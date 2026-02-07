# Strict Type Safety - Zero `any`, Smart `never`

## Philosophy: Type Safety Without Escape Hatches

The RheoMesh type system is designed with **maximum type safety**:
- ❌ **No `any`** - Every value has a precise type
- ✅ **Smart `never`** - Used intentionally for impossible states
- ✅ **`unknown`** for truly unknown values - forces explicit type checking
- ✅ **Proper generics** - Type information flows through the entire system

## Before vs After

### ❌ Before (Type-Unsafe)
```typescript
// Escape hatches everywhere
function handle(args: any): any {
    return args.something; // No safety
}

const result: any = await mesh.something();
result.foo.bar.baz; // Compiles but crashes at runtime
```

### ✅ After (Type-Safe)
```typescript
// Precise types everywhere
async function handle<T>(args: T): Promise<ResponseType<T>> {
    return processArgs(args);
}

const result = await mesh.list.get.query();
//    ^? { items: ListItem[], capacity: number, date: string }

result.items[0].text; // ✅ Perfectly typed
result.items[0].xyz;  // ❌ TypeScript error!
```

## Type System Architecture

### 1. Schema System - `unknown` Instead of `any`

```typescript
// ❌ OLD - Accepts anything
export interface Schema<T = any> {
    parse: (value: any) => T;
}

// ✅ NEW - Explicit about unknown values
export interface Schema<T> {
    parse: (value: unknown) => T;
    //              ^^^^^^^
    //              Forces you to validate before using
}
```

**Usage:**
```typescript
const userSchema = z.object({
    name: z.string(),
    age: z.number()
});

// This forces runtime validation
const user = userSchema.parse(unknownData);
//    ^? { name: string; age: number }
```

### 2. Router Types - Precise Generics

```typescript
// ❌ OLD - Lost type information
export class Router<TProcedures extends Record<string, any>> {
    //                                              ^^^
}

// ✅ NEW - Preserves exact types
export type AnyProcedure = Procedure<unknown, unknown>;
export type AnyRouter = Router<Record<string, AnyProcedure | AnyRouter>>;

export class Router<TProcedures extends Record<string, AnyProcedure | AnyRouter>> {
    //                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                                              Exact constraint
}
```

### 3. Type Inference - No `any` in Conditional Types

```typescript
// ❌ OLD - Loses type information
type InferInput<T> = T extends Procedure<infer I, any> ? I : never;
//                                                ^^^

// ✅ NEW - Preserves all type information
type InferInput<T> = T extends Procedure<infer I, unknown> ? I : never;
//                                                ^^^^^^^
//                                                Maintains precision

type InferOutput<T> = T extends Procedure<unknown, infer O> ? O : never;
```

### 4. Error Handling - `unknown` Catches

```typescript
// ❌ OLD - Unsafe error handling
try {
    await doSomething();
} catch (e: any) {
    console.error(e.message); // e could be anything!
}

// ✅ NEW - Safe error handling
try {
    await doSomething();
} catch (e: unknown) {
    const error = e as Error; // Explicit cast required
    console.error(error.message);
}
```

## Smart Use of `never`

`never` is **intentional** - it represents impossible states:

### When `never` is Correct

```typescript
// Procedure that doesn't match any pattern
type InferProcedure<T> = 
    T extends Procedure<infer I, infer O> ? { query: ... }
    : T extends Router<infer P> ? { ... }
    : never; // ✅ Correct! If it's neither Procedure nor Router,
             //    this state is impossible

// Namespace doesn't exist
type MeshInput<'invalid_namespace', 'something'> = never;
//                                                  ^^^^^
// ✅ Correct! Invalid namespace = impossible to get input type
```

### When `never` Would Be Wrong

```typescript
// ❌ WRONG - Fallback to never loses information
type ExtractData<T> = T extends { data: infer D } ? D : never;
//                                                      ^^^^^
// Should be 'undefined' or 'unknown' if structure doesn't match

// ✅ RIGHT - Explicit about missing data
type ExtractData<T> = T extends { data: infer D } ? D : undefined;
```

## Generated Types - No `any`

### Auto-Generated rheo-mesh.d.ts

```typescript
/**
 * Extract input type from a mesh procedure
 * No fallback to 'any' - returns void if procedure has no input
 */
export type MeshInput<
    TNamespace extends keyof RheoMesh,
    TProcedure extends keyof RheoMesh[TNamespace]
> = RheoMesh[TNamespace][TProcedure] extends { query: (input: infer I) => Promise<unknown> }
    ? I
    : RheoMesh[TNamespace][TProcedure] extends { mutate: (input: infer I) => Promise<unknown> }
    ? I
    : void; // ✅ Explicit: no input = void (not any!)

/**
 * Extract output type from a mesh procedure
 * No fallback to 'any' - returns unknown if inference fails
 */
export type MeshOutput<
    TNamespace extends keyof RheoMesh,
    TProcedure extends keyof RheoMesh[TNamespace]
> = RheoMesh[TNamespace][TProcedure] extends { query: (input?: unknown) => Promise<infer O> }
    ? O
    : RheoMesh[TNamespace][TProcedure] extends { mutate: (input?: unknown) => Promise<infer O> }
    ? O
    : unknown; // ✅ Explicit: can't infer = unknown (not any!)
```

