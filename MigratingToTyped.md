# Migration Guide: Converting Existing Cells to Type-Safe

This guide shows how to convert your existing Rheo mesh cells to use the type-safe system.

## Before You Start

**Prerequisites:**
- TypeScript 5.0+ installed
- Existing cells using `RheoCell` from `example1.ts`
- Basic familiarity with TypeScript types

**Time Required:** 10-15 minutes per cell

---

## Step-by-Step Migration

### Example: Migrating the AI Cell

#### BEFORE (example1.ts style)

```typescript
// ai1/index.ts - OLD VERSION
import { RheoCell } from "../protocols/example1";

const cell = new RheoCell(`AI_${process.pid}`, 0, process.argv[2]);

cell.provide("ai/generate", async (args: any) => {
    const { prompt, model } = args;
    
    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        body: JSON.stringify({ model: model || "llama3", prompt, stream: false })
    });
    
    return await response.json();
});

cell.listen();
```

**Problems with this approach:**
- ❌ `args: any` - no input validation
- ❌ Return type is `any` - no output typing
- ❌ Callers have no type safety
- ❌ No IDE autocomplete

#### AFTER (typed-mesh.ts style)

```typescript
// ai1/index.ts - NEW VERSION
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

// 1. Create typed router
const aiRouter = router({
    ai: router({
        generate: procedure
            .input(z.object({
                prompt: z.string(),
                model: z.optional(z.string())
            }))
            .mutation(async (input) => {
                // input is now { prompt: string, model?: string }
                const response = await fetch("http://localhost:11434/api/generate", {
                    method: "POST",
                    body: JSON.stringify({
                        model: input.model || "llama3",
                        prompt: input.prompt,
                        stream: false
                    })
                });
                
                const result = await response.json();
                
                // Explicit return type
                return {
                    model: result.model,
                    response: result.response,
                    done: result.done
                } as {
                    model: string;
                    response: string;
                    done: boolean;
                };
            })
    })
});

// 2. Augment global types
declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        "ai/generate": {
            input: {
                prompt: string;
                model?: string;
            };
            output: {
                model: string;
                response: string;
                done: boolean;
            };
        };
    }
}

// 3. Use TypedRheoCell
const cell = new TypedRheoCell(`AI_${process.pid}`, 0, process.argv[2]);

// 4. Register router
(cell as any).useRouter(aiRouter);

cell.listen();
```

**Benefits:**
- ✅ Input is validated at compile-time AND runtime
- ✅ Output type is explicit and enforced
- ✅ Callers get full type safety
- ✅ IDE autocomplete works perfectly

---

## Migration Checklist

For each cell you're migrating:

### 1. Update Imports

```typescript
// OLD
import { RheoCell } from "../protocols/example1";

// NEW
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
```

### 2. Convert `cell.provide()` to Routers

**Pattern:** `cell.provide(capability, handler)` → `router({ namespace: { procedure } })`

```typescript
// OLD
cell.provide("users/get", async (args: any) => {
    return getUser(args.id);
});

cell.provide("users/create", async (args: any) => {
    return createUser(args.name, args.email);
});

// NEW
const userRouter = router({
    users: router({
        get: procedure
            .input(z.object({ id: z.string() }))
            .query(async (input) => {
                return getUser(input.id);
            }),
        
        create: procedure
            .input(z.object({
                name: z.string(),
                email: z.string()
            }))
            .mutation(async (input) => {
                return createUser(input.name, input.email);
            })
    })
});
```

### 3. Add Type Augmentation

```typescript
declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        // Add each capability
        "users/get": {
            input: { id: string };
            output: User; // Your return type
        };
        "users/create": {
            input: { name: string; email: string };
            output: { ok: boolean; user: User };
        };
    }
}
```

### 4. Change Cell Class

```typescript
// OLD
const cell = new RheoCell(`MyCell_${process.pid}`, 0, seed);

// NEW
const cell = new TypedRheoCell(`MyCell_${process.pid}`, 0, seed);
```

### 5. Register Router

```typescript
// OLD
// cell.provide() calls already done

// NEW
(cell as any).useRouter(myRouter);
```

### 6. Update Cross-Cell Calls

```typescript
// OLD
const result = await cell.askMesh("ai/generate", { prompt: "test" });
// result.value is any

// NEW
const result = await cell.mesh.ai.generate({ prompt: "test" });
// result is { model: string, response: string, done: boolean }
```

---

## Common Patterns

### Pattern 1: Capability with No Input

```typescript
// OLD
cell.provide("status/health", async () => {
    return { status: "ok", uptime: process.uptime() };
});

// NEW
router({
    status: router({
        health: procedure.query(async () => {
            return {
                status: "ok" as const,
                uptime: process.uptime()
            };
        })
    })
});

declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        "status/health": {
            input: void;
            output: {
                status: "ok";
                uptime: number;
            };
        };
    }
}
```

