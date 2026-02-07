# RheoMesh - 100% Automatic Type Generation

## The Problem You Wanted Solved

You wanted **tRPC-style type safety** but for a **distributed mesh** where cells come and go dynamically. The key requirement: **zero manual type definitions** - the system should automatically discover and generate types from the live mesh.

## How It Works

### 🤖 Fully Automatic Type Generation

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cells join mesh with typed routers                      │
│     ├─ checklist: router({ list: { add, get, complete } })  │
│     ├─ ai1: router({ ai: { generate } })                    │
│     └─ telemetry: router({ mesh: { health } })              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Orchestrator detects mesh changes                       │
│     - New cell joined                                        │
│     - Cell capabilities changed                              │
│     - Cell left the mesh                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Codegen cell scans live mesh                            │
│     - Discovers all cells via atlas                          │
│     - Maps capabilities to cell types                        │
│     - Generates TypeScript imports                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. rheo-mesh.d.ts is auto-generated                        │
│     import type { ChecklistRouter } from './checklist'       │
│     import type { AiRouter } from './ai1'                    │
│                                                              │
│     export interface RheoMesh {                              │
│       list: InferRouter<ChecklistRouter>['list'];           │
│       ai: InferRouter<AiRouter>['ai'];                       │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. TypeScript picks up changes (HMR in dev)                │
│     - IntelliSense updates                                   │
│     - Type errors appear/disappear                           │
│     - Frontend gets instant autocomplete                     │
└─────────────────────────────────────────────────────────────┘
```

## Example Workflow

### Step 1: Define a Cell with Typed Router

```typescript
// checklist/index.ts
import { RheoCell, router, procedure, z } from "../protocols/example2";

const checklistRouter = router({
  list: router({
    add: procedure
      .input(z.object({
        text: z.string(),
        type: z.enum(['task', 'idea'])
      }))
      .mutation(async (input) => {
        return { ok: true, item: createItem(input) };
      })
  })
});

cell.useRouter(checklistRouter);
cell.listen();

// Export type for codegen to import
export type ChecklistRouter = typeof checklistRouter;
```

### Step 2: Types Auto-Generate (Zero Config)

When the cell starts:
1. Orchestrator detects new cell
2. Triggers `codegen/mesh-types` capability
3. Codegen scans atlas and generates:

```typescript
// rheo-mesh.d.ts (AUTO-GENERATED)
import type { ChecklistRouter } from './checklist/index';
import type { InferRouter } from './protocols/example2';

export interface RheoMesh {
    list: InferRouter<ChecklistRouter>['list'];
}
```

### Step 3: Use Types in Frontend (Instant IntelliSense)

```typescript
// ui/src/routes/+page.svelte
import { mesh } from "$lib/mesh-runtime";

// ✅ TypeScript knows this exists and its exact shape
const result = await mesh.list.add.mutate({
  text: "Buy milk",
  type: "task" // ✅ Only "task" | "idea" allowed
});

// ✅ Result is fully typed
console.log(result.item.id);
```

## Key Components

### 1. Codegen Cell (`codegen/index.ts`)

**Capability**: `codegen/mesh-types`

**What it does**:
- Scans `cell.atlas` for all active cells
- Extracts capability namespaces (e.g., "list", "ai", "mesh")
- Maps namespaces to cell types (e.g., "list" → "checklist")
- Generates TypeScript imports and interface
- Writes to `rheo-mesh.d.ts`

**Triggered by**:
- Orchestrator on mesh changes
- Manual call via `mesh.codegen['mesh-types'].query()`

### 2. Orchestrator (`orchestrator/index.ts`)

**Type Evolution Logic**:
```typescript
async function performTypeEvolution() {
  // Hash current mesh state
  const stateHash = hashMeshState(atlas);
  
  // Only regenerate if changed
  if (stateHash !== lastHash) {
    await orchestratorCell.askMesh("codegen/mesh-types", {});
  }
}

// Auto-check every 30 seconds
setInterval(performTypeEvolution, 30000);
```

### 3. Cell Protocol (`protocols/example2.ts`)

**Type Inference**:
```typescript
export type InferRouter<T extends Router<any>> = {
  [K in keyof T['_def']['procedures']]: InferProcedure<T['_def']['procedures'][K]>
};

// Extracts { query: (input: I) => Promise<O> } from procedure
type InferProcedure<T> = T extends Procedure<infer I, infer O>
  ? I extends void
    ? { query: () => Promise<O>; mutate: () => Promise<O> }
    : { query: (input: I) => Promise<O>; mutate: (input: I) => Promise<O> }
  : ...
```

## Generated File Structure

```typescript
// rheo-mesh.d.ts (EXAMPLE - auto-generated)

/**
 * 🤖 AUTO-GENERATED RHEO MESH TYPES
 * Generated: 2024-02-06T14:23:45.123Z
 * DO NOT EDIT MANUALLY
 */

import type { ChecklistRouter } from './checklist/index';
import type { AiRouter } from './ai1/index';
import type { TelemetryRouter } from './telemetry/index';
import type { LogRouter } from './log/index';
import type { InferRouter } from './protocols/example2';

export interface RheoMesh {
    list: InferRouter<ChecklistRouter>['list'];
    ai: InferRouter<AiRouter>['ai'];
    mesh: InferRouter<TelemetryRouter>['mesh'];
    log: InferRouter<LogRouter>['log'];
    cell: InferRouter<LogRouter>['cell'];
}

// Helper types for extracting input/output
export type MeshInput<...> = ...;
export type MeshOutput<...> = ...;
```

## Triggering Regeneration

### Automatic (Default)
- **On startup**: Orchestrator generates types after mesh converges
- **Every 30s**: Checks if mesh changed, regenerates if needed
- **On cell join/leave**: Mesh hash changes, triggers regeneration

### Manual
```typescript
// From any cell
const result = await cell.askMesh("codegen/mesh-types", {});
console.log("Generated:", result.value.namespaces);
```

### Development (Vite HMR)
The existing `vite-plugin-mesh-types.ts` can poll the generated file:

```typescript
// vite-plugin-mesh-types.ts
export function meshTypesPlugin() {
  return {
    configureServer(server) {
      setInterval(() => {
        // Check if rheo-mesh.d.ts changed
        // Trigger HMR if it did
      }, 5000);
    }
  };
}
```

## What Makes This "100% Automatic"?

| Aspect | Manual (tRPC-style) | Auto (RheoMesh) |
|--------|---------------------|-----------------|
| **Type Definition** | Write `AppRouter` by hand | ✅ Inferred from cells |
| **Import Statements** | Add imports manually | ✅ Generated from atlas |
| **Namespace Mapping** | Define manually | ✅ Extracted from capabilities |
| **Type Updates** | Edit manually | ✅ Auto-regenerates on change |
| **Cell Discovery** | Hard-coded | ✅ Scanned from live mesh |

## Migration from Manual to Auto

### Before (Manual rheo-mesh.d.ts)
```typescript
// ❌ You had to write this by hand
export interface RheoMesh {
  list: InferRouter<ChecklistRouter>['list'];
  ai: InferRouter<AiRouter>['ai'];
}
```

### After (Automatic)
```typescript
// ✅ Just export the router type
export type ChecklistRouter = typeof checklistRouter;

// ✅ Types auto-appear in rheo-mesh.d.ts
// ✅ IntelliSense just works
```

## Benefits

1. **Zero Boilerplate**: Define router once, types everywhere
2. **Self-Healing**: Types update when mesh topology changes
3. **Type Safety**: Compile-time errors for invalid calls
4. **Runtime Validation**: Schemas catch errors before handlers
5. **Discovery**: No need to know which cells exist
6. **Scalability**: Add 100 cells, types update automatically

## Debugging Type Generation

### Check Generated File
```bash
cat rheo-mesh.d.ts
```

### Trigger Manual Regeneration
```bash
# From any cell
bun run -e "
import { RheoCell } from './protocols/example1';
const c = new RheoCell('debug');
c.listen();
c.askMesh('codegen/mesh-types', {}).then(console.log);
"
```

### View Codegen Logs
```bash
tail -f .rheo/logs/Codegen_*.log
```

## Limitations & Future Work

### Current Limitations
- ❌ Nested routers beyond 2 levels not fully supported
- ❌ Circular type references not handled
- ❌ No validation of exported router type names

### Future Enhancements
- 🔮 Watch mode for instant regeneration in dev
- 🔮 Validation that exported types match runtime
- 🔮 Generate JSON schema for documentation
- 🔮 Support for subscriptions/events in types
- 🔮 Middleware type composition

---

**Status**: ✅ Fully automatic type generation implemented
**No manual steps required**: Types update automatically when mesh changes
**Developer experience**: Same as tRPC but for distributed systems