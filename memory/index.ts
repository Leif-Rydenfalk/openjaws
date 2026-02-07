// memory/index.ts - PURE MEMORY UTILITY (No AI Logic)
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const MESSAGES_PATH = join(DATA_DIR, "messages.json");

const cell = new TypedRheoCell(`Memory_${process.pid}`, 0);

// ============================================================================
// SIMPLE DATA STRUCTURES
// ============================================================================

interface MemoryEntry {
    id: string;
    timestamp: number;
    userId: string;
    sessionId: string;

    // Core content
    speaker: 'user' | 'assistant';
    text: string;

    // Lightweight metadata for filtering
    tags?: string[];
    layer?: 'session' | 'goals' | 'movement' | 'patterns' | 'actions';

    // For linking/threading
    respondsTo?: string;

    // Compression tracking (managed by caller)
    compressionLevel?: 0 | 1 | 2;
    compressed?: {
        gist: string;
        claims: string[];
        suggestions: string[];
    };
}

// ============================================================================
// PERSISTENCE
// ============================================================================

function loadMessages(): MemoryEntry[] {
    try {
        if (existsSync(MESSAGES_PATH)) {
            return JSON.parse(readFileSync(MESSAGES_PATH, 'utf8'));
        }
    } catch (e) {
        cell.log("WARN", "Failed to load messages, using empty store");
    }
    return [];
}

function saveMessages(messages: MemoryEntry[]) {
    try {
        writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2));
    } catch (e: any) {
        cell.log("ERROR", `Failed to save messages: ${e.message}`);
    }
}

// ============================================================================
// MEMORY ROUTER - PURE CRUD + SMART QUERIES
// ============================================================================

