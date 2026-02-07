/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: 2026-02-07T20:26:24.479Z
 * Source: Live mesh scan (37 capabilities)
 * 
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
        "ai/generate": { input: any; output: any };
        "architect/consult": { input: any; output: any };
        "coder/develop": { input: any; output: any };
        "comms/chat": { input: any; output: any };
        "comms/configure-channel": { input: any; output: any };
        "comms/end-session": { input: any; output: any };
        "comms/get-session": { input: any; output: any };
        "comms/get-stats": { input: any; output: any };
        "comms/start-session": { input: any; output: any };
        "kindly/chat": { input: any; output: any };
        "list/add": { input: any; output: any };
        "list/complete": { input: any; output: any };
        "list/get": { input: any; output: any };
        "list/suggest-tasks": { input: any; output: any };
        "list/summarize": { input: any; output: any };
        "log/get": { input: any; output: any };
        "log/info": { input: any; output: any };
        "memory/cleanup": { input: any; output: any };
        "memory/get-by-tag": { input: any; output: any };
        "memory/get-recent": { input: any; output: any };
        "memory/get-session": { input: any; output: any };
        "memory/get-thread": { input: any; output: any };
        "memory/search": { input: any; output: any };
        "memory/stats": { input: any; output: any };
        "memory/store": { input: any; output: any };
        "mesh/health": { input: any; output: any };
        "mesh/ping": { input: any; output: any };
        "projects/exec": { input: any; output: any };
        "projects/list": { input: any; output: any };
        "projects/read": { input: any; output: any };
        "projects/write": { input: any; output: any };
        "skills/get-context": { input: any; output: any };
        "skills/learn-pattern": { input: any; output: any };
        "skills/list": { input: any; output: any };
        "skills/search": { input: any; output: any };
        "skills/sync-from-mesh": { input: any; output: any };
        "skills/update-capability": { input: any; output: any };
    }
}

// ============================================================================
// NAMESPACE HELPERS (Optional convenience types)
// ============================================================================

/**
 * Capabilities in the ai namespace
 */
export type AiCapabilities = {
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
 * Capabilities in the comms namespace
 */
export type CommsCapabilities = {
    chat: { input: any; output: any };
    configure-channel: { input: any; output: any };
    end-session: { input: any; output: any };
    get-session: { input: any; output: any };
    get-stats: { input: any; output: any };
    start-session: { input: any; output: any };
};

/**
 * Capabilities in the kindly namespace
 */
export type KindlyCapabilities = {
    chat: { input: any; output: any };
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
    cleanup: { input: any; output: any };
    get-by-tag: { input: any; output: any };
    get-recent: { input: any; output: any };
    get-session: { input: any; output: any };
    get-thread: { input: any; output: any };
    search: { input: any; output: any };
    stats: { input: any; output: any };
    store: { input: any; output: any };
};

/**
 * Capabilities in the mesh namespace
 */
export type MeshCapabilities = {
    health: { input: any; output: any };
    ping: { input: any; output: any };
};

/**
 * Capabilities in the projects namespace
 */
export type ProjectsCapabilities = {
    exec: { input: any; output: any };
    list: { input: any; output: any };
    read: { input: any; output: any };
    write: { input: any; output: any };
};

/**
 * Capabilities in the skills namespace
 */
export type SkillsCapabilities = {
    get-context: { input: any; output: any };
    learn-pattern: { input: any; output: any };
    list: { input: any; output: any };
    search: { input: any; output: any };
    sync-from-mesh: { input: any; output: any };
    update-capability: { input: any; output: any };
};

// Type trigger: 1770495984479
