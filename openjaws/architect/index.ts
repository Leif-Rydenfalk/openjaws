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
                // 1. SEARCH FOR PREVIOUS PLANS
                const pastPlans = await cell.mesh.memory.search({
                    query: `plan for ${input.goal}`,
                    limit: 3
                }).catch(() => []);

                // 2. BUILD THE PROMPT
                const prompt = `
                OBJECTIVE: ${input.goal}
                
                PREVIOUS_ATTEMPTS_FROM_MEMORY:
                ${pastPlans.map(p => p.content).join('\n---\n')}

                TASK: Create a technical execution plan for the OpenJaws Mesh.
                Specify which cells (coder, projects, list) should be used.
                `;

                const aiRes = await cell.mesh.ai.generate({
                    prompt,
                    systemInstruction: "You are the Lead Mesh Architect. Focus on modularity and type-safety."
                });

                // 3. STORE THE NEW PLAN IN MEMORY
                await cell.mesh.memory.store({
                    content: `Goal: ${input.goal} | Plan: ${aiRes.response}`,
                    tags: ["architect", "planning", input.goal.substring(0, 10)]
                });

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