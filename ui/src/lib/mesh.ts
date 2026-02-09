// ui/src/lib/mesh.ts
// Browser mesh client - NO Node.js imports!

import { browser } from '$app/environment';
import type { MeshCapabilities } from '../../../protocols/example1/typed-mesh';

/**
 * Simple browser mesh client
 * Uses the same types as TypedRheoCell but doesn't import Node.js code
 */
class BrowserMeshClient {
    public id: string;
    public mode: 'client' = 'client';
    public addr: string;
    public atlas: Record<string, any> = {};

    constructor(id: string) {
        this.id = id;
        this.addr = `browser://${id}`;

        if (browser) {
            this.bootstrap();
        }
    }

    private async bootstrap() {
        try {
            const response = await fetch('/_mesh/atlas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requester: this.id })
            });

            if (response.ok) {
                const { atlas } = await response.json();
                this.atlas = atlas;
                console.log(`[Browser] Connected with ${Object.keys(atlas).length} cells`);
            }
        } catch (e) {
            console.warn('[Browser] Bootstrap failed:', e);
        }

        // Periodic refresh
        setInterval(async () => {
            try {
                const response = await fetch('/_mesh/atlas', {
                    method: 'POST',
                    body: JSON.stringify({ requester: this.id })
                });
                if (response.ok) {
                    const { atlas } = await response.json();
                    this.atlas = atlas;
                }
            } catch (e) { }
        }, 10000);
    }

    /**
     * Call a mesh capability via server proxy
     */
    async call<T = any>(capability: string, args?: any): Promise<T> {
        const response = await fetch('/_mesh/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ capability, args: args || {} })
        });

        if (!response.ok) {
            throw new Error(`Mesh call failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.ok) {
            throw new Error(result.error?.msg || 'Unknown error');
        }

        return result.value;
    }

    /**
     * Type-safe mesh proxy
     */
    get mesh(): MeshProxy {
        const self = this;
        return new Proxy({} as any, {
            get: (_, namespace: string) => {
                return new Proxy({}, {
                    get: (_, method: string) => {
                        return async (args?: any) => {
                            return self.call(`${namespace}/${method}`, args);
                        };
                    }
                });
            }
        });
    }
}

/**
 * Type-safe mesh proxy interface
 */
type MeshProxy = {
    [K in keyof MeshCapabilities as K extends `${infer NS}/${string}` ? NS : never]: {
        [M in keyof MeshCapabilities as M extends `${K}/${infer Method}` ? Method : never]:
        MeshCapabilities[M] extends { input: infer I; output: infer O }
        ? I extends void
        ? () => Promise<O>
        : (input: I) => Promise<O>
        : never
    }
};

// Singleton
let globalClient: BrowserMeshClient | null = null;

export function getMeshCell(): BrowserMeshClient {
    if (!browser) {
        // SSR - return dummy
        return {
            id: 'SSR',
            mode: 'client',
            addr: 'ssr://dummy',
            atlas: {},
            call: async () => ({}),
            mesh: {} as any
        } as any;
    }

    if (!globalClient) {
        globalClient = new BrowserMeshClient(`Browser_${Date.now()}`);
    }

    return globalClient;
}

export async function getMeshStatus() {
    if (!browser) return null;

    try {
        const response = await fetch('/_mesh/status');
        if (response.ok) {
            return await response.json();
        }
    } catch (e) { }
    return null;
}