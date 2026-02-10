#!/usr/bin/env bun
/**
 * 📡 RADAR CONTROLLER - Self-Contained Sensor Cell
 * Provides: sensors/proximity
 * Lifecycle: Auto-terminates when idle or on shutdown command
 */

import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const cell = new TypedRheoCell(`Radar_${process.pid}`, 0);

// Radar simulation state
let sweepAngle = 0;
const contacts = new Map<string, any>();
let lastScanTime = Date.now();
let idleTimeout: Timer | null = null;

// ============================================================================
// IDLE DETECTION - Auto-shutdown if not used
// ============================================================================

function resetIdleTimer() {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        cell.log("INFO", "⏰ Idle timeout reached (30s) - self-terminating");
        cell.handleShutdown();
    }, 30000); // 30 seconds idle = shutdown
}

// ============================================================================
// RADAR ROUTER
// ============================================================================

const radarRouter = router({
    sensors: router({
        proximity: procedure
            .input(z.object({
                maxDistance: z.number().optional(),
                sectors: z.array(z.string()).optional(),
                scanId: z.number().optional()
            }))
            .output(z.object({
                sensorType: z.literal('radar'),
                detections: z.array(z.object({
                    distance: z.number(),
                    bearing: z.number(),
                    velocity: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
                    confidence: z.number()
                })),
                coverage: z.array(z.string()),
                confidence: z.number(),
                sweepAngle: z.number()
            }))
            .query(async (input) => {
                resetIdleTimer();
                lastScanTime = Date.now();

                // Simulate radar sweep
                sweepAngle = (sweepAngle + 45) % 360;

                // Generate synthetic contacts based on sweep angle
                const detections: any[] = [];
                const numContacts = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;

                for (let i = 0; i < numContacts; i++) {
                    const distance = 500 + Math.random() * 1500;
                    const bearing = (sweepAngle + (Math.random() * 30 - 15)) % 360;

                    detections.push({
                        distance,
                        bearing: Math.abs(bearing),
                        velocity: {
                            x: (Math.random() - 0.5) * 50,
                            y: (Math.random() - 0.5) * 50,
                            z: (Math.random() - 0.5) * 10
                        },
                        confidence: 0.7 + Math.random() * 0.25
                    });
                }

                // Update internal contact database
                for (const det of detections) {
                    const id = `${Math.floor(det.distance)}-${Math.floor(det.bearing)}`;
                    contacts.set(id, { ...det, lastSeen: Date.now() });
                }

                // Cleanup old contacts
                for (const [id, contact] of contacts) {
                    if (Date.now() - contact.lastSeen > 10000) {
                        contacts.delete(id);
                    }
                }

                cell.log("INFO", `📡 RADAR SWEEP: ${sweepAngle}° | ${detections.length} contacts`);

                return {
                    sensorType: 'radar' as const,
                    detections,
                    coverage: ['front', 'left', 'right', 'rear'],
                    confidence: 0.85,
                    sweepAngle
                };
            })
    })
});

cell.useRouter(radarRouter);
cell.listen();

// Start idle timer
resetIdleTimer();

cell.log("INFO", "📡 Radar controller online");
cell.log("INFO", "   Capabilities: sensors/proximity");
cell.log("INFO", "   Coverage: 360° azimuth, 0-90° elevation");
cell.log("INFO", "   Auto-shutdown: 30s idle");