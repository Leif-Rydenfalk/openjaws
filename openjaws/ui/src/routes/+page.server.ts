// ui/src/routes/+page.server.ts
import { getMeshNode } from '$lib/mesh';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // 1. Hämta serverns mesh-nod (från hooks eller singleton)
    const cell = (locals as any).cell || getMeshNode();

    // 2. Tvinga en bootstrap (läs filer från .rheo/registry)
    // Detta är kritiskt för att hitta 'checklist'-cellen direkt vid start
    await cell.bootstrapFromRegistry(true);

    // 3. Hämta data med defensiv felhantering
    let checklistData = { items: [] };
    let logsData = [];
    let healthData = { status: "UNKNOWN", totalCells: 0 };

    try {
        // Kör parallellt, men låt inte ett fel sänka hela sidan
        const results = await Promise.allSettled([
            cell.askMesh("list/get", {}),
            cell.askMesh("log/get", { limit: 20 }),
            cell.askMesh("mesh/health", {})
        ]);

        // Checklist
        if (results[0].status === 'fulfilled' && results[0].value.ok) {
            checklistData = results[0].value.value;
        } else {
            console.warn("⚠️ Checklist cell unreachable:", results[0].status === 'fulfilled' ? results[0].value.error : "Timeout");
        }

        // Logs
        if (results[1].status === 'fulfilled' && results[1].value.ok) {
            logsData = results[1].value.value.logs;
        }

        // Health
        if (results[2].status === 'fulfilled' && results[2].value.ok) {
            healthData = results[2].value.value;
        }

    } catch (e) {
        console.error("💥 Critical Mesh Load Error:", e);
    }

    // Returnera ALLTID en giltig struktur, även om den är tom
    return {
        mesh: {
            health: healthData,
            atlas: cell.atlas,
            journal: []
        },
        business: {
            checklist: checklistData
        },
        nodeId: cell.id,
        globalLogs: logsData
    };
};

export const actions: Actions = {
    // (Behåll din dispatch action som den var)
    dispatch: async ({ request, locals }) => {
        const data = await request.formData();
        const cell = (locals as any).cell;
        const cap = data.get('cap') as string;

        let args = {};
        try { args = JSON.parse(data.get('args') as string || '{}'); } catch { }

        return await cell.askMesh(cap, args);
    }
};