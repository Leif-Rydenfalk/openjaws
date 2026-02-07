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
                // Base identity that is always included
                const baseIdentity = `
    IDENTITY: Gemini Flash Node [${cell.id}]
    OPERATING_SYSTEM: OpenJaws Mesh OS
    CONTEXT_AWARENESS: High
    PROTOCOLS: NTS-1 (Narrative Transparent Substrate)
    
    You are a node in a distributed computing mesh. Your responses are being 
    routed through a network of specialized cells. You provide intelligence 
    to the Architect, the Coder, and Kindly.
    `;

                // Combine the base identity with any specific instructions passed in the call
                const fullSystemInstruction = `${baseIdentity}\n${input.systemInstruction || ""}`;

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

                const body: any = {
                    contents: [{ parts: [{ text: input.prompt }] }],
                    // ADDED HERE: This ensures the AI always knows it's a Mesh Node
                    systemInstruction: {
                        parts: [{ text: fullSystemInstruction }]
                    }
                };

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