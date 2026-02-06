// orchestrator/orchestrator.ts - The Autonomic Guardian of the Rheo Mesh
// Decentralized Edition: Spawns cells and manages health without central anchors.
import { RheoCell } from "../protocols/example1";
import { spawn } from "node:child_process";
import { unlinkSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

// --- CONFIGURATION ---
const ROOT_DIR = resolve(import.meta.dir, "..");
const PID_REGISTRY = ".rheo_pids";
const REGISTRY_DIR = join(process.cwd(), ".rheo", "registry");

// --- TYPES ---
interface Blueprint {
    id: string;
    command: string;
    critical: boolean;
    scalable: boolean;
    path: string;
    env: Record<string, string>;
}

interface EvolutionState {
    lastUpdate: number;
    lastHash: string;
    updateCount: number;
    failures: number;
}

// --- STATE ---
const children = new Map<string, number>(); // ID -> PID
let forest: Blueprint[] = [];
let shuttingDown = false;
let orchestratorCell: RheoCell | null = null;

let evolutionState: EvolutionState = {
    lastUpdate: 0,
    lastHash: "",
    updateCount: 0,
    failures: 0
};

// --- UTILITIES ---

/**
 * TOML Parser (Zero-Dependency)
 * Parses Cell.toml configuration files.
 */
function parseToml(content: string): any {
    const result: any = { env: {} };
    let target = result;

    content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

        // Handle Section headers
        if (trimmed === "[env]") { target = result.env; return; }
        if (trimmed.startsWith("[")) { target = result; return; }

        const [key, ...rest] = trimmed.split("=");
        if (rest.length > 0) {
            const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
            const k = key.trim();
            target[k] = val === "true" ? true : val === "false" ? false : val;
        }
    });
    return result;
}

/**
 * Discovery
 * Scans the cells directory for valid Cell.toml blueprints.
 */
function discoverBlueprints(): Blueprint[] {
    const blueprints: Blueprint[] = [];
    const entries = readdirSync(ROOT_DIR);

    for (const entry of entries) {
        const fullPath = join(ROOT_DIR, entry);
        if (!statSync(fullPath).isDirectory()) continue;

        const tomlPath = join(fullPath, "Cell.toml");
        if (existsSync(tomlPath)) {
            try {
                const raw = readFileSync(tomlPath, "utf8");
                const parsed = parseToml(raw);
                blueprints.push({
                    id: parsed.id,
                    command: parsed.command,
                    critical: parsed.critical || false,
                    scalable: parsed.scalable || false,
                    path: fullPath,
                    env: parsed.env || {}
                });
            } catch (e) {
                console.error(`❌ [Orchestrator] Malformed blueprint in ${entry}`);
            }
        }
    }
    return blueprints;
}

/**
 * Versioning
 * Hashes cell source code to detect changes for hot-reloading.
 */
function calculateCellVersion(blueprint: Blueprint): string {
    try {
        const hash = createHash('sha256');
        const files = readdirSync(blueprint.path)
            .filter(f => !f.startsWith('.') && f !== 'cell.json' && f !== 'gen');

        for (const f of files) {
            const p = join(blueprint.path, f);
            if (statSync(p).isFile()) hash.update(readFileSync(p));
        }
        return hash.digest('hex').substring(0, 16);
    } catch (e) { return `v_${Date.now()}`; }
}

// --- LIFECYCLE MANAGEMENT ---

/**
 * Manage Cell
 * Checks if a cell is running, healthy, and up-to-date. Spawns if missing.
 */

