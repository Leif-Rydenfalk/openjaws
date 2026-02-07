<!-- ui/src/routes/debug/+page.svelte -->
<script lang="ts">
    import { getBrowserCell, getMeshStatus } from "$lib/browser-mesh-client";
    import { onMount } from "svelte";

    const cell = getBrowserCell();

    let meshStatus: any = null;
    let browserCellInfo: any = null;
    let testResults: Record<string, any> = {};
    let loading = true;

    onMount(async () => {
        await loadDebugInfo();
    });

    async function loadDebugInfo() {
        loading = true;

        // Get server mesh status
        meshStatus = await getMeshStatus();
        console.log("[Debug] Mesh status:", meshStatus);

        // Get browser cell info
        browserCellInfo = {
            id: cell.id,
            mode: cell.mode,
            addr: cell.addr,
            atlasSize: Object.keys(cell.atlas).length,
            capabilities: Object.values(cell.atlas).flatMap((e) => e.caps),
            atlas: cell.atlas,
        };

        // Test each capability
        const tests = [
            { name: "mesh/health", call: () => cell.mesh.mesh.health() },
            { name: "list/get", call: () => cell.mesh.list.get() },
            {
                name: "log/get",
                call: () => cell.mesh.log.get({ limit: 5 }),
            },
        ];

        for (const test of tests) {
            try {
                const result = await test.call();
                testResults[test.name] = {
                    status: result ? "✅ OK" : "❌ FAIL",
                    result: result,
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
    <h1 class="text-2xl text-green-400 font-bold mb-4">
        🔍 Browser Cell Debug Panel
    </h1>

    {#if loading}
        <div class="text-yellow-400">Loading debug info...</div>
    {:else}
        <!-- Browser Cell Info -->
        <section class="mb-8 bg-gray-800 p-4 rounded border border-gray-700">
            <h2 class="text-xl text-purple-400 mb-3">
                Browser Cell (Client Mode)
            </h2>
            {#if browserCellInfo}
                <table class="w-full text-sm">
                    <tbody>
                        <tr>
                            <td class="text-gray-500 pr-4">Cell ID:</td>
                            <td class="text-purple-400">{browserCellInfo.id}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Mode:</td>
                            <td class="text-purple-400"
                                >{browserCellInfo.mode}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Address:</td>
                            <td class="text-purple-400"
                                >{browserCellInfo.addr}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Atlas Size:</td>
                            <td class="text-purple-400"
                                >{browserCellInfo.atlasSize}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4"
                                >Known Capabilities:</td
                            >
                            <td class="text-purple-400"
                                >{browserCellInfo.capabilities.length}</td
                            >
                        </tr>
                    </tbody>
                </table>
            {/if}
        </section>

        <!-- Server Cell Status -->
        <section class="mb-8 bg-gray-800 p-4 rounded border border-gray-700">
            <h2 class="text-xl text-blue-400 mb-3">Server Cell Status</h2>
            {#if meshStatus}
                <table class="w-full text-sm">
                    <tbody>
                        <tr>
                            <td class="text-gray-500 pr-4">Cell ID:</td>
                            <td class="text-green-400">{meshStatus.cellId}</td>
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Mode:</td>
                            <td class="text-green-400">{meshStatus.mode}</td>
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Address:</td>
                            <td class="text-green-400"
                                >{meshStatus.address || "NOT BOUND"}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Atlas Size:</td>
                            <td class="text-green-400"
                                >{meshStatus.atlasSize}</td
                            >
                        </tr>
                        <tr>
                            <td class="text-gray-500 pr-4">Peers:</td>
                            <td class="text-green-400"
                                >{meshStatus.peers?.join(", ") || "None"}</td
                            >
                        </tr>
                    </tbody>
                </table>
            {:else}
                <div class="text-red-400">❌ Server cell not responding</div>
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

        <!-- Atlas Dump -->
        <section class="bg-gray-800 p-4 rounded border border-gray-700">
            <h2 class="text-xl text-blue-400 mb-3">Browser Cell Atlas</h2>
            {#if browserCellInfo}
                <pre
                    class="text-xs text-gray-500 overflow-x-auto">{JSON.stringify(
                        browserCellInfo.atlas,
                        null,
                        2,
                    )}</pre>
            {:else}
                <div class="text-red-400">❌ No atlas data</div>
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
