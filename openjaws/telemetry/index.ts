import { RheoCell, router, procedure } from "../protocols/example2";

const seed = process.argv[2];
const cell = new RheoCell(`Telemetry_${process.pid}`, 0, seed);

// ============================================================================
// TYPED ROUTER DEFINITION
// ============================================================================

const telemetryRouter = router({
    mesh: router({
        health: procedure.query(async () => {
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
                avgLoad: 0.1, // Could be expanded with real metrics
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