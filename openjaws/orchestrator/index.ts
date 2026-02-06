// orchestrator/index.ts - The Autonomic Guardian with Auto Type Generation
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
const children = new Map<string, number>();
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
function parseToml(content: string): any {
    const result: any = { env: {} };
    let target = result;

    content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;

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
async function manageCell(blueprint: Blueprint) {
    if (shuttingDown) return;

    const isInMesh = Object.keys(orchestratorCell?.atlas || {}).some(
        id => id.startsWith(blueprint.id) && (Date.now() - orchestratorCell!.atlas[id].lastSeen < 10000)
    );

    const manifestPath = join(blueprint.path, `${blueprint.id}.cell.json`);
    let isPhysicallyRunning = false;

    if (existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
            process.kill(manifest.pid, 0);
            isPhysicallyRunning = true;
        } catch (e) {
            unlinkSync(manifestPath);
        }
    }

    if (isInMesh && isPhysicallyRunning) return;

    if (isPhysicallyRunning && !isInMesh) {
        console.log(`⚠️  [Orchestrator] ${blueprint.id} lever men svarar inte i meshen. Reaping...`);
    }

    await spawnCell(blueprint);
}

const LOG_DIR = join(ROOT_DIR, ".rheo", "logs");
if (!existsSync(LOG_DIR)) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(LOG_DIR, { recursive: true });
}

async function spawnCell(blueprint: Blueprint, isReplica = false) {
    if (shuttingDown) return;

    const instanceId = isReplica
        ? `${blueprint.id}_Replica_${Math.random().toString(36).substring(7)}`
        : `${blueprint.id}_${process.pid}`;

    const logFilePath = join(LOG_DIR, `${instanceId}.log`);
    const { openSync } = await import("node:fs");
    const logFile = openSync(logFilePath, "a");

    const [cmd, ...args] = blueprint.command.split(" ");

    try {
        const proc = spawn(cmd, [...args, ""], {
            cwd: blueprint.path,
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

// --- TYPE EVOLUTION (AUTO-GENERATION) ---
async function performTypeEvolution() {
    if (!orchestratorCell) return;

    try {
        const healthRes = await orchestratorCell.askMesh("mesh/health", {});
        if (!healthRes.ok) return;

        const currentStats = healthRes.value;

        // Create hash of current mesh state
        const stateHash = createHash('sha256')
            .update(JSON.stringify({
                totalCells: currentStats.totalCells,
                capabilities: Object.values(orchestratorCell.atlas)
                    .flatMap(e => e.caps)
                    .sort(),
                timestamp: Math.floor(Date.now() / 60000) // Round to minute
            }))
            .digest('hex').substring(0, 16);

        // Only regenerate if mesh actually changed
        if (stateHash === evolutionState.lastHash) return;

        console.log("🧬 Detected mesh changes, regenerating types...");

        // Call the codegen cell to generate types
        const evolveRes = await orchestratorCell.askMesh("codegen/mesh-types", {});

        if (evolveRes.ok) {
            evolutionState = {
                lastUpdate: Date.now(),
                lastHash: stateHash,
                updateCount: evolutionState.updateCount + 1,
                failures: 0
            };

            console.log(`✨ Mesh types evolved (update #${evolutionState.updateCount})`);
            console.log(`   Namespaces: ${evolveRes.value.namespaces.join(', ')}`);
        }
    } catch (error) {
        evolutionState.failures++;
        if (evolutionState.failures > 3) {
            console.error("⚠️  Type evolution failing repeatedly - codegen cell may be down");
        }
    }
}

// --- AUTONOMIC LOOP ---
const MESH_START_TIME = Date.now();
const HEALING_GRACE_PERIOD = 15000;

async function autonomicLoop() {
    if (shuttingDown || !orchestratorCell) return;

    // Physical PID check
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

            // Healing
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

            // Scaling
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

    let killedCount = 0;
    for (const [id, pid] of children.entries()) {
        try {
            process.kill(pid, "SIGKILL");
            console.log(`   - Terminated: ${id}`);
            killedCount++;
        } catch (e) { }
    }

    console.log(`   💀 Hard killed ${killedCount} processes.`);

    if (existsSync(join(ROOT_DIR, PID_REGISTRY))) unlinkSync(join(ROOT_DIR, PID_REGISTRY));

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

orchestratorCell = new RheoCell(`Orchestrator_${process.pid}`, 0);

const mode = process.argv[2];

if (mode === "start") {
    (async () => {
        console.log("🌌 Rheo Sovereign Mesh: Hard Reset & Ignition...");

        // ✅ ADD THIS - Clean all old manifest files
        const manifestPattern = /.*_\d+\.cell\.json$/;
        for (const entry of readdirSync(ROOT_DIR)) {
            const fullPath = join(ROOT_DIR, entry);
            if (statSync(fullPath).isDirectory()) {
                for (const file of readdirSync(fullPath)) {
                    if (manifestPattern.test(file)) {
                        try {
                            unlinkSync(join(fullPath, file));
                            console.log(`🧹 Cleaned old manifest: ${file}`);
                        } catch (e) { }
                    }
                }
            }
        }

        // Also clean root-level orchestrator manifests
        for (const file of readdirSync(ROOT_DIR)) {
            if (file.startsWith('Orchestrator_') && file.endsWith('.cell.json')) {
                try {
                    unlinkSync(join(ROOT_DIR, file));
                } catch (e) { }
            }
        }

        // Nuclear cleanup
        if (existsSync(join(ROOT_DIR, PID_REGISTRY))) {
            const oldPids = JSON.parse(readFileSync(join(ROOT_DIR, PID_REGISTRY), 'utf8'));
            for (const [name, pid] of Object.entries(oldPids)) {
                try {
                    process.kill(pid as number, 'SIGKILL');
                    console.log(`💀 Reaped zombie: ${name}`);
                } catch (e) { }
            }
        }

        // Clean registry
        if (existsSync(REGISTRY_DIR)) {
            for (const file of readdirSync(REGISTRY_DIR)) {
                if (file.endsWith('.json')) unlinkSync(join(REGISTRY_DIR, file));
            }
        }

        forest = discoverBlueprints();
        console.log(`Found blueprints: ${forest.map(b => b.id).join(', ')}`);

        const cellsToSpawn = forest.filter(b => b.id !== "PortMapper");

        orchestratorCell!.listen();

        console.log(`🚀 Spawning ${cellsToSpawn.length} cells...`);
        await Promise.all(cellsToSpawn.map(b => manageCell(b)));

        savePidRegistry();
        console.log("🟢 Mesh Online. Autonomic Guardian activated.");

        // Wait for convergence
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

        // Initial type generation
        await performTypeEvolution();
        console.log("🎯 Type system ready!");

        // Start autonomic loop
        setTimeout(autonomicLoop, 5000);

        // Auto-regenerate types on mesh changes
        setInterval(async () => {
            try {
                await performTypeEvolution();
            } catch (e) {
                // Silent fail - will retry next interval
            }
        }, 30000); // Check every 30 seconds
    })();
} else {
    orchestratorCell.listen();
}

function randomUUID() {
    return createHash('sha256').update(Math.random().toString()).digest('hex');
}