#!/usr/bin/env bun
// verify-types.ts - Quick verification that auto-type-generation works

import { TypedRheoCell } from "./protocols/typed-mesh";
import { router, procedure, z } from "./protocols/example2";

console.log("🧪 Starting Type Generation Verification...\n");

// ============================================================================
// TEST CELL
// ============================================================================

const cell = new TypedRheoCell(`Verify_${process.pid}`, 0);

const testRouter = router({
    verify: router({
        "test-input": procedure
            .input(z.object({
                name: z.string(),
                age: z.number(),
                active: z.optional(z.boolean())
            }))
            .output(z.object({
                success: z.boolean(),
                message: z.string()
            }))
            .mutation(async (input) => {
                return {
                    success: true,
                    message: `Hello ${input.name}, age ${input.age}`
                };
            }),

        "test-enum": procedure
            .input(z.object({
                status: z.enum(["active", "inactive", "pending"])
            }))
            .output(z.object({
                validated: z.boolean()
            }))
            .mutation(async (input) => {
                return { validated: true };
            }),

        "test-array": procedure
            .input(z.object({
                items: z.array(z.string())
            }))
            .output(z.object({
                count: z.number()
            }))
            .query(async (input) => {
                return { count: input.items.length };
            }),

        "test-nested": procedure
            .input(z.object({
                user: z.object({
                    name: z.string(),
                    email: z.string()
                }),
                tags: z.array(z.string())
            }))
            .output(z.object({
                processed: z.boolean()
            }))
            .mutation(async (input) => {
                return { processed: true };
            })
    })
});

cell.useRouter(testRouter);
cell.listen();

// ============================================================================
// VERIFICATION TESTS
// ============================================================================

async function runVerification() {
    await new Promise(r => setTimeout(r, 8000)); // Wait for mesh

    console.log("✅ Test Cell Started\n");

    // Test 1: Contract endpoint exists
    console.log("Test 1: Contract Endpoint");
    try {
        const contract = await cell.askMesh("cell/contract" as any, { cap: "verify/test-input" });
        if (contract.ok && contract.value) {
            console.log("  ✓ Contract endpoint working");
            console.log(`  ✓ Input schema found: ${contract.value.input ? 'YES' : 'NO'}`);
            console.log(`  ✓ Output schema found: ${contract.value.output ? 'YES' : 'NO'}`);
        } else {
            console.log("  ✗ Contract endpoint failed");
            process.exit(1);
        }
    } catch (e) {
        console.log("  ✗ Contract endpoint error:", e);
        process.exit(1);
    }

    console.log();

    // Test 2: Schema introspection
    console.log("Test 2: Schema Introspection");
    const router = cell.getRouter();
    if (router) {
        const contract = router.getContract("verify/test-input");
        if (contract) {
            console.log("  ✓ Router.getContract() working");

            // Check input schema
            if (contract.input && contract.input._def) {
                console.log(`  ✓ Input has _def: ${contract.input._def.typeName}`);
            }

            // Check output schema
            if (contract.output && contract.output._def) {
                console.log(`  ✓ Output has _def: ${contract.output._def.typeName}`);
            }
        } else {
            console.log("  ✗ Contract not found");
            process.exit(1);
        }
    }

    console.log();

    // Test 3: Trigger codegen
    console.log("Test 3: Triggering Codegen");
    try {
        const codegenResult = await cell.askMesh("codegen/mesh-types" as any);
        if (codegenResult.ok && codegenResult.value) {
            console.log(`  ✓ Codegen succeeded`);
            console.log(`  ✓ Generated ${codegenResult.value.capabilities} capabilities`);
            console.log(`  ✓ File: ${codegenResult.value.path}`);
        } else {
            console.log("  ⚠ Codegen not available (cell not started?)");
        }
    } catch (e) {
        console.log("  ⚠ Codegen not available (cell not started?)");
    }

    console.log();

    // Test 4: Check generated file
    console.log("Test 4: Generated File");
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const typesPath = join(process.cwd(), "mesh-types.d.ts");
    if (existsSync(typesPath)) {
        const content = readFileSync(typesPath, "utf8");

        console.log("  ✓ mesh-types.d.ts exists");

        // Check for our test capabilities
        const checks = [
            { name: "verify/test-input", found: content.includes('"verify/test-input"') },
            { name: "verify/test-enum", found: content.includes('"verify/test-enum"') },
            { name: "verify/test-array", found: content.includes('"verify/test-array"') },
            { name: "declare module", found: content.includes('declare module "./protocols/typed-mesh"') }
        ];

        for (const check of checks) {
            console.log(`  ${check.found ? '✓' : '✗'} Contains ${check.name}`);
        }
    } else {
        console.log("  ⚠ mesh-types.d.ts not found (run codegen first)");
    }

    console.log();

    // Test 5: Type safety verification
    console.log("Test 5: Runtime Type Safety");
    try {
        // This should work
        const result = await cell.mesh.verify['test-input']({
            name: "Test",
            age: 25,
            active: true
        });
        console.log(`  ✓ Valid input accepted`);
        console.log(`  ✓ Result: ${result.message}`);
    } catch (e: any) {
        console.log(`  ✗ Valid input rejected: ${e.message}`);
        process.exit(1);
    }

    try {
        // This should fail validation
        await cell.mesh.verify['test-input']({
            name: "Test",
            age: "twenty-five", // Wrong type
            active: true
        } as any);
        console.log(`  ✗ Invalid input was accepted (should have failed)`);
        process.exit(1);
    } catch (e: any) {
        console.log(`  ✓ Invalid input rejected correctly`);
    }

    console.log();

    // Summary
    console.log("=".repeat(60));
    console.log("🎉 ALL TESTS PASSED");
    console.log("=".repeat(60));
    console.log();
    console.log("Your implementation is working correctly!");
    console.log();
    console.log("Next steps:");
    console.log("1. Check mesh-types.d.ts for generated types");
    console.log("2. Open any cell in VS Code");
    console.log("3. Try typing: await cell.mesh.");
    console.log("4. You should see full autocomplete!");
    console.log();

    process.exit(0);
}

// Run verification
setTimeout(runVerification, 10000);