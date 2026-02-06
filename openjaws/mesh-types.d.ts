/**
 * 🤖 AUTO-GENERATED MESH TYPE DECLARATIONS
 * Generated: 2026-02-06T22:14:31.220Z
 * 
 * This file provides complete type safety for all mesh capabilities.
 * DO NOT EDIT MANUALLY - changes will be overwritten.
 * 
 * To regenerate: Call mesh.codegen['mesh-types']() or restart orchestrator
 */

declare module "./protocols/typed-mesh" {
    interface MeshCapabilities {
    }
}

// ============================================================================
// NAMESPACE HELPERS (Optional convenience types)
// ============================================================================

// ============================================================================
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
