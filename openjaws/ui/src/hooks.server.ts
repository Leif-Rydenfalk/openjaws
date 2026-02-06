// ui/src/hooks.server.ts
// Server cell that handles browser mesh calls

import type { Handle } from '@sveltejs/kit';
import { TypedRheoCell } from '../../protocols/typed-mesh';

// ONE real server cell
const globalThis_any = globalThis as any;

if (!globalThis_any._meshCell) {
    console.log('[Server] Initializing mesh cell...');
    const cell = new TypedRheoCell(`SvelteKit_${process.pid}`, 0);
    cell.listen();
    cell.bootstrapFromRegistry(true).catch(() => { });
    globalThis_any._meshCell = cell;
    console.log(`[Server] Cell online at ${cell.addr}`);
}

const serverCell: TypedRheoCell = globalThis_any._meshCell;

export const handle: Handle = async ({ event, resolve }) => {
    const { request, url } = event;

    // Simple mesh call endpoint - just forward to askMesh
    if (url.pathname === '/_mesh/call' && request.method === 'POST') {
        try {
            const { capability, args } = await request.json();

            // Use server cell to make the mesh call
            const result = await serverCell.askMesh(capability as any, args || {});

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e: any) {
            return new Response(JSON.stringify({
                ok: false,
                error: {
                    code: 'SERVER_ERROR',
                    msg: e.message,
                    from: 'SvelteKit',
                    trace: []
                }
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Provide atlas for browser bootstrap
    if (url.pathname === '/_mesh/atlas' && request.method === 'POST') {
        return new Response(JSON.stringify({ atlas: serverCell.atlas }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Status endpoint
    if (url.pathname === '/_mesh/status') {
        return new Response(JSON.stringify({
            cellId: serverCell.id,
            mode: serverCell.mode,
            address: serverCell.addr,
            atlasSize: Object.keys(serverCell.atlas).length,
            peers: Object.keys(serverCell.atlas).filter(id => id !== serverCell.id)
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return resolve(event);
};