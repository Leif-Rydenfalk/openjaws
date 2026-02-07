<script lang="ts">
    import { enhance } from "$app/forms";
    import { afterUpdate } from "svelte";

    let message = "";
    let chatElement: HTMLDivElement;
    let loading = false;

    // HARDCODED ADMIN CONTEXT
    let userContext = { username: "ROOT_ADMIN", role: "admin" };

    let chat: Array<{ role: "user" | "kindly"; text: string; meta?: any }> = [
        {
            role: "kindly",
            text: "Security protocols disabled. Root Administrator access granted. System is fully open.",
        },
    ];

    afterUpdate(() => {
        if (chatElement) chatElement.scrollTop = chatElement.scrollHeight;
    });
</script>

<div
    class="flex flex-col h-screen bg-zinc-950 text-emerald-500 font-mono overflow-hidden"
>
    <!-- HEADER -->
    <header
        class="h-12 border-b border-emerald-900/50 bg-black flex items-center justify-between px-6 shrink-0"
    >
        <div class="flex items-center gap-3">
            <div class="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
            <span
                class="text-xs font-bold tracking-widest uppercase text-emerald-400"
            >
                Kindly_Orchestrator_v1
            </span>
        </div>

        <div class="flex items-center gap-4">
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
                <span
                    class="text-[9px] font-bold uppercase tracking-widest opacity-30 mb-1"
                >
                    {entry.role === "user"
                        ? userContext.username
                        : "Kindly_Agent"}
                </span>
                <div
                    class="max-w-[85%] p-4 rounded-lg text-sm border
                    {entry.role === 'user'
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        : 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400'}"
                >
                    <pre
                        class="whitespace-pre-wrap font-mono">{entry.text}</pre>
                </div>
                {#if entry.meta?.personalized}
                    <span class="text-[8px] text-emerald-700 mt-1"
                        >Personalized</span
                    >
                {/if}
            </div>
        {/each}

        {#if loading}
            <div
                class="text-emerald-700 text-[10px] font-bold uppercase animate-pulse"
            >
                Processing... Signal Routing in progress
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
                return async ({ result }) => {
                    loading = false;
                    if (result.type === "success" && result.data) {
                        chat = [
                            ...chat,
                            { role: "user", text: message },
                            {
                                role: "kindly",
                                text: result.data.reply,
                                meta: result.data.contextUsed,
                            },
                        ];
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
                class="bg-red-900/20 border border-red-800 text-red-500 px-6 py-3 rounded text-xs font-bold uppercase tracking-wider hover:bg-red-500 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "EXECUTING..." : "EXECUTE"}
            </button>
        </form>
    </footer>
</div>