const memoryRouter = router({
    memory: router({
        /**
         * Store a single memory entry
         */
        store: procedure
            .input(z.object({
                userId: z.string(),
                sessionId: z.string(),
                speaker: z.enum(['user', 'assistant']),
                text: z.string(),
                tags: z.optional(z.array(z.string())),
                layer: z.optional(z.enum(['session', 'goals', 'movement', 'patterns', 'actions'])),
                respondsTo: z.optional(z.string()),
                compressed: z.optional(z.object({
                    gist: z.string(),
                    claims: z.array(z.string()),
                    suggestions: z.array(z.string())
                }))
            }))
            .output(z.object({
                id: z.string(),
                timestamp: z.number()
            }))
            .mutation(async (input) => {
                const messages = loadMessages();

                const entry: MemoryEntry = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                    userId: input.userId,
                    sessionId: input.sessionId,
                    speaker: input.speaker,
                    text: input.text,
                    tags: input.tags,
                    layer: input.layer,
                    respondsTo: input.respondsTo,
                    compressionLevel: input.compressed ? 1 : 0,
                    compressed: input.compressed
                };

                messages.push(entry);
                saveMessages(messages);

                return {
                    id: entry.id,
                    timestamp: entry.timestamp
                };
            }),

        /**
         * Get recent messages (raw retrieval)
         */
        'get-recent': procedure
            .input(z.object({
                userId: z.string(),
                sessionId: z.optional(z.string()),
                limit: z.optional(z.number()),
                speaker: z.optional(z.enum(['user', 'assistant']))
            }))
            .output(z.object({
                messages: z.array(z.any()),
                total: z.number()
            }))
            .query(async (input) => {
                const messages = loadMessages();

                let filtered = messages.filter(m => m.userId === input.userId);

                if (input.sessionId) {
                    filtered = filtered.filter(m => m.sessionId === input.sessionId);
                }

                if (input.speaker) {
                    filtered = filtered.filter(m => m.speaker === input.speaker);
                }

                // Most recent first
                filtered.sort((a, b) => b.timestamp - a.timestamp);

                const limit = input.limit || 20;
                const result = filtered.slice(0, limit);

                return {
                    messages: result,
                    total: filtered.length
                };
            }),

        /**
         * Search messages by text content
         */
        search: procedure
            .input(z.object({
                userId: z.string(),
                query: z.string(),
                limit: z.optional(z.number()),
                speaker: z.optional(z.enum(['user', 'assistant'])),
                layer: z.optional(z.enum(['session', 'goals', 'movement', 'patterns', 'actions'])),
                timeRange: z.optional(z.object({
                    start: z.number(),
                    end: z.number()
                }))
            }))
            .output(z.object({
                results: z.array(z.any()),
                total: z.number()
            }))
            .query(async (input) => {
                const messages = loadMessages();
                const queryLower = input.query.toLowerCase();

                let filtered = messages.filter(m => {
                    if (m.userId !== input.userId) return false;
                    if (input.speaker && m.speaker !== input.speaker) return false;
                    if (input.layer && m.layer !== input.layer) return false;
                    if (input.timeRange) {
                        if (m.timestamp < input.timeRange.start || m.timestamp > input.timeRange.end) {
                            return false;
                        }
                    }

                    // Text search
                    const searchable = (m.text || '').toLowerCase() +
                        (m.compressed?.gist || '').toLowerCase() +
                        (m.tags?.join(' ') || '').toLowerCase();

                    return searchable.includes(queryLower);
                });

                // Sort by relevance (simple: most recent matching)
                filtered.sort((a, b) => b.timestamp - a.timestamp);

                const limit = input.limit || 10;
                const results = filtered.slice(0, limit);

                return {
                    results,
                    total: filtered.length
                };
            }),

        /**
         * Get messages by tag
         */
        'get-by-tag': procedure
            .input(z.object({
                userId: z.string(),
                tags: z.array(z.string()),
                limit: z.optional(z.number())
            }))
            .output(z.object({
                messages: z.array(z.any())
            }))
            .query(async (input) => {
                const messages = loadMessages();

                const filtered = messages.filter(m => {
                    if (m.userId !== input.userId) return false;
                    if (!m.tags) return false;

                    return input.tags.some(tag => m.tags!.includes(tag));
                });

                filtered.sort((a, b) => b.timestamp - a.timestamp);

                return {
                    messages: filtered.slice(0, input.limit || 20)
                };
            }),

        /**
         * Get session summary (just metadata)
         */
        'get-session': procedure
            .input(z.object({
                userId: z.string(),
                sessionId: z.string()
            }))
            .output(z.object({
                messageCount: z.number(),
                userMessages: z.number(),
                assistantMessages: z.number(),
                startTime: z.number(),
                lastActive: z.number(),
                tags: z.array(z.string())
            }))
            .query(async (input) => {
                const messages = loadMessages();

                const sessionMsgs = messages.filter(m =>
                    m.userId === input.userId &&
                    m.sessionId === input.sessionId
                );

                if (sessionMsgs.length === 0) {
                    return {
                        messageCount: 0,
                        userMessages: 0,
                        assistantMessages: 0,
                        startTime: 0,
                        lastActive: 0,
                        tags: []
                    };
                }

                const allTags = new Set<string>();
                sessionMsgs.forEach(m => m.tags?.forEach(t => allTags.add(t)));

                return {
                    messageCount: sessionMsgs.length,
                    userMessages: sessionMsgs.filter(m => m.speaker === 'user').length,
                    assistantMessages: sessionMsgs.filter(m => m.speaker === 'assistant').length,
                    startTime: Math.min(...sessionMsgs.map(m => m.timestamp)),
                    lastActive: Math.max(...sessionMsgs.map(m => m.timestamp)),
                    tags: Array.from(allTags)
                };
            }),

        /**
         * Get conversation thread (linked messages)
         */
        'get-thread': procedure
            .input(z.object({
                messageId: z.string()
            }))
            .output(z.object({
                thread: z.array(z.any())
            }))
            .query(async (input) => {
                const messages = loadMessages();
                const thread: MemoryEntry[] = [];

                // Find the starting message
                let current = messages.find(m => m.id === input.messageId);
                if (!current) {
                    return { thread: [] };
                }

                // Walk backwards through respondsTo chain
                const visited = new Set<string>();
                while (current && !visited.has(current.id)) {
                    thread.unshift(current);
                    visited.add(current.id);

                    if (current.respondsTo) {
                        current = messages.find(m => m.id === current!.respondsTo);
                    } else {
                        break;
                    }
                }

                // Walk forwards through messages that respond to thread members
                const threadIds = new Set(thread.map(m => m.id));
                const responses = messages.filter(m =>
                    m.respondsTo && threadIds.has(m.respondsTo) && !visited.has(m.id)
                );

                thread.push(...responses);

                // Sort by timestamp
                thread.sort((a, b) => a.timestamp - b.timestamp);

                return { thread };
            }),

        /**
         * Delete old messages (cleanup)
         */
        cleanup: procedure
            .input(z.object({
                olderThan: z.number(), // timestamp
                keepUserMessages: z.optional(z.boolean())
            }))
            .output(z.object({
                deleted: z.number()
            }))
            .mutation(async (input) => {
                const messages = loadMessages();
                const cutoff = input.olderThan;

                const before = messages.length;

                const kept = messages.filter(m => {
                    if (m.timestamp > cutoff) return true;
                    if (input.keepUserMessages && m.speaker === 'user') return true;
                    return false;
                });

                saveMessages(kept);

                cell.log("INFO", `🧹 Cleaned up ${before - kept.length} old messages`);

                return {
                    deleted: before - kept.length
                };
            }),

        /**
         * Get stats
         */
        stats: procedure
            .input(z.object({
                userId: z.optional(z.string())
            }))
            .output(z.object({
                totalMessages: z.number(),
                userMessages: z.number(),
                assistantMessages: z.number(),
                uniqueSessions: z.number(),
                uniqueUsers: z.number(),
                oldestMessage: z.number(),
                newestMessage: z.number()
            }))
            .query(async (input) => {
                const messages = loadMessages();

                let filtered = input.userId
                    ? messages.filter(m => m.userId === input.userId)
                    : messages;

                if (filtered.length === 0) {
                    return {
                        totalMessages: 0,
                        userMessages: 0,
                        assistantMessages: 0,
                        uniqueSessions: 0,
                        uniqueUsers: 0,
                        oldestMessage: 0,
                        newestMessage: 0
                    };
                }

                const sessions = new Set(filtered.map(m => m.sessionId));
                const users = new Set(filtered.map(m => m.userId));

                return {
                    totalMessages: filtered.length,
                    userMessages: filtered.filter(m => m.speaker === 'user').length,
                    assistantMessages: filtered.filter(m => m.speaker === 'assistant').length,
                    uniqueSessions: sessions.size,
                    uniqueUsers: users.size,
                    oldestMessage: Math.min(...filtered.map(m => m.timestamp)),
                    newestMessage: Math.max(...filtered.map(m => m.timestamp))
                };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(memoryRouter);
cell.listen();

cell.log("INFO", "🧠 Memory utility online - pure storage, no logic");

// Periodic cleanup (optional)
setInterval(async () => {
    try {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const result = await cell.mesh.memory.cleanup({
            olderThan: thirtyDaysAgo,
            keepUserMessages: true // Always keep user messages
        });

        if (result.deleted > 0) {
            cell.log("INFO", `🗑️  Auto-cleanup: removed ${result.deleted} old assistant messages`);
        }
    } catch (e) {
        // Cleanup is non-critical
    }
}, 3600000); // Every hour

export type MemoryRouter = typeof memoryRouter;