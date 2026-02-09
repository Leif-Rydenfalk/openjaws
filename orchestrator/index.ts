import { RheoCell } from "../protocols/example1/core";
import { spawn } from "node:child_process";
import { unlinkSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, createWriteStream } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { config } from "dotenv";

// 1. Load Environment
const ROOT_DIR = resolve(import.meta.dir, "..");
config({ path: join(ROOT_DIR, ".env") });

const LOG_DIR = join(ROOT_DIR, ".rheo", "logs");
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const PID_REGISTRY = ".rheo_pids";

// 2. State & Colors
const children = new Map<string, number>();
let orchestratorCell: RheoCell | null = null;
let shuttingDown = false;

const COLORS = ["\x1b[32m", "\x1b[33m", "\x1b[34m", "\x1b[35m", "\x1b[36m", "\x1b[38;5;208m"];
let colorIdx = 0;
const cellColors = new Map<string, string>();

// 3. Blueprint Discovery
interface Blueprint {
    id: string; command: string; path: string; critical: boolean; env: any;
}

function parseToml(content: string): any {
    const result: any = { env: {} };
    let target = result;
    content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        if (trimmed === "[env]") { target = result.env; return; }
        const [key, ...rest] = trimmed.split("=");
        if (rest.length > 0) {
            const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
            target[key.trim()] = val === "true" ? true : val === "false" ? false : val;
        }
    });
    return result;
}

function discoverBlueprints(): Blueprint[] {
    const blueprints: Blueprint[] = [];
    readdirSync(ROOT_DIR).forEach(entry => {
        const tomlPath = join(ROOT_DIR, entry, "Cell.toml");
        if (existsSync(tomlPath)) {
            const p = parseToml(readFileSync(tomlPath, "utf8"));
            blueprints.push({ id: p.id, command: p.command, path: join(ROOT_DIR, entry), critical: p.critical, env: p.env });
        }
    });
    return blueprints;
}

// 4. Unified Logging & Spawning
async function spawnCell(blueprint: Blueprint) {
    if (shuttingDown) return;

    const instanceId = blueprint.id;
    const logFilePath = join(LOG_DIR, `${blueprint.id}.log`);
    const auditFilePath = join(LOG_DIR, `mesh.audit.log`);

    const fileStream = createWriteStream(logFilePath, { flags: 'a' });
    const auditStream = createWriteStream(auditFilePath, { flags: 'a' });

    if (!cellColors.has(blueprint.id)) {
        cellColors.set(blueprint.id, COLORS[colorIdx % COLORS.length]);
        colorIdx++;
    }
    const color = cellColors.get(blueprint.id);

    const [cmd, ...args] = blueprint.command.split(" ");

    const proc = spawn(cmd, args, {
        cwd: blueprint.path,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
            ...process.env,
            ...blueprint.env,
            RHEO_CELL_ID: instanceId,
            RHEO_DISABLE_GHOST_CLEANUP: "false"  // ADD THIS
        }
    });

    const handleData = (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (!line) return;
            const ts = new Date().toLocaleTimeString();
            console.log(`${color}[${ts}] [${blueprint.id}]\x1b[0m ${line}`);
            fileStream.write(`[${ts}] ${line}\n`);
            auditStream.write(`[${ts}] [${blueprint.id}] ${line}\n`);
        });
    };

    proc.stdout?.on('data', handleData);
    proc.stderr?.on('data', handleData);

    if (proc.pid) {
        children.set(instanceId, proc.pid);
        console.log(`📡 [Orchestrator] Online: ${blueprint.id} (PID: ${proc.pid})`);
    }

    proc.on('exit', (code) => {
        if (!shuttingDown) console.log(`\x1b[31m🚨 [Orchestrator] ${blueprint.id} DIED (Code: ${code})\x1b[0m`);
        fileStream.end();
        auditStream.end();
    });
}

// 5. Entry Point
orchestratorCell = new RheoCell(`Orchestrator_${process.pid}`, 0);
orchestratorCell.listen();

console.log(`🌌 Rheo Sovereign Mesh: Hard Reset & Ignition...`);

// Also kill any remaining .cell.json files in subdirectories one last time
readdirSync(ROOT_DIR).forEach(dir => {
    const fullDir = join(ROOT_DIR, dir);
    if (statSync(fullDir).isDirectory()) {
        readdirSync(fullDir).forEach(file => {
            if (file.endsWith(".cell.json")) unlinkSync(join(fullDir, file));
        });
    }
});


// Cleanup
const registryDir = join(ROOT_DIR, ".rheo", "registry");
if (existsSync(registryDir)) readdirSync(registryDir).forEach(f => unlinkSync(join(registryDir, f)));

const blueprints = discoverBlueprints();
blueprints.forEach(b => spawnCell(b));

process.on("SIGINT", async () => {
    shuttingDown = true;
    console.log("\n🛑 Extinguishing Mesh...");
    for (const pid of children.values()) try { process.kill(pid, "SIGKILL"); } catch (e) { }
    process.exit(0);
});

setInterval(async () => {
    if (shuttingDown) return;

    // Check specific cells, not broadcast
    for (const [cellId, entry] of Object.entries(orchestratorCell!.atlas)) {
        if (cellId === orchestratorCell!.id) continue;

        // Direct ping to specific address
        try {
            const res = await fetch(`${entry.addr}/atlas`, {
                signal: AbortSignal.timeout(2000)
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
        } catch {
            console.log(`💀 ${cellId} unreachable, removing from atlas`);
            delete orchestratorCell!.atlas[cellId];

            // Respawn if critical
            const blueprint = blueprints.find(b => b.id === cellId);
            if (blueprint?.critical) {
                console.log(`🚨 Respawning critical cell: ${cellId}`);
                spawnCell(blueprint);
            }
        }
    }
}, 10000);