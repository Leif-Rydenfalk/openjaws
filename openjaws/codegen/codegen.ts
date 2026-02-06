// codegen/codegen.ts - Auto-generate types from LIVE zod schemas
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const cell = new TypedRheoCell(`Codegen_${process.pid}`, 0, process.argv[2]);

// ============================================================================
// ZOD TO TYPESCRIPT CONVERTER
// ============================================================================

/**
 * Convert zod schema shape to TypeScript type string
 * This works by introspecting the runtime zod schema structure
 */
function zodShapeToTS(shape: any): string {
    if (!shape) return "void";

    // Handle zod internals
    if (shape._def) {
        const def = shape._def;

        // String
        if (def.typeName === "ZodString") {
            return "string";
        }

        // Number
        if (def.typeName === "ZodNumber") {
            return "number";
        }

        // Boolean
        if (def.typeName === "ZodBoolean") {
            return "boolean";
        }

        // Enum
        if (def.typeName === "ZodEnum") {
            const values = def.values || [];
            return values.map((v: string) => `"${v}"`).join(" | ");
        }

        // Array
        if (def.typeName === "ZodArray") {
            const itemType = zodShapeToTS(def.type);
            return `Array<${itemType}>`;
        }

        // Optional
        if (def.typeName === "ZodOptional") {
            const innerType = zodShapeToTS(def.innerType);
            return innerType; // Don't add undefined here, it's handled in object parsing
        }

        // Object
        if (def.typeName === "ZodObject") {
            const shape = typeof def.shape === "function" ? def.shape() : def.shape;
            const props = Object.entries(shape)
                .map(([key, schema]: [string, any]) => {
                    const isOptional = schema._def?.typeName === "ZodOptional" || schema.optional;
                    const typeStr = zodShapeToTS(schema);
                    return `${key}${isOptional ? "?" : ""}: ${typeStr}`;
                })
                .join("; ");
            return `{ ${props} }`;
        }

        // Unknown/Any
        if (def.typeName === "ZodUnknown" || def.typeName === "ZodAny") {
            return "any";
        }
    }

    // Fallback for plain objects
    if (typeof shape === "object" && shape !== null) {
        if (Array.isArray(shape)) {
            return "any[]";
        }
        return "any";
    }

    return "any";
}

/**
 * Extract contract from a cell's router
 * This queries the cell and gets the actual zod schemas
 */
async function extractContract(
    cellId: string,
    capability: string
): Promise<{ input: string; output: string } | null> {
    try {
        const result = await cell.askMesh("cell/contract" as any, { cap: capability });

        if (!result.ok || !result.value) {
            return null;
        }

        const contract = result.value;

        // Convert schemas to TypeScript
        const inputType = contract.input ? zodShapeToTS(contract.input) : "void";
        const outputType = contract.output ? zodShapeToTS(contract.output) : "any";

        return { input: inputType, output: outputType };
    } catch (e) {
        // Cell might not support contracts yet
        return null;
    }
}

// ============================================================================
// DECLARATION FILE GENERATION
// ============================================================================

/**
 * Generate mesh-types.d.ts from live mesh topology
 */
async function generateTypes(): Promise<{
    ok: boolean;
    path?: string;
    capabilities?: number;
    namespaces?: string[];
}> {
    cell.log("INFO", "🧬 Scanning mesh for type information...");

    const atlas = cell.atlas;
    const capabilityTypes = new Map<string, { input: string; output: string }>();
    const namespaces = new Set<string>();

    // Scan all cells
    for (const [cellId, entry] of Object.entries(atlas)) {
        if (cellId === cell.id) continue;

        for (const cap of entry.caps) {
            // Skip internal system capabilities
            if (cap.startsWith("cell/")) {
                continue;
            }

            // Include core mesh capabilities
            if (cap.startsWith("mesh/")) {
                if (!["mesh/ping", "mesh/health"].includes(cap)) {
                    continue;
                }
            }

            const [namespace, procedure] = cap.split("/");
            if (!namespace || !procedure) continue;

            namespaces.add(namespace);

            // Try to get contract
            const contract = await extractContract(cellId, cap);

            if (contract) {
                capabilityTypes.set(cap, contract);
                cell.log("INFO", `  ✓ ${cap}: ${contract.input} → ${contract.output}`);
            } else {
                // Fallback: use any
                capabilityTypes.set(cap, { input: "any", output: "any" });
                cell.log("WARN", `  ? ${cap}: No contract (using any)`);
            }
        }
    }

    // Generate TypeScript file
    const timestamp = new Date().toISOString();
    let output = `/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: ${timestamp}
 * Source: Live mesh scan (${capabilityTypes.size} capabilities)
 * 
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
`;

    // Add capabilities
    for (const [cap, sig] of Array.from(capabilityTypes.entries()).sort()) {
        output += `        "${cap}": { input: ${sig.input}; output: ${sig.output} };\n`;
    }

    output += `    }
}

// ============================================================================
// NAMESPACE HELPERS (Optional convenience types)
// ============================================================================

`;

    // Generate namespace-specific types
    for (const namespace of Array.from(namespaces).sort()) {
        const caps = Array.from(capabilityTypes.keys())
            .filter(cap => cap.startsWith(`${namespace}/`))
            .sort();

        if (caps.length === 0) continue;

        const pascalNamespace = namespace.charAt(0).toUpperCase() + namespace.slice(1);

        output += `/**
 * Capabilities in the ${namespace} namespace
 */
export type ${pascalNamespace}Capabilities = {\n`;

        for (const cap of caps) {
            const procedure = cap.split("/")[1];
            const sig = capabilityTypes.get(cap)!;
            output += `    ${procedure}: { input: ${sig.input}; output: ${sig.output} };\n`;
        }

        output += `};\n\n`;
    }

    output += `// Type trigger: ${Date.now()}
`;

    // Write file
    const outputPath = join(process.cwd(), "..", "mesh-types.d.ts");
    writeFileSync(outputPath, output);

    // Poke TypeScript server
    pokeTSServer();

    cell.log("INFO", `✅ Generated ${capabilityTypes.size} types → ${outputPath}`);

    return {
        ok: true,
        path: outputPath,
        capabilities: capabilityTypes.size,
        namespaces: Array.from(namespaces)
    };
}

