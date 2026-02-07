<script lang="ts">
    import { enhance } from "$app/forms";
    import { afterUpdate } from "svelte";

    let message = "";
    let chatElement: HTMLDivElement;
    let loading = false;

    let chat: Array<{ role: "user" | "kindly"; text: string }> = [
        {
            role: "kindly",
            text: "Systems stabilized. Orchestrator Kindly online. How shall we direct the mesh?",
        },
    ];

    afterUpdate(() => {
        if (chatElement) chatElement.scrollTop = chatElement.scrollHeight;
    });
</script>

<div
    class="flex flex-col h-screen bg-zinc-950 text-emerald-500 font-mono overflow-hidden"
>
    <header
        class="h-12 border-b border-emerald-900/50 bg-black flex items-center justify-between px-6 shrink-0"
    >
        <div class="flex items-center gap-3">
            <div
                class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
            ></div>
            <span
                class="text-xs font-bold tracking-widest uppercase text-emerald-400"
                >Kindly_Orchestrator_v1</span
            >
        </div>
    </header>

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
                    {entry.role === "user" ? "Local_User" : "Kindly_Agent"}
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
            </div>
        {/each}

        {#if loading}
            <div
                class="text-emerald-700 text-[10px] font-bold uppercase animate-pulse"
            >
                Thinking... Signal Routing in progress
            </div>
        {/if}
    </div>

    <footer class="p-4 bg-black border-t border-emerald-900/50">
        <form
            method="POST"
            action="?/send"
            use:enhance={() => {
                const userMsg = message;
                message = "";
                loading = true;
                chat = [...chat, { role: "user", text: userMsg }];

                return async ({ result }) => {
                    loading = false;
                    if (result.type === "success" && result.data?.ok) {
                        chat = [
                            ...chat,
                            { role: "kindly", text: result.data.reply },
                        ];
                    } else {
                        chat = [
                            ...chat,
                            {
                                role: "kindly",
                                text:
                                    "ERROR: Link failure. " +
                                    (result.data?.error || "Unknown"),
                            },
                        ];
                    }
                };
            }}
            class="max-w-4xl mx-auto relative"
        >
            <input
                bind:value={message}
                name="message"
                placeholder="Type a command..."
                class="w-full bg-zinc-900 border border-emerald-800/50 rounded p-4 text-sm outline-none focus:border-emerald-500"
                autocomplete="off"
            />
            <button
                class="absolute right-3 top-3 px-4 py-1.5 bg-emerald-900/20 border border-emerald-800 text-emerald-500 text-[10px] hover:bg-emerald-500 hover:text-black"
                >Transmit</button
            >
        </form>
    </footer>
</div>
