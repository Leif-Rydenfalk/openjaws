/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: 2026-02-06T23:20:39.784Z
 * Source: Live mesh scan (14 capabilities)
 * 
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
        "ai/embed": { input: any; output: any };
        "ai/generate": { input: any; output: any };
        "codegen/mesh-types": { input: any; output: { ok: boolean; path?: string; capabilities?: number; namespaces?: Array<string> } };
        "codegen/poke-ts": { input: any; output: { ok: boolean } };
        "codegen/validate": { input: any; output: { ok: boolean; error?: string; missing?: Array<string>; undeclared?: Array<string>; stats?: { declared: number; actual: number } } };
        "list/add": { input: any; output: any };
        "list/complete": { input: any; output: any };
        "list/get": { input: any; output: any };
        "list/suggest-tasks": { input: any; output: any };
        "list/summarize": { input: any; output: any };
        "log/get": { input: any; output: any };
        "log/info": { input: any; output: any };
        "mesh/health": { input: any; output: any };
        "mesh/ping": { input: any; output: any };
    }
}

// ============================================================================
// NAMESPACE HELPERS (Optional convenience types)
// ============================================================================

/**
 * Capabilities in the ai namespace
 */
export type AiCapabilities = {
    embed: { input: any; output: any };
    generate: { input: any; output: any };
};

/**
 * Capabilities in the codegen namespace
 */
export type CodegenCapabilities = {
    mesh-types: { input: any; output: { ok: boolean; path?: string; capabilities?: number; namespaces?: Array<string> } };
    poke-ts: { input: any; output: { ok: boolean } };
    validate: { input: any; output: { ok: boolean; error?: string; missing?: Array<string>; undeclared?: Array<string>; stats?: { declared: number; actual: number } } };
};

/**
 * Capabilities in the list namespace
 */
export type ListCapabilities = {
    add: { input: any; output: any };
    complete: { input: any; output: any };
    get: { input: any; output: any };
    suggest-tasks: { input: any; output: any };
    summarize: { input: any; output: any };
};

/**
 * Capabilities in the log namespace
 */
export type LogCapabilities = {
    get: { input: any; output: any };
    info: { input: any; output: any };
};

/**
 * Capabilities in the mesh namespace
 */
export type MeshCapabilities = {
    health: { input: any; output: any };
    ping: { input: any; output: any };
};

// Type trigger: 1770420039784
