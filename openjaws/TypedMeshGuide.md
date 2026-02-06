# Type-Safe Mesh Integration Guide

This guide shows how to build and use the fully type-safe Rheo mesh system.

## Table of Contents

1. [Overview](#overview)
2. [Backend Cell Development](#backend-cell-development)
3. [Frontend Integration](#frontend-integration)
4. [Type Generation](#type-generation)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The type-safe mesh system provides **100% compile-time type safety** for all mesh calls:

- ✅ **Capability validation**: Only valid capabilities can be called
- ✅ **Input validation**: Arguments must match the expected schema
- ✅ **Output typing**: Return values are fully typed
- ✅ **Cross-language ready**: Type definitions can be generated for any language
- ✅ **Frontend/Backend parity**: Same API everywhere

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Type System Layer                        │
│  mesh-types.d.ts (auto-generated from live mesh)            │
│  protocols/typed-mesh.ts (base type infrastructure)         │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  Backend Cell  │  │  Backend Cell  │  │   Frontend     │
│   (TypedCell)  │  │   (TypedCell)  │  │  (mesh proxy)  │
│                │  │                │  │                │
│  • AI Cell     │  │  • Checklist   │  │  • SvelteKit   │
│  • Log Cell    │  │  • Telemetry   │  │  • React       │
│  • etc.        │  │  • etc.        │  │  • etc.        │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## Backend Cell Development

### Step 1: Create Your Router

```typescript
// mycell/index.ts
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

// Define your router with full type safety
const myRouter = router({
    myspace: router({
        // Query procedure (read-only)
        getData: procedure.query(async () => {
            return {
                status: "ok" as const,
                data: ["item1", "item2"]
            };
        }),
        
        // Mutation procedure (with input validation)
        updateData: procedure
            .input(z.object({
                id: z.string(),
                value: z.number()
            }))
            .mutation(async (input) => {
                // input is typed as { id: string, value: number }
                console.log(`Updating ${input.id} to ${input.value}`);
                
                return {
                    success: true,
                    updatedId: input.id
                };
            })
    })
});
```

### Step 2: Augment Global Types

```typescript
// Still in mycell/index.ts

// Augment the global MeshCapabilities interface
declare module "../protocols/typed-mesh" {
    interface MeshCapabilities {
        "myspace/getData": {
            input: void;
            output: {
                status: "ok";
                data: string[];
            };
        };
        
        "myspace/updateData": {
            input: {
                id: string;
                value: number;
            };
            output: {
                success: boolean;
                updatedId: string;
            };
        };
    }
}
```

### Step 3: Initialize Cell

```typescript
// Still in mycell/index.ts

const cell = new TypedRheoCell(`MyCell_${process.pid}`, 0, process.argv[2]);

// Register the router
(cell as any).useRouter(myRouter);

// Start listening
cell.listen();

cell.log("INFO", "My type-safe cell is online!");
```

### Step 4: Call Other Cells

```typescript
// Now you can call other cells with full type safety!

async function doWork() {
    // ✅ Call AI cell
    const aiResponse = await cell.mesh.ai.generate({
        prompt: "Explain quantum computing"
    });
    // aiResponse is typed as { model: string, response: string, done: boolean }
    
    // ✅ Call checklist cell
    const list = await cell.mesh.list.get();
    // list is typed as { items: ListItem[], capacity: number, date: string }
    
    // ✅ Call mesh health
    const health = await cell.mesh.mesh.health();
    // health is typed as { totalCells: number, avgLoad: number, ... }
    
    // ❌ These would be compile errors:
    // await cell.mesh.ai.generate({ prmpt: "typo" }); // Wrong property
    // await cell.mesh.nonexistent.method(); // Doesn't exist
    // await cell.mesh.list.get({ wrongParam: true }); // get() takes no args
}
```

---

## Frontend Integration

### SvelteKit Example

```typescript
// +page.svelte
<script lang="ts">
    import { mesh } from '$lib/typed-mesh-runtime';
    import { onMount } from 'svelte';
    
    // State with proper types
    let items: Awaited<ReturnType<typeof mesh.list.get>>["items"] = [];
    let loading = true;
    let error = "";
    
    onMount(async () => {
        try {
            // ✅ Fully typed mesh call
            const result = await mesh.list.get();
            items = result.items;
        } catch (e) {
            error = (e as Error).message;
        } finally {
            loading = false;
        }
    });
    
    async function addTask(text: string) {
        // ✅ Type-safe mutation
        const result = await mesh.list.add({
            text,
            type: "task"
        });
        
        if (result.ok) {
            items = [...items, result.item];
        }
    }
    
    async function getSummary() {
        // ✅ Cross-cell call (checklist -> AI)
        const summary = await mesh.list.summarize();
        alert(summary.summary);
    }
</script>

{#if loading}
    <p>Loading...</p>
{:else if error}
    <p>Error: {error}</p>
{:else}
    <ul>
        {#each items as item}
            <li>{item.text}</li>
        {/each}
    </ul>
    
    <button on:click={getSummary}>
        Get AI Summary
    </button>
{/if}
```

### React Example

```typescript
// App.tsx
import { mesh, meshCall } from './lib/typed-mesh-runtime';
import { useEffect, useState } from 'react';

function App() {
    const [items, setItems] = useState<
        Awaited<ReturnType<typeof mesh.list.get>>["items"]
    >([]);
    
    useEffect(() => {
        async function load() {
            // ✅ Fully typed
            const result = await mesh.list.get();
            setItems(result.items);
        }
        load();
    }, []);
    
    async function handleAdd(text: string) {
        // ✅ Type-safe call
        const result = await mesh.list.add({ text, type: "task" });
        if (result.ok) {
            setItems([...items, result.item]);
        }
    }
    
    return (
        <div>
            {items.map(item => (
                <div key={item.id}>{item.text}</div>
            ))}
        </div>
    );
}
```

---

## Type Generation

### Automatic Generation

The codegen cell automatically generates type declarations:

1. **On mesh startup**: Types are generated when the orchestrator starts
2. **On topology changes**: When cells join/leave, types are regenerated
3. **On demand**: Call `mesh.codegen['mesh-types']()` to regenerate

### Manual Generation

```bash
# From any cell
bun run -e "
const cell = new TypedRheoCell('Manual', 0);
cell.listen();
await cell.mesh.codegen['mesh-types']();
process.exit(0);
"
```

### Validation

Check that runtime mesh matches generated types:

```typescript
const validation = await cell.mesh.codegen['validate-mesh']();

if (!validation.ok) {
    console.log('Missing capabilities:', validation.missing);
    console.log('Undeclared capabilities:', validation.undeclared);
}
```

---

## Best Practices

### 1. Always Define Output Types

```typescript
// ❌ BAD - output type is inferred as any
const badRouter = router({
    myspace: router({
        getData: procedure.query(async () => {
            return fetchData(); // Return type unknown
        })
    })
});

// ✅ GOOD - explicit output type
const goodRouter = router({
    myspace: router({
        getData: procedure.query(async (): Promise<MyDataType> => {
            return fetchData();
        })
    })
});
```

### 2. Use Const Assertions for Enums

```typescript
// ✅ GOOD - discriminated union
return {
    status: "success" as const,
    data: result
};

// Later, TypeScript knows status is exactly "success"
```

### 3. Namespace Organization

Group related capabilities under the same namespace:

```typescript
// ✅ GOOD
router({
    users: router({
        get: procedure...,
        create: procedure...,
        update: procedure...,
        delete: procedure...
    })
});

// ❌ BAD - scattered capabilities
router({
    getUser: procedure...,
    createUser: procedure...,
    // Hard to discover and organize
});
```

### 4. Error Handling

```typescript
// Use try-catch for mesh calls
try {
    const result = await cell.mesh.ai.generate({ prompt });
    return result.response;
} catch (e) {
    // Handle mesh errors gracefully
    return "AI service unavailable";
}
```

### 5. Type-Safe Stores (Svelte)

```typescript
import { writable, derived } from 'svelte/store';
import { mesh } from '$lib/typed-mesh-runtime';

// Create typed store
export const healthStore = writable<
    Awaited<ReturnType<typeof mesh.mesh.health>>
>({
    totalCells: 0,
    avgLoad: 0,
    status: "NOMINAL",
    hotSpots: [],
    timestamp: 0
});

// Auto-update
setInterval(async () => {
    const health = await mesh.mesh.health();
    healthStore.set(health);
}, 5000);
```

---

## Troubleshooting

### "Property does not exist on type"

**Cause**: Type declarations haven't been generated yet.

**Solution**: 
1. Ensure codegen cell is running
2. Wait for mesh to stabilize (15 seconds)
3. Manually trigger: `await cell.mesh.codegen['mesh-types']()`
4. Restart TypeScript server in your IDE

### "Cannot find module '../mesh-types'"

**Cause**: Type file hasn't been generated.

**Solution**:
```bash
cd openjaws
bun run orchestrator/index.ts start
# Wait 15 seconds for type generation
```

### Cross-cell call fails at runtime but compiles

**Cause**: Target cell is offline or mesh hasn't converged.

**Solution**:
```typescript
try {
    const result = await cell.mesh.targetcell.method();
    return result;
} catch (e) {
    // Fallback or retry logic
    cell.log("WARN", "Target cell unavailable");
    return defaultValue;
}
```

### Types are stale after cell update

**Cause**: Type declarations need to be regenerated.

**Solution**:
The orchestrator should auto-regenerate every 30 seconds. To force:
```typescript
await cell.mesh.codegen['mesh-types']();
```

---

## Advanced Patterns

### Conditional Capabilities

```typescript
// Only register capability if feature is enabled
if (process.env.ENABLE_PREMIUM === "true") {
    router({
        premium: router({
            advancedFeature: procedure.mutation(async () => {
                // ...
            })
        })
    });
}
```

### Capability Composition

```typescript
// Compose multiple mesh calls
async function smartSummary(userId: string) {
    // Get user data
    const userData = await cell.mesh.users.get({ id: userId });
    
    // Get their tasks
    const tasks = await cell.mesh.list.get();
    
    // Generate AI summary
    const summary = await cell.mesh.ai.generate({
        prompt: `Summarize tasks for ${userData.name}: ${tasks.items.map(i => i.text).join(', ')}`
    });
    
    return summary.response;
}
```

### Type-Safe Middleware

```typescript
// Create middleware that preserves types
function withAuth<T extends ValidCapability>(
    capability: T,
    handler: (input: CapabilityInput<T>) => Promise<CapabilityOutput<T>>
) {
    return async (input: CapabilityInput<T>): Promise<CapabilityOutput<T>> => {
        // Auth check
        if (!isAuthenticated()) {
            throw new Error("Unauthorized");
        }
        
        return handler(input);
    };
}
```

---

## Summary

The type-safe mesh system provides:

1. **Compile-time safety**: Catch errors before runtime
2. **IDE support**: Full autocomplete and documentation
3. **Refactoring confidence**: Rename capabilities across the codebase
4. **Cross-language ready**: Generate types for Python, Rust, etc.
5. **Frontend/backend parity**: Same API everywhere

**Next steps**:
1. Start with the provided example cells (ai1, checklist)
2. Create your own cell following the patterns
3. Use the frontend integration in your UI
4. Let the codegen cell handle type generation automatically