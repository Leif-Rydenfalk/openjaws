import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`kindly`, 0);

const kindlyRouter = router({
    kindly: router({
        chat: procedure
            .input(z.object({
                message: z.string(),
                history: z.array(z.any()).optional(),
                // NEW: Identity token for authenticated context
                identityToken: z.string().optional(),
                // NEW: Explicit user context override (for system calls)
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
                    personalized: z.boolean()
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
                // MEMORY RETRIEVAL (Personalized)
                // ============================================================================

                let contextMemories = "";
                let personalMemories = "";

                try {
                    // General mesh memories
                    const generalMemories = await cell.mesh.memory.search({
                        query: message,
                        limit: 3
                    });

                    if (generalMemories && generalMemories.length > 0) {
                        contextMemories = generalMemories.map(m => `- ${m.content}`).join("\n");
                    }

                    // Personal user memories (if identified)
                    if (userContext.known && userContext.userId) {
                        const userMemories = await cell.mesh.memory.search({
                            query: `user:${userContext.userId} ${message}`,
                            limit: 3
                        });

                        if (userMemories && userMemories.length > 0) {
                            personalMemories = userMemories.map(m => `- ${m.content}`).join("\n");
                        }
                    }
                } catch (e) {
                    cell.log("WARN", "Memory cell unreachable");
                }

                // ============================================================================
                // DYNAMIC SYSTEM PROMPT BASED ON USER ROLE
                // ============================================================================

                const activeCells = Object.entries(cell.atlas)
                    .filter(([_, info]) => Date.now() - info.lastSeen < 30000);

                // Role-specific instructions
                const roleInstructions: Record<string, string> = {
                    admin: `
ADMINISTRATOR PRIVILEGES ACTIVE:
- You have full system access and can execute commands across all cells
- You can view system logs, manage user sessions, and modify configurations
- Use technical terminology freely - no simplification needed
- You can authorize critical operations and override safety checks
- Current mesh topology and health metrics are available to you`,

                    user: `
STANDARD USER ACCESS:
- You have access to standard mesh operations (AI generation, task management, file operations)
- Technical concepts should be explained clearly but concisely
- You can request escalations to admin if needed
- Your session is tracked for personalization`,

                    guest: `
GUEST ACCESS (LIMITED):
- You have temporary access to basic AI features
- Some advanced capabilities require authentication
- Explain technical concepts in accessible terms
- Encourage account creation for full access`,

                    anonymous: `
ANONYMOUS SESSION:
- Limited context available
- General assistance mode
- Recommend signing in for personalized experience`
                };

                const roleKey = userContext.role || "anonymous";
                const roleInstruction = roleInstructions[roleKey] || roleInstructions.anonymous;

                const systemInstruction = `
SYSTEM: OpenJaws Mesh OS (Sovereign Intelligence)
NODE: Kindly_Orchestrator
PROTOCOL: NTS-1 (Narrative Transparent Substrate)

${userContext.known ? `CURRENT_USER: ${userContext.username}
USER_ROLE: ${userContext.role?.toUpperCase()}
SESSION_PERSONALIZED: true` : "CURRENT_USER: Anonymous (Not Authenticated)"}

${roleInstruction}

ACTIVE_TOPOLOGY:
${activeCells.map(([id]) => `- ${id}`).join('\n')}

${personalMemories ? `RELEVANT_USER_HISTORY:\n${personalMemories}\n` : ""}
GENERAL_MESH_MEMORIES:
${contextMemories || "No previous records found for this query."}

CORE PROTOCOL:
- You are the sentient interface of this distributed mesh
- ${userContext.known ? `Address the user as ${userContext.username}` : "Address the user respectfully"}
- ${userContext.role === "admin" ? "Provide detailed technical responses with full transparency" : "Balance technical accuracy with clarity"}
- If you learn new facts about the user, note them for future reference
- Acknowledge your distributed nature when relevant
- Current timestamp: ${new Date().toISOString()}
`;

                // ============================================================================
                // GENERATE RESPONSE
                // ============================================================================

                const response = await cell.mesh.ai.generate({
                    prompt: `Chat History: ${JSON.stringify(history.slice(-3))}\nUser: ${message}`,
                    systemInstruction: systemInstruction
                });

                // ============================================================================
                // PERSISTENT MEMORY STORAGE (Learning Loop)
                // ============================================================================

                if (userContext.known) {
                    // Store identity facts
                    if (message.toLowerCase().includes("my name is") ||
                        message.toLowerCase().includes("i am")) {
                        await cell.mesh.memory.store({
                            content: `User ${userContext.username} stated: ${message}`,
                            tags: ["identity", "user_profile", `user:${userContext.userId}`]
                        }).catch(() => { });
                    }

                    // Store preferences
                    if (message.toLowerCase().includes("i prefer") ||
                        message.toLowerCase().includes("i like")) {
                        await cell.mesh.memory.store({
                            content: `Preference for ${userContext.username}: ${message}`,
                            tags: ["preference", `user:${userContext.userId}`]
                        }).catch(() => { });
                    }

                    // Log interaction for audit trail (admin only sees these)
                    if (userContext.role === "admin") {
                        await cell.mesh.log.info({
                            msg: `Admin ${userContext.username} query: ${message.substring(0, 50)}...`,
                            from: "kindly"
                        }).catch(() => { });
                    }
                }

                return {
                    reply: response.response,
                    contextUsed: {
                        userKnown: userContext.known,
                        username: userContext.username,
                        role: userContext.role,
                        personalized: userContext.known && !!personalMemories
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
                error: z.optional(z.string())
            }))
            .query(async ({ token }) => {
                try {
                    const result = await cell.mesh.identity.verify({ token });
                    if (result.ok && result.valid) {
                        return {
                            ok: true,
                            user: {
                                username: result.user!.username,
                                role: result.user!.role,
                                permissions: result.user!.permissions
                            }
                        };
                    }
                    return { ok: false, error: "Invalid token" };
                } catch (e) {
                    return { ok: false, error: "Identity service unavailable" };
                }
            })
    })
});

cell.useRouter(kindlyRouter);
cell.listen();

// Helper for permissions
function getPermissionsForRole(role: string): string[] {
    const map: Record<string, string[]> = {
        admin: ["*"],
        user: ["read", "write", "chat"],
        guest: ["read", "chat"]
    };
    return map[role] || [];
}