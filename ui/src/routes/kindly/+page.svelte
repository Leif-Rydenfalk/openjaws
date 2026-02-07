<!-- kindly/+page.svelte - UPDATED UI WITH TEMPORAL CONTEXT -->
<script lang="ts">
    import { enhance } from "$app/forms";
    import { afterUpdate, onMount } from "svelte";

    export let data;

    let message = "";
    let chatElement: HTMLDivElement;
    let loading = false;

    let userContext = { username: "ROOT_ADMIN", role: "admin" };
    let temporalContext = data.temporalContext || {
        sessionMemories: 0,
        activeGoals: 0,
        learnedPatterns: 0,
        timeOfDay: "unknown",
    };

    let chat: Array<{
        role: "user" | "kindly";
        text: string;
        meta?: any;
        timestamp: number;
    }> = [
        {
            role: "kindly",
            text: `Security protocols disabled. Root Administrator access granted. System fully operational.

Time: ${temporalContext.timeOfDay}
Session Memory: ${temporalContext.sessionMemories} events
Active Goals: ${temporalContext.activeGoals}
Learned Patterns: ${temporalContext.learnedPatterns}

Temporal memory system active. I'm learning your routines.`,
            timestamp: Date.now(),
        },
    ];

    afterUpdate(() => {
        if (chatElement) chatElement.scrollTop = chatElement.scrollHeight;
    });

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

<div
    class="flex flex-col h-screen bg-zinc-950 text-emerald-500 font-mono overflow-hidden"
>
    <!-- HEADER -->
    <header
        class="h-12 border-b border-emerald-900/50 bg-black flex items-center justify-between px-6 shrink-0"
    >
        <div class="flex items-center gap-3">
            <div
                class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
            ></div>
            <span
                class="text-xs font-bold tracking-widest uppercase text-emerald-400"
            >
                Kindly_Orchestrator_v1
            </span>
        </div>

        <div class="flex items-center gap-4">
            <!-- Temporal Context Indicators -->
            <div class="flex gap-3 text-[9px] text-emerald-600">
                <span title="Session Memories"
                    >📝 {temporalContext.sessionMemories}</span
                >
                <span title="Active Goals"
                    >🎯 {temporalContext.activeGoals}</span
                >
                <span title="Learned Patterns"
                    >🔮 {temporalContext.learnedPatterns}</span
                >
                <span title="Time of Day">⏰ {temporalContext.timeOfDay}</span>
            </div>

            <span
                class="text-[10px] text-red-500 font-bold tracking-widest animate-pulse border border-red-900/50 px-2 py-0.5 bg-red-950/30"
            >
                ⚠ ROOT ACCESS ACTIVE
            </span>
            <span class="text-[10px] text-emerald-600">
                {userContext.username}
                <span class="text-emerald-400">[{userContext.role}]</span>
            </span>
        </div>
    </header>

    <!-- CHAT AREA -->
    <div
        bind:this={chatElement}
        class="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar"
    >
        {#each chat as entry}
            <div
                class="flex flex-col {entry.role === 'user'
                    ? 'items-end'
                    : 'items-start'}"
            >
                <div class="flex items-center gap-2 mb-1">
                    <span
                        class="text-[9px] font-bold uppercase tracking-widest opacity-30"
                    >
                        {entry.role === "user"
                            ? userContext.username
                            : "Kindly_Agent"}
                    </span>
                    <span class="text-[8px] text-emerald-900">
                        {formatTime(entry.timestamp)}
                    </span>
                </div>

                <div
                    class="max-w-[85%] p-4 rounded-lg text-sm border
                    {entry.role === 'user'
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        : 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400'}"
                >
                    <pre
                        class="whitespace-pre-wrap font-mono">{entry.text}</pre>
                </div>

                {#if entry.meta}
                    <div class="flex gap-2 mt-1 text-[8px] text-emerald-700">
                        {#if entry.meta.personalized}
                            <span title="Using temporal memory"
                                >🧠 Personalized</span
                            >
                        {/if}
                        {#if entry.meta.patternsDetected > 0}
                            <span title="Patterns detected"
                                >🔮 {entry.meta.patternsDetected} patterns</span
                            >
                        {/if}
                        {#if entry.meta.sessionMemories > 0}
                            <span title="Session context"
                                >📝 {entry.meta.sessionMemories} memories</span
                            >
                        {/if}
                        {#if entry.meta.suggestedActions && entry.meta.suggestedActions.length > 0}
                            <span title="Suggestions available"
                                >💡 {entry.meta.suggestedActions.length} suggestions</span
                            >
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}

        {#if loading}
            <div
                class="text-emerald-700 text-[10px] font-bold uppercase animate-pulse flex items-center gap-2"
            >
                <div
                    class="h-1 w-1 bg-emerald-500 rounded-full animate-ping"
                ></div>
                Processing temporal context...
            </div>
        {/if}
    </div>

    <!-- INPUT AREA -->
    <footer class="p-4 bg-black border-t border-emerald-900/50">
        <form
            method="POST"
            action="?/send"
            use:enhance={() => {
                loading = true;
                const userMsg = message;
                const timestamp = Date.now();

                return async ({ result }) => {
                    loading = false;
                    if (result.type === "success" && result.data) {
                        chat = [
                            ...chat,
                            { role: "user", text: userMsg, timestamp },
                            {
                                role: "kindly",
                                text: result.data.reply,
                                meta: result.data.contextUsed,
                                timestamp: Date.now(),
                            },
                        ];

                        // Update temporal context display
                        if (result.data.contextUsed) {
                            temporalContext = {
                                sessionMemories:
                                    result.data.contextUsed.sessionMemories ||
                                    temporalContext.sessionMemories,
                                activeGoals: temporalContext.activeGoals,
                                learnedPatterns:
                                    result.data.contextUsed.patternsDetected ||
                                    temporalContext.learnedPatterns,
                                timeOfDay: temporalContext.timeOfDay,
                            };
                        }

                        message = "";
                    }
                };
            }}
            class="flex gap-3"
        >
            <input
                type="hidden"
                name="history"
                value={JSON.stringify(
                    chat.slice(-5).map((c) => ({ role: c.role, text: c.text })),
                )}
            />

            <input
                name="message"
                bind:value={message}
                placeholder="Enter root command..."
                disabled={loading}
                class="flex-grow bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-emerald-400 placeholder-zinc-600 focus:border-emerald-500 outline-none disabled:opacity-50"
            />

            <button
                type="submit"
                disabled={!message.trim() || loading}
                class="bg-emerald-900/20 border border-emerald-800 text-emerald-500 px-6 py-3 rounded text-xs font-bold uppercase tracking-wider hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "PROCESSING..." : "EXECUTE"}
            </button>
        </form>
    </footer>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #065f46;
        border-radius: 2px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #047857;
    }
</style>
