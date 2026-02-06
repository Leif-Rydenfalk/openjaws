import { RheoCell } from "../../../protocols/example1";

const globalMesh = globalThis as any;

export function getMeshNode() {
    if (!globalMesh.cell) {
        const cell = new RheoCell("COMMAND_CENTER_UI");
        cell.listen();

        // Tvinga fram en adress direkt om listen() mot förmodan skulle vara asynkron
        if (!cell.addr && cell.server) {
            (cell as any)._addr = `http://localhost:${cell.server.port}`;
        }

        globalMesh.cell = cell;
    }
    return globalMesh.cell;
}