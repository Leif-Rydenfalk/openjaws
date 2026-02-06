// checklist/typed-checklist-cell.ts - Type-safe checklist with cross-cell calls

import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// DATA LAYER
// ============================================================================

const MAX_ITEMS = 5;
const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

interface ListItem {
    id: string;
    text: string;
    completed: boolean;
    type: 'task' | 'idea';
    createdAt: number;
}

function getTodayPath() {
    const date = new Date().toISOString().split('T')[0];
    return join(DATA_DIR, `${date}.json`);
}

function loadDailyData(): ListItem[] {
    const path = getTodayPath();
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
    return [];
}

function saveDailyData(data: ListItem[]) {
    writeFileSync(getTodayPath(), JSON.stringify(data, null, 2));
}

// ============================================================================
// CELL INITIALIZATION
// ============================================================================

const cell = new TypedRheoCell(`Checklist_${process.pid}`, 0, process.argv[2]);

// ============================================================================
// TYPED ROUTER DEFINITION
// ============================================================================

const checklistRouter = router({
    list: router({
        get: procedure.query(async () => {
            return {
                items: loadDailyData(),
                capacity: MAX_ITEMS,
                date: new Date().toISOString().split('T')[0]
            };
        }),

        add: procedure
            .input(z.object({
                text: z.string(),
                type: z.enum(['task', 'idea'] as const)
            }))
            .mutation(async (input) => {
                const items = loadDailyData();
                const activeTasks = items.filter(i => i.type === 'task' && !i.completed);

                if (input.type === 'task' && activeTasks.length >= MAX_ITEMS) {
                    throw new Error(
                        `KAPACITET_NÅDD: Du har redan ${MAX_ITEMS} aktiva uppgifter. ` +
                        `Slutför något för att skapa momentum!`
                    );
                }

                const newItem: ListItem = {
                    id: Math.random().toString(36).substring(7),
                    text: input.text,
                    completed: false,
                    type: input.type,
                    createdAt: Date.now()
                };

                items.push(newItem);
                saveDailyData(items);

                // ✅ TYPE-SAFE CROSS-CELL CALL
                // This demonstrates calling the log cell with full type safety
                try {
                    await cell.mesh.log.info({
                        msg: `➕ Added ${input.type}: ${input.text}`,
                        from: cell.id
                    });
                } catch (e) {
                    // Log cell might not be available - that's ok
                    cell.log("INFO", `➕ Added ${input.type}: ${input.text}`);
                }

                return { ok: true, item: newItem };
            }),

        complete: procedure
            .input(z.object({
                id: z.string()
            }))
            .mutation(async (input) => {
                const items = loadDailyData();
                const item = items.find(i => i.id === input.id);

                if (!item) {
                    throw new Error("Hittade inte objektet.");
                }

                item.completed = true;
                saveDailyData(items);

                // ✅ TYPE-SAFE CROSS-CELL CALL
                try {
                    await cell.mesh.log.info({
                        msg: `✅ Completed: ${item.text}`,
                        from: cell.id
                    });
                } catch (e) {
                    cell.log("INFO", `✅ Completed: ${item.text}`);
                }

                return { ok: true, momentum: "plus_one" as const };
            }),

        summarize: procedure.mutation(async () => {
            const items = loadDailyData();
            const completed = items.filter(i => i.completed).map(i => i.text);
            const pending = items.filter(i => !i.completed && i.type === 'task').map(i => i.text);
            const ideas = items.filter(i => i.type === 'idea').map(i => i.text);

            const prompt = `Sammanfatta min dag kortfattat. 
                Klarade av: ${completed.join(", ")}. 
                Missade: ${pending.join(", ")}. 
                Nya idéer: ${ideas.join(", ")}.
                Ge mig feedback för att bibehålla momentum imorgon.`;

            // ✅ TYPE-SAFE CROSS-CELL CALL to AI
            // The return type is automatically inferred from ai/generate's output type
            try {
                const aiResponse = await cell.mesh.ai.generate({ prompt });

                // aiResponse is typed as { model: string, response: string, done: boolean }
                return {
                    summary: aiResponse.response,
                    generatedBy: aiResponse.model
                };
            } catch (e) {
                return {
                    summary: "AI unavailable, but great work today!",
                    generatedBy: "fallback"
                };
            }
        }),

        // New: AI-enhanced task suggestions
        'suggest-tasks': procedure
            .input(z.object({
                context: z.optional(z.string())
            }))
            .mutation(async (input) => {
                const items = loadDailyData();
                const completedToday = items.filter(i => i.completed).map(i => i.text);

                const prompt = `Based on these completed tasks: ${completedToday.join(", ")}.
                    ${input.context ? `Context: ${input.context}.` : ""}
                    Suggest 3 logical next tasks to maintain momentum.
                    Format: Just list the 3 tasks, one per line.`;

                // ✅ TYPE-SAFE AI CALL
                const aiResponse = await cell.mesh.ai.generate({ prompt });

                const suggestions = aiResponse.response
                    .split('\n')
                    .filter(line => line.trim())
                    .slice(0, 3);

                return {
                    suggestions,
                    basedOn: completedToday.length
                };
            })
    })
});

// ============================================================================
// TYPE AUGMENTATION
// ============================================================================

declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        "list/get": {
            input: void;
            output: {
                items: Array<{
                    id: string;
                    text: string;
                    completed: boolean;
                    type: 'task' | 'idea';
                    createdAt: number;
                }>;
                capacity: number;
                date: string;
            };
        };

        "list/add": {
            input: {
                text: string;
                type: 'task' | 'idea';
            };
            output: {
                ok: boolean;
                item: {
                    id: string;
                    text: string;
                    completed: boolean;
                    type: 'task' | 'idea';
                    createdAt: number;
                };
            };
        };

        "list/complete": {
            input: {
                id: string;
            };
            output: {
                ok: boolean;
                momentum: "plus_one";
            };
        };

        "list/summarize": {
            input: void;
            output: {
                summary: string;
                generatedBy: string;
            };
        };

        "list/suggest-tasks": {
            input: {
                context?: string;
            };
            output: {
                suggestions: string[];
                basedOn: number;
            };
        };
    }
}

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(checklistRouter);
cell.listen();

cell.log("INFO", "📋 Type-safe Checklist cell initialized");

// ============================================================================
// DEMONSTRATION OF TYPE SAFETY
// ============================================================================

async function demonstrateTypeSafety() {
    try {
        // ✅ Calling our own capabilities
        const list = await cell.mesh.list.get();
        console.log(`Current list has ${list.items.length} items`);

        // ✅ Calling other cells with full type safety
        const health = await cell.mesh.mesh.health();
        console.log(`Mesh health: ${health.status}, ${health.totalCells} cells`);

        // ✅ AI integration with type safety
        if (list.items.length > 0) {
            const suggestions = await cell.mesh.list['suggest-tasks']({
                context: "Focus on productivity"
            });
            console.log(`AI suggested ${suggestions.suggestions.length} next tasks`);
        }

        // ❌ These would all be compile errors:
        // await cell.mesh.list.get({ wrongParam: true }); // get expects void
        // await cell.mesh.list.add({ text: 123 }); // text must be string
        // await cell.mesh.nonexistent.method(); // namespace doesn't exist

    } catch (e) {
        console.error("Demo error:", e);
    }
}

// Run demo after mesh stabilizes
setTimeout(demonstrateTypeSafety, 6000);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ChecklistRouter = typeof checklistRouter;
export { cell as checklistCell };