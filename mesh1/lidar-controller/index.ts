#!/usr/bin/env bun
/**
 * 🔦 LIDAR CONTROLLER - Precision Optical Sensor
 * Provides: sensors/proximity
 * Specialization: High accuracy, short range, ground proximity
 */

import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const cell = new TypedRheoCell(`Lidar_${process.pid}`, 0);

let idleTimeout: Timer | null = null;

function resetIdleTimer() {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        cell.log("INFO", "⏰ Idle timeout - self-terminating");
        cell.handleShutdown();
    }, 25000);
}

const lidarRouter = router({
    sensors: router({
        proximity: procedure
            .input(z.object({
                maxDistance: z.number().optional(),
                sectors: z.array(z.string()).optional(),
                scanId: z.number().optional()
            }))
            .output(z.object({
                sensorType: z.literal('lidar'),
                detections: z.array(z.object({
                    distance: z.number(),
                    bearing: z.number(),
                    elevation: z.number(),
                    objectType: z.enum(['ground', 'obstacle', 'terrain']),
                    confidence: z.number()
                })),
                coverage: z.array(z.string()),
                confidence: z.number(),
                groundClearance: z.number()
            }))
            .query(async (input) => {
                resetIdleTimer();

                // Lidar specializes in ground proximity and obstacles
                const detections: any[] = [];

                // Always report ground clearance
                const groundClearance = 50 + Math.random() * 200;

                // Occasionally detect obstacles
                if (Math.random() > 0.5) {
                    detections.push({
                        distance: 20 + Math.random() * 100,
                        bearing: Math.random() * 360,
                        elevation: -5 - Math.random() * 20,
                        objectType: Math.random() > 0.5 ? 'obstacle' : 'terrain',
                        confidence: 0.9 + Math.random() * 0.09
                    });
                }

                cell.log("INFO", `🔦 LIDAR: ${detections.length} obstacles, ${groundClearance.toFixed(1)}m ground clearance`);

                return {
                    sensorType: 'lidar' as const,
                    detections,
                    coverage: ['below', 'front-low'],
                    confidence: 0.95,
                    groundClearance
                };
            })
    })
});

cell.useRouter(lidarRouter);
cell.listen();
resetIdleTimer();

cell.log("INFO", "🔦 Lidar controller online");
cell.log("INFO", "   Specialization: Ground proximity, obstacle detection");
cell.log("INFO", "   Auto-shutdown: 25s idle");