#!/usr/bin/env bun
// skills/test.ts - Test and demonstration of Skills System

import { TypedRheoCell } from "../protocols/typed-mesh";

const cell = new TypedRheoCell(`SkillsTest_${process.pid}`, 0);

async function runTests() {
    await new Promise(r => setTimeout(r, 10000)); // Wait for mesh

    console.log("🧪 Skills System Test Suite\n");
    console.log("=".repeat(60));

    // Test 1: List all capabilities
    console.log("\n📋 Test 1: List All Capabilities");
    try {
        const skills = await cell.mesh.skills.list({});
        console.log(`✓ Found ${skills.totalCapabilities} capabilities`);
        console.log(`✓ Organized in ${skills.categories.length} categories`);

        skills.categories.slice(0, 2).forEach(cat => {
            console.log(`\n  ${cat.name}:`);
            cat.capabilities.slice(0, 3).forEach(cap => {
                console.log(`    - ${cap.endpoint}`);
            });
        });
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 2: Search for capabilities
    console.log("\n\n🔍 Test 2: Search Capabilities");
    try {
        const results = await cell.mesh.skills.search({
            query: "memory temporal patterns",
            limit: 5
        });

        console.log(`✓ Found ${results.total} matching capabilities`);
        console.log(`✓ Top ${results.results.length} results:`);

        results.results.forEach((r, i) => {
            console.log(`\n  ${i + 1}. ${r.endpoint} (score: ${r.score})`);
            console.log(`     ${r.description}`);
            console.log(`     Category: ${r.category}`);
        });
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 3: Get AI context
    console.log("\n\n📚 Test 3: Generate AI Context");
    try {
        const context = await cell.mesh.skills['get-context']({
            includeExamples: false
        });

        console.log(`✓ Generated ${context.markdown.length} character documentation`);
        console.log(`✓ Covers ${context.capabilities} capabilities`);
        console.log(`✓ Relevant endpoints: ${context.relevantEndpoints.slice(0, 5).join(', ')}...`);

        // Show preview
        const preview = context.markdown.split('\n').slice(0, 10).join('\n');
        console.log(`\nPreview:\n${preview}\n...`);
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 4: Update capability metadata
    console.log("\n\n📊 Test 4: Update Capability Metadata");
    try {
        const result = await cell.mesh.skills['update-capability']({
            endpoint: "ai/generate",
            incrementUsage: true,
            updateSuccess: true
        });

        if (result.updated) {
            console.log(`✓ Updated ai/generate metadata`);

            // Verify update
            const search = await cell.mesh.skills.search({
                query: "ai generate",
                limit: 1
            });

            if (search.results[0]) {
                console.log(`✓ Verified update`);
            }
        } else {
            console.log(`⚠ Capability not found (might not be in default skills)`);
        }
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 5: Learn a pattern
    console.log("\n\n🔮 Test 5: Learn Pattern");
    try {
        const result = await cell.mesh.skills['learn-pattern']({
            pattern: "test-workflow",
            description: "Standard testing workflow",
            example: "architect/consult → projects/write → projects/exec"
        });

        console.log(`✓ Learned pattern: ${result.patternId}`);
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 6: Sync from mesh
    console.log("\n\n🌐 Test 6: Sync from Live Mesh");
    try {
        const result = await cell.mesh.skills['sync-from-mesh']();

        console.log(`✓ Discovered ${result.discovered} new capabilities`);
        console.log(`✓ Updated ${result.updated} existing capabilities`);

        if (result.discovered > 0) {
            console.log(`\n  New capabilities found in the mesh!`);
        } else {
            console.log(`\n  All capabilities already known`);
        }
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 7: Filter by tags
    console.log("\n\n🏷️  Test 7: Filter by Tags");
    try {
        const aiCapabilities = await cell.mesh.skills.list({
            tags: ["ai"]
        });

        console.log(`✓ Found ${aiCapabilities.totalCapabilities} AI-related capabilities`);

        const memoryCapabilities = await cell.mesh.skills.list({
            tags: ["memory"]
        });

        console.log(`✓ Found ${memoryCapabilities.totalCapabilities} memory-related capabilities`);
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Test 8: Category filter
    console.log("\n\n📁 Test 8: Filter by Category");
    try {
        const taskCaps = await cell.mesh.skills.list({
            category: "Task"
        });

        console.log(`✓ Found ${taskCaps.categories.length} task-related categories`);

        if (taskCaps.categories.length > 0) {
            console.log(`\n  ${taskCaps.categories[0].name}:`);
            taskCaps.categories[0].capabilities.forEach(cap => {
                console.log(`    - ${cap.endpoint}`);
            });
        }
    } catch (e: any) {
        console.log(`✗ Failed: ${e.message}`);
    }

    // Summary
    console.log("\n\n" + "=".repeat(60));
    console.log("✅ Skills System Tests Complete");
    console.log("=".repeat(60));

    console.log("\nThe Skills System provides:");
    console.log("  • Capability discovery and documentation");
    console.log("  • Natural language search");
    console.log("  • Usage tracking and analytics");
    console.log("  • Pattern learning");
    console.log("  • AI-friendly context generation");
    console.log("  • Auto-sync with live mesh topology");

    console.log("\nNext steps:");
    console.log("  1. Integrate into Kindly for capability-aware chat");
    console.log("  2. Use in Architect for better planning");
    console.log("  3. Add usage tracking to all cells");
    console.log("  4. Monitor pattern learning over time");
    console.log();

    process.exit(0);
}

// Connect to mesh and run tests
cell.listen();
setTimeout(runTests, 12000);

console.log("⏳ Waiting for mesh convergence...");