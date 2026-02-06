import { RheoCell } from "../protocols/example1";

const seed = process.argv[2];
const cell = new RheoCell(`Telemetry_${process.pid}`, 0, seed);

cell.provide("mesh/health", async () => {
    const atlasEntries = Object.values(cell.atlas);
    return {
        totalCells: atlasEntries.length,
        avgLoad: 0.1, // Kan expanderas senare
        status: "NOMINAL"
    };
});

cell.listen();