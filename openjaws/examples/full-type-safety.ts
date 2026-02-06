// examples/full-type-safety-demo.ts
// This file demonstrates all aspects of the type-safe mesh system

import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

/**
 * EXAMPLE CELL: Recipe Manager
 * Demonstrates:
 * - Type-safe router definition
 * - Cross-cell calls (to AI and Log)
 * - Type augmentation
 * - Error handling
 */

// ============================================================================
// DATA TYPES
// ============================================================================

interface Recipe {
    id: string;
    name: string;
    ingredients: string[];
    steps: string[];
    cuisine: "italian" | "mexican" | "japanese" | "american";
    prepTime: number; // minutes
    createdAt: number;
}

const recipes: Recipe[] = [];

// ============================================================================
// CELL INITIALIZATION
// ============================================================================

const cell = new TypedRheoCell(`RecipeManager_${process.pid}`, 0, process.argv[2]);

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

const recipeRouter = router({
    recipes: router({
        /**
         * List all recipes
         */
        list: procedure.query(async () => {
            return {
                recipes,
                total: recipes.length
            };
        }),

        /**
         * Get a specific recipe
         */
        get: procedure
            .input(z.object({
                id: z.string()
            }))
            .query(async (input) => {
                const recipe = recipes.find(r => r.id === input.id);

                if (!recipe) {
                    throw new Error(`Recipe ${input.id} not found`);
                }

                return recipe;
            }),

        /**
         * Create a new recipe
         */
        create: procedure
            .input(z.object({
                name: z.string(),
                ingredients: z.array(z.string()),
                steps: z.array(z.string()),
                cuisine: z.enum(["italian", "mexican", "japanese", "american"]),
                prepTime: z.number()
            }))
            .mutation(async (input) => {
                const newRecipe: Recipe = {
                    id: Math.random().toString(36).substring(7),
                    ...input,
                    createdAt: Date.now()
                };

                recipes.push(newRecipe);

                // ✅ TYPE-SAFE CROSS-CELL CALL TO LOG
                try {
                    await cell.mesh.log.info({
                        msg: `Created recipe: ${newRecipe.name}`,
                        from: cell.id
                    });
                } catch (e) {
                    // Log cell might not be available
                    cell.log("INFO", `Created recipe: ${newRecipe.name}`);
                }

                return {
                    ok: true,
                    recipe: newRecipe
                };
            }),

        /**
         * Generate recipe variations using AI
         */
        'suggest-variations': procedure
            .input(z.object({
                recipeId: z.string(),
                dietaryRestrictions: z.optional(z.array(z.string()))
            }))
            .mutation(async (input) => {
                const recipe = recipes.find(r => r.id === input.recipeId);

                if (!recipe) {
                    throw new Error("Recipe not found");
                }

                // ✅ TYPE-SAFE CROSS-CELL CALL TO AI
                const prompt = `Given this recipe:
                    Name: ${recipe.name}
                    Ingredients: ${recipe.ingredients.join(", ")}
                    Cuisine: ${recipe.cuisine}
                    
                    ${input.dietaryRestrictions ? `Dietary restrictions: ${input.dietaryRestrictions.join(", ")}` : ""}
                    
                    Suggest 3 creative variations. Format: Just list the variations with ingredients.`;

                try {
                    const aiResponse = await cell.mesh.ai.generate({ prompt });

                    // aiResponse is typed as { model: string, response: string, done: boolean }
                    const variations = aiResponse.response
                        .split('\n\n')
                        .filter(v => v.trim())
                        .slice(0, 3);

                    return {
                        baseRecipe: recipe.name,
                        variations,
                        generatedBy: aiResponse.model
                    };

                } catch (e) {
                    return {
                        baseRecipe: recipe.name,
                        variations: [
                            "Add lemon zest for brightness",
                            "Swap proteins for a different take",
                            "Make it spicy with chili peppers"
                        ],
                        generatedBy: "fallback"
                    };
                }
            }),

        /**
         * Get recipes by cuisine
         */
        'by-cuisine': procedure
            .input(z.object({
                cuisine: z.enum(["italian", "mexican", "japanese", "american"])
            }))
            .query(async (input) => {
                const filtered = recipes.filter(r => r.cuisine === input.cuisine);

                return {
                    cuisine: input.cuisine,
                    recipes: filtered,
                    count: filtered.length
                };
            }),

        /**
         * Get cooking summary for the day
         */
        'daily-summary': procedure.mutation(async () => {
            const today = new Date().toISOString().split('T')[0];
            const todayRecipes = recipes.filter(r => {
                const recipeDate = new Date(r.createdAt).toISOString().split('T')[0];
                return recipeDate === today;
            });

            if (todayRecipes.length === 0) {
                return {
                    summary: "No cooking today! Time to explore new recipes.",
                    recipesCount: 0
                };
            }

            // ✅ CROSS-CELL COMPOSITION: Recipes -> AI -> Log
            const prompt = `I cooked these recipes today: ${todayRecipes.map(r => r.name).join(", ")}. Give me a short, encouraging summary about my cooking journey.`;

            try {
                const aiResponse = await cell.mesh.ai.generate({ prompt });

                // Log the summary
                await cell.mesh.log.info({
                    msg: `Daily cooking summary generated: ${todayRecipes.length} recipes`,
                    from: cell.id
                });

                return {
                    summary: aiResponse.response,
                    recipesCount: todayRecipes.length,
                    recipes: todayRecipes.map(r => r.name)
                };

            } catch (e) {
                return {
                    summary: `Great work! You cooked ${todayRecipes.length} recipes today.`,
                    recipesCount: todayRecipes.length,
                    recipes: todayRecipes.map(r => r.name)
                };
            }
        })
    })
});

