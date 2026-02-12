import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const cell = new TypedRheoCell(`TypeVerifier_${process.pid}`, 0);

const testSuite = async () => {
    console.log("\n🧪 STARTING CROSS-LANGUAGE TYPE VERIFICATION");
    console.log("============================================================");

    // SMART POLLING: Wait up to 60s for test-1-rs to compile and join
    console.log("⏳ Waiting for test-1-rs to join mesh (compilation delay)...");
    let rustCellFound = false;
    for (let i = 0; i < 60; i++) {
        const atlas = Object.values(cell.atlas);
        if (atlas.some(e => e.caps.includes('test/binary-interop'))) {
            rustCellFound = true;
            console.log(`✅ Rust test cell detected after ${i}s`);
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!rustCellFound) {
        console.error("\n❌ FATAL: Rust test cell never joined the mesh. Check its logs.");
        process.exit(1);
    }

    let passed = 0;
    let failed = 0;
    const report = (name: string, ok: boolean, msg?: string) => {
        if (ok) {
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } else {
            console.log(`  ❌ FAIL: ${name} -> ${msg}`);
            failed++;
        }
    };

    // TEST 1: Rust Binary Interop
    try {
        const res = await (cell.mesh as any).test['binary-interop']({ input: "OpenJaws" });
        report("Rust Binary Interop", res.received === "OpenJaws" && res.protocol_version === "NTS-1");
    } catch (e: any) {
        report("Rust Binary Interop", false, e.message);
    }

    // TEST 2: Zod Runtime Enforcement
    try {
        // Call OURSELVES with the wrong type. The useRouter logic in TypedRheoCell
        // should intercept and throw an "Input validation failed" error.
        await (cell.mesh as any).typeverifier.internalTest({ age: "not-a-number" as any });
        report("Zod Runtime Enforcement", false, "Allowed invalid string for number field");
    } catch (e: any) {
        const isValidationError = e.message.toLowerCase().includes("validation failed");
        report("Zod Runtime Enforcement", isValidationError, e.message);
    }

    // TEST 3: Error Narrative Chain
    try {
        await (cell.mesh as any).test['trigger-narrative-error']({});
        report("Error Narrative Chain", false, "Did not throw");
    } catch (e: any) {
        // MeshError preserves history. Check if the Rust steps are there.
        const hasRustSteps = e.error?.history?.some((s: any) => s.cell === "test-1-rs");
        report("Error Narrative Chain", !!hasRustSteps, "Narrative steps from Rust not found in trace");
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`VERIFICATION RESULT: ${passed}/3 Passed`);
    console.log(`${"=".repeat(60)}\n`);

    process.exit(failed > 0 ? 1 : 0);
};

// Internal test cap for Test 2
const verifierRouter = router({
    typeverifier: router({
        internalTest: procedure
            .input(z.object({ age: z.number() }))
            .query(async () => ({ ok: true }))
    })
});

cell.useRouter(verifierRouter);
cell.listen();
setTimeout(testSuite, 5000); // Allow local initialization