/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: 2026-02-10T20:58:02.908Z
 * Source: Live mesh scan (36 capabilities)
 * 
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
        "ai/generate": { input: any; output: any };
        "ai/reset-usage": { input: any; output: any };
        "ai/usage": { input: any; output: any };
        "architect/consult": { input: any; output: any };
        "coder/develop": { input: any; output: any };
        "kindly/chat": { input: any; output: any };
        "kindly/get-activity": { input: any; output: any };
        "list/add": { input: any; output: any };
        "list/complete": { input: any; output: any };
        "list/get": { input: any; output: any };
        "list/suggest-tasks": { input: any; output: any };
        "list/summarize": { input: any; output: any };
        "log/get": { input: any; output: any };
        "log/info": { input: any; output: any };
        "mesh/health": { input: any; output: any };
        "mesh/ping": { input: any; output: any };
        "projects/exec": { input: any; output: any };
        "projects/list": { input: any; output: any };
        "projects/read": { input: any; output: any };
        "projects/write": { input: any; output: any };
        "safety/get-close-proximity": { input: any; output: any };
        "safety/run-test-sequence": { input: any; output: any };
        "sensors/proximity": { input: any; output: any };
        "simple-ai/chat": { input: any; output: any };
        "simple-ai/clear": { input: any; output: any };
        "simple-ai/history": { input: any; output: any };
        "simple-ai/session": { input: any; output: any };
        "simple-ai/stats": { input: any; output: any };
        "skills/get-context": { input: any; output: any };
        "skills/learn-pattern": { input: any; output: any };
        "skills/list": { input: any; output: any };
        "skills/search": { input: any; output: any };
        "skills/sync-from-mesh": { input: any; output: any };
        "skills/update-capability": { input: any; output: any };
        "tts/status": { input: any; output: any };
        "tts/synthesize": { input: any; output: any };
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
    reset-usage: { input: any; output: any };
    usage: { input: any; output: any };
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
 * Capabilities in the kindly namespace
 */
export type KindlyCapabilities = {
    chat: { input: any; output: any };
    get-activity: { input: any; output: any };
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
 * Capabilities in the safety namespace
 */
export type SafetyCapabilities = {
    get-close-proximity: { input: any; output: any };
    run-test-sequence: { input: any; output: any };
};

/**
 * Capabilities in the sensors namespace
 */
export type SensorsCapabilities = {
    proximity: { input: any; output: any };
};

/**
 * Capabilities in the simple-ai namespace
 */
export type Simple-aiCapabilities = {
    chat: { input: any; output: any };
    clear: { input: any; output: any };
    history: { input: any; output: any };
    session: { input: any; output: any };
    stats: { input: any; output: any };
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

/**
 * Capabilities in the tts namespace
 */
export type TtsCapabilities = {
    status: { input: any; output: any };
    synthesize: { input: any; output: any };
};

// Type trigger: 1770757082909
