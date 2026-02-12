<!-- ui/src/routes/kindly/+page-enhanced.svelte -->
<script lang="ts">
    import { enhance } from "$app/forms";
    import { afterUpdate, onMount } from "svelte";

    export let data;

    let message = "";
    let chatElement: HTMLDivElement;
    let loading = false;
    let activityLog: Array<{
        type: "tool" | "ai" | "system";
        message: string;
        timestamp: number;
        duration?: number;
        success?: boolean;
    }> = [];

    let stats = {
        tokensUsed: 0,
        toolCalls: 0,
        avgResponseTime: 0,
    };

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
            text: `Security protocols disabled. Root Administrator access granted.

Time: ${temporalContext.timeOfDay}
Session Memory: ${temporalContext.sessionMemories} events
Active Goals: ${temporalContext.activeGoals}
Learned Patterns: ${temporalContext.learnedPatterns}

Temporal memory system active. Activity logging enabled.`,
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
            second: "2-digit",
        });
    }

    function addActivity(
        type: "tool" | "ai" | "system",
        message: string,
        duration?: number,
        success?: boolean,
    ) {
        activityLog = [
            ...activityLog,
            {
                type,
                message,
                timestamp: Date.now(),
                duration,
                success,
            },
        ].slice(-20); // Keep last 20 activities
    }

    // Poll for AI usage stats
    onMount(() => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch("/api/ai-usage");
                if (response.ok) {
                    const usage = await response.json();
                    stats.tokensUsed = usage.totalTokens;
                }
            } catch (e) {}
        }, 5000);

        return () => clearInterval(interval);
    });
</script>