/**
 * Force VS Code to reload TypeScript types
 */
function pokeTSServer() {
    const typesPath = join(process.cwd(), "..", "mesh-types.d.ts");

    // Method 1: Touch the file timestamp
    try {
        const now = new Date();
        if (existsSync(typesPath)) {
            const content = readFileSync(typesPath, "utf8");
            writeFileSync(typesPath, content);
        }
    } catch (e) { }

    // Method 2: Create trigger file
    try {
        const triggerPath = join(process.cwd(), "..", ".mesh-types-trigger");
        writeFileSync(triggerPath, Date.now().toString());
    } catch (e) { }

    // Method 3: Signal tsserver (if running)
    try {
        spawn("pkill", ["-SIGUSR1", "-f", "tsserver"], {
            stdio: "ignore",
            detached: true
        }).unref();
    } catch (e) { }

    cell.log("INFO", "👉 Poked TypeScript server");
}

// ============================================================================
// ROUTER
// ============================================================================

const codegenRouter = router({
    codegen: router({
        "mesh-types": procedure
            .input(z.void())
            .output(z.object({
                ok: z.boolean(),
                path: z.optional(z.string()),
                capabilities: z.optional(z.number()),
                namespaces: z.optional(z.array(z.string()))
            }))
            .query(generateTypes),

        "poke-ts": procedure
            .input(z.void())
            .output(z.object({
                ok: z.boolean()
            }))
            .query(() => {
                pokeTSServer();
                return { ok: true };
            }),

        validate: procedure
            .input(z.void())
            .output(z.object({
                ok: z.boolean(),
                error: z.optional(z.string()),
                missing: z.optional(z.array(z.string())),
                undeclared: z.optional(z.array(z.string())),
                stats: z.optional(z.object({
                    declared: z.number(),
                    actual: z.number()
                }))
            }))
            .query(async () => {
                const typeFile = join(process.cwd(), "..", "mesh-types.d.ts");

                if (!existsSync(typeFile)) {
                    return {
                        ok: false,
                        error: "Type file not generated yet"
                    };
                }

                const content = readFileSync(typeFile, "utf8");
                const declared = new Set<string>();
                const regex = /"([^"]+)":\s*{/g;
                let match;

                while ((match = regex.exec(content)) !== null) {
                    if (match[1].includes("/")) {
                        declared.add(match[1]);
                    }
                }

                const actual = new Set<string>();
                for (const entry of Object.values(cell.atlas)) {
                    entry.caps.forEach(cap => actual.add(cap));
                }

                const missing = Array.from(declared).filter(c => !actual.has(c));
                const undeclared = Array.from(actual).filter(c => !declared.has(c));

                return {
                    ok: missing.length === 0 && undeclared.length === 0,
                    missing,
                    undeclared,
                    stats: {
                        declared: declared.size,
                        actual: actual.size
                    }
                };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(codegenRouter);
cell.listen();

cell.log("INFO", "🧬 Enhanced Codegen cell online");

// Watch for mesh changes
let lastHash = "";
cell.onAtlasUpdate(async (atlas) => {
    const hash = Object.keys(atlas).sort().join(",");
    if (hash !== lastHash) {
        lastHash = hash;
        // Debounce
        setTimeout(generateTypes, 1000);
    }
});

// Initial generation
setTimeout(generateTypes, 5000);

// Periodic regeneration
setInterval(generateTypes, 30000);