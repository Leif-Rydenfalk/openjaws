<!-- ui/src/routes/+page.svelte -->
<script lang="ts">
    import { mesh, getMeshStatus } from "$lib/typed-mesh-runtime";
    import { onMount } from "svelte";

    // State
    let checklist = { items: [], capacity: 5, date: "" };
    let health = {
        status: "LOADING" as const,
        totalCells: 0,
        avgLoad: 0,
        hotSpots: [],
        timestamp: 0,
    };
    let logs: string[] = [];
    let meshStatus: any = null;
    let newTask = "";
    let isSubmitting = false;
    let errorMessage = "";
    let loading = true;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    // ✅ FULLY TYPED CLIENT-SIDE DATA LOADING
    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        loading = true;
        errorMessage = "";

        try {
            // First check mesh status
            meshStatus = await getMeshStatus();
            console.log("[UI] Mesh status:", meshStatus);

            if (!meshStatus || meshStatus.atlasSize <= 1) {
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    errorMessage = `Mesh not ready (${retryCount}/${MAX_RETRIES}). Retrying...`;
                    setTimeout(loadData, 2000);
                    return;
                }
                errorMessage =
                    "Mesh not converged. Check that cells are running.";
                loading = false;
                return;
            }

            // Parallel typed mesh calls
            const [healthResult, checklistResult, logsResult] =
                await Promise.all([
                    mesh.mesh.health().catch((e) => {
                        console.error("[UI] Health call failed:", e);
                        return null;
                    }),
                    mesh.list.get().catch((e) => {
                        console.error("[UI] Checklist call failed:", e);
                        return null;
                    }),
                    mesh.log.get({ limit: 20 }).catch((e) => {
                        console.error("[UI] Log call failed:", e);
                        return null;
                    }),
                ]);

            if (healthResult) health = healthResult;
            if (checklistResult) checklist = checklistResult;
            if (logsResult) logs = logsResult.logs || [];

            retryCount = 0; // Reset on success
            loading = false;
        } catch (e: unknown) {
            const err = e as Error;
            console.error("[LoadData] Error:", err);
            errorMessage = `Failed to load data: ${err.message}`;

            if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(loadData, 2000);
            } else {
                loading = false;
            }
        }
    }

    // ✅ FULLY TYPED MUTATIONS
    async function addItem() {
        if (!newTask.trim() || isSubmitting) return;

        isSubmitting = true;
        errorMessage = "";

        try {
            const result = await mesh.list.add({
                text: newTask,
                type: "task",
            });

            if (result.ok) {
                newTask = "";
                await loadData();
            }
        } catch (e: unknown) {
            const err = e as Error;
            errorMessage = err.message;
            console.error("[AddItem] Error:", err);
        } finally {
            isSubmitting = false;
        }
    }

    async function complete(id: string) {
        try {
            await mesh.list.complete({ id });

            // Optimistic update
            checklist.items = checklist.items.map((i: unknown) => {
                const item = i as { id: string; completed: boolean };
                return item.id === id ? { ...item, completed: true } : item;
            });
        } catch (e: unknown) {
            const err = e as Error;
            console.error("[Complete] Error:", err);
            errorMessage = err.message;
            await loadData();
        }
    }

    async function summarize() {
        try {
            const result = await mesh.list.summarize();
            alert(result.summary);
        } catch (e: unknown) {
            const err = e as Error;
            console.error("[Summarize] Error:", err);
            errorMessage = err.message;
        }
    }
</script>