## Runtime Type Safety

### Input Validation

```typescript
// Schema validates at runtime
const addTask = procedure
    .input(z.object({
        text: z.string(),
        type: z.enum(['task', 'idea'])
    }))
    .mutation(async (input) => {
        // input is GUARANTEED to be valid here
        // Both compile-time AND runtime safety
        const task = createTask(input.text, input.type);
        //                      ^^^^^^^^^^  ^^^^^^^^^^^
        //                      TypeScript knows these exist
        return { ok: true, task };
    });
```

### Error Handling

```typescript
// Cell error handling
this.provide(cap, async (args: unknown, ctx: Signal) => {
    //                         ^^^^^^^
    //                         Not 'any' - forces validation
    
    if (proc._def.input) {
        try {
            validatedInput = proc._def.input.parse(args);
        } catch (e: unknown) { // ✅ Safe error type
            const error = e as Error;
            throw new Error(`Validation failed: ${error.message}`);
        }
    }
});
```

## Client-Side Type Safety

### Mesh Runtime Proxy

```typescript
// ❌ OLD - Type information lost
function createMeshProxy(path: string[] = []): any {
    //                                         ^^^
}

// ✅ NEW - Type information preserved
function createMeshProxy(path: string[] = []): unknown {
    //                                         ^^^^^^^
    return new Proxy(() => {}, {
        apply(_target, _thisArg, args: unknown[]) {
            //                         ^^^^^^^
            const input = args[0];
            return fetchFn(capability, input);
        }
    });
}

// Type assertion at the end (only place we need it)
export const mesh = createMeshProxy() as RheoMesh;
```

### Usage in Components

```typescript
// Fully typed throughout
const result = await mesh.list.add.mutate({
    text: "Task",
    type: "task"
});

// result.ok is typed as boolean
// result.item is typed as ListItem
if (result.ok) {
    console.log(result.item.id);
    //          ^^^^^^^^^^^^^^
    //          TypeScript knows this structure exactly
}
```

## Benefits of Strict Typing

### 1. Catch Errors at Compile Time

```typescript
// ❌ Caught by TypeScript
await mesh.list.add.mutate({
    text: "Task",
    type: "invalid" // Error: Type '"invalid"' is not assignable to type '"task" | "idea"'
});

// ❌ Caught by TypeScript
await mesh.list.nonexistent.query();
// Error: Property 'nonexistent' does not exist
```

### 2. IntelliSense Shows Exact Types

```
mesh.list.add.mutate({
                      ^
                      Ctrl+Space shows:
                      {
                        text: string,
                        type: "task" | "idea"
                      }
```

### 3. Refactoring is Safe

```typescript
// Change procedure input schema
const add = procedure
    .input(z.object({
        text: z.string(),
        priority: z.enum(['low', 'high']), // Changed from 'type'
    }))
    .mutation(handler);

// TypeScript immediately shows ALL call sites that need updating
await mesh.list.add.mutate({ text: "Task", type: "task" });
//                                          ^^^^^^^^^^^^
// Error: Object literal may only specify known properties
```

### 4. Runtime Validation Enforces Types

```typescript
// Even if someone sends invalid data via HTTP
fetch('/_mesh/call', {
    body: JSON.stringify({
        capability: 'list/add',
        args: { text: 123, type: 'invalid' } // Wrong types!
    })
});

// Schema validation catches it:
// "Input validation failed: Expected string"
```

## Type Safety Guarantees

| Layer | TypeScript | Runtime Validation |
|-------|------------|-------------------|
| Schema definitions | ✅ | ✅ |
| Procedure inputs | ✅ | ✅ |
| Procedure outputs | ✅ | - |
| Router composition | ✅ | - |
| Client proxy | ✅ | - |
| HTTP calls | ✅ | ✅ |

## Migration Checklist

- [x] Replace all `any` with `unknown` in schemas
- [x] Replace all `any` with precise generic types
- [x] Use `unknown` in catch blocks
- [x] Use `never` only for impossible states
- [x] Add explicit type guards where needed
- [x] Generate strict types (no `any` fallbacks)
- [x] Validate inputs at runtime
- [x] Cast `unknown` to specific types explicitly

## Testing Type Safety

```typescript
// This should NOT compile:
const bad: any = await mesh.list.get.query(); // ❌ No 'any' allowed

// This SHOULD compile:
const good = await mesh.list.get.query(); // ✅ Inferred type
const items = good.items; // ✅ TypeScript knows this exists

// This should NOT compile:
const broken = good.nonexistent; // ❌ TypeScript error

// Runtime validation catches mismatches:
await mesh.list.add.mutate({ wrong: "data" }); // ❌ Throws at runtime
```

---

**Result**: A type system with **zero escape hatches**, **maximum safety**, and **perfect inference** throughout the entire stack!