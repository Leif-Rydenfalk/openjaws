<!-- ui/src/routes/+page.svelte -->
<script lang="ts">
    import { mesh } from "$lib/mesh-runtime";
    import { invalidateAll } from "$app/navigation";
    import { onMount } from "svelte";

    export let data;

    // Reaktiva variabler
    $: checklist = data.business.checklist;
    $: health = data.mesh.health;
    $: logs = data.globalLogs || [];

    let newTask = "";
    let isSubmitting = false;

    // Funktioner som använder den nya TYPADE proxyn
    async function addItem() {
        if (!newTask.trim() || isSubmitting) return;
        isSubmitting = true;

        try {
            // TypeScript vet nu att detta finns!
            const res = await mesh.list.add({
                text: newTask,
                type: "task",
            });

            if (res.ok) {
                newTask = "";
                // Ladda om data från servern (SSR) för att synka allt
                await invalidateAll();
            }
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            isSubmitting = false;
        }
    }

    async function complete(id: string) {
        try {
            await mesh.list.complete({ id });
            // Optimistisk uppdatering i UI
            checklist.items = checklist.items.map((i: any) =>
                i.id === id ? { ...i, completed: true } : i,
            );
        } catch (e) {
            console.error(e);
        }
    }
</script>

<div class="p-8 bg-gray-900 min-h-screen text-gray-100 font-mono">
    <header
        class="mb-8 border-b border-gray-700 pb-4 flex justify-between items-center"
    >
        <div>
            <h1 class="text-2xl text-green-400 font-bold">RHEO_MESH_UI</h1>
            <p class="text-sm text-gray-500">{data.nodeId}</p>
        </div>
        <div class="text-right">
            <div
                class="text-xl"
                class:text-green-500={health.status === "NOMINAL"}
                class:text-red-500={health.status !== "NOMINAL"}
            >
                {health.status || "OFFLINE"}
            </div>
            <div class="text-xs text-gray-500">
                {health.totalCells || 0} active cells
            </div>
        </div>
    </header>

    <main class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- CHECKLIST CELL INTERFACE -->
        <section
            class="bg-gray-800 p-6 rounded shadow-lg border border-gray-700"
        >
            <h2
                class="text-xl mb-4 text-blue-400 border-b border-gray-700 pb-2"
            >
                >> Checklist.exe
            </h2>

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

            <div class="flex gap-2">
                <input
                    type="text"
                    bind:value={newTask}
                    placeholder="New directive..."
                    class="flex-1 bg-gray-900 border border-gray-600 p-2 text-white focus:outline-none focus:border-green-500"
                    on:keydown={(e) => e.key === "Enter" && addItem()}
                />
                <button
                    on:click={addItem}
                    disabled={isSubmitting}
                    class="bg-green-600 text-black font-bold px-4 py-2 hover:bg-green-500 disabled:opacity-50"
                >
                    EXEC
                </button>
            </div>
        </section>

        <!-- LOGS / AUDIT -->
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
        </section>
    </main>
</div>