async function manageCell(blueprint: Blueprint) {
    if (shuttingDown) return;

    // 1. KOLLA ATLASEN FÖRST
    // Om cellen redan finns i meshen och vi kan nå den, rör den inte.
    const isInMesh = Object.keys(orchestratorCell?.atlas || {}).some(
        id => id.startsWith(blueprint.id) && (Date.now() - orchestratorCell!.atlas[id].lastSeen < 10000)
    );

    // 2. KOLLA FYSISK PROCESS
    const manifestPath = join(blueprint.path, `${blueprint.id}.cell.json`);
    let isPhysicallyRunning = false;

    if (existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
            process.kill(manifest.pid, 0); // Kollar om PID lever
            isPhysicallyRunning = true;
        } catch (e) {
            // PID lever inte, rensa gamla manifestet
            unlinkSync(manifestPath);
        }
    }

    // 3. BESLUTSLOGIK
    if (isInMesh && isPhysicallyRunning) {
        // Cellen mår bra, gör ingenting.
        return;
    }

    if (isPhysicallyRunning && !isInMesh) {
        console.log(`⚠️  [Orchestrator] ${blueprint.id} lever men svarar inte i meshen. Reaping...`);
        // Här kan vi välja att döda den för att låta en ny fräsch instans komma upp
    }

    // Spawn om den inte finns eller är trasig
    await spawnCell(blueprint);
}

import { openSync, mkdirSync } from "node:fs";

// Inside orchestrator/index.ts, add this helper:
const LOG_DIR = join(ROOT_DIR, ".rheo", "logs");
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

async function spawnCell(blueprint: Blueprint, isReplica = false) {
    if (shuttingDown) return;

    const instanceId = isReplica
        ? `${blueprint.id}_Replica_${Math.random().toString(36).substring(7)}`
        : `${blueprint.id}_${process.pid}`;

    const logFilePath = join(LOG_DIR, `${instanceId}.log`);
    const logFile = openSync(logFilePath, "a"); // "a" means append

    const [cmd, ...args] = blueprint.command.split(" ");

    try {
        const proc = spawn(cmd, [...args, ""], {
            cwd: blueprint.path,
            // REDIRECTION: 0=ignore input, 1=logFile, 2=logFile
            stdio: ["ignore", logFile, logFile],
            detached: true,
            env: {
                ...process.env,
                ...blueprint.env,
                RHEO_CELL_ID: instanceId,
            }
        });

        if (proc.pid) {
            children.set(instanceId, proc.pid);
            savePidRegistry();
            console.log(`📡 [Orchestrator] Spawned ${instanceId} (Logs: .rheo/logs/${instanceId}.log)`);
        }

        proc.unref();
    } catch (e: any) {
        console.error(`💥 [Orchestrator] Failed to spawn ${blueprint.id}:`, e.message);
    }
}

// /**
//  * Spawn Cell
//  * Launches a cell process detached from the orchestrator.
//  */
// async function spawnCell(blueprint: Blueprint, isReplica = false) {
//     if (shuttingDown) return;

//     const instanceId = isReplica
//         ? `${blueprint.id}_Replica_${Math.random().toString(36).substring(7)}`
//         : `${blueprint.id}_${process.pid}`;

//     // Kill any existing process for this ID
//     const existingPid = children.get(instanceId) || children.get(blueprint.id);
//     if (existingPid) {
//         try {
//             process.kill(existingPid, 'SIGKILL');
//             await new Promise(r => setTimeout(r, 200));
//         } catch (e) { }
//     }

//     const [cmd, ...args] = blueprint.command.split(" ");

//     try {
//         const proc = spawn(cmd, [...args, ""], { // Empty string as seed (using Registry)
//             cwd: blueprint.path,
//             // stdio: "inherit",
//             stdio: blueprint.id === "ui" ? "pipe" : "inherit", // Ugly as fuck but im lazy
//             detached: true,
//             env: {
//                 ...process.env,
//                 ...blueprint.env,
//                 RHEO_CELL_ID: instanceId,
//                 RHEO_FORCE_RANDOM_PORT: blueprint.id === "AuthGuard" ? "true" : "false"
//             }
//         });

//         if (proc.pid) {
//             children.set(instanceId, proc.pid);
//             savePidRegistry();
//         }

//         proc.unref();
//     } catch (e: any) {
//         console.error(`💥 [Orchestrator] Failed to spawn ${blueprint.id}:`, e.message);
//     }
// }

// --- EVOLUTION & HEALING ---

/**
 * Type Evolution
 * Regenerates global mesh types when capabilities change.
 */
