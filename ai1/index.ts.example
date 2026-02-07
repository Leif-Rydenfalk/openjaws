// ai1/index.ts - Clean implementation with NO manual type declarations
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

// ============================================================================
// ROUTER DEFINITION (Source of truth for types)
// ============================================================================

const aiRouter = router({
    ai: router({
        generate: procedure
            .input(z.object({
                prompt: z.string(),
                model: z.optional(z.string())
            }))
            .output(z.object({
                model: z.string(),
                response: z.string(),
                done: z.boolean()
            }))
            .mutation(async (input) => {
                const model = input.model || "llama3";

                try {
                    const response = await fetch("http://localhost:11434/api/generate", {
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model,
                            prompt: input.prompt,
                            stream: false
                        }),
                        signal: AbortSignal.timeout(5000)
                    });

                    if (!response.ok) throw new Error("Ollama error");

                    return await response.json() as {
                        model: string;
                        response: string;
                        done: boolean;
                    };

                } catch (e) {
                    return {
                        model: "mock-llm",
                        response: `[MOCK] I heard you say: "${input.prompt}". ` +
                            `(To see real AI, start Ollama with '${model}')`,
                        done: true
                    };
                }
            }),

        // Additional capability: embeddings
        embed: procedure
            .input(z.object({
                text: z.string(),
                model: z.optional(z.string())
            }))
            .output(z.object({
                embedding: z.array(z.number()),
                model: z.string()
            }))
            .mutation(async (input) => {
                // Mock implementation
                return {
                    embedding: new Array(384).fill(0).map(() => Math.random()),
                    model: input.model || "nomic-embed-text"
                };
            })
    })
});

// ============================================================================
// CELL INITIALIZATION
// ============================================================================

const cell = new TypedRheoCell(`AI_${process.pid}`, 0, process.argv[2]);

// Register the router
cell.useRouter(aiRouter);

// Start listening
cell.listen();

cell.log("INFO", "🤖 Type-safe AI cell initialized");

// ============================================================================
// USAGE DEMONSTRATION
// ============================================================================

// This demonstrates type-safe inter-cell communication
async function demonstrateTypeSafety() {
    await new Promise(r => setTimeout(r, 10000)); // Wait for mesh

    try {
        // ✅ This is fully typed - IDE will autocomplete and type-check
        const result = await cell.mesh.ai.generate({
            prompt: "What is the meaning of life?"
        });

        // result is typed as { model: string, response: string, done: boolean }
        console.log(`AI Response: ${result.response}`);

        // ✅ Optional parameters work
        const withModel = await cell.mesh.ai.generate({
            prompt: "Hello",
            model: "llama3"
        });

        // ❌ This would be a compile error - wrong property name
        // await cell.mesh.ai.generate({ prmpt: "typo" });

        // ❌ This would be a compile error - capability doesn't exist
        // await cell.mesh.ai.nonexistent({ });

        // ✅ Can call other cells with full type safety
        const health = await cell.mesh.mesh.health();
        console.log(`Mesh has ${health.totalCells} cells`);
    } catch (e) {
        console.log("Demo waiting for mesh convergence...");
    }
}

// Run demonstration after mesh stabilizes
setTimeout(demonstrateTypeSafety, 12000);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AiRouter = typeof aiRouter;
export { cell as aiCell };