import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const SESSIONS_FILE = join(DATA_DIR, "sessions.json");

const cell = new TypedRheoCell(`SimpleAIUI_${process.pid}`, 0);

// ============================================================================
// SIMPLE SESSION STORAGE
// ============================================================================

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

interface Session {
    id: string;
    messages: Message[];
    createdAt: number;
    lastActive: number;
}

function loadSessions(): Record<string, Session> {
    try {
        if (existsSync(SESSIONS_FILE)) {
            return JSON.parse(readFileSync(SESSIONS_FILE, "utf8"));
        }
    } catch (e) {
        cell.log("WARN", "Failed to load sessions, starting fresh");
    }
    return {};
}

function saveSessions(sessions: Record<string, Session>) {
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function getOrCreateSession(sessionId: string): Session {
    const sessions = loadSessions();

    if (sessions[sessionId]) {
        sessions[sessionId].lastActive = Date.now();
        saveSessions(sessions);
        return sessions[sessionId];
    }

    const newSession: Session = {
        id: sessionId,
        messages: [],
        createdAt: Date.now(),
        lastActive: Date.now()
    };

    sessions[sessionId] = newSession;
    saveSessions(sessions);
    cell.log("INFO", `🆕 New session created: ${sessionId}`);

    return newSession;
}

function addMessage(sessionId: string, role: "user" | "assistant", content: string) {
    const sessions = loadSessions();
    if (!sessions[sessionId]) return;

    sessions[sessionId].messages.push({
        role,
        content,
        timestamp: Date.now()
    });
    sessions[sessionId].lastActive = Date.now();

    // Keep only last 50 messages to prevent bloat
    if (sessions[sessionId].messages.length > 50) {
        sessions[sessionId].messages = sessions[sessionId].messages.slice(-50);
    }

    saveSessions(sessions);
}

// ============================================================================
// ROUTER
// ============================================================================

const simpleRouter = router({
    "simple-ai": router({
        /**
         * Start or get existing session
         */
        session: procedure
            .input(z.object({
                sessionId: z.string()
            }))
            .output(z.object({
                sessionId: z.string(),
                messageCount: z.number(),
                isNew: z.boolean()
            }))
            .mutation(async ({ sessionId }) => {
                const sessions = loadSessions();
                const isNew = !sessions[sessionId];
                const session = getOrCreateSession(sessionId);

                return {
                    sessionId: session.id,
                    messageCount: session.messages.length,
                    isNew
                };
            }),

        /**
         * Send message and get AI response
         */
        chat: procedure
            .input(z.object({
                sessionId: z.string(),
                message: z.string()
            }))
            .output(z.object({
                reply: z.string(),
                messageCount: z.number()
            }))
            .mutation(async ({ sessionId, message }) => {
                const session = getOrCreateSession(sessionId);

                // Store user message
                addMessage(sessionId, "user", message);

                // Build conversation history for AI
                const history = session.messages
                    .slice(-10) // Last 10 messages for context
                    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
                    .join("\n\n");

                const prompt = history
                    ? `${history}\n\nUser: ${message}\nAssistant:`
                    : `User: ${message}\nAssistant:`;

                // Call AI
                const aiResponse = await cell.mesh.ai.generate({
                    prompt: prompt,
                    systemInstruction: "You are a helpful assistant. Be concise and direct."
                });

                const reply = aiResponse.response.trim();

                // Store AI response
                addMessage(sessionId, "assistant", reply);

                const sessions = loadSessions();

                return {
                    reply,
                    messageCount: sessions[sessionId].messages.length
                };
            }),

        /**
         * Get conversation history
         */
        history: procedure
            .input(z.object({
                sessionId: z.string(),
                limit: z.optional(z.number())
            }))
            .output(z.object({
                messages: z.array(z.object({
                    role: z.enum(["user", "assistant"]),
                    content: z.string(),
                    timestamp: z.number()
                })),
                total: z.number()
            }))
            .query(async ({ sessionId, limit = 50 }) => {
                const sessions = loadSessions();
                const session = sessions[sessionId];

                if (!session) {
                    return { messages: [], total: 0 };
                }

                const messages = session.messages.slice(-limit);

                return {
                    messages,
                    total: session.messages.length
                };
            }),

        /**
         * Clear session history
         */
        clear: procedure
            .input(z.object({
                sessionId: z.string()
            }))
            .output(z.object({
                ok: z.boolean()
            }))
            .mutation(async ({ sessionId }) => {
                const sessions = loadSessions();

                if (sessions[sessionId]) {
                    sessions[sessionId].messages = [];
                    sessions[sessionId].lastActive = Date.now();
                    saveSessions(sessions);
                    cell.log("INFO", `🗑️  Session cleared: ${sessionId}`);
                }

                return { ok: true };
            }),

        /**
         * Get all active sessions (admin)
         */
        stats: procedure
            .input(z.void())
            .output(z.object({
                totalSessions: z.number(),
                totalMessages: z.number()
            }))
            .query(async () => {
                const sessions = loadSessions();
                const totalMessages = Object.values(sessions)
                    .reduce((sum, s) => sum + s.messages.length, 0);

                return {
                    totalSessions: Object.keys(sessions).length,
                    totalMessages
                };
            })
    })
});

cell.useRouter(simpleRouter);
cell.listen();

cell.log("INFO", "💬 Simple AI-UI cell online");
cell.log("INFO", "   Capabilities: simple-ai/session, simple-ai/chat, simple-ai/history, simple-ai/clear");

export type SimpleAIRouter = typeof simpleRouter;