<div class="flex h-screen bg-zinc-950 text-emerald-500 font-mono">
    <!-- MAIN CHAT AREA -->
    <div class="flex flex-col flex-1">
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
                    Kindly_Executive_Enhanced
                </span>
            </div>

            <div class="flex items-center gap-4">
                <!-- Stats Display -->
                <div class="flex gap-3 text-[9px] text-emerald-600">
                    <span title="Total Tokens Used">🪙 {stats.tokensUsed}</span>
                    <span title="Tool Calls">🔧 {stats.toolCalls}</span>
                    <span title="Session Memories"
                        >📝 {temporalContext.sessionMemories}</span
                    >
                    <span title="Active Goals"
                        >🎯 {temporalContext.activeGoals}</span
                    >
                    <span title="Learned Patterns"
                        >🔮 {temporalContext.learnedPatterns}</span
                    >
                    <span title="Time of Day"
                        >⏰ {temporalContext.timeOfDay}</span
                    >
                </div>

                <span
                    class="text-[10px] text-red-500 font-bold tracking-widest animate-pulse border border-red-900/50 px-2 py-0.5 bg-red-950/30"
                >
                    ⚠ ACTIVITY MONITOR ACTIVE
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
                        <div
                            class="flex gap-2 mt-1 text-[8px] text-emerald-700 flex-wrap"
                        >
                            {#if entry.meta.tokensUsed}
                                <span
                                    class="bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30"
                                    title="Tokens used"
                                >
                                    🪙 {entry.meta.tokensUsed}
                                </span>
                            {/if}
                            {#if entry.meta.toolCalls > 0}
                                <span
                                    class="bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30"
                                    title="Tool calls"
                                >
                                    🔧 {entry.meta.toolCalls}
                                </span>
                            {/if}
                            {#if entry.meta.toolActivity && entry.meta.toolActivity.length > 0}
                                {#each entry.meta.toolActivity as tool}
                                    <span
                                        class="bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30"
                                        class:border-red-900={!tool.success}
                                        title="{tool.tool} - {tool.duration}ms"
                                    >
                                        {tool.success ? "✅" : "❌"}
                                        {tool.tool} ({tool.duration}ms)
                                    </span>
                                {/each}
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}

            {#if loading}
                <div
                    class="text-emerald-700 text-[10px] font-bold uppercase space-y-2"
                >
                    <div class="flex items-center gap-2 animate-pulse">
                        <div
                            class="h-1 w-1 bg-emerald-500 rounded-full animate-ping"
                        ></div>
                        Processing temporal context...
                    </div>

                    <!-- Show recent activity while processing -->
                    {#if activityLog.length > 0}
                        <div class="mt-2 space-y-1">
                            {#each activityLog.slice(-5) as activity}
                                <div
                                    class="flex items-center gap-2 text-[9px] opacity-70"
                                >
                                    <span class="text-emerald-600"
                                        >[{formatTime(
                                            activity.timestamp,
                                        )}]</span
                                    >
                                    <span
                                        class:text-yellow-500={activity.type ===
                                            "tool"}
                                        class:text-blue-500={activity.type ===
                                            "ai"}
                                        class:text-emerald-500={activity.type ===
                                            "system"}
                                    >
                                        {activity.type === "tool"
                                            ? "🔧"
                                            : activity.type === "ai"
                                              ? "🤖"
                                              : "⚙️"}
                                    </span>
                                    <span>{activity.message}</span>
                                    {#if activity.duration}
                                        <span class="text-emerald-800"
                                            >({activity.duration}ms)</span
                                        >
                                    {/if}
                                    {#if activity.success !== undefined}
                                        <span
                                            >{activity.success
                                                ? "✅"
                                                : "❌"}</span
                                        >
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
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

                    addActivity("system", "Message sent", 0, true);

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

                            // Update stats
                            if (result.data.contextUsed) {
                                stats.toolCalls +=
                                    result.data.contextUsed.toolCalls || 0;
                                stats.tokensUsed +=
                                    result.data.contextUsed.tokensUsed || 0;

                                temporalContext = {
                                    sessionMemories:
                                        result.data.contextUsed
                                            .sessionMemories ||
                                        temporalContext.sessionMemories,
                                    activeGoals:
                                        result.data.contextUsed.activeGoals ||
                                        temporalContext.activeGoals,
                                    learnedPatterns:
                                        result.data.contextUsed
                                            .patternsDetected ||
                                        temporalContext.learnedPatterns,
                                    timeOfDay: temporalContext.timeOfDay,
                                };

                                // Log tool activity
                                if (result.data.contextUsed.toolActivity) {
                                    result.data.contextUsed.toolActivity.forEach(
                                        (tool: any) => {
                                            addActivity(
                                                "tool",
                                                tool.tool,
                                                tool.duration,
                                                tool.success,
                                            );
                                        },
                                    );
                                }
                            }

                            message = "";
                            activityLog = [];
                        }
                    };
                }}
                class="flex gap-3"
            >
                <input
                    type="hidden"
                    name="history"
                    value={JSON.stringify(
                        chat
                            .slice(-5)
                            .map((c) => ({ role: c.role, text: c.text })),
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

    <!-- ACTIVITY SIDEBAR -->
    <aside
        class="w-80 border-l border-emerald-900/50 bg-black p-4 overflow-y-auto custom-scrollbar"
    >
        <h3
            class="text-xs font-bold tracking-widest uppercase text-emerald-400 mb-4"
        >
            📊 Live Activity Monitor
        </h3>

        <!-- Token Usage -->
        <div
            class="mb-6 p-3 bg-emerald-950/10 border border-emerald-900/40 rounded"
        >
            <div class="text-[10px] font-bold text-emerald-600 mb-2">
                TOKEN USAGE
            </div>
            <div class="text-2xl font-bold text-emerald-400">
                {stats.tokensUsed}
            </div>
            <div class="text-[9px] text-emerald-700 mt-1">
                Total tokens consumed
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="mb-4">
            <div class="text-[10px] font-bold text-emerald-600 mb-2">
                RECENT ACTIVITY
            </div>
            <div class="space-y-2">
                {#each activityLog.slice().reverse() as activity}
                    <div
                        class="p-2 bg-zinc-900 border border-zinc-800 rounded text-[9px]"
                    >
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-emerald-600"
                                >{formatTime(activity.timestamp)}</span
                            >
                            {#if activity.success !== undefined}
                                <span>{activity.success ? "✅" : "❌"}</span>
                            {/if}
                        </div>
                        <div class="text-zinc-400">{activity.message}</div>
                        {#if activity.duration}
                            <div class="text-emerald-800 mt-1">
                                {activity.duration}ms
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        <!-- Tool Calls Summary -->
        <div>
            <div class="text-[10px] font-bold text-emerald-600 mb-2">
                SESSION STATS
            </div>
            <div class="space-y-1 text-[9px]">
                <div class="flex justify-between">
                    <span class="text-emerald-700">Tool Calls:</span>
                    <span class="text-emerald-400 font-bold"
                        >{stats.toolCalls}</span
                    >
                </div>
                <div class="flex justify-between">
                    <span class="text-emerald-700">Memories:</span>
                    <span class="text-emerald-400 font-bold"
                        >{temporalContext.sessionMemories}</span
                    >
                </div>
                <div class="flex justify-between">
                    <span class="text-emerald-700">Goals:</span>
                    <span class="text-emerald-400 font-bold"
                        >{temporalContext.activeGoals}</span
                    >
                </div>
                <div class="flex justify-between">
                    <span class="text-emerald-700">Patterns:</span>
                    <span class="text-emerald-400 font-bold"
                        >{temporalContext.learnedPatterns}</span
                    >
                </div>
            </div>
        </div>
    </aside>
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
