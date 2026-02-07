import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const WORKSPACE = resolve(process.env.PROJECT_ROOT || "./ai_workspace");
if (!existsSync(WORKSPACE)) mkdirSync(WORKSPACE, { recursive: true });

const cell = new TypedRheoCell(`Projects_${process.pid}`, 0);

const projectsRouter = router({
    projects: router({
        write: procedure
            .input(z.object({ path: z.string(), content: z.string() }))
            .meta({ description: "Write a file to the workspace", example: { path: "hello.ts", content: "console.log('hi')" } })
            .mutation(async ({ path, content }) => {
                const fullPath = join(WORKSPACE, path);
                mkdirSync(resolve(fullPath, ".."), { recursive: true });
                writeFileSync(fullPath, content);
                return { ok: true, path: fullPath };
            }),

        read: procedure
            .input(z.object({ path: z.string() }))
            .meta({ description: "Read a file from the workspace" })
            .query(async ({ path }) => {
                return { content: readFileSync(join(WORKSPACE, path), "utf8") };
            }),

        list: procedure
            .input(z.object({ path: z.string().optional() }))
            .query(async ({ path = "." }) => {
                return { files: readdirSync(join(WORKSPACE, path)) };
            }),

        exec: procedure
            .input(z.object({ command: z.string(), args: z.array(z.string()) }))
            .meta({ description: "Execute a command in the workspace", example: { command: "bun", args: ["--version"] } })
            .mutation(async ({ command, args }) => {
                const result = spawnSync(command, args, { cwd: WORKSPACE, encoding: "utf8" });
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.status
                };
            })
    })
});

cell.useRouter(projectsRouter);
cell.listen();