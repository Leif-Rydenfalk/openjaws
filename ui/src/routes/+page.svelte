<!-- ui/src/routes/kindly/+page.svelte -->
<script lang="ts">
    import { enhance } from "$app/forms";
    import { afterUpdate } from "svelte";

    let message = "";
    let chatElement: HTMLDivElement;
    let loading = false;
    let sessionId = "new";

    let chat: Array<{
        role: "user" | "kindly";
        text: string;
        timestamp: number;
    }> = [
        {
            role: "kindly",
            text: "Ready. What do you need?",
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

<div class="flex flex-col h-screen bg-zinc-950 text-emerald-500 font-mono">
    <!-- HEADER -->
    <header
        class="h-12 border-b border-emerald-900/50 bg-black flex items-center justify-between px-6"
    >
        <div class="flex items-center gap-3">
            <div
                class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
            ></div>
            <span class="text-xs font-bold tracking-widest uppercase"
                >Kindly_Executive</span
            >
        </div>
        <span class="text-[10px] text-emerald-600"
            >Session: {sessionId.substring(0, 16)}</span
        >
    </header>

    <!-- CHAT AREA -->
    <div
        bind:this={chatElement}
        class="flex-grow overflow-y-auto p-6 space-y-4"
    >
        {#each chat as entry}
            <div
                class="flex flex-col {entry.role === 'user'
                    ? 'items-end'
                    : 'items-start'}"
            >
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[9px] font-bold uppercase opacity-30">
                        {entry.role === "user" ? "YOU" : "KINDLY"}
                    </span>
                    <span class="text-[8px] text-emerald-900"
                        >{formatTime(entry.timestamp)}</span
                    >
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
            </div>
        {/each}

        {#if loading}
            <div
                class="text-emerald-700 text-[10px] font-bold uppercase animate-pulse"
            >
                Processing...
            </div>
        {/if}
    </div>

    <!-- INPUT -->
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
                        if (result.data.ok) {
                            sessionId = result.data.sessionId;
                            chat = [
                                ...chat,
                                { role: "user", text: userMsg, timestamp },
                                {
                                    role: "kindly",
                                    text: result.data.reply,
                                    timestamp: Date.now(),
                                },
                            ];
                            message = "";
                        }
                    }
                };
            }}
            class="flex gap-3"
        >
            <input type="hidden" name="sessionId" value={sessionId} />
            <input
                name="message"
                bind:value={message}
                placeholder="What do you need?"
                disabled={loading}
                class="flex-grow bg-zinc-900 border border-zinc-800 rounded p-3 text-sm text-emerald-400 placeholder-zinc-600 focus:border-emerald-500 outline-none disabled:opacity-50"
            />
            <button
                type="submit"
                disabled={!message.trim() || loading}
                class="bg-emerald-900/20 border border-emerald-800 text-emerald-500 px-6 py-3 rounded text-xs font-bold uppercase hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50"
            >
                {loading ? "PROCESSING" : "SEND"}
            </button>
        </form>
    </footer>
</div>