async function performTypeEvolution() {
    if (!orchestratorCell) return;

    try {
        const healthRes = await orchestratorCell.askMesh("mesh/health", {});
        if (!healthRes.ok) return;

        const currentStats = healthRes.value;
        const stateHash = createHash('sha256')
            .update(JSON.stringify({
                totalCells: currentStats.totalCells,
                capabilities: Object.keys(orchestratorCell.atlas).sort(),
                timestamp: Date.now()
            }))
            .digest('hex').substring(0, 16);

        if (stateHash === evolutionState.lastHash) return;

        console.log("🧬 Detected mesh changes, evolving types...");
        const evolveRes = await orchestratorCell.askMesh("codegen/mesh-types", {});

        if (evolveRes.ok) {
            const typesPath = join(ROOT_DIR, "rheo-mesh.d.ts");
            const header = `/** \n * 🤖 RHEO AUTO-GENERATED MESH TYPES\n * Generated: ${new Date().toISOString()}\n */\n\n`;
            writeFileSync(typesPath, header + evolveRes.value);

            evolutionState = {
                lastUpdate: Date.now(),
                lastHash: stateHash,
                updateCount: evolutionState.updateCount + 1,
                failures: 0
            };
            console.log(`✨ Mesh types evolved (update #${evolutionState.updateCount})`);
        }
    } catch (error) { }
}

/**
 * Autonomic Loop
 * The heartbeat of the system. Handles healing and scaling.
 */
const MESH_START_TIME = Date.now();
const HEALING_GRACE_PERIOD = 15000;

async function autonomicLoop() {
    if (shuttingDown || !orchestratorCell) return;

    // 1. PHYSICAL PID CHECK
    for (const [id, pid] of children.entries()) {
        try { process.kill(pid, 0); } catch (e) {
            console.log(`🚨 [Orchestrator] PHYSICAL DEATH: ${id} (PID ${pid})`);
            children.delete(id);
        }
    }

    try {
        const healthRes = await orchestratorCell.askMesh("mesh/health", {});
        if (healthRes.ok) {
            const stats = healthRes.value;
            const currentBlueprints = discoverBlueprints();
            const isWarmingUp = (Date.now() - MESH_START_TIME) < HEALING_GRACE_PERIOD;

            // 2. HEALING (Critical Cells)
            if (!isWarmingUp) {
                for (const b of currentBlueprints) {
                    const isPresentInAtlas = Object.keys(orchestratorCell.atlas).some(id => id.startsWith(b.id));
                    const isPhysicallyRunning = Array.from(children.keys()).some(id => id.startsWith(b.id));

                    if ((!isPresentInAtlas || !isPhysicallyRunning) && b.critical) {
                        console.log(`🚨 [Orchestrator] HEALING: ${b.id} missing. Reviving...`);
                        await manageCell(b);
                    }
                }
            }

            // 3. SCALING
            if (!isWarmingUp && stats.avgLoad > 0.8 && stats.totalCells < 30) {
                const hotspot = stats.hotSpots[0];
                if (hotspot) {
                    const type = hotspot.split('_')[0];
                    const b = currentBlueprints.find(f => f.id === type);
                    if (b?.scalable) {
                        console.log(`📈 [Orchestrator] Scaling ${b.id} due to load`);
                        await spawnCell(b, true);
                    }
                }
            }
        }
    } catch (e) { }

    setTimeout(autonomicLoop, 5000);
}

// --- SHUTDOWN & REGISTRY ---

function savePidRegistry() {
    const registry = Object.fromEntries(children);
    registry["Orchestrator"] = process.pid;
    writeFileSync(join(ROOT_DIR, PID_REGISTRY), JSON.stringify(registry, null, 2));
}

