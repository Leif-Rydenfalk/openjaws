// protocols/example2.ts - Type-Safe Router Protocol for RheoMesh
// Inspired by tRPC but adapted for distributed mesh architecture

import { RheoCell as BaseCell } from "./example1";
import type { TraceResult, Signal } from "./example1";

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Extracts the input type from a procedure
 */
export type InferInput<T> = T extends Procedure<infer I, unknown> ? I : never;

/**
 * Extracts the output type from a procedure
 */
export type InferOutput<T> = T extends Procedure<unknown, infer O> ? O : never;

/**
 * Converts a procedure to its client-callable interface
 */
type InferProcedure<T> =
    T extends Procedure<infer I, infer O>
    ? I extends void
    ? { query: () => Promise<O>; mutate: () => Promise<O> }
    : { query: (input: I) => Promise<O>; mutate: (input: I) => Promise<O> }
    : T extends Router<infer P>
    ? { [K in keyof P]: InferProcedure<P[K]> }
    : never;

/**
 * Converts a router definition to a client-callable interface
 */
export type InferRouter<T> = T extends Router<infer TProcedures>
    ? { [K in keyof TProcedures]: InferProcedure<TProcedures[K]> }
    : never;

// ============================================================================
// SCHEMA SYSTEM (Runtime validation + Type inference)
// ============================================================================

export interface Schema<T> {
    _type?: T; // Phantom type for inference
    parse: (value: unknown) => T;
    optional?: boolean;
}

export const z = {
    string: (): Schema<string> => ({
        parse: (val) => {
            if (typeof val !== 'string') throw new Error('Expected string');
            return val;
        }
    }),

    number: (): Schema<number> => ({
        parse: (val) => {
            if (typeof val !== 'number') throw new Error('Expected number');
            return val;
        }
    }),

    boolean: (): Schema<boolean> => ({
        parse: (val) => {
            if (typeof val !== 'boolean') throw new Error('Expected boolean');
            return val;
        }
    }),

    enum: <T extends string>(values: readonly T[]): Schema<T> => ({
        parse: (val) => {
            if (!values.includes(val as T)) {
                throw new Error(`Expected one of: ${values.join(', ')}`);
            }
            return val as T;
        }
    }),

    object: <T extends Record<string, Schema<unknown>>>(
        shape: T
    ): Schema<{ [K in keyof T]: T[K] extends Schema<infer U> ? U : never }> => ({
        parse: (val) => {
            if (typeof val !== 'object' || val === null) {
                throw new Error('Expected object');
            }

            const result: any = {};
            for (const [key, schema] of Object.entries(shape)) {
                const fieldValue = (val as any)[key];

                // Check if required field is missing
                if (fieldValue === undefined && !schema.optional) {
                    throw new Error(`Missing required field: ${key}`);
                }

                // Parse if present
                if (fieldValue !== undefined) {
                    result[key] = schema.parse(fieldValue);
                }
            }
            return result;
        }
    }),

    array: <T>(item: Schema<T>): Schema<T[]> => ({
        parse: (val) => {
            if (!Array.isArray(val)) throw new Error('Expected array');
            return val.map(item.parse);
        }
    }),

    optional: <T>(schema: Schema<T>): Schema<T | undefined> => ({
        parse: (val) => {
            if (val === undefined) return undefined;
            return schema.parse(val);
        },
        optional: true
    }),

    unknown: (): Schema<unknown> => ({
        parse: (val) => val
    })
};

// ============================================================================
// PROCEDURE BUILDER
// ============================================================================

export class Procedure<TInput = void, TOutput = unknown> {
    public readonly _def: {
        input?: Schema<TInput>;
        type: 'query' | 'mutation';
        handler: (input: TInput, ctx: Signal) => Promise<TOutput>;
    };

    constructor(
        type: 'query' | 'mutation',
        input: Schema<TInput> | undefined,
        handler: (input: TInput, ctx: Signal) => Promise<TOutput>
    ) {
        this._def = { type, input, handler };
    }
}

/**
 * Procedure builder - start here to create endpoints
 */
