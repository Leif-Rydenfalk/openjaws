// ui/src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { RheoCell } from '../../protocols/example1';

// Singleton mesh node
const globalMesh = globalThis as any;
if (!globalMesh._meshNode) {
    console.log('🌌 [MeshBridge] Initializing server-side mesh node...');
    const cell = new RheoCell(`SvelteKit_Bridge_${process.pid}`, 0);

    // --- 🛠️ FIX: GHOST MODE BYPASS ---
    // Eftersom Vite kör servern kan inte RheoCell binda sin port.
    // CDK:n blockerar utgående trafik om ingen adress finns ("NOT_READY").
    // Vi sätter manuellt en dummy-adress för att låsa upp klient-läget.
    if (!cell.addr) {
        console.log('👻 Activating Client-Only Ghost Mode');
        (cell as any)._addr = "http://GHOST_CLIENT";
    }
    // ---------------------------------

    cell.listen();
    globalMesh._meshNode = cell;
}

const meshNode = globalMesh._meshNode;

export const handle: Handle = async ({ event, resolve }) => {
    const { request, url, locals } = event;

    // Gör cellen tillgänglig
    locals.cell = meshNode;

    // --- MESH PROXY ENDPOINT ---
    if (url.pathname === '/_mesh/call' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { capability, args } = body;

            // Se till att vi har peers innan vi anropar
            // (Detta görs normalt i load, men bra som fallback här)
            if (Object.keys(meshNode.atlas).length === 1) {
                await meshNode.bootstrapFromRegistry(true);
            }

            const result = await meshNode.askMesh(capability, args || {});

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e: any) {
            console.error("Mesh Bridge Error:", e);
            return new Response(JSON.stringify({
                ok: false,
                error: { code: 'BRIDGE_CRASH', msg: e.message, from: 'SvelteKit' }
            }), { status: 500 });
        }
    }

    return resolve(event);
};