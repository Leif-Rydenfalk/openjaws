import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

// Accessing the key passed by the Orchestrator
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3-flash-preview"; // Flash is faster/cheaper for testing

const cell = new TypedRheoCell(`Gemini_${process.pid}`, 0);

const aiRouter = router({
    ai: router({
        generate: procedure
            .input(z.object({
                prompt: z.string(),
                systemInstruction: z.string().optional(),
                jsonMode: z.boolean().optional()
            }))
            .output(z.object({ response: z.string() }))
            .meta({
                description: "Generate content using Google Gemini API",
                example: { prompt: "Explain quantum computing" }
            })
            .mutation(async (input) => {
                if (!API_KEY) {
                    cell.log("ERROR", "GEMINI_API_KEY is not set in environment!");
                    throw new Error("API_KEY_MISSING");
                }

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

                cell.log("INFO", `Generating content for prompt: ${input.prompt.substring(0, 50)}...`);

                const body: any = {
                    contents: [{ parts: [{ text: input.prompt }] }]
                };

                if (input.systemInstruction) {
                    body.systemInstruction = { parts: [{ text: input.systemInstruction }] };
                }

                if (input.jsonMode) {
                    body.generationConfig = { responseMimeType: "application/json" };
                }

                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body)
                    });

                    const data = await res.json();

                    if (data.error) {
                        cell.log("ERROR", `Gemini API Error: ${data.error.message}`);
                        return { response: `Gemini Error: ${data.error.message}` };
                    }

                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";
                    return { response: text };
                } catch (e: any) {
                    cell.log("ERROR", `Fetch Error: ${e.message}`);
                    throw e;
                }
            })
    })
});

cell.useRouter(aiRouter);
cell.listen();