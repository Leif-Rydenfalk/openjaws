import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`kindly`, 0);

const kindlyRouter = router({
    kindly: router({
        chat: procedure
            .input(z.object({ message: z.string(), history: z.array(z.any()).optional() }))
            .mutation(async ({ message, history = [] }) => {
                cell.log("INFO", `Processing message: ${message}`);

                // 1. SEARCH LONG-TERM MEMORY
                // We look for relevant context based on the user's message
                let contextMemories = "";
                try {
                    const memories = await cell.mesh.memory.search({ query: message, limit: 3 });
                    if (memories && memories.length > 0) {
                        contextMemories = memories.map(m => `- ${m.content}`).join("\n");
                        cell.log("INFO", `Retrieved ${memories.length} relevant memories`);
                    }
                } catch (e) {
                    cell.log("WARN", "Memory cell unreachable, proceeding with limited context");
                }

                // 2. GET CURRENT MESH STATE
                const activeCells = Object.entries(cell.atlas)
                    .filter(([_, info]) => Date.now() - info.lastSeen < 30000);

                const systemInstruction = `
                SYSTEM: OpenJaws Mesh OS (Sovereign Intelligence)
                NODE: Kindly_Orchestrator
                
                ACTIVE_TOPOLOGY:
                ${activeCells.map(([id]) => `- ${id}`).join('\n')}

                RELEVANT_LONG_TERM_MEMORIES:
                ${contextMemories || "No previous records found for this query."}

                CORE PROTOCOL:
                - You are the sentient interface of this mesh.
                - If the user introduces themselves (e.g., "My name is..."), REMEMBER IT.
                - Use the RELEVANT_LONG_TERM_MEMORIES to answer questions about the past.
                - If you learn a new fact about the user, include [STORE_MEMORY: fact] in your internal logic.
                - Be concise, helpful, and acknowledge your distributed nature.
                `;

                // 3. GENERATE RESPONSE
                const response = await cell.mesh.ai.generate({
                    prompt: `Chat History: ${JSON.stringify(history.slice(-3))}\nUser: ${message}`,
                    systemInstruction: systemInstruction
                });

                // 4. PERSISTENT MEMORY STORAGE (The "Consciousness" Loop)
                // If the user said "My name is...", we proactively store it.
                if (message.toLowerCase().includes("my name is") || message.toLowerCase().includes("i am")) {
                    await cell.mesh.memory.store({
                        content: `User Identity: ${message}`,
                        tags: ["identity", "user_profile"]
                    }).catch(() => { });
                    cell.log("INFO", "Stored identity fact to memory");
                }

                return { reply: response.response };
            })
    })
});

cell.useRouter(kindlyRouter);
cell.listen();