### Pattern 2: Optional Parameters

```typescript
// OLD
cell.provide("search/query", async (args: any) => {
    const limit = args.limit || 10;
    return performSearch(args.term, limit);
});

// NEW
router({
    search: router({
        query: procedure
            .input(z.object({
                term: z.string(),
                limit: z.optional(z.number())
            }))
            .query(async (input) => {
                const limit = input.limit ?? 10;
                return performSearch(input.term, limit);
            })
    })
});
```

### Pattern 3: Cross-Cell Calls

```typescript
// OLD
const aiResult = await cell.askMesh("ai/generate", { prompt: "test" });
if (aiResult.ok) {
    const response = aiResult.value.response; // any
}

// NEW
const response = await cell.mesh.ai.generate({ prompt: "test" });
// response is { model: string, response: string, done: boolean }
console.log(response.response); // typed!
```

### Pattern 4: Error Handling

```typescript
// OLD
const result = await cell.askMesh("ai/generate", { prompt: "test" });
if (!result.ok) {
    console.error(result.error);
}

// NEW
try {
    const response = await cell.mesh.ai.generate({ prompt: "test" });
    console.log(response.response);
} catch (e) {
    console.error("AI call failed:", e);
}
```

---

## Testing Your Migration

### 1. Verify Compilation

```bash
bun run --bun tsc --noEmit
# Should have no type errors
```

### 2. Test Type Safety

Add intentional errors to verify type checking works:

```typescript
// These should all be compile errors:
// await cell.mesh.ai.generate({ prmpt: "typo" });
// await cell.mesh.nonexistent.method();
// await cell.mesh.list.add({ text: 123 });
```

### 3. Test Runtime

```bash
# Start your cell
bun run my-cell/index.ts

# Verify it appears in mesh
bun run -e "
const cell = new TypedRheoCell('Test', 0);
cell.listen();
await new Promise(r => setTimeout(r, 3000));
const health = await cell.mesh.mesh.health();
console.log(health);
"
```

---

## Troubleshooting

### "Property does not exist on type"

**Cause:** Type augmentation not loaded.

**Fix:** Ensure you have the `declare module` block in your cell file.

### "Cannot find module"

**Cause:** Import paths are wrong.

**Fix:** Check that `../protocols/typed-mesh` path is correct relative to your cell.

### "Type 'any' is not assignable"

**Cause:** You're mixing old and new APIs.

**Fix:** Make sure you're using `TypedRheoCell` not `RheoCell`, and `mesh.namespace.procedure()` not `askMesh()`.

### Runtime errors but compiles fine

**Cause:** Mesh isn't ready yet.

**Fix:** Add delays before making cross-cell calls during startup:

```typescript
setTimeout(async () => {
    const result = await cell.mesh.ai.generate({ prompt: "test" });
}, 5000); // Wait 5s for mesh to stabilize
```

---

## Migration Priority

Migrate cells in this order for easiest transition:

1. **Leaf cells** (cells that don't call others): `ai1`, `log`, `telemetry`
2. **Mid-level cells** (call leaf cells): `checklist`  
3. **Orchestrator cells** (call everything)
4. **Frontend** (once backend is migrated)

---

## Example: Full Cell Migration

Here's a complete before/after for reference:

### BEFORE

```typescript
import { RheoCell } from "../protocols/example1";

const cell = new RheoCell(`Store_${process.pid}`, 0);

const items: string[] = [];

cell.provide("store/list", async () => {
    return items;
});

cell.provide("store/add", async (args: any) => {
    items.push(args.item);
    return { ok: true };
});

cell.listen();
```

### AFTER

```typescript
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`Store_${process.pid}`, 0);

const items: string[] = [];

const storeRouter = router({
    store: router({
        list: procedure.query(async () => {
            return { items };
        }),
        
        add: procedure
            .input(z.object({
                item: z.string()
            }))
            .mutation(async (input) => {
                items.push(input.item);
                return { ok: true };
            })
    })
});

declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        "store/list": {
            input: void;
            output: { items: string[] };
        };
        "store/add": {
            input: { item: string };
            output: { ok: boolean };
        };
    }
}

(cell as any).useRouter(storeRouter);
cell.listen();
```

---

## Summary

**Migration steps:**
1. ✅ Import `TypedRheoCell`, `router`, `procedure`, `z`
2. ✅ Convert `cell.provide()` → `router()`
3. ✅ Add `declare module` type augmentation
4. ✅ Use `TypedRheoCell` instead of `RheoCell`
5. ✅ Call `cell.useRouter()`
6. ✅ Update cross-cell calls to use `mesh.namespace.procedure()`

**Result:** Full compile-time type safety across your entire mesh! 🎉