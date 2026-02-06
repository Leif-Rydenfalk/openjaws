<!-- ui/src/routes/+page.svelte -->
<script lang="ts">
    import { getMeshCell, getMeshStatus } from "$lib/mesh";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    // Get the real TypedRheoCell (only works in browser)
    let cell: any = null;

    let checklist = { items: [], capacity: 5, date: "" };
    let health = {
        status: "LOADING" as const,
        totalCells: 0,
        avgLoad: 0,
        hotSpots: [],
        timestamp: 0,
    };
    let logs: string[] = [];
    let newTask = "";
    let loading = true;
    let error = "";

    onMount(async () => {
        // Initialize cell in browser only
        cell = getMeshCell();

        // Wait for cell to bootstrap
        await new Promise((r) => setTimeout(r, 2000));
        loadData();
    });

    async function loadData() {
        if (!cell) return;

        loading = true;
        error = "";

        try {
            // Use the cell's mesh proxy directly - same API as server cells!
            const [h, c, l] = await Promise.all([
                cell.mesh.mesh.health(),
                cell.mesh.list.get(),
                cell.mesh.log.get({ limit: 20 }),
            ]);

            health = h;
            checklist = c;
            logs = l.logs || [];
            loading = false;
        } catch (e: any) {
            error = e.message;
            loading = false;
        }
    }

    async function addTask() {
        if (!newTask.trim() || !cell) return;
        try {
            await cell.mesh.list.add({ text: newTask, type: "task" });
            newTask = "";
            await loadData();
        } catch (e: any) {
            error = e.message;
        }
    }

    async function complete(id: string) {
        if (!cell) return;
        try {
            await cell.mesh.list.complete({ id });
            checklist.items = checklist.items.map((i: any) =>
                i.id === id ? { ...i, completed: true } : i,
            );
        } catch (e: any) {
            error = e.message;
        }
    }
</script>

<svelte:head>
    <title>Rheo Mesh UI</title>
</svelte:head>

{#if !browser || loading}
    <div
        class="p-8 bg-gray-900 min-h-screen text-gray-100 flex items-center justify-center"
    >
        <div class="text-center">
            <div class="text-4xl mb-4">🌐</div>
            <div class="text-xl text-green-400">
                {#if !browser}
                    Initializing...
                {:else}
                    Connecting to mesh...
                {/if}
            </div>
            {#if cell}
                <div class="text-sm text-gray-500 mt-2">Cell: {cell.id}</div>
                <div class="text-xs text-purple-400 mt-1">
                    Mode: {cell.mode}
                </div>
            {/if}
        </div>
    </div>
{:else}
    <div class="p-8 bg-gray-900 min-h-screen text-gray-100 font-mono">
        <header class="mb-8 border-b border-gray-700 pb-4">
            <h1 class="text-2xl text-green-400 font-bold">RHEO MESH UI</h1>
            <p class="text-sm text-gray-500">Direct TypedRheoCell Access</p>
            {#if cell}
                <p class="text-xs text-purple-400">
                    Cell: {cell.id} @ {cell.addr}
                </p>
                <p class="text-xs text-gray-600">
                    Atlas: {Object.keys(cell.atlas).length} cells
                </p>
            {/if}
        </header>

        {#if error}
            <div class="mb-4 p-4 bg-red-900 text-red-200 rounded">
                {error}
                <button on:click={() => (error = "")} class="float-right"
                    >✕</button
                >
            </div>
        {/if}

        <main class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section class="bg-gray-800 p-6 rounded">
                <h2 class="text-xl text-blue-400 mb-4">Checklist</h2>

                <div class="space-y-2 mb-6">
                    {#if checklist.items.length === 0}
                        <p class="text-gray-600 italic">No tasks</p>
                    {/if}
                    {#each checklist.items as item}
                        <div
                            class="flex justify-between bg-gray-900 p-3 rounded"
                        >
                            <span
                                class:line-through={item.completed}
                                class:text-gray-500={item.completed}
                            >
                                <span class="text-xs text-yellow-600 mr-2"
                                    >[{item.type.toUpperCase()}]</span
                                >
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

                <div class="mb-4 text-xs text-gray-500">
                    Capacity: {checklist.items.filter(
                        (i: any) => i.type === "task" && !i.completed,
                    ).length} / {checklist.capacity}
                </div>

                <div class="flex gap-2">
                    <input
                        type="text"
                        bind:value={newTask}
                        placeholder="New task..."
                        class="flex-1 bg-gray-900 border border-gray-600 p-2 text-white focus:outline-none focus:border-green-500"
                        on:keydown={(e) => e.key === "Enter" && addTask()}
                    />
                    <button
                        on:click={addTask}
                        class="bg-green-600 text-black font-bold px-4 py-2 hover:bg-green-500"
                    >
                        EXEC
                    </button>
                </div>
            </section>

            <section
                class="bg-black p-4 rounded font-mono text-xs h-96 overflow-y-auto"
            >
                <h3 class="text-gray-500 mb-2 sticky top-0 bg-black pb-2">
                    SYSTEM LOGS
                </h3>
                {#each logs as log}
                    <div
                        class="text-gray-400 mb-1 border-b border-gray-900 pb-1"
                    >
                        {log}
                    </div>
                {/each}
                {#if logs.length === 0}
                    <div class="text-gray-600 italic">No logs available</div>
                {/if}
            </section>
        </main>

        <footer class="mt-8 text-center">
            <button
                on:click={loadData}
                class="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 px-3 py-1 rounded"
            >
                🔄 Refresh
            </button>
            <div class="mt-2 text-xs text-purple-600">
                Using Real TypedRheoCell in Browser ✨
            </div>
        </footer>
    </div>
{/if}
