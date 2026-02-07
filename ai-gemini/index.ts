import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

// Accessing the key passed by the Orchestrator
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3-flash-preview"; // Flash is faster/cheaper for testing

const cell = new TypedRheoCell(`Gemini_${process.pid}`, 0);

// ============================================================================
// TOKEN TRACKING
// ============================================================================

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    timestamp: number;
}

interface UsageStats {
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    lastHourTokens: number;
    recentCalls: TokenUsage[];
}

const usageStats: UsageStats = {
    totalCalls: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    lastHourTokens: 0,
    recentCalls: []
};

function trackUsage(usage: TokenUsage) {
    usageStats.totalCalls++;
    usageStats.totalPromptTokens += usage.promptTokens;
    usageStats.totalCompletionTokens += usage.completionTokens;
    usageStats.totalTokens += usage.totalTokens;

    usageStats.recentCalls.push(usage);

    // Keep only last 100 calls
    if (usageStats.recentCalls.length > 100) {
        usageStats.recentCalls.shift();
    }

    // Calculate last hour usage
    const oneHourAgo = Date.now() - 3600000;
    usageStats.lastHourTokens = usageStats.recentCalls
        .filter(call => call.timestamp > oneHourAgo)
        .reduce((sum, call) => sum + call.totalTokens, 0);
}

// ============================================================================
// AI ROUTER WITH LOGGING
// ============================================================================

const aiRouter = router({
    ai: router({
        generate: procedure
            .input(z.object({
                prompt: z.string(),
                systemInstruction: z.string().optional(),
                jsonMode: z.boolean().optional(),
                requestId: z.string().optional() // For tracking
            }))
            .output(z.object({
                response: z.string(),
                usage: z.object({
                    promptTokens: z.number(),
                    completionTokens: z.number(),
                    totalTokens: z.number()
                })
            }))
            .meta({
                description: "Generate content using Google Gemini API with token tracking",
                example: { prompt: "Explain quantum computing" }
            })
            .mutation(async (input) => {
                const startTime = Date.now();

                // Log the request
                cell.log("INFO", `🤖 AI Request [${input.requestId || 'direct'}]: ${input.prompt.substring(0, 80)}...`);

                // Log to mesh audit
                try {
                    await cell.mesh.log.info({
                        msg: `AI_REQUEST: ${input.prompt.substring(0, 100)}... (reqId: ${input.requestId || 'none'})`,
                        from: cell.id
                    });
                } catch (e) { }

                // Base identity that is always included
                const baseIdentity = `
    BASE IDENTITY PROMPT (So you know who you are so you know whats going on)
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

                        // Log error
                        try {
                            await cell.mesh.log.info({
                                msg: `AI_ERROR: ${data.error.message}`,
                                from: cell.id
                            });
                        } catch (e) { }

                        return {
                            response: `Gemini Error: ${data.error.message}`,
                            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
                        };
                    }

                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";

                    // Extract token usage from response
                    const usage: TokenUsage = {
                        promptTokens: data.usageMetadata?.promptTokenCount || 0,
                        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                        totalTokens: data.usageMetadata?.totalTokenCount || 0,
                        timestamp: Date.now()
                    };

                    // Track usage
                    trackUsage(usage);

                    const duration = Date.now() - startTime;

                    // Log completion
                    cell.log("INFO", `✅ AI Response [${input.requestId || 'direct'}]: ${usage.totalTokens} tokens, ${duration}ms`);

                    try {
                        await cell.mesh.log.info({
                            msg: `AI_COMPLETE: ${usage.totalTokens}tok, ${duration}ms (reqId: ${input.requestId || 'none'})`,
                            from: cell.id
                        });
                    } catch (e) { }

                    return {
                        response: text,
                        usage: {
                            promptTokens: usage.promptTokens,
                            completionTokens: usage.completionTokens,
                            totalTokens: usage.totalTokens
                        }
                    };
                } catch (e: any) {
                    cell.log("ERROR", `Fetch Error: ${e.message}`);

                    try {
                        await cell.mesh.log.info({
                            msg: `AI_FETCH_ERROR: ${e.message}`,
                            from: cell.id
                        });
                    } catch (err) { }

                    throw e;
                }
            }),

        /**
         * Get current token usage statistics
         */
        usage: procedure
            .input(z.void())
            .output(z.object({
                totalCalls: z.number(),
                totalPromptTokens: z.number(),
                totalCompletionTokens: z.number(),
                totalTokens: z.number(),
                lastHourTokens: z.number(),
                avgTokensPerCall: z.number(),
                recentCalls: z.array(z.object({
                    promptTokens: z.number(),
                    completionTokens: z.number(),
                    totalTokens: z.number(),
                    timestamp: z.number()
                }))
            }))
            .query(async () => {
                return {
                    ...usageStats,
                    avgTokensPerCall: usageStats.totalCalls > 0
                        ? Math.round(usageStats.totalTokens / usageStats.totalCalls)
                        : 0,
                    recentCalls: usageStats.recentCalls.slice(-10) // Last 10 calls
                };
            }),

        /**
         * Reset usage statistics
         */
        'reset-usage': procedure
            .input(z.void())
            .output(z.object({ ok: z.boolean() }))
            .mutation(async () => {
                usageStats.totalCalls = 0;
                usageStats.totalPromptTokens = 0;
                usageStats.totalCompletionTokens = 0;
                usageStats.totalTokens = 0;
                usageStats.lastHourTokens = 0;
                usageStats.recentCalls = [];

                cell.log("INFO", "📊 Usage statistics reset");
                return { ok: true };
            })
    })
});

cell.useRouter(aiRouter);
cell.listen();

// Log usage stats periodically
setInterval(() => {
    if (usageStats.totalCalls > 0) {
        cell.log("INFO", `📊 AI Stats: ${usageStats.totalCalls} calls, ${usageStats.totalTokens} tokens total, ${usageStats.lastHourTokens} last hour`);
    }
}, 60000); // Every minute