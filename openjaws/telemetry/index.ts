// telemetry/index.ts - Clean implementation with NO manual type declarations
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const seed = process.argv[2];
const cell = new TypedRheoCell(`Telemetry_${process.pid}`, 0, seed);

// ============================================================================
// TYPED ROUTER DEFINITION
// ============================================================================

const telemetryRouter = router({
    mesh: router({
        health: procedure
            .input(z.void())
            .output(z.object({
                totalCells: z.number(),
                avgLoad: z.number(),
                status: z.enum(["NOMINAL"]),
                hotSpots: z.array(z.string()),
                timestamp: z.number()
            }))
            .query(async () => {
                const atlasEntries = Object.values(cell.atlas);

                // Calculate actual metrics
                const totalCells = atlasEntries.length;

                // Find hot spots (cells with most capabilities)
                const hotSpots = atlasEntries
                    .sort((a, b) => b.caps.length - a.caps.length)
                    .slice(0, 3)
                    .map(e => e.id || 'unknown');

                return {
                    totalCells,
                    avgLoad: 0.1,
                    status: "NOMINAL" as const,
                    hotSpots,
                    timestamp: Date.now()
                };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(telemetryRouter);
cell.listen();

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TelemetryRouter = typeof telemetryRouter;