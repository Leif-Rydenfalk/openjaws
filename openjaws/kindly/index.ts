import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`kindly`, 0);

const kindlyRouter = router({
    kindly: router({
        chat: procedure
            .input(z.object({ message: z.string(), history: z.array(z.any()).optional() }))
            .mutation(async ({ message, history = [] }) => {

                // 1. DYNAMIC TOPOLOGY (Filtered for fresh cells only)
                const now = Date.now();
                const activeCells = Object.entries(cell.atlas)
                    .filter(([_, info]) => now - info.lastSeen < 30000); // 30s freshness

                const topology = activeCells.map(([id, info]) => {
                    return `- ${id} [CAPS: ${info.caps.join(', ')}]`;
                }).join('\n');

                const systemInstruction = `
                SYSTEM: OpenJaws Mesh OS
                AGENT: Kindly
                ACTIVE_CELLS_COUNT: ${activeCells.length}
                
                CURRENT TOPOLOGY:
                ${topology}

                CORE PROTOCOL:
                - You are a concise mesh operator.
                - Respond strictly to the LATEST user message.
                - Use the history provided only for context.
                - If asked about cells, use the ACTIVE_CELLS_COUNT (${activeCells.length}).
                `;

                const response = await cell.mesh.ai.generate({
                    prompt: `History: ${JSON.stringify(history.slice(-5))}\n\nUser: ${message}`,
                    systemInstruction: systemInstruction
                });

                return { reply: response.response };
            })
    })
});

cell.useRouter(kindlyRouter);
cell.listen();