<!-- ui/src/routes/debug/+page.svelte -->
<script lang="ts">
    import { getMeshStatus, meshCall } from "$lib/typed-mesh-runtime";
    import { onMount } from "svelte";

    let status: any = null;
    let atlasData: any = null;
    let testResults: any = {};
    let loading = true;

    onMount(async () => {
        await loadDebugInfo();
    });

    async function loadDebugInfo() {
        loading = true;

        // Get mesh status
        status = await getMeshStatus();
        console.log("[Debug] Mesh status:", status);

        // Try to get atlas from mesh
        try {
            const result = await meshCall("mesh/directory" as any);
            if (result.ok) {
                atlasData = result.value;
            }
        } catch (e) {
            console.error("[Debug] Atlas call failed:", e);
        }

        // Test each capability
        const tests = [
            { name: "mesh/health", call: () => meshCall("mesh/health" as any) },
            { name: "mesh/ping", call: () => meshCall("mesh/ping" as any) },
            { name: "list/get", call: () => meshCall("list/get" as any) },
            {
                name: "log/get",
                call: () => meshCall("log/get" as any, { limit: 5 }),
            },
        ];

        for (const test of tests) {
            try {
                const result = await test.call();
                testResults[test.name] = {
                    status: result.ok ? "✅ OK" : "❌ FAIL",
                    result: result.ok ? result.value : result.error,
                };
            } catch (e: any) {
                testResults[test.name] = {
                    status: "❌ ERROR",
                    result: e.message,
                };
            }
        }

        loading = false;
    }
</script>

<div class="p-8 bg-gray-900 min-h-screen text-gray-100 font-mono">
    <h1 class="text-2xl text-green-400 font-bold mb-4">🔍 Mesh Debug Panel</h1>

    {#if loading}
        <div class="text-yellow-400">Loading debug info...</div>
    {:else}
        <!-- Bridge Status -->
        <section class="mb-8 bg-gray-800 p-4 rounded border border-gray-700">
            <h2 class="text-xl text-blue-400 mb-3">Bridge Cell Status</h2>
            {#if status}
                <table class="w-full text-sm">
                    <tbody>
                        <tr>
                            <td class="text-gray-500 pr-4">Cell ID:</td>
                            <td class="text-green-400">{status.cellId}</td>
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Address:</td>
                            <td class="text-green-400"
                                >{status.address || "NOT BOUND"}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Atlas Size:</td>
                            <td class="text-green-400">{status.atlasSize}</td>
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Peers:</td>
                            <td class="text-green-400"
                                >{status.peers?.join(", ") || "None"}</td
                            >
                        </tr>
                    </tbody>
                </table>
            {:else}
                <div class="text-red-400">❌ Bridge cell not responding</div>
            {/if}
        </section>

        <!-- Capability Tests -->
        <section class="mb-8 bg-gray-800 p-4 rounded border border-gray-700">
            <h2 class="text-xl text-blue-400 mb-3">Capability Tests</h2>
            <div class="space-y-2">
                {#each Object.entries(testResults) as [name, result]}
                    <div class="bg-gray-900 p-3 rounded">
                        <div class="flex justify-between mb-2">
                            <span class="text-yellow-400">{name}</span>
                            <span>{result.status}</span>
                        </div>
                        <pre
                            class="text-xs text-gray-500 overflow-x-auto">{JSON.stringify(
                                result.result,
                                null,
                                2,
                            )}</pre>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Atlas Data -->
        <section class="bg-gray-800 p-4 rounded border border-gray-700">
            <h2 class="text-xl text-blue-400 mb-3">Atlas Data</h2>
            {#if atlasData}
                <pre
                    class="text-xs text-gray-500 overflow-x-auto">{JSON.stringify(
                        atlasData,
                        null,
                        2,
                    )}</pre>
            {:else}
                <div class="text-red-400">❌ Could not fetch atlas</div>
            {/if}
        </section>

        <!-- Actions -->
        <section class="mt-8">
            <button
                on:click={loadDebugInfo}
                class="bg-green-600 text-black font-bold px-4 py-2 rounded hover:bg-green-500"
            >
                🔄 Refresh Debug Info
            </button>
            <a href="/" class="ml-4 text-blue-400 hover:text-blue-300">
                ← Back to Main
            </a>
        </section>
    {/if}
</div>
