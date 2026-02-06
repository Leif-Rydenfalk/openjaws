import { RheoCell } from "../protocols/example1";

// Accept seed from orchestrator (process.argv[2])
const seed = process.argv[2];
const cell = new RheoCell(`Inference_${process.pid}`, 0, seed);

cell.provide("ai/generate", async (args: { prompt: string }) => {
    cell.log("INFO", `🤖 Processing prompt: "${args.prompt.substring(0, 30)}..."`);

    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3",
                prompt: args.prompt,
                stream: false
            }),
            // Short timeout so we don't hang the mesh
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) throw new Error("Ollama error");
        return await response.json();

    } catch (e) {
        cell.log("WARN", "⚠️ Ollama unreachable. Returning mock response.");
        return {
            model: "mock-llm",
            response: `[MOCK] I heard you say: "${args.prompt}". (To see real AI, start Ollama with 'llama3')`,
            done: true
        };
    }
});

cell.listen();