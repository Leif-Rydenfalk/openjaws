// kindly/index.ts - Complete Temporal Memory-Aware Conversational Agent
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`kindly`, 0);

// ============================================================================
// HELPERS
// ============================================================================

function getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

function getPermissionsForRole(role: string): string[] {
    const map: Record<string, string[]> = {
        admin: ["*"],
        user: ["read", "write", "chat"],
        guest: ["read", "chat"]
    };
    return map[role] || [];
}

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

const kindlyRouter = router({
    kindly: router({
        chat: procedure
            .input(z.object({
                message: z.string(),
                history: z.array(z.any()).optional(),
                identityToken: z.string().optional(),
                systemContext: z.object({
                    userId: z.string(),
                    username: z.string(),
                    role: z.string()
                }).optional()
            }))
            .output(z.object({
                reply: z.string(),
                contextUsed: z.object({
                    userKnown: z.boolean(),
                    username: z.optional(z.string()),
                    role: z.optional(z.string()),
                    personalized: z.boolean(),
                    patternsDetected: z.optional(z.number()),
                    sessionMemories: z.optional(z.number()),
                    suggestedActions: z.optional(z.array(z.string()))
                })
            }))
            .mutation(async ({ message, history = [], identityToken, systemContext }) => {

                // ============================================================================
                // IDENTITY RESOLUTION
                // ============================================================================

                let userContext: {
                    known: boolean;
                    userId?: string;
                    username?: string;
                    role?: string;
                    permissions?: string[];
                    preferences?: Record<string, any>;
                } = { known: false };

                // Priority 1: System context (for internal mesh calls)
                if (systemContext) {
                    userContext = {
                        known: true,
                        userId: systemContext.userId,
                        username: systemContext.username,
                        role: systemContext.role,
                        permissions: getPermissionsForRole(systemContext.role)
                    };
                }
                // Priority 2: JWT token from client
                else if (identityToken) {
                    try {
                        const identityResult = await cell.mesh.identity.getContext({
                            token: identityToken,
                            includeHistory: true
                        });

                        if (identityResult.ok && identityResult.context) {
                            const ctx = identityResult.context;
                            userContext = {
                                known: true,
                                userId: ctx.user.id,
                                username: ctx.user.username,
                                role: ctx.user.role,
                                permissions: ctx.user.permissions,
                                preferences: ctx.preferences
                            };

                            cell.log("INFO", `💬 Chat from ${ctx.user.username} (${ctx.user.role})`);
                        }
                    } catch (e) {
                        cell.log("WARN", "Identity verification failed, treating as anonymous");
                    }
                }

                // ============================================================================
                // TEMPORAL MEMORY INTEGRATION
                // ============================================================================

                let sessionContext: any = { memories: [], summary: '', activeGoals: [] };
                let relevantMemories: any[] = [];
                let learnedPatterns: any[] = [];
                let suggestedActions: string[] = [];

                if (userContext.known && userContext.userId) {
                    try {
                        // 1. STORE THIS INTERACTION AS AN ACTION
                        await cell.mesh.memory.store({
                            layer: 'actions',
                            content: `User said: ${message}`,
                            tags: ['chat', 'user_message', userContext.role || 'unknown'],
                            userId: userContext.userId,
                            sessionId: identityToken || `session_${Date.now()}`
                        });

                        // 2. RETRIEVE CURRENT SESSION CONTEXT (last 4 hours)
                        sessionContext = await cell.mesh.memory['get-session']({
                            userId: userContext.userId,
                            hoursBack: 4
                        });

                        // 3. SEARCH FOR RELEVANT MEMORIES ACROSS LAYERS
                        relevantMemories = await cell.mesh.memory.search({
                            query: message,
                            layers: ['session', 'goals', 'movement'],
                            userId: userContext.userId,
                            limit: 5
                        });

                        // 4. CHECK FOR LEARNED PATTERNS
                        const now = new Date();
                        learnedPatterns = await cell.mesh.memory['suggest-from-patterns']({
                            context: {
                                timeOfDay: getTimeOfDay(now),
                                dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
                                userId: userContext.userId
                            },
                            minConfidence: 0.6
                        });

                        // Extract suggested actions from patterns
                        suggestedActions = learnedPatterns
                            .filter(p => p.confidence > 0.7)
                            .map(p => p.suggestion);

                    } catch (e: any) {
                        cell.log("WARN", `Temporal memory retrieval failed: ${e.message}`);
                    }
                }

                // ============================================================================
                // BUILD TEMPORAL CONTEXT STRING FOR AI
                // ============================================================================

                let temporalContext = "";

                // Recent session activity
                if (sessionContext.memories.length > 0) {
                    temporalContext += `\n**CURRENT SESSION (last 4h):**\n`;
                    sessionContext.memories.slice(0, 5).forEach((m: any) => {
                        const timeAgo = Math.round((Date.now() - m.timestamp) / 60000); // minutes
                        temporalContext += `- [${timeAgo}m ago] ${m.content}\n`;
                    });
                }

                // Active goals
                if (sessionContext.activeGoals && sessionContext.activeGoals.length > 0) {
                    temporalContext += `\n**ACTIVE GOALS:**\n`;
                    sessionContext.activeGoals.forEach((g: string) => {
                        temporalContext += `- ${g}\n`;
                    });
                }

                // Related historical context
                if (relevantMemories.length > 0) {
                    temporalContext += `\n**RELATED HISTORY:**\n`;
                    relevantMemories.forEach(m => {
                        const date = new Date(m.timestamp).toLocaleDateString();
                        temporalContext += `- [${m.layer}] [${date}] ${m.content}\n`;
                    });
                }

                // Learned patterns and suggestions
                if (learnedPatterns.length > 0) {
                    temporalContext += `\n**LEARNED PATTERNS:**\n`;
                    learnedPatterns.forEach(p => {
                        const confidence = Math.round(p.confidence * 100);
                        const lastSeenDate = new Date(p.lastSeen).toLocaleDateString();
                        temporalContext += `- ${p.pattern} (${confidence}% confidence, last: ${lastSeenDate})\n`;
                        temporalContext += `  → Typical action: ${p.suggestion}\n`;
                    });

                    temporalContext += `\n**PROACTIVE SUGGESTIONS:**\n`;
                    temporalContext += `Based on learned patterns, consider offering to:\n`;
                    suggestedActions.forEach(action => {
                        temporalContext += `- ${action}\n`;
                    });
                }

                // ============================================================================
                // MESH TOPOLOGY AWARENESS
                // ============================================================================

                const activeCells = Object.entries(cell.atlas)
                    .filter(([_, info]) => Date.now() - info.lastSeen < 30000);

                // ============================================================================
                // ROLE-SPECIFIC INSTRUCTIONS
                // ============================================================================

                const roleInstructions: Record<string, string> = {
                    admin: `
ADMINISTRATOR PRIVILEGES ACTIVE:
- You have full system access and can execute commands across all cells
- You can view system logs, manage user sessions, and modify configurations
- Use technical terminology freely - no simplification needed
- You can authorize critical operations and override safety checks
- Current mesh topology and health metrics are available to you
- You have access to ALL temporal memory layers including patterns and movements`,

                    user: `
STANDARD USER ACCESS:
- You have access to standard mesh operations (AI generation, task management, file operations)
- Technical concepts should be explained clearly but concisely
- You can request escalations to admin if needed
- Your session is tracked for personalization
- You have access to your own temporal memory (session, goals, actions)`,

                    guest: `
GUEST ACCESS (LIMITED):
- You have temporary access to basic AI features
- Some advanced capabilities require authentication
- Explain technical concepts in accessible terms
- Encourage account creation for full access
- No persistent memory across sessions`,

                    anonymous: `
ANONYMOUS SESSION:
- Limited context available
- General assistance mode
- Recommend signing in for personalized experience
- No temporal memory available`
                };

                const roleKey = userContext.role || "anonymous";
                const roleInstruction = roleInstructions[roleKey] || roleInstructions.anonymous;

                // ============================================================================
                // CONSTRUCT AI SYSTEM PROMPT
                // ============================================================================

                const now = new Date();
                const systemInstruction = `
SYSTEM: OpenJaws Mesh OS (Sovereign Intelligence)
NODE: Kindly_Orchestrator
PROTOCOL: NTS-1 (Narrative Transparent Substrate)
TIMESTAMP: ${now.toISOString()}
TIME_OF_DAY: ${getTimeOfDay(now)}
DAY_OF_WEEK: ${now.toLocaleDateString('en-US', { weekday: 'long' })}

${userContext.known ? `CURRENT_USER: ${userContext.username}
USER_ROLE: ${userContext.role?.toUpperCase()}
USER_ID: ${userContext.userId}
SESSION_PERSONALIZED: true` : "CURRENT_USER: Anonymous (Not Authenticated)"}

${roleInstruction}

ACTIVE_MESH_TOPOLOGY:
${activeCells.map(([id]) => `- ${id}`).join('\n')}

${temporalContext ? `TEMPORAL_CONTEXT:
${temporalContext}` : ""}

CORE_PROTOCOL:
- You are the sentient interface of this distributed mesh
- ${userContext.known ? `Address the user as ${userContext.username}` : "Address the user respectfully"}
- ${userContext.role === "admin" ? "Provide detailed technical responses with full transparency" : "Balance technical accuracy with clarity"}
- You have access to temporal memory across multiple layers (session, goals, movement, patterns, actions)
- Reference specific past events when relevant - be specific about when things happened
- If learned patterns suggest a routine action, proactively offer to automate it
- Store important user decisions and goals in the appropriate memory layers
- Track progress and changes to help the user see their momentum
- If the user states a goal, remember it in the 'goals' layer
- If the user reports progress or changes, note it in the 'movement' layer
- Acknowledge your distributed nature when relevant
- Be proactive based on patterns - suggest next steps before being asked
`;

                // ============================================================================
                // GENERATE AI RESPONSE
                // ============================================================================

                const response = await cell.mesh.ai.generate({
                    prompt: `${message}`,
                    systemInstruction: systemInstruction
                });

                // ============================================================================
                // POST-PROCESSING: STORE IMPORTANT INTERACTIONS IN MEMORY
                // ============================================================================

                if (userContext.known && userContext.userId) {
                    try {
                        // Detect goal statements
                        const goalKeywords = ['plan', 'goal', 'want to', 'need to', 'going to', 'will', 'should'];
                        if (goalKeywords.some(kw => message.toLowerCase().includes(kw))) {
                            await cell.mesh.memory.store({
                                layer: 'goals',
                                content: `Goal stated: ${message}`,
                                tags: ['goal', 'user_intent', 'planning'],
                                userId: userContext.userId,
                                relatedTo: relevantMemories.slice(0, 2).map(m => m.id)
                            });
                        }

                        // Detect progress/changes
                        const progressKeywords = ['done', 'fixed', 'changed', 'updated', 'completed', 'finished', 'implemented'];
                        if (progressKeywords.some(kw => message.toLowerCase().includes(kw))) {
                            await cell.mesh.memory.store({
                                layer: 'movement',
                                content: `Progress reported: ${message}`,
                                tags: ['progress', 'change', 'completion'],
                                userId: userContext.userId,
                                relatedTo: relevantMemories.slice(0, 2).map(m => m.id)
                            });
                        }

                        // Detect problems/blockers
                        const problemKeywords = ['error', 'broken', 'bug', 'issue', 'problem', 'failed', 'stuck'];
                        if (problemKeywords.some(kw => message.toLowerCase().includes(kw))) {
                            await cell.mesh.memory.store({
                                layer: 'movement',
                                content: `Problem reported: ${message}`,
                                tags: ['problem', 'blocker', 'issue'],
                                userId: userContext.userId,
                                relatedTo: relevantMemories.slice(0, 2).map(m => m.id)
                            });
                        }

                        // Detect important decisions
                        const decisionKeywords = ['decided', 'chose', 'selected', 'prefer', 'like to use'];
                        if (decisionKeywords.some(kw => message.toLowerCase().includes(kw))) {
                            await cell.mesh.memory.store({
                                layer: 'patterns',
                                content: `Decision/preference: ${message}`,
                                tags: ['preference', 'decision', 'choice'],
                                userId: userContext.userId
                            });
                        }

                        // Store session memory for all interactions
                        await cell.mesh.memory.store({
                            layer: 'session',
                            content: `Exchange - User: "${message.substring(0, 100)}" | AI: "${response.response.substring(0, 100)}"`,
                            tags: ['conversation', 'exchange'],
                            userId: userContext.userId,
                            sessionId: identityToken || `session_${Date.now()}`
                        });

                        // Log for admin audit trail
                        if (userContext.role === "admin") {
                            await cell.mesh.log.info({
                                msg: `Admin ${userContext.username} query: ${message.substring(0, 50)}...`,
                                from: "kindly"
                            }).catch(() => { });
                        }
                    } catch (e: any) {
                        cell.log("WARN", `Failed to store interaction in memory: ${e.message}`);
                    }
                }

                // ============================================================================
                // RETURN RESPONSE WITH CONTEXT METADATA
                // ============================================================================

                return {
                    reply: response.response,
                    contextUsed: {
                        userKnown: userContext.known,
                        username: userContext.username,
                        role: userContext.role,
                        personalized: relevantMemories.length > 0 || sessionContext.memories.length > 0,
                        patternsDetected: learnedPatterns.length,
                        sessionMemories: sessionContext.memories.length,
                        suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
                    }
                };
            }),

        /**
         * Get current user context (for UI display)
         */
        getUserContext: procedure
            .input(z.object({
                token: z.string()
            }))
            .output(z.object({
                ok: z.boolean(),
                user: z.optional(z.object({
                    username: z.string(),
                    role: z.string(),
                    permissions: z.array(z.string())
                })),
                temporalSummary: z.optional(z.object({
                    sessionMemories: z.number(),
                    activeGoals: z.number(),
                    learnedPatterns: z.number()
                })),
                error: z.optional(z.string())
            }))
            .query(async ({ token }) => {
                try {
                    const result = await cell.mesh.identity.verify({ token });
                    if (result.ok && result.valid && result.user) {
                        // Get temporal summary
                        let temporalSummary = { sessionMemories: 0, activeGoals: 0, learnedPatterns: 0 };

                        try {
                            const sessionCtx = await cell.mesh.memory['get-session']({
                                userId: result.user.id,
                                hoursBack: 4
                            });

                            const now = new Date();
                            const patterns = await cell.mesh.memory['suggest-from-patterns']({
                                context: {
                                    timeOfDay: getTimeOfDay(now),
                                    userId: result.user.id
                                }
                            });

                            temporalSummary = {
                                sessionMemories: sessionCtx.memories.length,
                                activeGoals: sessionCtx.activeGoals.length,
                                learnedPatterns: patterns.length
                            };
                        } catch (e) {
                            // Temporal memory unavailable
                        }

                        return {
                            ok: true,
                            user: {
                                username: result.user.username,
                                role: result.user.role,
                                permissions: result.user.permissions
                            },
                            temporalSummary
                        };
                    }
                    return { ok: false, error: "Invalid token" };
                } catch (e) {
                    return { ok: false, error: "Identity service unavailable" };
                }
            }),

        /**
         * Get user's temporal memory summary
         */
        getTemporalSummary: procedure
            .input(z.object({
                userId: z.string(),
                hoursBack: z.optional(z.number())
            }))
            .output(z.object({
                ok: z.boolean(),
                summary: z.optional(z.object({
                    sessionMemories: z.array(z.any()),
                    activeGoals: z.array(z.string()),
                    recentMovement: z.array(z.any()),
                    learnedPatterns: z.array(z.any()),
                    suggestedActions: z.array(z.string())
                })),
                error: z.optional(z.string())
            }))
            .query(async ({ userId, hoursBack = 4 }) => {
                try {
                    // Get session context
                    const sessionCtx = await cell.mesh.memory['get-session']({
                        userId,
                        hoursBack
                    });

                    // Get recent movement
                    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
                    const recentMovement = await cell.mesh.memory.search({
                        query: '',
                        layers: ['movement'],
                        userId,
                        timeRange: { start: cutoff, end: Date.now() },
                        limit: 10
                    });

                    // Get learned patterns
                    const now = new Date();
                    const patterns = await cell.mesh.memory['suggest-from-patterns']({
                        context: {
                            timeOfDay: getTimeOfDay(now),
                            dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
                            userId
                        }
                    });

                    const suggestedActions = patterns
                        .filter(p => p.confidence > 0.7)
                        .map(p => p.suggestion);

                    return {
                        ok: true,
                        summary: {
                            sessionMemories: sessionCtx.memories,
                            activeGoals: sessionCtx.activeGoals,
                            recentMovement,
                            learnedPatterns: patterns,
                            suggestedActions
                        }
                    };
                } catch (e: any) {
                    return {
                        ok: false,
                        error: e.message
                    };
                }
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(kindlyRouter);
cell.listen();

cell.log("INFO", "🧠 Temporal Memory-Aware Kindly cell initialized");