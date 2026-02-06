// Path: codegen/codegen.ts
import { RheoCell, Contract, Signal } from "../protocols/example1"; // Antag relative path är korrekt
import { randomUUID } from "node:crypto";

const seed = process.argv[2];
const id = `Codegen_${process.pid}`;
const cell = new RheoCell(id, 0, seed);

// ... (TS_MAP, deepSchemaToTs, extractReturnType, askRemoteContract helpers är oförändrade från din fil) ...

// --- TYPE GENERATION CAPABILITY ---
cell.provide("codegen/mesh-types", async (args: any, ctx: Signal) => {
    cell.log("INFO", "🧬 Evolving Global Mesh Types...", ctx.id);

    // 1. Hämta hela atlassen
    const atlas = await cell.mesh.mesh.directory({});
    const capabilityMap = new Map<string, { contract?: Contract }>();

    // 2. Samla in kontrakt via reflektion
    for (const [cellId, entry] of Object.entries(atlas)) {
        const remote = entry as any;
        for (const cap of remote.caps) {
            if (capabilityMap.has(cap)) continue; // Redan processad

            // Om vi har adress, fråga efter kontraktet
            if (remote.addr) {
                try {
                    const cRes = await askRemoteContract(remote.addr, cap, ctx);
                    const contract = cRes.value || cRes.result?.value;
                    capabilityMap.set(cap, { contract });
                } catch (e) {
                    capabilityMap.set(cap, {}); // Marker som processad men utan kontrakt
                }
            }
        }
    }

    // 3. Bygg namespace-strukturen
    const namespaces: Record<string, string[]> = {};

    for (const [capability, info] of capabilityMap) {
        // Hantera "namespace/method" format
        const parts = capability.split('/');
        if (parts.length < 2) continue;

        const ns = parts[0];
        // Konvertera kebab-case till camelCase för metodnamn (t.ex. "add-item" -> "addItem")
        const methodRaw = parts.slice(1).join('_');
        const method = methodRaw.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

        if (!namespaces[ns]) namespaces[ns] = [];

        let tsDef = "";
        if (info.contract) {
            const input = deepSchemaToTs(info.contract.inputSchema);
            const output = extractReturnType(info.contract.outputSchema);
            tsDef = `${method}(args: ${input}): Promise<${output}>;`;
        } else {
            // Fallback för capabilities utan kontrakt
            tsDef = `${method}(args: any): Promise<any>;`;
        }
        namespaces[ns].push(`        ${tsDef}`);
    }

    // 4. Skapa d.ts innehåll
    let dts = `/** 
 * 🤖 RHEO AUTO-GENERATED MESH TYPES 
 * Generated: ${new Date().toISOString()}
 * 
 * This file is automatically updated by the Codegen Cell.
 * DO NOT EDIT MANUALLY.
 */\n\n`;

    dts += `export interface RheoMesh {\n`;
    for (const [ns, methods] of Object.entries(namespaces)) {
        dts += `    ${ns}: {\n${methods.join('\n')}\n    };\n`;
    }
    dts += "}\n";

    return dts;
});

cell.listen();