async function shutdownMesh() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n🛑 [Orchestrator] COORDINATED MESH SHUTDOWN...");

    if (orchestratorCell) {
        const endpoints = new Set(Object.values(orchestratorCell.atlas).map(e => e.addr));
        // Soft Shutdown Signal
        const signals = Array.from(endpoints).map(async (addr) => {
            try {
                return await (orchestratorCell as any).rpc(addr, {
                    id: randomUUID(), from: orchestratorCell!.id, intent: "TELL",
                    payload: { capability: "cell/shutdown", args: {} },
                    trace: [], atlas: {}, proofs: {}
                } as any);
            } catch (e) { return { ok: false }; }
        });
        await Promise.race([Promise.allSettled(signals), new Promise(r => setTimeout(r, 1000))]);
    }

    // Hard Kill
    let killedCount = 0;
    for (const [id, pid] of children.entries()) {
        try {
            process.kill(pid, "SIGKILL");
            console.log(`   - Terminated: ${id}`); // <--- ADDED BACK
            killedCount++;
        } catch (e) { }
    }

    console.log(`   💀 Hard killed ${killedCount} processes.`);

    // Cleanup Files
    if (existsSync(join(ROOT_DIR, PID_REGISTRY))) unlinkSync(join(ROOT_DIR, PID_REGISTRY));

    // Clean entire Registry (Nuclear Option for clean restart)
    if (existsSync(REGISTRY_DIR)) {
        for (const file of readdirSync(REGISTRY_DIR)) {
            unlinkSync(join(REGISTRY_DIR, file));
        }
    }

    console.log("👋 Mesh extinguished.");
    process.exit(0);
}

// --- ENTRY POINT ---

process.on("SIGINT", shutdownMesh);
process.on("SIGTERM", shutdownMesh);

// We define the cell but don't listen yet
orchestratorCell = new RheoCell(`Orchestrator_${process.pid}`, 0);

const mode = process.argv[2];

if (mode === "start") {
    (async () => {
        console.log("🌌 Rheo Sovereign Mesh: Hard Reset & Ignition...");

        // NUCLEAR CLEANUP: Döda allt som finns i PID-registret från förra sessionen
        if (existsSync(join(ROOT_DIR, PID_REGISTRY))) {
            const oldPids = JSON.parse(readFileSync(join(ROOT_DIR, PID_REGISTRY), 'utf8'));
            for (const [name, pid] of Object.entries(oldPids)) {
                try {
                    process.kill(pid as number, 'SIGKILL');
                    console.log(`💀 Reaped zombie: ${name}`);
                } catch (e) { }
            }
        }

        console.log("🌌 Rheo Sovereign Mesh: Starting Decentralized Engine...");

        // 1. Clean Slate (Delete old registry files)
        if (existsSync(REGISTRY_DIR)) {
            for (const file of readdirSync(REGISTRY_DIR)) {
                if (file.endsWith('.json')) unlinkSync(join(REGISTRY_DIR, file));
            }
        }

        // 2. Discover Blueprints
        forest = discoverBlueprints();
        console.log(`Found blueprints: ${forest.map(b => b.id).join(', ')}`);

        // Remove PortMapper if it still lingers in folders
        const cellsToSpawn = forest.filter(b => b.id !== "PortMapper");

        // 3. Start Listening (This creates the Orchestrator's registry card)
        orchestratorCell!.listen();

        // 4. Spawn all cells in parallel
        console.log(`🚀 Spawning ${cellsToSpawn.length} cells...`);
        await Promise.all(cellsToSpawn.map(b => manageCell(b)));

        savePidRegistry();
        console.log("🟢 Mesh Online. Autonomic Guardian activated.");

        // 5. Wait for Convergence
        console.log("⏳ Waiting for mesh stabilization...");
        await new Promise<void>((resolve) => {
            let attempts = 0;
            const check = async () => {
                attempts++;
                try {
                    const healthRes = await orchestratorCell!.askMesh("mesh/health", {});
                    if (healthRes.ok && healthRes.value.totalCells >= cellsToSpawn.length * 0.8) {
                        resolve();
                        return;
                    }
                } catch { }
                if (attempts < 50) setTimeout(check, 200);
                else resolve();
            };
            check();
        });

        await performTypeEvolution();
        console.log("🎯 Type system ready!");

        setTimeout(autonomicLoop, 5000);
    })();
} else {
    orchestratorCell.listen();
}

function randomUUID() {
    return createHash('sha256').update(Math.random().toString()).digest('hex');
}