/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: 2026-02-07T00:25:17.278Z
 * Source: Live mesh scan (15 capabilities)
 * 
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
        "ai/embed": { input: any; output: any };
        "ai/generate": { input: any; output: any };
        "architect/consult": { input: any; output: any };
        "coder/develop": { input: any; output: any };
        "list/add": { input: any; output: any };
        "list/complete": { input: any; output: any };
        "list/get": { input: any; output: any };
        "list/suggest-tasks": { input: any; output: any };
        "list/summarize": { input: any; output: any };
        "log/get": { input: any; output: any };
        "log/info": { input: any; output: any };
        "memory/search": { input: any; output: any };
        "memory/store": { input: any; output: any };
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
 * Capabilities in the architect namespace
 */
export type ArchitectCapabilities = {
    consult: { input: any; output: any };
};

/**
 * Capabilities in the coder namespace
 */
export type CoderCapabilities = {
    develop: { input: any; output: any };
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
 * Capabilities in the memory namespace
 */
export type MemoryCapabilities = {
    search: { input: any; output: any };
    store: { input: any; output: any };
};

/**
 * Capabilities in the mesh namespace
 */
export type MeshCapabilities = {
    health: { input: any; output: any };
    ping: { input: any; output: any };
};

// Type trigger: 1770423917278
