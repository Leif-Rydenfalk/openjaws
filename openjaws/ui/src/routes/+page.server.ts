import { TypedRheoCell } from '../../../protocols/typed-mesh';

// Singleton Server Cell
let serverCell: TypedRheoCell;

if (!(globalThis as any)._serverCell) {
    serverCell = new TypedRheoCell(`UI_Server_${process.pid}`, 0);
    serverCell.listen();
    (globalThis as any)._serverCell = serverCell;
} else {
    serverCell = (globalThis as any)._serverCell;
}

export const load = async () => {
    // 1. Fetch Mesh Health
    let health = { totalCells: 0, avgLoad: 0 };
    try { health = await serverCell.mesh.mesh.health(); } catch (e) { }

    // 2. Fetch Business Data (Checklist)
    let checklist = { items: [] };
    try { checklist = await serverCell.mesh.list.get(); } catch (e) { }

    // 3. Fetch Global Logs
    let globalLogs: string[] = [];
    try {
        const res = await serverCell.mesh.log.get({ limit: 50 });
        globalLogs = res.logs;
    } catch (e) { }

    // 4. Get Local Atlas & Journal (Narrative)
    // We access the raw cell properties for introspection
    const atlas = serverCell.atlas;

    // Convert rolling journal to array
    const journal = await serverCell.askMesh("cell/journal", { limit: 20 });

    return {
        nodeId: serverCell.id,
        mesh: {
            health,
            atlas,
            globalLogs,
            journal: journal.value || []
        },
        business: {
            checklist
        }
    };
};

export const actions = {
    dispatch: async ({ request }) => {
        const data = await request.formData();
        const cap = data.get('cap') as string;
        const argsRaw = data.get('args') as string;

        try {
            const args = JSON.parse(argsRaw);

            // Raw dynamic call to the mesh
            const result = await serverCell.askMesh(cap as any, args);

            return { ok: result.ok, value: result.value, error: result.error, cid: result.cid };
        } catch (e: any) {
            return { ok: false, error: e.message };
        }
    }
};