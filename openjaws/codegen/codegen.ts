// codegen/enhanced-codegen.ts - Auto-generate type-safe mesh declarations
// This cell scans the mesh and generates TypeScript type declarations

import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure } from "../protocols/example2";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const cell = new TypedRheoCell(`Codegen_${process.pid}`, 0, process.argv[2]);

// ============================================================================
// TYPE EXTRACTION FROM LIVE CELLS
// ============================================================================

interface CapabilitySignature {
    input: string;  // TypeScript type as string
    output: string; // TypeScript type as string
}

/**
 * Extract type information from a cell by analyzing its router
 * This queries the cell and infers types from the schema
 */
async function extractCellTypes(cellId: string, capabilities: string[]): Promise<Map<string, CapabilitySignature>> {
    const types = new Map<string, CapabilitySignature>();

    for (const cap of capabilities) {
        try {
            // Try to get schema information if the cell provides it
            const contractResult = await cell.askMesh("cell/contract" as any, { cap } as any);

            if (contractResult.ok && contractResult.value) {
                const schema = contractResult.value;
                types.set(cap, {
                    input: schemaToTypeScript(schema.inputSchema),
                    output: schemaToTypeScript(schema.outputSchema)
                });
            } else {
                // Fallback: infer from capability name and common patterns
                types.set(cap, inferTypesFromCapability(cap));
            }
        } catch (e) {
            // Fallback for cells without contract support
            types.set(cap, inferTypesFromCapability(cap));
        }
    }

    return types;
}

/**
 * Convert JSON schema to TypeScript type string
 */
function schemaToTypeScript(schema: any): string {
    if (!schema) return "void";

    switch (schema.type) {
        case "string":
            return schema.enum ? schema.enum.map((v: string) => `"${v}"`).join(" | ") : "string";
        case "number":
            return "number";
        case "boolean":
            return "boolean";
        case "array":
            return `Array<${schemaToTypeScript(schema.items)}>`;
        case "object":
            if (!schema.properties) return "Record<string, any>";
            const props = Object.entries(schema.properties)
                .map(([key, propSchema]) => {
                    const optional = !schema.required?.includes(key);
                    return `${key}${optional ? "?" : ""}: ${schemaToTypeScript(propSchema)}`;
                })
                .join("; ");
            return `{ ${props} }`;
        default:
            return "any";
    }
}

/**
 * Infer types from capability name using common patterns
 */
function inferTypesFromCapability(capability: string): CapabilitySignature {
    const [namespace, procedure] = capability.split("/");

    // Common patterns based on procedure names
    if (procedure === "get" || procedure === "list" || procedure === "health") {
        return { input: "void", output: "any" };
    }

    if (procedure === "add" || procedure === "create" || procedure === "update") {
        return { input: "any", output: "{ ok: boolean }" };
    }

    if (procedure === "delete" || procedure === "remove") {
        return { input: "{ id: string }", output: "{ ok: boolean }" };
    }

    // Default
    return { input: "any", output: "any" };
}

// ============================================================================
// DECLARATION FILE GENERATION
// ============================================================================

const codegenRouter = router({
    codegen: router({
        'mesh-types': procedure.query(async () => {
            cell.log("INFO", "🧬 Generating mesh type declarations...");

            const atlas = cell.atlas;
            const namespaceMap = new Map<string, Set<string>>();
            const capabilityTypes = new Map<string, CapabilitySignature>();

            // 1. Collect capabilities by namespace
            for (const [cellId, entry] of Object.entries(atlas)) {
                if (!entry.id || entry.id === cell.id) continue;

                for (const cap of entry.caps) {
                    // Skip system capabilities
                    if (cap.startsWith("mesh/") || cap.startsWith("cell/")) {
                        if (!["mesh/health", "mesh/ping"].includes(cap)) continue;
                    }

                    const [namespace, procedure] = cap.split("/");
                    if (!namespace || !procedure) continue;

                    if (!namespaceMap.has(namespace)) {
                        namespaceMap.set(namespace, new Set());
                    }
                    namespaceMap.get(namespace)!.add(cap);
                }
            }

            // 2. Extract type information for each capability
            for (const [namespace, caps] of namespaceMap) {
                const cellId = Array.from(Object.entries(atlas))
                    .find(([_, e]) => e.caps.some(c => c.startsWith(namespace + "/")))
                    ?.[0];

                if (cellId) {
                    const types = await extractCellTypes(cellId, Array.from(caps));
                    types.forEach((sig, cap) => capabilityTypes.set(cap, sig));
                }
            }

            // 3. Generate TypeScript declaration file
            const declarations = generateDeclarations(namespaceMap, capabilityTypes);

            // 4. Write to disk
            const outputPath = join(process.cwd(), "..", "mesh-types.d.ts");
            writeFileSync(outputPath, declarations);

            cell.log("INFO", `✅ Generated types for ${capabilityTypes.size} capabilities`);

            return {
                ok: true,
                path: outputPath,
                namespaces: Array.from(namespaceMap.keys()),
                capabilities: Array.from(capabilityTypes.keys()),
                timestamp: new Date().toISOString()
            };
        }),

        'validate-mesh': procedure.query(async () => {
            // Validate that runtime mesh matches generated types
            const typeFile = join(process.cwd(), "..", "mesh-types.d.ts");

            if (!existsSync(typeFile)) {
                return {
                    ok: false,
                    error: "Type declarations not generated yet"
                };
            }

            const atlas = cell.atlas;
            const actualCaps = new Set<string>();

            for (const entry of Object.values(atlas)) {
                entry.caps.forEach(cap => actualCaps.add(cap));
            }

            // Parse type file to get declared capabilities
            const content = readFileSync(typeFile, "utf8");
            const declaredCaps = extractDeclaredCapabilities(content);

            const missing = Array.from(declaredCaps)
                .filter(cap => !actualCaps.has(cap));

            const undeclared = Array.from(actualCaps)
                .filter(cap => !declaredCaps.has(cap))
                .filter(cap => !cap.startsWith("cell/")); // Ignore system caps

            return {
                ok: missing.length === 0 && undeclared.length === 0,
                missing,
                undeclared,
                stats: {
                    declared: declaredCaps.size,
                    actual: actualCaps.size
                }
            };
        })
    })
});

