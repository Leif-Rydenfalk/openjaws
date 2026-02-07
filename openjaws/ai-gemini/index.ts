import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-1.5-pro";

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
            .mutation(async (input) => {
                if (!API_KEY) throw new Error("GEMINI_API_KEY missing");

                const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

                const body = {
                    contents: [{ parts: [{ text: input.prompt }] }],
                    systemInstruction: input.systemInstruction ? { parts: [{ text: input.systemInstruction }] } : undefined,
                    generationConfig: input.jsonMode ? { responseMimeType: "application/json" } : undefined
                };

                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });

                const data = await res.json();
                if (data.error) throw new Error(`Gemini Error: ${data.error.message}`);

                const text = data.candidates[0].content.parts[0].text;
                return { response: text };
            })
    })
});

cell.useRouter(aiRouter);
cell.listen();