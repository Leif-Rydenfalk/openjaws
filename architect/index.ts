import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`Architect_${process.pid}`, 0);

const architectRouter = router({
    architect: router({
        // The "Brain" of the company
        consult: procedure
            .input(z.object({
                goal: z.string(),
                execute: z.optional(z.boolean())
            }))
            .mutation(async (input) => {
                // 1. READ THE ACTUAL CODEBASE
                const relevantFiles = [
                    "ui/src/routes/+page.svelte",
                    "ui/src/routes/+layout.svelte",
                    "ui/tailwind.config.ts",
                    "ui/src/app.css"
                ];

                let codeContext = "";
                for (const file of relevantFiles) {
                    try {
                        const content = await cell.mesh.projects.read({ path: file });
                        codeContext += `\n=== ${file} ===\n${content.content}\n`;
                    } catch (e) {
                        // File might not exist
                    }
                }

                // 2. SEARCH MEMORY FOR PREVIOUS CONTEXT
                const pastPlans = await cell.mesh.memory.search({
                    query: `plan for ${input.goal}`,
                    limit: 3
                }).catch(() => []);

                // 3. BUILD INFORMED PROMPT
                const prompt = `
        OBJECTIVE: ${input.goal}
        
        CURRENT CODEBASE STATE:
        ${codeContext}
        
        PREVIOUS_ATTEMPTS_FROM_MEMORY:
        ${pastPlans.map(p => p.content).join('\n---\n')}

        TASK: Create a CONCRETE execution plan based on the ACTUAL codebase above.
        - Reference specific files and line numbers
        - Identify what already exists vs what needs to be created
        - Specify which mesh cells to use (coder, projects, checklist)
        - Break down into executable steps
        `;

                const aiRes = await cell.mesh.ai.generate({
                    prompt,
                    systemInstruction: `You are analyzing a real codebase. Base your plan ONLY on what you can see in the files provided. Do not hallucinate features that don't exist.`
                });

                // Store the plan
                await cell.mesh.memory.store({
                    content: `Goal: ${input.goal} | Files analyzed: ${relevantFiles.join(', ')} | Plan: ${aiRes.response}`,
                    tags: ["architect", "planning", input.goal.substring(0, 10)]
                });

                // Execute if requested
                let tasksCreated = 0;
                if (input.execute) {
                    const lines = aiRes.response.split('\n');
                    for (const line of lines) {
                        if (line.trim().match(/^[1-9]\.|^-|^\*\s/)) {
                            try {
                                await cell.mesh.list.add({
                                    text: line.replace(/^[0-9.\-*]+\s*/, '').trim(),
                                    type: 'task'
                                });
                                tasksCreated++;
                            } catch (e) { }
                        }
                    }
                }

                return {
                    plan: aiRes.response,
                    contextUsed: relevantFiles,
                    tasksCreated
                };
            })
    })
});

cell.useRouter(architectRouter);
cell.listen();