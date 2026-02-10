#!/usr/bin/env bun
/**
 * 🛩️  AIRCRAFT SAFETY CONTROLLER
 * Production-grade sensor fusion with scoped lifecycle management
 */

import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const cell = new TypedRheoCell(`Safety_${process.pid}`, 0);

// Track only OUR test sensors, not the whole mesh
const discoveredSensors = new Set<string>();
let testStartTime = 0;
let scanCount = 0;

// ============================================================================
// SENSOR FUSION ROUTER
// ============================================================================

const safetyRouter = router({
    safety: router({
        'get-close-proximity': procedure
            .input(z.object({
                maxDistance: z.number().optional(),
                sectors: z.array(z.string()).optional()
            }))
            .output(z.object({
                threats: z.array(z.any()),
                coverage: z.record(z.number()),
                sensorCount: z.number(),
                scanId: z.number()
            }))
            .query(async (input) => {
                scanCount++;
                const maxDistance = input.maxDistance || 1000;

                cell.log("INFO", `🛩️  [SCAN-${scanCount}] Requesting proximity data from all sensors...`);

                // MULTICAST: Ask ALL sensors providing this capability
                const sensorResults = await cell.askAll('sensors/proximity', {
                    maxDistance,
                    sectors: input.sectors,
                    scanId: scanCount
                }, 3000); // 3s timeout per sensor

                // Track which sensors responded (for scoped shutdown later)
                for (const result of sensorResults.results) {
                    discoveredSensors.add(result.cellId);
                }

                // Fuse results
                const threats: any[] = [];
                const coverage: Record<string, number> = {};

                for (const { cellId, result, latency } of sensorResults.results) {
                    if (!result?.detections) continue;

                    cell.log("INFO", `   ✅ ${cellId}: ${result.detections.length} detections (${latency.toFixed(2)}ms)`);

                    for (const detection of result.detections) {
                        threats.push({
                            ...detection,
                            source: cellId,
                            sensorType: result.sensorType || 'unknown'
                        });
                    }

                    for (const sector of result.coverage || []) {
                        coverage[sector] = (coverage[sector] || 0) + (result.confidence || 0.5);
                    }
                }

                // Sort by distance
                threats.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));

                // Log status
                if (threats.length > 0) {
                    const closest = threats[0];
                    cell.log("INFO", `⚠️  CLOSEST THREAT: ${closest.distance.toFixed(1)}m ${closest.bearing}° (${closest.sensorType})`);
                } else {
                    cell.log("INFO", `✅ CLEAR: No threats detected`);
                }

                if (sensorResults.failures.length > 0) {
                    cell.log("WARN", `   ❌ ${sensorResults.failures.length} sensors failed to respond`);
                }

                return {
                    threats: threats.slice(0, 5),
                    coverage,
                    sensorCount: sensorResults.results.length,
                    scanId: scanCount
                };
            }),

        // Test lifecycle management - ONLY shuts down test participants
        'run-test-sequence': procedure
            .input(z.object({
                scans: z.number().default(2),
                intervalMs: z.number().default(20),
                shutdownSensors: z.boolean().default(true)
            }))
            .output(z.object({
                duration: z.number(),
                totalScans: z.number(),
                sensorsFound: z.number(),
                threatsDetected: z.number()
            }))
            .mutation(async (input) => {
                testStartTime = Date.now();
                discoveredSensors.clear();
                scanCount = 0;
                let totalThreats = 0;

                cell.log("INFO", "═══════════════════════════════════════════════════");
                cell.log("INFO", "🛩️  AIRCRAFT PROXIMITY FUSION TEST");
                cell.log("INFO", "═══════════════════════════════════════════════════");
                cell.log("INFO", `Configuration: ${input.scans} scans @ ${input.intervalMs}ms interval`);
                cell.log("INFO", "Waiting for sensors to join mesh...");

                // Wait for mesh convergence
                await new Promise(r => setTimeout(r, 2000));

                // Run scan sequence
                for (let i = 0; i < input.scans; i++) {
                    try {
                        const result = await cell.mesh.safety['get-close-proximity']({
                            maxDistance: 1000 + (Math.random() * 500)
                        });
                        totalThreats += result.threats.length;
                    } catch (e: any) {
                        cell.log("ERROR", `Scan ${i + 1} failed: ${e.message}`);
                    }

                    if (i < input.scans - 1) {
                        await new Promise(r => setTimeout(r, input.intervalMs));
                    }
                }

                const duration = Date.now() - testStartTime;

                // Summary
                cell.log("INFO", "═══════════════════════════════════════════════════");
                cell.log("INFO", "📋 TEST SUMMARY");
                cell.log("INFO", "═══════════════════════════════════════════════════");
                cell.log("INFO", `Duration: ${(duration / 1000).toFixed(2)}s`);
                cell.log("INFO", `Total scans: ${scanCount}`);
                cell.log("INFO", `Unique sensors: ${discoveredSensors.size}`);
                for (const sensor of discoveredSensors) {
                    cell.log("INFO", `   • ${sensor}`);
                }
                cell.log("INFO", `Total threats detected: ${totalThreats}`);

                // SCOPED SHUTDOWN: Only OUR test sensors, not production
                if (input.shutdownSensors && discoveredSensors.size > 0) {
                    cell.log("INFO", "🔧 Shutting down test sensors...");

                    const shutdownPromises = Array.from(discoveredSensors).map(async (sensorId) => {
                        try {
                            // Find sensor address from atlas
                            const entry = Object.values(cell.atlas).find(e =>
                                (e.id || '').includes(sensorId) || sensorId.includes(e.addr)
                            );

                            if (!entry) {
                                cell.log("WARN", `   ⚠️  Could not find address for ${sensorId}`);
                                return { sensorId, ok: false, error: 'Not in atlas' };
                            }

                            // Direct RPC to sensor only
                            const result = await cell.rpc(entry.addr, {
                                id: crypto.randomUUID(),
                                from: cell.id,
                                intent: "ASK",
                                payload: { capability: "cell/shutdown", args: {} },
                                proofs: {},
                                atlas: {},
                                trace: []
                            } as any);

                            cell.log("INFO", `   ✅ ${sensorId} acknowledged`);
                            return { sensorId, ok: true };
                        } catch (e: any) {
                            cell.log("WARN", `   ❌ ${sensorId} failed: ${e.message}`);
                            return { sensorId, ok: false, error: e.message };
                        }
                    });

                    const results = await Promise.all(shutdownPromises);
                    const successCount = results.filter(r => r.ok).length;
                    cell.log("INFO", `   Shutdown: ${successCount}/${discoveredSensors.size} sensors`);
                }

                // Self-terminate after delay (let sensors shut down first)
                cell.log("INFO", "🔄 Scheduling self-termination in 2s...");
                setTimeout(async () => {
                    cell.log("INFO", "═══════════════════════════════════════════════════");
                    cell.log("INFO", "🔥 TEST CONTROLLER SHUTDOWN");
                    cell.log("INFO", "═══════════════════════════════════════════════════");
                    await cell.handleShutdown();
                }, 2000);

                return {
                    duration,
                    totalScans: scanCount,
                    sensorsFound: discoveredSensors.size,
                    threatsDetected: totalThreats
                };
            })
    })
});

cell.useRouter(safetyRouter);
cell.listen();

// Auto-start test after mesh convergence
setTimeout(async () => {
    try {
        await cell.mesh.safety['run-test-sequence']({
            scans: 8,
            intervalMs: 20,
            shutdownSensors: true
        });
    } catch (e: any) {
        cell.log("ERROR", `Test sequence failed: ${e.message}`);
        // Self-terminate on failure too
        setTimeout(() => cell.handleShutdown(), 1000);
    }
}, 1000);

cell.log("INFO", "🛩️  Safety Controller online - auto-test in 5s...");