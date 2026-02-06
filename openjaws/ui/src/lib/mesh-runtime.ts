// Path: ui/src/lib/mesh-runtime.ts
import { browser } from '$app/environment';

// Importera typerna från roten (anpassa sökväg om filen ligger annorlunda)
// Vi använder "import type" så att detta försvinner vid kompilering
import type { RheoMesh } from '../../../rheo-mesh';

/**
 * MESH RUNTIME PROXY
 * 
 * Denna proxy konverterar metodanrop:
 *   mesh.list.add({ text: "Hejsan" })
 * 
 * Till HTTP-anrop:
 *   POST /_mesh/call { capability: "list/add", args: { text: "Hejsan" } }
 * 
 * Tack vare TypeScript-interfacet får du full autocompletion och typsäkerhet!
 */
export const mesh = new Proxy({} as RheoMesh, {
    get: (target, namespace: string) => {
        return new Proxy({}, {
            get: (subTarget, method: string) => {
                return async (args: any) => {
                    // Om vi är på servern (SSR), kasta fel eller hantera annorlunda
                    // (Server-side calls bör gå via cell.askMesh direkt, inte via HTTP loopback)
                    if (!browser) {
                        console.warn(`[MeshRuntime] Warning: Calling mesh proxy for '${namespace}/${method}' during SSR. Use locals.cell.askMesh() instead.`);
                    }

                    // Återskapa capability-strängen: "list" + "add" -> "list/add"
                    // (Hanterar camelCase -> kebab-case om nödvändigt, men vi håller det enkelt nu)
                    const capability = `${namespace}/${method}`;

                    const response = await fetch('/_mesh/call', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ capability, args })
                    });

                    const result = await response.json();

                    if (!result.ok) {
                        throw new Error(result.error?.msg || `Mesh call failed: ${capability}`);
                    }

                    return result.value;
                };
            }
        });
    }
});