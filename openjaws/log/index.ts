import { RheoCell } from "../protocols/example1";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// 1. Initialisering
const seed = process.argv[2];
const cell = new RheoCell(`Logger_${process.pid}`, 0, seed);

// Sökväg till den fysiska audit-loggen
const LOG_PATH = join(process.cwd(), "mesh_audit.log");

/**
 * CAPABILITY: log/info
 * Sparar en händelse permanent till disk.
 * Args: { msg: string, from: string }
 */
cell.provide("log/info", async (args: { msg: string, from: string }) => {
    const timestamp = new Date().toISOString();
    const origin = args.from || "UNKNOWN_SOURCE";
    const message = args.msg || "Empty signal received";

    const logLine = `[${timestamp}] [${origin}] ${message}\n`;

    try {
        appendFileSync(LOG_PATH, logLine);
        cell.log("INFO", `📝 Audit Logged: ${message.substring(0, 30)}...`);
        return { ok: true, timestamp };
    } catch (e: any) {
        cell.log("ERROR", `Failed to write to audit log: ${e.message}`);
        throw new Error("LOG_WRITE_FAILURE");
    }
});

/**
 * CAPABILITY: log/get
 * Hämtar de senaste raderna från audit-loggen för visning i UI.
 * Args: { limit?: number }
 */
cell.provide("log/get", async (args: { limit?: number }) => {
    try {
        if (!existsSync(LOG_PATH)) {
            return { ok: true, logs: ["// LOG_STREAM_EMPTY: Ingen historik hittades."] };
        }

        const limit = args.limit || 50;
        const rawContent = readFileSync(LOG_PATH, 'utf8');

        // Dela upp i rader, rensa tomma rader och hämta de senaste
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
            error: { code: "READ_ERROR", msg: e.message }
        };
    }
});

/**
 * CAPABILITY: cell/inspect (Override för extra info)
 */
cell.provide("cell/inspect", () => {
    return {
        id: cell.id,
        type: "AUDIT_LOGGER",
        status: "ACTIVE",
        logFile: LOG_PATH,
        uptime: process.uptime()
    };
});

// Starta lyssnaren
cell.listen();

cell.log("INFO", "🛡️  Logger Cell initialized. Audit stream redirected to: " + LOG_PATH);