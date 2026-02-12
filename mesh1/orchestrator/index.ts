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


const cellDeaths = new Map<string, { code: number | null; signal: string | null; time: string }>();



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

function cleanupAllZombies() {
    console.log("🧹 Sweeping for zombie cells...");
    const manifestDir = join(ROOT_DIR, ".rheo", "manifests");

    if (existsSync(manifestDir)) {
        readdirSync(manifestDir).forEach(file => {
            if (file.endsWith(".json")) {
                try {
                    const path = join(manifestDir, file);
                    const manifest = JSON.parse(readFileSync(path, "utf8"));
                    if (manifest.pid && manifest.pid !== process.pid) {
                        try {
                            process.kill(manifest.pid, 0); // Check if exists
                            process.kill(manifest.pid, "SIGKILL");
                            console.log(`  💀 Killed ghost cell: ${manifest.id} (PID: ${manifest.pid})`);
                        } catch (e) {
                            // Already dead
                        }
                    }
                    unlinkSync(path); // Remove stale manifest
                } catch (e) { }
            }
        });
    }
    // Also clear the registry so dead cells don't stay in the Atlas
    const registryDir = join(ROOT_DIR, ".rheo", "registry");
    if (existsSync(registryDir)) {
        readdirSync(registryDir).forEach(f => {
            try { unlinkSync(join(registryDir, f)); } catch (e) { }
        });
    }
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
            RHEO_DISABLE_GHOST_CLEANUP: "false",
            RHEO_SEED: orchestratorCell?.addr || ""  // FIXED: Pass orchestrator as seed
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

    proc.on('exit', (code, signal) => {
        const deathInfo = { code, signal, time: new Date().toLocaleTimeString() };
        cellDeaths.set(instanceId, deathInfo);

        const emoji = signal === 'SIGKILL' ? '💥' : signal ? '🔪' : code === 0 ? '✅' : '❌';
        const reason = signal ? `by ${signal}` : code !== null ? `code ${code}` : 'unknown';

        console.log(`${emoji} [Orchestrator] ${blueprint.id} DIED (${reason}) at ${deathInfo.time}`);

        if (!shuttingDown && code !== 0 && code !== null) {
            console.log(`\x1b[31m🚨 [Orchestrator] ${blueprint.id} CRASHED - will respawn if critical\x1b[0m`);

            if (blueprint.critical) {
                console.log(`\x1b[33m🔄 [Orchestrator] Respawning critical cell: ${blueprint.id}\x1b[0m`);
                setTimeout(() => spawnCell(blueprint), 1000);
            }
        }

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

cleanupAllZombies();

const blueprints = discoverBlueprints();
blueprints.forEach(b => spawnCell(b));

process.on("SIGINT", async () => {
    shuttingDown = true;
    console.log("\n🛑 EXTINGUISHING MESH - INITIATING ORDERLY SHUTDOWN");
    console.log("=".repeat(60));

    const shutdownResults = [];
    const aliveAtEnd = [];

    // Phase 1: Graceful shutdown via mesh
    console.log("\n📡 Phase 1: Sending graceful shutdown signals...");
    for (const [cellId, pid] of children.entries()) {
        try {
            // Try mesh shutdown first
            const result = await orchestratorCell!.askMesh("cell/shutdown" as any, {});
            shutdownResults.push({ cellId, pid, method: "mesh", ok: result.ok });
            console.log(`  ✅ ${cellId} (PID:${pid}) - graceful shutdown acknowledged`);
        } catch (e: any) {
            shutdownResults.push({ cellId, pid, method: "mesh", ok: false, error: e.message });
            console.log(`  ⚠️  ${cellId} (PID:${pid}) - mesh shutdown failed: ${e.message}`);
        }
    }

    // Phase 2: Wait for natural death
    console.log("\n⏳ Phase 2: Waiting 2s for cells to terminate...");
    await new Promise(r => setTimeout(r, 2000));

    // Phase 3: Check who's still alive and SIGTERM
    console.log("\n🔪 Phase 3: SIGTERM remaining processes...");
    for (const [cellId, pid] of children.entries()) {
        try {
            // Check if process exists
            process.kill(pid, 0); // Signal 0 checks existence
            // Still alive, SIGTERM
            process.kill(pid, "SIGTERM");
            console.log(`  🔪 ${cellId} (PID:${pid}) - SIGTERM sent`);
            shutdownResults.push({ cellId, pid, method: "sigterm", ok: true });
        } catch (e: any) {
            // Process already dead
            console.log(`  💀 ${cellId} (PID:${pid}) - already terminated`);
        }
    }

    // Phase 4: Wait and SIGKILL stragglers
    console.log("\n⏳ Phase 4: Waiting 1s for SIGTERM...");
    await new Promise(r => setTimeout(r, 1000));

    console.log("\n💥 Phase 5: SIGKILL any remaining...");
    for (const [cellId, pid] of children.entries()) {
        try {
            process.kill(pid, 0); // Still exists?
            process.kill(pid, "SIGKILL");
            console.log(`  💥 ${cellId} (PID:${pid}) - SIGKILL sent`);
            shutdownResults.push({ cellId, pid, method: "sigkill", ok: true });

            // Give it a moment then check
            await new Promise(r => setTimeout(r, 100));
            try {
                process.kill(pid, 0);
                aliveAtEnd.push({ cellId, pid, status: "UNDEAD - SIGKILL FAILED" });
                console.log(`  🚨 ${cellId} (PID:${pid}) - STILL ALIVE AFTER SIGKILL!`);
            } catch {
                console.log(`  ✅ ${cellId} (PID:${pid}) - confirmed dead`);
            }
        } catch (e: any) {
            // Finally dead
            console.log(`  ✅ ${cellId} (PID:${pid}) - confirmed dead`);
        }
    }

    // Final report
    console.log("\n" + "=".repeat(60));
    console.log("📊 SHUTDOWN REPORT");
    console.log("=".repeat(60));

    const total = children.size;
    const byMethod = shutdownResults.reduce((acc, r) => {
        acc[r.method] = (acc[r.method] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log(`Total cells: ${total}`);
    console.log(`  - Graceful (mesh): ${byMethod.mesh || 0}`);
    console.log(`  - SIGTERM: ${byMethod.sigterm || 0}`);
    console.log(`  - SIGKILL: ${byMethod.sigkill || 0}`);

    if (aliveAtEnd.length > 0) {
        console.log(`\n🚨 ZOMBIE CELLS DETECTED: ${aliveAtEnd.length}`);
        for (const zombie of aliveAtEnd) {
            console.log(`  - ${zombie.cellId} (PID:${zombie.pid}) - ${zombie.status}`);
        }
    } else {
        console.log("\n✅ All cells terminated successfully");
    }

    // Cleanup registry files
    console.log("\n🧹 Cleaning registry...");
    try {
        const registryDir = join(ROOT_DIR, ".rheo", "registry");
        if (existsSync(registryDir)) {
            const files = readdirSync(registryDir);
            for (const f of files) {
                unlinkSync(join(registryDir, f));
                console.log(`  🗑️  ${f}`);
            }
        }
        console.log("✅ Registry cleaned");
    } catch (e: any) {
        console.log(`⚠️  Registry cleanup failed: ${e.message}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("👋 Mesh extinguished. Goodbye.");
    console.log("=".repeat(60));

    process.exit(aliveAtEnd.length > 0 ? 1 : 0);
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