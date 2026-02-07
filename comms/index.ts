// comms/index.ts - Channel-Agnostic Conversation Management
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const SESSIONS_PATH = join(DATA_DIR, "chat_sessions.json");
const CHANNELS_PATH = join(DATA_DIR, "channels.json");

const cell = new TypedRheoCell(`Comms_${process.pid}`, 0);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ChannelType = 'web' | 'telegram' | 'discord' | 'sms' | 'whatsapp' | 'slack';

interface ChatSession {
    id: string;
    channel: ChannelType;
    channelUserId: string;  // Channel-specific user ID
    userId?: string;        // Internal user ID (from identity cell)
    username?: string;
    role?: string;
    createdAt: number;
    lastActive: number;
    messageCount: number;
    metadata: Record<string, any>;
}

// ============================================================================
// DATA PERSISTENCE
// ============================================================================

function loadSessions(): Record<string, ChatSession> {
    try {
        if (existsSync(SESSIONS_PATH)) {
            return JSON.parse(readFileSync(SESSIONS_PATH, 'utf8'));
        }
    } catch (e) { }
    return {};
}

function saveSessions(sessions: Record<string, ChatSession>) {
    writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}

// ============================================================================
// COMMS ROUTER
// ============================================================================

const commsRouter = router({
    comms: router({
        /**
         * Start or resume a chat session
         */
        'start-session': procedure
            .input(z.object({
                channel: z.enum(['web', 'telegram', 'discord', 'sms', 'whatsapp', 'slack']),
                channelUserId: z.string(),
                metadata: z.optional(z.any())
            }))
            .output(z.object({
                sessionId: z.string(),
                isNew: z.boolean(),
                user: z.optional(z.object({
                    userId: z.string(),
                    username: z.string(),
                    role: z.string()
                }))
            }))
            .mutation(async (input) => {
                const sessions = loadSessions();

                // Find existing session
                const existing = Object.values(sessions).find(
                    s => s.channel === input.channel && s.channelUserId === input.channelUserId
                );

                if (existing) {
                    existing.lastActive = Date.now();
                    saveSessions(sessions);

                    return {
                        sessionId: existing.id,
                        isNew: false,
                        user: existing.userId ? {
                            userId: existing.userId,
                            username: existing.username || 'User',
                            role: existing.role || 'user'
                        } : undefined
                    };
                }

                // Create new session
                const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const newSession: ChatSession = {
                    id: sessionId,
                    channel: input.channel,
                    channelUserId: input.channelUserId,
                    createdAt: Date.now(),
                    lastActive: Date.now(),
                    messageCount: 0,
                    metadata: input.metadata || {}
                };

                sessions[sessionId] = newSession;
                saveSessions(sessions);

                cell.log("INFO", `📱 New ${input.channel} session: ${sessionId}`);

                return {
                    sessionId,
                    isNew: true
                };
            }),

        /**
         * Send message and get AI response
         */
        chat: procedure
            .input(z.object({
                sessionId: z.string(),
                message: z.string(),
                metadata: z.optional(z.any())
            }))
            .output(z.object({
                messageId: z.string(),
                reply: z.string(),
                contextUsed: z.any()
            }))
            .mutation(async (input) => {
                const sessions = loadSessions();
                const session = sessions[input.sessionId];

                if (!session) {
                    throw new Error("Session not found");
                }

                // Update session
                session.lastActive = Date.now();
                session.messageCount++;
                saveSessions(sessions);

                // Get AI response from Kindly
                const response = await cell.mesh.kindly.chat({
                    message: input.message,
                    systemContext: {
                        userId: session.userId || session.channelUserId,
                        username: session.username || 'User',
                        role: session.role || 'user',
                        sessionId: session.id,
                        channel: session.channel
                    }
                });

                const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                return {
                    messageId,
                    reply: response.reply,
                    contextUsed: response.contextUsed
                };
            }),

        /**
         * Get session info
         */
        'get-session': procedure
            .input(z.object({
                sessionId: z.string()
            }))
            .output(z.object({
                session: z.any(),
                found: z.boolean()
            }))
            .query(async (input) => {
                const sessions = loadSessions();
                return {
                    session: sessions[input.sessionId] || null,
                    found: !!sessions[input.sessionId]
                };
            }),

        /**
         * End session
         */
        'end-session': procedure
            .input(z.object({
                sessionId: z.string()
            }))
            .output(z.object({
                ok: z.boolean()
            }))
            .mutation(async (input) => {
                const sessions = loadSessions();
                delete sessions[input.sessionId];
                saveSessions(sessions);
                return { ok: true };
            }),

        /**
         * Configure channel
         */
        'configure-channel': procedure
            .input(z.object({
                channel: z.enum(['web', 'telegram', 'discord', 'sms', 'whatsapp', 'slack']),
                enabled: z.boolean(),
                config: z.any()
            }))
            .output(z.object({
                ok: z.boolean()
            }))
            .mutation(async (input) => {
                cell.log("INFO", `⚙️  Channel ${input.channel} configured: ${input.enabled ? 'enabled' : 'disabled'}`);
                return { ok: true };
            }),

        /**
         * Get stats
         */
        'get-stats': procedure
            .input(z.object({
                channel: z.optional(z.enum(['web', 'telegram', 'discord', 'sms', 'whatsapp', 'slack']))
            }))
            .output(z.object({
                totalSessions: z.number(),
                activeSessions: z.number()
            }))
            .query(async (input) => {
                const sessions = loadSessions();
                const now = Date.now();

                let filtered = Object.values(sessions);
                if (input.channel) {
                    filtered = filtered.filter(s => s.channel === input.channel);
                }

                const active = filtered.filter(s => now - s.lastActive < 3600000);

                return {
                    totalSessions: filtered.length,
                    activeSessions: active.length
                };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(commsRouter);
cell.listen();

cell.log("INFO", "📡 Communications Hub online");

export type CommsRouter = typeof commsRouter;