function generateDeclarations(
    namespaceMap: Map<string, Set<string>>,
    capabilityTypes: Map<string, CapabilitySignature>
): string {
    const timestamp = new Date().toISOString();

    let output = `/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: ${timestamp}
 * 
 * This file provides complete type safety for all mesh capabilities.
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * 
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
`;

    // Generate capability declarations
    const sortedCaps = Array.from(capabilityTypes.keys()).sort();

    for (const capability of sortedCaps) {
        const sig = capabilityTypes.get(capability)!;
        output += `        "${capability}": { input: ${sig.input}; output: ${sig.output} };\n`;
    }

    output += `    }
}

// ============================================================================
// NAMESPACE HELPERS (Optional convenience types)
// ============================================================================

`;

    // Generate namespace-specific types
    for (const [namespace, caps] of namespaceMap) {
        const pascalNamespace = namespace.charAt(0).toUpperCase() + namespace.slice(1);

        output += `/**
 * Capabilities in the ${namespace} namespace
 */
export type ${pascalNamespace}Capabilities = {\n`;

        for (const cap of Array.from(caps).sort()) {
            const procedure = cap.split("/")[1];
            const sig = capabilityTypes.get(cap)!;
            output += `    ${procedure}: { input: ${sig.input}; output: ${sig.output} };\n`;
        }

        output += `};\n\n`;
    }

    output += `// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Direct askMesh with type safety
 * 
 * const cell = new TypedRheoCell(...);
 * 
 * // ✅ Typed input and output
 * const result = await cell.askMesh("ai/generate", { 
 *     prompt: "Hello" 
 * });
 * // result.value => { model: string, response: string, done: boolean }
 * 
 * // ❌ Compile error - wrong input type
 * await cell.askMesh("ai/generate", { prmpt: "typo" });
 * 
 * // ❌ Compile error - capability doesn't exist  
 * await cell.askMesh("ai/nonexistent", {});
 */

/**
 * Example 2: Proxy API for ergonomic calls
 * 
 * const cell = new TypedRheoCell(...);
 * 
 * // ✅ Natural method-like syntax
 * const health = await cell.mesh.mesh.health();
 * // health => { totalCells: number, ... }
 * 
 * const summary = await cell.mesh.ai.generate({ 
 *     prompt: "Summarize my day" 
 * });
 * // summary => { model: string, response: string, done: boolean }
 * 
 * // ❌ Compile error - namespace doesn't exist
 * await cell.mesh.nonexistent.method();
 */
`;

    return output;
}

function extractDeclaredCapabilities(content: string): Set<string> {
    const caps = new Set<string>();
    const regex = /"([^"]+)":\s*{/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (match[1].includes("/")) {
            caps.add(match[1]);
        }
    }

    return caps;
}

// ============================================================================
// CELL SETUP
// ============================================================================

// Register router (augmentation happens in separate declaration file)
cell.useRouter(codegenRouter);
cell.listen();

cell.log("INFO", "🧬 Enhanced Codegen cell online");

// Auto-generate types on startup
setTimeout(async () => {
    try {
        const result = await cell.askMesh("codegen/mesh-types" as any);
        if (result.ok) {
            cell.log("INFO", "✨ Initial type generation complete");
        }
    } catch (e) {
        cell.log("WARN", "Type generation delayed - mesh not ready");
    }
}, 3000);