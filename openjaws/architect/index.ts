import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`Architect_${process.pid}`, 0);

const architectRouter = router({
    architect: router({
        // The "Brain" of the company
        consult: procedure
            .input(z.object({
                goal: z.string(),
                execute: z.optional(z.boolean()) // If true, actually adds tasks
            }))
            .output(z.object({
                plan: z.string(),
                contextUsed: z.array(z.string()),
                tasksCreated: z.number()
            }))
            .mutation(async (input) => {
                // 1. Retrieve Context from Memory
                let context: any[] = [];
                try {
                    context = await cell.mesh.memory.search({ query: input.goal });
                } catch (e) { console.warn("Memory offline"); }

                const contextStr = context.map(c => c.content).join("\n- ");

                // 2. Synthesize Plan via AI
                const prompt = `
                    ROLE: You are the Chief Architect of this company.
                    GOAL: ${input.goal}
                    
                    COMPANY CONTEXT:
                    ${contextStr || "No specific memory found."}
                    
                    INSTRUCTIONS:
                    Create a concrete, 3-step execution plan.
                    If the goal is actionable, output tasks clearly.
                `;

                const aiRes = await cell.mesh.ai.generate({ prompt, model: "llama3" });

                // 3. (Optional) Execute by adding to Checklist
                let tasksCreated = 0;
                if (input.execute) {
                    const lines = aiRes.response.split('\n');
                    for (const line of lines) {
                        if (line.trim().match(/^[1-9]\.|^-/)) {
                            // It looks like a task
                            try {
                                await cell.mesh.list.add({
                                    text: line.replace(/^[0-9.-]+\s*/, ''),
                                    type: 'task'
                                });
                                tasksCreated++;
                            } catch (e) { }
                        }
                    }
                }

                return {
                    plan: aiRes.response,
                    contextUsed: context.map(c => c.content),
                    tasksCreated
                };
            })
    })
});

cell.useRouter(architectRouter);
cell.listen();