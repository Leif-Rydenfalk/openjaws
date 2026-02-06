// ui/src/hooks.server.ts - Type-safe SvelteKit mesh bridge
import type { Handle } from '@sveltejs/kit';
import { TypedRheoCell } from '../../protocols/typed-mesh';

// Singleton mesh node
const globalMesh = globalThis as any;

if (!globalMesh._meshNode) {
    console.log('🌌 [MeshBridge] Initializing server-side mesh node...');

    // Create a proper cell that can listen
    const cell = new TypedRheoCell(`SvelteKit_Bridge_${process.pid}`, 0);

    // Listen first to get a port
    cell.listen();

    // Bootstrap from registry
    cell.bootstrapFromRegistry(true).catch(() => {
        console.log('[MeshBridge] Initial bootstrap failed, will retry via gossip');
    });

    globalMesh._meshNode = cell;

    console.log(`[MeshBridge] Cell initialized at ${cell.addr}`);
}

const meshNode: TypedRheoCell = globalMesh._meshNode;

export const handle: Handle = async ({ event, resolve }) => {
    const { request, url, locals } = event;

    // Make cell available to all routes
    locals.cell = meshNode;

    // Ensure we have peers (lazy bootstrap)
    if (Object.keys(meshNode.atlas).length <= 1) {
        try {
            await meshNode.bootstrapFromRegistry(true);
        } catch (e) {
            console.error('[MeshBridge] Bootstrap error:', e);
        }
    }

    // --- MESH PROXY ENDPOINT ---
    if (url.pathname === '/_mesh/call' && request.method === 'POST') {
        try {
            const body = await request.json();
            const { capability, args } = body;

            // Type-safe mesh call
            const result = await meshNode.askMesh(capability as any, args || {});

            return new Response(JSON.stringify(result), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
        } catch (e: any) {
            console.error("[MeshBridge] Call error:", e);
            return new Response(JSON.stringify({
                ok: false,
                error: {
                    code: 'BRIDGE_ERROR',
                    msg: e.message,
                    from: 'SvelteKit'
                }
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // --- MESH STATUS ENDPOINT (for debugging) ---
    if (url.pathname === '/_mesh/status' && request.method === 'GET') {
        return new Response(JSON.stringify({
            cellId: meshNode.id,
            address: meshNode.addr,
            atlasSize: Object.keys(meshNode.atlas).length,
            capabilities: Object.values(meshNode.atlas).flatMap(e => e.caps),
            peers: Object.keys(meshNode.atlas).filter(id => id !== meshNode.id)
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return resolve(event);
};