{#if loading}
    <div
        class="p-8 bg-gray-900 min-h-screen text-gray-100 font-mono flex items-center justify-center"
    >
        <div class="text-center max-w-md">
            <div class="text-4xl mb-4">🌐</div>
            <div class="text-xl text-green-400 mb-2">
                {retryCount > 0
                    ? `Retrying (${retryCount}/${MAX_RETRIES})...`
                    : "Connecting to mesh..."}
            </div>
            <div class="text-sm text-gray-500 mt-2">
                {meshStatus
                    ? `Found ${meshStatus.atlasSize} cells, waiting for capabilities...`
                    : "Discovering cells and capabilities"}
            </div>
            {#if errorMessage}
                <div class="mt-4 text-yellow-400 text-sm">
                    {errorMessage}
                </div>
            {/if}
        </div>
    </div>
{:else}
    <div class="p-8 bg-gray-900 min-h-screen text-gray-100 font-mono">
        <!-- Header -->
        <header
            class="mb-8 border-b border-gray-700 pb-4 flex justify-between items-center"
        >
            <div>
                <h1 class="text-2xl text-green-400 font-bold">RHEO_MESH_UI</h1>
                <p class="text-sm text-gray-500">Type-Safe Client API</p>
                {#if meshStatus}
                    <p class="text-xs text-gray-600 mt-1">
                        Bridge: {meshStatus.cellId} | Atlas: {meshStatus.atlasSize}
                        cells
                    </p>
                {/if}
            </div>
            <div class="text-right">
                <div
                    class="text-xl"
                    class:text-green-500={health.status === "NOMINAL"}
                    class:text-yellow-500={health.status === "LOADING"}
                    class:text-red-500={health.status !== "NOMINAL" &&
                        health.status !== "LOADING"}
                >
                    {health.status}
                </div>
                <div class="text-xs text-gray-500">
                    {health.totalCells} active cells
                </div>
            </div>
        </header>

        <!-- Error Display -->
        {#if errorMessage}
            <div
                class="mb-4 p-4 bg-red-900 border border-red-700 rounded text-red-200"
            >
                ⚠️ {errorMessage}
                <button
                    on:click={() => (errorMessage = "")}
                    class="float-right text-xs hover:text-white"
                >
                    ✕
                </button>
            </div>
        {/if}

        <main class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Checklist Cell Interface -->
            <section
                class="bg-gray-800 p-6 rounded shadow-lg border border-gray-700"
            >
                <div
                    class="flex justify-between items-center mb-4 border-b border-gray-700 pb-2"
                >
                    <h2 class="text-xl text-blue-400">>> Checklist.exe</h2>
                    <button
                        on:click={summarize}
                        class="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded hover:bg-purple-700"
                    >
                        SUMMARIZE
                    </button>
                </div>

                <!-- Items List -->
                <div class="space-y-2 mb-6">
                    {#if checklist.items.length === 0}
                        <p class="text-gray-600 italic">
                            No active tasks detected in mesh.
                        </p>
                    {/if}

                    {#each checklist.items as item}
                        <div
                            class="flex justify-between items-center bg-gray-900 p-3 rounded hover:bg-gray-850 transition"
                        >
                            <span
                                class:line-through={item.completed}
                                class:text-gray-500={item.completed}
                            >
                                <span class="text-xs text-yellow-600 mr-2">
                                    [{item.type.toUpperCase()}]
                                </span>
                                {item.text}
                            </span>
                            {#if !item.completed}
                                <button
                                    on:click={() => complete(item.id)}
                                    class="text-xs bg-green-900 text-green-300 px-2 py-1 rounded hover:bg-green-700"
                                >
                                    DONE
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>

                <!-- Capacity Indicator -->
                <div class="mb-4 text-xs text-gray-500">
                    Capacity: {checklist.items.filter((i: unknown) => {
                        const item = i as { type: string; completed: boolean };
                        return item.type === "task" && !item.completed;
                    }).length} / {checklist.capacity}
                </div>

                <!-- Add New Task -->
                <div class="flex gap-2">
                    <input
                        type="text"
                        bind:value={newTask}
                        placeholder="New directive..."
                        class="flex-1 bg-gray-900 border border-gray-600 p-2 text-white focus:outline-none focus:border-green-500"
                        on:keydown={(e) => e.key === "Enter" && addItem()}
                        disabled={isSubmitting}
                    />
                    <button
                        on:click={addItem}
                        disabled={isSubmitting}
                        class="bg-green-600 text-black font-bold px-4 py-2 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "..." : "EXEC"}
                    </button>
                </div>
            </section>

            <!-- Logs / Audit -->
            <section
                class="bg-black p-4 rounded font-mono text-xs border border-gray-800 h-96 overflow-y-auto"
            >
                <h3
                    class="text-gray-500 mb-2 sticky top-0 bg-black pb-2 border-b border-gray-800"
                >
                    SYSTEM_LOGS
                </h3>
                {#each logs as log}
                    <div
                        class="mb-1 whitespace-pre-wrap text-gray-400 border-b border-gray-900 pb-1"
                    >
                        {log}
                    </div>
                {/each}
                {#if logs.length === 0}
                    <div class="text-gray-600 italic">No logs available</div>
                {/if}
            </section>
        </main>

        <!-- Footer with refresh button and debug info -->
        <footer class="mt-8 text-center">
            <button
                on:click={loadData}
                class="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1 rounded"
            >
                🔄 Refresh Data
            </button>
            {#if meshStatus}
                <div class="mt-2 text-xs text-gray-700">
                    Peers: {meshStatus.peers.join(", ")}
                </div>
            {/if}
        </footer>
    </div>
{/if}