export const procedure = {
    /**
     * Query with no input
     */
    query: <TOutput>(
        handler: (ctx: Signal) => Promise<TOutput>
    ): Procedure<void, TOutput> => {
        return new Procedure('query', undefined, async (_: void, ctx: Signal) => handler(ctx));
    },

    /**
     * Mutation with no input
     */
    mutation: <TOutput>(
        handler: (ctx: Signal) => Promise<TOutput>
    ): Procedure<void, TOutput> => {
        return new Procedure('mutation', undefined, async (_: void, ctx: Signal) => handler(ctx));
    },

    /**
     * Start building a procedure with input validation
     */
    input: <TInput>(schema: Schema<TInput>) => ({
        query: <TOutput>(
            handler: (input: TInput, ctx: Signal) => Promise<TOutput>
        ): Procedure<TInput, TOutput> => {
            return new Procedure('query', schema, handler);
        },

        mutation: <TOutput>(
            handler: (input: TInput, ctx: Signal) => Promise<TOutput>
        ): Procedure<TInput, TOutput> => {
            return new Procedure('mutation', schema, handler);
        }
    })
};

// ============================================================================
// ROUTER
// ============================================================================

export type AnyProcedure = Procedure<unknown, unknown>;
export type AnyRouter = Router<Record<string, AnyProcedure | AnyRouter>>;

export class Router<TProcedures extends Record<string, AnyProcedure | AnyRouter>> {
    public readonly _def: {
        procedures: TProcedures;
    };

    constructor(procedures: TProcedures) {
        this._def = { procedures };
    }

    /**
     * Get all capability paths this router provides
     */
    getCapabilities(prefix = ''): string[] {
        const caps: string[] = [];

        for (const [key, proc] of Object.entries(this._def.procedures)) {
            const path = prefix ? `${prefix}/${key}` : key;

            if (proc instanceof Router) {
                caps.push(...proc.getCapabilities(path));
            } else {
                caps.push(path);
            }
        }

        return caps;
    }

    /**
     * Find a procedure by its capability path
     */
    findProcedure(capability: string): AnyProcedure | null {
        const parts = capability.split('/');
        let current: AnyProcedure | AnyRouter | undefined = undefined;
        let currentProcs: Record<string, AnyProcedure | AnyRouter> = this._def.procedures;

        for (const part of parts) {
            current = currentProcs[part];
            if (!current) return null;

            if (current instanceof Router) {
                currentProcs = current._def.procedures;
            }
        }

        return current instanceof Procedure ? current : null;
    }
}

/**
 * Create a router
 */
export function router<T extends Record<string, AnyProcedure | AnyRouter>>(
    procedures: T
): Router<T> {
    return new Router(procedures);
}

// ============================================================================
// ENHANCED RHEO CELL WITH ROUTER SUPPORT
// ============================================================================

export class RheoCell extends BaseCell {
    private _router: AnyRouter | null = null;

    /**
     * Attach a typed router to this cell
     */
    useRouter<T extends AnyRouter>(router: T): void {
        this._router = router;

        // Register all capabilities from the router
        const capabilities = router.getCapabilities();

        for (const cap of capabilities) {
            this.provide(cap, async (args: unknown, ctx: Signal) => {
                const proc = router.findProcedure(cap);

                if (!proc) {
                    throw new Error(`Procedure not found: ${cap}`);
                }

                // Validate input if schema exists
                let validatedInput = args;
                if (proc._def.input) {
                    try {
                        validatedInput = proc._def.input.parse(args);
                    } catch (e: unknown) {
                        const error = e as Error;
                        throw new Error(`Input validation failed for ${cap}: ${error.message}`);
                    }
                }

                // Execute handler
                return await proc._def.handler(validatedInput, ctx);
            });
        }
    }

    /**
     * Get the router if attached
     */
    getRouter(): AnyRouter | null {
        return this._router;
    }
}

// ============================================================================
// CLIENT PROXY GENERATOR
// ============================================================================

/**
 * Creates a type-safe client proxy for calling mesh procedures
 */
export function createMeshClient<TRouter extends AnyRouter>(config: {
    fetchFn: (capability: string, args: unknown) => Promise<unknown>;
}): InferRouter<TRouter> {
    const { fetchFn } = config;

    function createProxy(path: string[] = []): unknown {
        return new Proxy(() => { }, {
            get(_target, prop: string) {
                return createProxy([...path, prop]);
            },

            apply(_target, _thisArg, args: unknown[]) {
                const capability = path.join('/');
                const input = args[0];

                return fetchFn(capability, input);
            },

            // Support for .query() and .mutate()
            has(_target, prop: string) {
                return prop === 'query' || prop === 'mutate';
            }
        });
    }

    return createProxy() as InferRouter<TRouter>;
}

// ============================================================================
// TYPE EXPORT HELPERS
// ============================================================================

/**
 * Helper to export router type from a cell
 */
export type RouterType<T extends { _def: { procedures: Record<string, AnyProcedure | AnyRouter> } }> = T;

/**
 * Helper to infer the full client interface from a cell's router
 */
export type ClientFromRouter<T> = T extends AnyRouter ? InferRouter<T> : never;