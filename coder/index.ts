import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`Coder_${process.pid}`, 0);

const coderRouter = router({
    coder: router({
        develop: procedure
            .input(z.object({ task: z.string(), fileName: z.string() }))
            .mutation(async ({ task, fileName }) => {
                // 1. Ask AI to write the code
                const aiRes = await cell.mesh.ai.generate({
                    prompt: `Write code for this task: ${task}. Output ONLY the code, no markdown blocks.`,
                    systemInstruction: "You are a senior TypeScript developer. You output clean, efficient code."
                });

                // 2. Use Projects cell to save it
                await cell.mesh.projects.write({
                    path: fileName,
                    content: aiRes.response
                });

                // 3. Try to run it (if it's a script)
                let runResult = "Not executed";
                if (fileName.endsWith(".ts") || fileName.endsWith(".js")) {
                    const exec = await cell.mesh.projects.exec({
                        command: "bun",
                        args: [fileName]
                    });
                    runResult = exec.stdout || exec.stderr;
                }

                return {
                    file: fileName,
                    output: runResult,
                    status: "completed"
                };
            })
    })
});

cell.useRouter(coderRouter);
cell.listen();