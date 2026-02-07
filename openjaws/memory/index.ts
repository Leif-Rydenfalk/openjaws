// memory/index.ts - COMPLETE TEMPORAL MEMORY SYSTEM
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { join } from "node:path";
import { existsSync, writeFileSync, readFileSync } from "node:fs";

const DB_PATH = join(process.cwd(), "temporal_memory.json");
const PATTERN_DB = join(process.cwd(), "learned_patterns.json");

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TemporalMemory {
    id: string;
    timestamp: number;
    layer: 'session' | 'goals' | 'movement' | 'patterns' | 'actions';
    content: string;
    tags: string[];
    context: {
        userId?: string;
        sessionId?: string;
        timeOfDay?: string;
        dayOfWeek?: string;
        relatedTo?: string[];
    };
}

interface LearnedPattern {
    id: string;
    pattern: string;
    triggers: string[];
    actions: string[];
    confidence: number;
    lastSeen: number;
    occurrences: number;
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

function loadDb(): TemporalMemory[] {
    try {
        if (!existsSync(DB_PATH)) return [];
        return JSON.parse(readFileSync(DB_PATH, 'utf8'));
    } catch { return []; }
}

function saveDb(data: TemporalMemory[]) {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function loadPatterns(): LearnedPattern[] {
    try {
        if (!existsSync(PATTERN_DB)) return [];
        return JSON.parse(readFileSync(PATTERN_DB, 'utf8'));
    } catch { return []; }
}

function savePatterns(patterns: LearnedPattern[]) {
    writeFileSync(PATTERN_DB, JSON.stringify(patterns, null, 2));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

function frequency<T>(arr: T[]): Record<string, number> {
    return arr.reduce((acc, val) => {
        const key = String(val);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
}

function detectPatterns(newAction: TemporalMemory, cell: TypedRheoCell) {
    const db = loadDb();
    const patterns = loadPatterns();

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const actionKeyword = newAction.content.toLowerCase().split(' ')[0];

    const similarActions = db.filter(m =>
        m.layer === 'actions' &&
        m.timestamp > thirtyDaysAgo &&
        m.context.userId === newAction.context.userId &&
        m.content.toLowerCase().includes(actionKeyword)
    );

    if (similarActions.length < 3) return;

    const times = similarActions.map(a => a.context.timeOfDay).filter(Boolean) as string[];
    const days = similarActions.map(a => a.context.dayOfWeek).filter(Boolean) as string[];

    const timeFreq = frequency(times);
    const dayFreq = frequency(days);

    const dominantTime = Object.entries(timeFreq).sort((a, b) => b[1] - a[1])[0];
    const dominantDay = Object.entries(dayFreq).sort((a, b) => b[1] - a[1])[0];

    if (dominantTime && dominantTime[1] / similarActions.length > 0.7) {
        const patternId = `${actionKeyword}_${dominantTime[0]}_${newAction.context.userId}`;

        let existing = patterns.find(p => p.id === patternId);
        if (existing) {
            existing.occurrences++;
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            existing.lastSeen = Date.now();
        } else {
            patterns.push({
                id: patternId,
                pattern: `${actionKeyword} routine - ${dominantTime[0]}`,
                triggers: [`time:${dominantTime[0]}`, `user:${newAction.context.userId}`],
                actions: [newAction.content],
                confidence: 0.7,
                lastSeen: Date.now(),
                occurrences: similarActions.length
            });
        }

        savePatterns(patterns);
        cell.log("INFO", `🔮 Pattern learned: ${patternId} (${dominantTime[1]}/${similarActions.length})`);
    }
}

// ============================================================================
// CELL INITIALIZATION
// ============================================================================

const cell = new TypedRheoCell(`Memory_${process.pid}`, 0);

// ============================================================================
// ROUTER DEFINITION
// ============================================================================

const memoryRouter = router({
    memory: router({
        /**
         * Store a temporal memory in the appropriate layer
         */
        store: procedure
            .input(z.object({
                layer: z.enum(['session', 'goals', 'movement', 'patterns', 'actions']),
                content: z.string(),
                tags: z.array(z.string()),
                userId: z.optional(z.string()),
                sessionId: z.optional(z.string()),
                relatedTo: z.optional(z.array(z.string()))
            }))
            .output(z.object({ id: z.string(), ok: z.boolean() }))
            .mutation(async (input) => {
                const db = loadDb();
                const now = new Date();
                const id = Math.random().toString(36).substring(7);

                const entry: TemporalMemory = {
                    id,
                    timestamp: Date.now(),
                    layer: input.layer,
                    content: input.content,
                    tags: input.tags,
                    context: {
                        userId: input.userId,
                        sessionId: input.sessionId,
                        timeOfDay: getTimeOfDay(now),
                        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
                        relatedTo: input.relatedTo
                    }
                };

                db.push(entry);
                saveDb(db);

                if (input.layer === 'actions') {
                    detectPatterns(entry, cell);
                }

                cell.log("INFO", `🧠 ${input.layer.toUpperCase()}: "${input.content.substring(0, 40)}..."`);
                return { id, ok: true };
            }),

        /**
         * Search across temporal layers with time awareness
         */
        search: procedure
            .input(z.object({
                query: z.string(),
                layers: z.optional(z.array(z.enum(['session', 'goals', 'movement', 'patterns', 'actions']))),
                timeRange: z.optional(z.object({
                    start: z.number(),
                    end: z.number()
                })),
                userId: z.optional(z.string()),
                sessionId: z.optional(z.string()),
                limit: z.optional(z.number())
            }))
            .output(z.array(z.object({
                id: z.string(),
                layer: z.string(),
                content: z.string(),
                timestamp: z.number(),
                score: z.number(),
                tags: z.array(z.string()),
                context: z.any()
            })))
            .query(async (input) => {
                const db = loadDb();
                const queryWords = input.query.toLowerCase()
                    .replace(/[?.!,]/g, '')
                    .split(/\s+/)
                    .filter(w => w.length > 0);

                const results = db
                    .filter(entry => {
                        if (input.layers && !input.layers.includes(entry.layer)) return false;
                        if (input.timeRange) {
                            if (entry.timestamp < input.timeRange.start ||
                                entry.timestamp > input.timeRange.end) return false;
                        }
                        if (input.userId && entry.context.userId !== input.userId) return false;
                        if (input.sessionId && entry.context.sessionId !== input.sessionId) return false;
                        return true;
                    })
                    .map(entry => {
                        let score = 0;
                        const contentLower = entry.content.toLowerCase();

                        if (queryWords.length > 0) {
                            queryWords.forEach(word => {
                                if (contentLower.includes(word)) score += 1;
                            });

                            entry.tags.forEach(tag => {
                                if (input.query.toLowerCase().includes(tag.toLowerCase())) score += 3;
                            });
                        } else {
                            score = 1;
                        }

                        const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
                        if (ageHours < 1) score += 2;
                        else if (ageHours < 24) score += 1;

                        const layerBonus: Record<string, number> = {
                            session: 1.5,
                            movement: 1.3,
                            goals: 1.2,
                            actions: 1.0,
                            patterns: 0.8
                        };
                        score *= layerBonus[entry.layer];

                        return {
                            id: entry.id,
                            layer: entry.layer,
                            content: entry.content,
                            timestamp: entry.timestamp,
                            score,
                            tags: entry.tags,
                            context: entry.context
                        };
                    })
                    .filter(r => r.score > 0)
                    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
                    .slice(0, input.limit || 10);

                cell.log("INFO", `🔍 Search: "${input.query}" → ${results.length} results`);
                return results;
            }),

        /**
         * Get current session context
         */
        'get-session': procedure
            .input(z.object({
                userId: z.optional(z.string()),
                sessionId: z.optional(z.string()),
                hoursBack: z.optional(z.number())
            }))
            .output(z.object({
                memories: z.array(z.any()),
                summary: z.string(),
                activeGoals: z.array(z.string())
            }))
            .query(async (input) => {
                const db = loadDb();
                const cutoff = Date.now() - (input.hoursBack || 4) * 60 * 60 * 1000;

                const sessionMemories = db
                    .filter(m =>
                        m.timestamp > cutoff &&
                        m.layer === 'session' &&
                        (!input.userId || m.context.userId === input.userId) &&
                        (!input.sessionId || m.context.sessionId === input.sessionId)
                    )
                    .sort((a, b) => b.timestamp - a.timestamp);

                const activeGoals = db
                    .filter(m =>
                        m.layer === 'goals' &&
                        m.timestamp > cutoff &&
                        (!input.userId || m.context.userId === input.userId)
                    )
                    .map(m => m.content);

                return {
                    memories: sessionMemories,
                    summary: `${sessionMemories.length} session memories in last ${input.hoursBack || 4}h`,
                    activeGoals
                };
            }),

        /**
         * Suggest actions based on learned patterns
         */
        'suggest-from-patterns': procedure
            .input(z.object({
                context: z.object({
                    timeOfDay: z.optional(z.string()),
                    dayOfWeek: z.optional(z.string()),
                    userId: z.optional(z.string())
                }),
                minConfidence: z.optional(z.number())
            }))
            .output(z.array(z.object({
                pattern: z.string(),
                suggestion: z.string(),
                confidence: z.number(),
                lastSeen: z.number()
            })))
            .query(async (input) => {
                const patterns = loadPatterns();

                const matches = patterns
                    .filter(p => {
                        if (p.confidence < (input.minConfidence || 0.5)) return false;

                        const timeMatch = !input.context.timeOfDay ||
                            p.triggers.includes(`time:${input.context.timeOfDay}`);
                        const dayMatch = !input.context.dayOfWeek ||
                            p.triggers.includes(`day:${input.context.dayOfWeek}`);
                        const userMatch = !input.context.userId ||
                            p.triggers.includes(`user:${input.context.userId}`);

                        return timeMatch && dayMatch && userMatch;
                    })
                    .map(p => ({
                        pattern: p.pattern,
                        suggestion: p.actions.join(', '),
                        confidence: p.confidence,
                        lastSeen: p.lastSeen
                    }))
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 5);

                if (matches.length > 0) {
                    cell.log("INFO", `🔮 Pattern suggestions: ${matches.length} matches`);
                }

                return matches;
            }),

        /**
         * Prune old memories
         */
        prune: procedure
            .input(z.object({
                olderThanDays: z.number()
            }))
            .output(z.object({
                removed: z.number(),
                kept: z.number()
            }))
            .mutation(async (input) => {
                const db = loadDb();
                const cutoff = Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000;

                const kept = db.filter(m =>
                    m.timestamp > cutoff ||
                    m.layer === 'goals' ||
                    m.layer === 'patterns'
                );

                const removed = db.length - kept.length;
                saveDb(kept);

                cell.log("INFO", `🧹 Pruned ${removed} memories, kept ${kept.length}`);
                return { removed, kept: kept.length };
            })
    })
});

cell.useRouter(memoryRouter);
cell.listen();

cell.log("INFO", "🧠 Temporal Memory System online");