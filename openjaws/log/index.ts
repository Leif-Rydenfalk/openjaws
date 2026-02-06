// log/typed-log-cell.ts - Type-safe logging cell
// This demonstrates a minimal but complete type-safe cell

import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_PATH = join(process.cwd(), "mesh_audit.log");

// ============================================================================
// CELL & ROUTER
// ============================================================================

const cell = new TypedRheoCell(`Logger_${process.pid}`, 0, process.argv[2]);

const logRouter = router({
    log: router({
        info: procedure
            .input(z.object({
                msg: z.string(),
                from: z.string()
            }))
            .mutation(async (input) => {
                const timestamp = new Date().toISOString();
                const logLine = `[${timestamp}] [${input.from}] ${input.msg}\n`;

                try {
                    appendFileSync(LOG_PATH, logLine);
                    cell.log("INFO", `📝 Logged: ${input.msg.substring(0, 30)}...`);

                    return {
                        ok: true,
                        timestamp
                    };
                } catch (e: any) {
                    cell.log("ERROR", `Failed to write log: ${e.message}`);
                    throw new Error("LOG_WRITE_FAILURE");
                }
            }),

        get: procedure
            .input(z.object({
                limit: z.optional(z.number())
            }))
            .query(async (input) => {
                try {
                    if (!existsSync(LOG_PATH)) {
                        return {
                            ok: true,
                            logs: [],
                            count: 0,
                            path: LOG_PATH
                        };
                    }

                    const limit = input.limit || 50;
                    const rawContent = readFileSync(LOG_PATH, 'utf8');

                    const lines = rawContent
                        .split('\n')
                        .filter(line => line.trim().length > 0)
                        .slice(-limit);

                    return {
                        ok: true,
                        logs: lines,
                        count: lines.length,
                        path: LOG_PATH
                    };
                } catch (e: any) {
                    return {
                        ok: false,
                        error: e.message,
                        logs: [],
                        count: 0,
                        path: LOG_PATH
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
        "log/info": {
            input: {
                msg: string;
                from: string;
            };
            output: {
                ok: boolean;
                timestamp: string;
            };
        };

        "log/get": {
            input: {
                limit?: number;
            };
            output: {
                ok: boolean;
                logs: string[];
                count: number;
                path: string;
                error?: string;
            };
        };
    }
}

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(logRouter);
cell.listen();

cell.log("INFO", "🛡️ Type-safe Logger cell initialized");
cell.log("INFO", `Audit trail: ${LOG_PATH}`);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LogRouter = typeof logRouter;
export { cell as logCell };