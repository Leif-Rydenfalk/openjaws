<!-- ui/src/routes/+page.svelte -->
<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import { onMount } from "svelte";
    import { slide, fade } from "svelte/transition";

    export let data;
    export let form;

    // State for Signal Forge
    let selectedCap = "";
    let customArgs = "{}";
    let isForging = false;
    let isLoadingTemplate = false; // New state

    // Computed: Unique capabilities
    $: allCaps = Array.from(
        new Set(
            Object.values(data.mesh.atlas || {}).flatMap(
                (node: any) => node.caps,
            ),
        ),
    ).sort();

    // Computed: Business logic
    $: items = data.business.checklist.items || [];
    $: journal = data.mesh.journal || [];
    $: completionRate = items.length
        ? Math.round(
              (items.filter((i: any) => i.completed).length / items.length) *
                  100,
          )
        : 100;

    // Auto-refresh (Live Mesh View)
    onMount(() => {
        const interval = setInterval(() => invalidateAll(), 2000);
        return () => clearInterval(interval);
    });

    // Boilerplate generator for Signal Forge
    async function selectCap(cap: string) {
        selectedCap = cap;
        customArgs = "// Loading template from cell...";
        isLoadingTemplate = true;

        try {
            // Ask Codegen to describe the capability
            const res = await fetch("/api/mesh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    capability: "codegen/describe",
                    args: { cap },
                }),
            });

            const data = await res.json();

            if (data.ok && data.value.found && data.value.meta?.example) {
                customArgs = JSON.stringify(data.value.meta.example, null, 2);
            } else {
                customArgs = "{\n  // No example provided by cell\n}";
            }
        } catch (e) {
            customArgs = "{\n  // Error fetching template\n}";
        } finally {
            isLoadingTemplate = false;
        }
    }
</script>

<div
    class="flex flex-col h-screen max-h-screen bg-zinc-950 text-zinc-400 font-mono overflow-hidden selection:bg-emerald-500/30"