// ============================================================================
// TYPE AUGMENTATION
// ============================================================================

declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        "recipes/list": {
            input: void;
            output: {
                recipes: Recipe[];
                total: number;
            };
        };

        "recipes/get": {
            input: {
                id: string;
            };
            output: Recipe;
        };

        "recipes/create": {
            input: {
                name: string;
                ingredients: string[];
                steps: string[];
                cuisine: "italian" | "mexican" | "japanese" | "american";
                prepTime: number;
            };
            output: {
                ok: boolean;
                recipe: Recipe;
            };
        };

        "recipes/suggest-variations": {
            input: {
                recipeId: string;
                dietaryRestrictions?: string[];
            };
            output: {
                baseRecipe: string;
                variations: string[];
                generatedBy: string;
            };
        };

        "recipes/by-cuisine": {
            input: {
                cuisine: "italian" | "mexican" | "japanese" | "american";
            };
            output: {
                cuisine: string;
                recipes: Recipe[];
                count: number;
            };
        };

        "recipes/daily-summary": {
            input: void;
            output: {
                summary: string;
                recipesCount: number;
                recipes?: string[];
            };
        };
    }
}

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(recipeRouter);
cell.listen();

cell.log("INFO", "🍳 Recipe Manager cell initialized");

// ============================================================================
// DEMONSTRATION
// ============================================================================

async function demonstrateTypeSystem() {
    await new Promise(resolve => setTimeout(resolve, 8000)); // Wait for mesh

    cell.log("INFO", "🎯 Starting type safety demonstration...");

    try {
        // 1. Create a recipe
        cell.log("INFO", "Step 1: Creating a recipe...");
        const created = await cell.mesh.recipes.create({
            name: "Spaghetti Carbonara",
            ingredients: ["spaghetti", "eggs", "pancetta", "pecorino", "black pepper"],
            steps: [
                "Boil pasta",
                "Fry pancetta",
                "Mix eggs and cheese",
                "Combine everything"
            ],
            cuisine: "italian",
            prepTime: 20
        });

        cell.log("INFO", `✅ Created recipe: ${created.recipe.name} (ID: ${created.recipe.id})`);

        // 2. Get AI suggestions
        cell.log("INFO", "Step 2: Getting AI variations...");
        const variations = await cell.mesh.recipes['suggest-variations']({
            recipeId: created.recipe.id,
            dietaryRestrictions: ["vegetarian"]
        });

        cell.log("INFO", `✅ Got ${variations.variations.length} variations from ${variations.generatedBy}`);

        // 3. Create another recipe
        await cell.mesh.recipes.create({
            name: "Tacos al Pastor",
            ingredients: ["pork", "pineapple", "tortillas", "cilantro", "onion"],
            steps: ["Marinate pork", "Grill", "Assemble tacos"],
            cuisine: "mexican",
            prepTime: 45
        });

        // 4. Get cuisine-specific recipes
        cell.log("INFO", "Step 3: Filtering by cuisine...");
        const italian = await cell.mesh.recipes['by-cuisine']({ cuisine: "italian" });
        cell.log("INFO", `✅ Found ${italian.count} Italian recipes`);

        // 5. Get daily summary
        cell.log("INFO", "Step 4: Generating daily summary...");
        const summary = await cell.mesh.recipes['daily-summary']();
        cell.log("INFO", `✅ Summary: ${summary.summary.substring(0, 50)}...`);

        // 6. Check logs
        cell.log("INFO", "Step 5: Checking audit logs...");
        const logs = await cell.mesh.log.get({ limit: 5 });
        cell.log("INFO", `✅ Found ${logs.count} recent log entries`);

        // 7. Check mesh health
        cell.log("INFO", "Step 6: Checking mesh health...");
        const health = await cell.mesh.mesh.health();
        cell.log("INFO", `✅ Mesh status: ${health.status}, ${health.totalCells} cells online`);

        cell.log("INFO", "🎉 Type safety demonstration complete!");

        // These would all be COMPILE ERRORS:
        // await cell.mesh.recipes.create({ name: 123 }); // name must be string
        // await cell.mesh.recipes.create({ cuisine: "french" }); // not in enum
        // await cell.mesh.nonexistent.method(); // namespace doesn't exist
        // await cell.mesh.ai.generate({ prmpt: "typo" }); // wrong property name

    } catch (e) {
        cell.log("ERROR", `Demo failed: ${e}`);
    }
}

// Run demonstration
demonstrateTypeSystem();

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RecipeRouter = typeof recipeRouter;
export { cell as recipeCell };
export type { Recipe };