>
    <!-- HEADER -->
    <header
        class="h-14 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10"
    >
        <div class="flex items-center gap-4">
            <div class="flex items-center gap-3">
                <div class="relative">
                    <div
                        class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"
                    ></div>
                    <div
                        class="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-ping opacity-20"
                    ></div>
                </div>
                <h1 class="font-bold tracking-tighter text-zinc-100 text-sm">
                    OPENJAWS<span class="text-zinc-600">_OS</span>
                </h1>
            </div>
            <div class="h-4 w-px bg-zinc-800"></div>
            <div
                class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold"
            >
                {data.nodeId}
            </div>
        </div>

        <div class="flex gap-8 text-[10px] font-bold">
            <div class="flex gap-2">
                <span class="text-zinc-600">MESH_HEALTH:</span>
                <span class="text-emerald-400">NOMINAL</span>
            </div>
            <div class="flex gap-2">
                <span class="text-zinc-600">ACTIVE_CELLS:</span>
                <span class="text-white">{data.mesh.health.totalCells}</span>
            </div>
            <div class="text-zinc-600 uppercase">
                {new Date().toLocaleTimeString()}
            </div>
        </div>
    </header>

    <!-- MAIN GRID -->
    <main
        class="flex-grow grid grid-cols-12 overflow-hidden bg-[url('/grid.svg')] bg-[length:40px_40px] bg-fixed"
    >
        <!-- COL 1: TOPOLOGY (ATLAS) -->
        <section
            class="col-span-3 border-r border-zinc-800 bg-zinc-950/80 backdrop-blur-sm flex flex-col min-h-0"
        >
            <div class="p-4 border-b border-zinc-800 shrink-0">
                <div
                    class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"
                >
                    <span class="w-1 h-1 bg-zinc-500"></span> NETWORK_TOPOLOGY
                </div>
            </div>

            <div class="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {#each Object.entries(data.mesh.atlas) as [id, info]}
                    <!-- Node Card -->
                    <div
                        class="p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-lg group hover:border-emerald-500/30 hover:bg-zinc-900/80 transition-all"
                    >
                        <div class="flex justify-between items-center mb-3">
                            <span
                                class="text-zinc-200 text-xs font-bold font-mono tracking-tight"
                            >
                                {id.split("_")[0]}
                            </span>
                            <div class="flex gap-1">
                                <span
                                    class="h-1.5 w-1.5 rounded-full bg-emerald-500/50"
                                ></span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                            {#each info.caps as cap}
                                <button
                                    on:click={() => selectCap(cap)}
                                    class="text-[9px] px-1.5 py-0.5 rounded bg-black border border-zinc-800 text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-left"
                                >
                                    {cap}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- COL 2: OPERATIONS (CENTER) -->
        <section
            class="col-span-6 border-r border-zinc-800 bg-zinc-900/20 backdrop-blur-sm flex flex-col min-h-0 relative"
        >
            <!-- Scanline Effect -->
            <div
                class="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent h-[100px] w-full animate-scan"
            ></div>

            <div class="flex-grow overflow-y-auto p-8 custom-scrollbar">
                <div class="max-w-2xl mx-auto space-y-10">
                    <!-- COMPANY STATUS -->
                    <div class="space-y-6">
                        <div class="flex justify-between items-end">
                            <div>
                                <h2
                                    class="text-lg font-bold text-white tracking-tight flex items-center gap-2"
                                >
                                    <span class="text-emerald-500">//</span> COMPANY_OBJECTIVES
                                </h2>
                            </div>
                            <div class="text-right">
                                <span
                                    class="text-2xl text-emerald-400 font-bold tracking-tighter"
                                    >{completionRate}%</span
                                >
                                <p
                                    class="text-[9px] text-zinc-600 uppercase font-bold tracking-widest"
                                >
                                    Momentum
                                </p>
                            </div>
                        </div>

                        <!-- Progress Bar -->
                        <div
                            class="h-1 w-full bg-zinc-800 rounded-full overflow-hidden"
                        >
                            <div
                                class="h-full bg-emerald-500 shadow-[0_0_15px_#10b981] transition-all duration-1000"
                                style="width: {completionRate}%"
                            ></div>
                        </div>

                        <!-- Checklist -->
                        <div class="space-y-2">
                            {#if items.length === 0}
                                <div
                                    class="p-8 text-center border border-dashed border-zinc-800 rounded-lg text-zinc-600 text-xs"
                                >
                                    No active objectives. Consult the Architect
                                    to generate a plan.
                                </div>
                            {/if}

                            {#each items as item (item.id)}
                                <div
                                    transition:slide|local
                                    class="flex items-center justify-between p-3 bg-zinc-900/60 border border-zinc-800/50 rounded-lg group hover:border-zinc-700 transition-colors"
                                >
                                    <div class="flex items-center gap-4">
                                        <div
                                            class="w-1.5 h-1.5 rounded-full shrink-0 {item.completed
                                                ? 'bg-zinc-700'
                                                : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}"
                                        ></div>
                                        <div class="flex flex-col">
                                            <span
                                                class="text-xs font-medium {item.completed
                                                    ? 'text-zinc-600 line-through'
                                                    : 'text-zinc-200'}"
                                            >
                                                {item.text}
                                            </span>
                                            <span
                                                class="text-[9px] text-zinc-600 font-bold tracking-wider mt-0.5"
                                            >
                                                {item.type}
                                            </span>
                                        </div>
                                    </div>
                                    {#if !item.completed}
                                        <form
                                            method="POST"
                                            action="?/dispatch"
                                            use:enhance
                                        >
                                            <input
                                                type="hidden"
                                                name="cap"
                                                value="list/complete"
                                            />
                                            <input
                                                type="hidden"
                                                name="args"
                                                value={JSON.stringify({
                                                    id: item.id,
                                                })}
                                            />
                                            <button
                                                class="text-[9px] font-bold text-zinc-500 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30 px-3 py-1.5 rounded transition-all bg-black/50"
                                            >
                                                COMPLETE
                                            </button>
                                        </form>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- SIGNAL FORGE -->
                    <div class="pt-8 border-t border-zinc-800">
                        <div class="mb-6 flex items-center justify-between">
                            <h2
                                class="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"
                            >
                                <span class="text-emerald-500">⚡</span> Signal_Forge
                            </h2>
                            <div class="text-[9px] text-zinc-500 font-bold">
                                DIRECT_MESH_INTERFACE
                            </div>
                        </div>

                        <form
                            method="POST"
                            action="?/dispatch"
                            use:enhance={() => {
                                isForging = true;
                                return async ({ update }) => {
                                    await update();
                                    isForging = false;
                                };
                            }}
                            class="bg-zinc-900/40 border border-zinc-800 rounded-lg p-1"
                        >
                            <div class="grid grid-cols-12 gap-1 p-1">
                                <div class="col-span-4">
                                    <select
                                        name="cap"
                                        bind:value={selectedCap}
                                        class="w-full h-full bg-black border border-zinc-800 rounded px-3 text-xs text-emerald-400 font-mono outline-none focus:border-emerald-500"
                                    >
                                        <option value="" disabled selected
                                            >Select Capability...</option
                                        >
                                        {#each allCaps as cap}
                                            <option value={cap}>{cap}</option>
                                        {/each}
                                    </select>
                                </div>
                                <div class="col-span-8">
                                    <input
                                        type="text"
                                        disabled
                                        value="NTS-1 PROTOCOL / JSON-RPC 2.0"
                                        class="w-full h-full bg-zinc-900/50 border border-zinc-800 rounded px-3 text-[10px] text-zinc-600 font-bold text-center uppercase cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div class="p-1">
                                <textarea
                                    name="args"
                                    bind:value={customArgs}
                                    spellcheck="false"
                                    class="w-full bg-black border border-zinc-800 rounded p-4 text-zinc-300 font-mono text-xs h-32 outline-none focus:border-emerald-500/50 resize-none placeholder-zinc-700"
                                    placeholder="// Enter JSON arguments..."
                                ></textarea>
                            </div>

                            <div class="p-1">
                                <button
                                    disabled={isForging}
                                    class="w-full bg-zinc-100 hover:bg-white text-black font-bold py-3 rounded text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {#if isForging}
                                        Transmitting Signal...
                                    {:else}
                                        Execute Command
                                    {/if}
                                </button>
                            </div>
                        </form>

                        {#if form}
                            <div
                                transition:slide
                                class="mt-4 p-4 rounded border font-mono text-xs overflow-hidden relative {form.ok
                                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                                    : 'bg-rose-950/20 border-rose-500/30 text-rose-400'}"
                            >
                                <div
                                    class="absolute top-0 right-0 p-2 text-[9px] opacity-50 font-bold"
                                >
                                    {form.cid?.substring(0, 8)}
                                </div>
                                <div
                                    class="font-bold mb-2 text-[10px] uppercase tracking-wider"
                                >
                                    {form.ok ? "SUCCESS" : "FAILURE"}
                                </div>
                                <pre>{JSON.stringify(
                                        form.ok ? form.value : form.error,
                                        null,
                                        2,
                                    )}</pre>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </section>

        <!-- COL 3: LOGS & INTEL -->
        <section
            class="col-span-3 border-l border-zinc-800 bg-zinc-950/80 backdrop-blur-sm flex flex-col min-h-0"
        >
            <!-- NARRATIVE LEDGER -->
            <div class="flex-grow flex flex-col min-h-0">
                <div class="p-4 border-b border-zinc-800 shrink-0">
                    <div
                        class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"
                    >
                        <span class="w-1 h-1 bg-zinc-500"></span> NARRATIVE_LEDGER
                    </div>
                </div>

                <div
                    class="overflow-y-auto p-4 space-y-4 custom-scrollbar flex-grow"
                >
                    {#each journal as step}
                        <div class="relative pl-4 border-l border-zinc-800">
                            <div
                                class="absolute -left-[3px] top-1.5 w-1.5 h-1.5 rounded-full bg-zinc-800"
                            ></div>
                            <div
                                class="flex justify-between items-baseline mb-1"
                            >
                                <span
                                    class="text-[9px] font-bold text-emerald-500"
                                    >{new Date(
                                        step.timestamp,
                                    ).toLocaleTimeString()}</span
                                >
                                <span class="text-[9px] font-bold text-zinc-400"
                                    >{step.cell?.split("_")[0]}</span
                                >
                            </div>
                            <div
                                class="text-[10px] text-zinc-300 font-bold mb-1"
                            >
                                {step.action}
                            </div>
                            {#if step.data && Object.keys(step.data).length > 0}
                                <div
                                    class="text-[9px] text-zinc-600 font-mono bg-zinc-900/50 p-1.5 rounded break-all"
                                >
                                    {JSON.stringify(step.data).substring(
                                        0,
                                        100,
                                    )}{JSON.stringify(step.data).length > 100
                                        ? "..."
                                        : ""}
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>

            <!-- GLOBAL LOGS -->
            <div class="h-1/3 border-t border-zinc-800 flex flex-col">
                <div
                    class="p-3 border-b border-zinc-800 bg-zinc-900/30 shrink-0"
                >
                    <div
                        class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest"
                    >
                        SYSTEM_LOGS
                    </div>
                </div>
                <div
                    class="overflow-y-auto p-3 bg-black font-mono text-[9px] custom-scrollbar"
                >
                    {#each data.mesh.globalLogs as log}
                        <div
                            class="mb-1 text-zinc-500 border-b border-zinc-900/50 pb-0.5 whitespace-nowrap overflow-x-hidden text-ellipsis"
                        >
                            {log}
                        </div>
                    {/each}
                </div>
            </div>
        </section>
    </main>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 0px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #52525b;
    }

    @keyframes scan {
        0% {
            transform: translateY(-100%);
        }
        100% {
            transform: translateY(100vh);
        }
    }
    .animate-scan {
        animation: scan 8s linear infinite;
    }
</style>
