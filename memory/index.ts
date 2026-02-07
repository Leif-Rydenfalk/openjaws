// memory/index.ts - TEMPORAL MEMORY SYSTEM
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const cell = new TypedRheoCell(`TemporalMemory_${process.pid}`, 0);

// ============================================================================
// TEMPORAL INDEXES
// ============================================================================

interface TemporalIndexes {
    byTime: Map<number, string[]>;           // timestamp -> entry IDs
    byLayer: Map<TemporalLayerName, string[]>; // layer -> entry IDs
    byTag: Map<string, string[]>;            // tag -> entry IDs
    byGoal: Map<string, string[]>;           // goal ID -> related entries
    byPattern: Map<string, string[]>;        // pattern -> triggering entries
}

type TemporalLayerName = 'session' | 'goals' | 'movement' | 'patterns' | 'actions';

interface TemporalEntry<T = any> {
    id: string;
    timestamp: number;
    layer: TemporalLayerName;
    content: T;
    temporal: {
        dayOfWeek: number;
        hourOfDay: number;
        timeOfDay: 'night' | 'morning' | 'afternoon' | 'evening';
        weekNumber: number;
        season?: string;
    };
    relatesTo?: string[];
    causedBy?: string;
    leadsTo?: string[];
    tags: string[];
    importance: number;
    accessCount: number;
    lastAccessed: number;
}

interface SessionMemory {
    speaker: 'user' | 'agent';
    text: string;
    intent?: string;
    entities?: string[];
    emotionalValence?: number;
}

interface GoalMemory {
    description: string;
    status: 'active' | 'completed' | 'abandoned' | 'blocked';
    priority: number;
    createdAt: number;
    targetDate?: number;
    progress: number;
    subgoals: string[];
    blockingFactors?: string[];
    successCriteria: string[];
}

interface MovementMemory {
    type: 'problem' | 'success' | 'change' | 'decision' | 'insight';
    description: string;
    fromState: string;
    toState: string;
    impact: number;
    relatedGoal?: string;
    resolution?: string;
}

interface PatternMemory {
    trigger: {
        time?: { hour?: number; dayOfWeek?: number[] };
        context?: string[];
        precedingAction?: string;
    };
    action: string;
    confidence: number;
    occurrences: number;
    lastTriggered: number;
    examples: string[];
}

interface ActionMemory {
    actor: 'user' | 'agent';
    action: string;
    target: string;
    result: 'success' | 'failure' | 'partial';
    duration?: number;
    toolUsed?: string;
    sideEffects?: string[];
}

const entries = new Map<string, TemporalEntry>();
const indexes: TemporalIndexes = {
    byTime: new Map(),
    byLayer: new Map(),
    byTag: new Map(),
    byGoal: new Map(),
    byPattern: new Map()
};

// ============================================================================
// TEMPORAL UTILITIES
// ============================================================================

function getTemporalContext(timestamp: number = Date.now()) {
    const date = new Date(timestamp);
    const hour = date.getHours();

    return {
        timestamp,
        dayOfWeek: date.getDay(),
        hourOfDay: hour,
        timeOfDay: hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
        weekNumber: getWeekNumber(date),
        season: getSeason(date)
    };
}

function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getSeason(date: Date): string {
    const month = date.getMonth();
    if (month < 2 || month === 11) return 'winter';
    if (month < 5) return 'spring';
    if (month < 8) return 'summer';
    return 'autumn';
}

// ============================================================================
// CORE STORAGE
// ============================================================================

function storeEntry<T>(entry: TemporalEntry<T>): TemporalEntry<T> {
    entries.set(entry.id, entry);

    const hourBucket = Math.floor(entry.timestamp / 3600000) * 3600000;
    if (!indexes.byTime.has(hourBucket)) indexes.byTime.set(hourBucket, []);
    indexes.byTime.get(hourBucket)!.push(entry.id);

    if (!indexes.byLayer.has(entry.layer)) indexes.byLayer.set(entry.layer, []);
    indexes.byLayer.get(entry.layer)!.push(entry.id);

    entry.tags.forEach(tag => {
        if (!indexes.byTag.has(tag)) indexes.byTag.set(tag, []);
        indexes.byTag.get(tag)!.push(entry.id);
    });

    if (entry.layer === 'goals' || entry.relatesTo) {
        const goalIds = entry.layer === 'goals' ? [entry.id] : entry.relatesTo || [];
        goalIds.forEach(gid => {
            if (!indexes.byGoal.has(gid)) indexes.byGoal.set(gid, []);
            indexes.byGoal.get(gid)!.push(entry.id);
        });
    }

    persist();
    return entry;
}

function persist() {
    const data = {
        entries: Array.from(entries.entries()),
        timestamp: Date.now()
    };
    writeFileSync(join(DATA_DIR, "temporal_memory.json"), JSON.stringify(data, null, 2));
}

function load(): boolean {
    try {
        const path = join(DATA_DIR, "temporal_memory.json");
        if (!existsSync(path)) return false;

        const data = JSON.parse(readFileSync(path, 'utf8'));
        data.entries.forEach(([id, entry]: [string, TemporalEntry]) => {
            entries.set(id, entry);
        });
        return true;
    } catch (e) {
        return false;
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateImportance(input: any): number {
    let score = 0.5;
    if (input.intent?.includes('goal')) score += 0.3;
    if (input.emotionalValence && Math.abs(input.emotionalValence) > 0.5) score += 0.2;
    if (input.entities && input.entities.length > 0) score += 0.1;
    return Math.min(1, score);
}

function findSimilarPattern(userId: string, trigger: any): TemporalEntry<PatternMemory> | undefined {
    return Array.from(entries.values()).find(e => {
        if (e.layer !== 'patterns' || !e.tags.includes(userId)) return false;
        const pat = e.content as PatternMemory;

        if (trigger.time?.hour !== undefined && pat.trigger.time?.hour !== undefined) {
            if (Math.abs(trigger.time.hour - pat.trigger.time.hour) <= 1) return true;
        }

        return false;
    }) as TemporalEntry<PatternMemory> | undefined;
}

// ============================================================================
// LAYER-SPECIFIC OPERATIONS (NESTED ROUTER STRUCTURE)
// ============================================================================

const memoryRouter = router({
    memory: router({
        session: router({
            store: procedure
                .input(z.object({
                    userId: z.string(),
                    sessionId: z.string(),
                    speaker: z.enum(['user', 'agent']),
                    text: z.string(),
                    intent: z.optional(z.string()),
                    entities: z.optional(z.array(z.string())),
                    emotionalValence: z.optional(z.number())
                }))
                .output(z.object({ id: z.string(), timestamp: z.number() }))
                .mutation(async (input) => {
                    const temporal = getTemporalContext();
                    const entry: TemporalEntry<SessionMemory> = {
                        id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        timestamp: temporal.timestamp,
                        layer: 'session',
                        content: {
                            speaker: input.speaker,
                            text: input.text,
                            intent: input.intent,
                            entities: input.entities,
                            emotionalValence: input.emotionalValence
                        },
                        temporal,
                        tags: ['session', input.userId, input.sessionId, input.speaker],
                        importance: calculateImportance(input),
                        accessCount: 0,
                        lastAccessed: temporal.timestamp
                    };

                    storeEntry(entry);
                    return { id: entry.id, timestamp: entry.timestamp };
                }),

            get: procedure
                .input(z.object({
                    userId: z.string(),
                    sessionId: z.optional(z.string()),
                    since: z.optional(z.number()),
                    limit: z.optional(z.number())
                }))
                .output(z.array(z.any()))
                .query(async (input) => {
                    let results = Array.from(entries.values())
                        .filter(e => e.layer === 'session' && e.tags.includes(input.userId));

                    if (input.sessionId) {
                        results = results.filter(e => e.tags.includes(input.sessionId));
                    }

                    if (input.since) {
                        results = results.filter(e => e.timestamp >= input.since);
                    }

                    results.sort((a, b) => b.timestamp - a.timestamp);

                    results.forEach(e => {
                        e.accessCount++;
                        e.lastAccessed = Date.now();
                    });

                    return results.slice(0, input.limit || 50);
                })
        }),

        goals: router({
            create: procedure
                .input(z.object({
                    userId: z.string(),
                    description: z.string(),
                    priority: z.optional(z.number()),
                    targetDate: z.optional(z.number()),
                    successCriteria: z.optional(z.array(z.string())),
                    sourceSessionId: z.optional(z.string())
                }))
                .output(z.object({ id: z.string(), status: z.string() }))
                .mutation(async (input) => {
                    const temporal = getTemporalContext();
                    const entry: TemporalEntry<GoalMemory> = {
                        id: `goal_${Date.now()}`,
                        timestamp: temporal.timestamp,
                        layer: 'goals',
                        content: {
                            description: input.description,
                            status: 'active',
                            priority: input.priority || 0.5,
                            createdAt: temporal.timestamp,
                            targetDate: input.targetDate,
                            progress: 0,
                            subgoals: [],
                            successCriteria: input.successCriteria || []
                        },
                        temporal,
                        tags: ['goal', input.userId, 'active'],
                        importance: 0.9,
                        accessCount: 0,
                        lastAccessed: temporal.timestamp,
                        relatesTo: input.sourceSessionId ? [input.sourceSessionId] : undefined
                    };

                    storeEntry(entry);
                    return { id: entry.id, status: 'active' };
                }),

            list: procedure
                .input(z.object({
                    userId: z.string(),
                    status: z.optional(z.enum(['active', 'completed', 'abandoned', 'blocked', 'all'])),
                    priorityThreshold: z.optional(z.number())
                }))
                .output(z.array(z.any()))
                .query(async (input) => {
                    let goals = Array.from(entries.values())
                        .filter(e => e.layer === 'goals' && e.tags.includes(input.userId));

                    if (input.status && input.status !== 'all') {
                        goals = goals.filter(e => (e.content as GoalMemory).status === input.status);
                    }

                    if (input.priorityThreshold) {
                        goals = goals.filter(e => (e.content as GoalMemory).priority >= input.priorityThreshold!);
                    }

                    return goals.sort((a, b) => (b.content as GoalMemory).priority - (a.content as GoalMemory).priority);
                }),

            update: procedure
                .input(z.object({
                    goalId: z.string(),
                    updates: z.object({
                        status: z.optional(z.enum(['active', 'completed', 'abandoned', 'blocked'])),
                        progress: z.optional(z.number()),
                        description: z.optional(z.string())
                    })
                }))
                .output(z.object({ ok: z.boolean() }))
                .mutation(async (input) => {
                    const entry = entries.get(input.goalId) as TemporalEntry<GoalMemory>;
                    if (!entry) return { ok: false };

                    Object.assign(entry.content, input.updates);
                    entry.lastAccessed = Date.now();

                    persist();
                    return { ok: true };
                })
        }),

        movement: router({
            record: procedure
                .input(z.object({
                    userId: z.string(),
                    type: z.enum(['problem', 'success', 'change', 'decision', 'insight']),
                    description: z.string(),
                    fromState: z.string(),
                    toState: z.string(),
                    impact: z.number(),
                    relatedGoal: z.optional(z.string())
                }))
                .output(z.object({ id: z.string() }))
                .mutation(async (input) => {
                    const temporal = getTemporalContext();
                    const entry: TemporalEntry<MovementMemory> = {
                        id: `mov_${Date.now()}`,
                        timestamp: temporal.timestamp,
                        layer: 'movement',
                        content: {
                            type: input.type,
                            description: input.description,
                            fromState: input.fromState,
                            toState: input.toState,
                            impact: input.impact,
                            relatedGoal: input.relatedGoal
                        },
                        temporal,
                        tags: ['movement', input.userId, input.type],
                        importance: Math.abs(input.impact) / 10,
                        accessCount: 0,
                        lastAccessed: temporal.timestamp
                    };

                    storeEntry(entry);
                    return { id: entry.id };
                }),

            timeline: procedure
                .input(z.object({
                    userId: z.string(),
                    goalId: z.optional(z.string()),
                    type: z.optional(z.enum(['problem', 'success', 'change', 'decision', 'insight'])),
                    since: z.optional(z.number())
                }))
                .output(z.array(z.any()))
                .query(async (input) => {
                    let movements = Array.from(entries.values())
                        .filter(e => e.layer === 'movement' && e.tags.includes(input.userId));

                    if (input.goalId) {
                        movements = movements.filter(e => (e.content as MovementMemory).relatedGoal === input.goalId);
                    }

                    if (input.type) {
                        movements = movements.filter(e => (e.content as MovementMemory).type === input.type);
                    }

                    if (input.since) {
                        movements = movements.filter(e => e.timestamp >= input.since);
                    }

                    return movements.sort((a, b) => a.timestamp - b.timestamp);
                })
        }),

        patterns: router({
            learn: procedure
                .input(z.object({
                    userId: z.string(),
                    trigger: z.object({
                        time: z.optional(z.object({ hour: z.optional(z.number()), dayOfWeek: z.optional(z.array(z.number())) })),
                        context: z.optional(z.array(z.string())),
                        precedingAction: z.optional(z.string())
                    }),
                    action: z.string(),
                    confidence: z.optional(z.number()),
                    examples: z.optional(z.array(z.string()))
                }))
                .output(z.object({ patternId: z.string(), confidence: z.number() }))
                .mutation(async (input) => {
                    const temporal = getTemporalContext();

                    const existing = findSimilarPattern(input.userId, input.trigger);

                    if (existing) {
                        const pattern = existing.content as PatternMemory;
                        pattern.occurrences++;
                        pattern.confidence = Math.min(0.95, pattern.confidence + 0.1);
                        pattern.lastTriggered = temporal.timestamp;
                        if (input.examples) pattern.examples.push(...input.examples);
                        existing.lastAccessed = temporal.timestamp;
                        persist();

                        return { patternId: existing.id, confidence: pattern.confidence };
                    }

                    const entry: TemporalEntry<PatternMemory> = {
                        id: `pat_${Date.now()}`,
                        timestamp: temporal.timestamp,
                        layer: 'patterns',
                        content: {
                            trigger: input.trigger,
                            action: input.action,
                            confidence: input.confidence || 0.5,
                            occurrences: 1,
                            lastTriggered: temporal.timestamp,
                            examples: input.examples || []
                        },
                        temporal,
                        tags: ['pattern', input.userId, 'learned'],
                        importance: 0.7,
                        accessCount: 0,
                        lastAccessed: temporal.timestamp
                    };

                    storeEntry(entry);
                    return { patternId: entry.id, confidence: entry.content.confidence };
                }),

            match: procedure
                .input(z.object({
                    userId: z.string(),
                    context: z.object({
                        timeOfDay: z.optional(z.enum(['night', 'morning', 'afternoon', 'evening'])),
                        hour: z.optional(z.number()),
                        dayOfWeek: z.optional(z.number()),
                        currentActivity: z.optional(z.string()),
                        lastAction: z.optional(z.string())
                    }),
                    minConfidence: z.optional(z.number())
                }))
                .output(z.array(z.object({
                    pattern: z.any(),
                    matchScore: z.number(),
                    recommendation: z.string()
                })))
                .query(async (input) => {
                    const patterns = Array.from(entries.values())
                        .filter(e => e.layer === 'patterns' && e.tags.includes(input.userId))
                        .map(e => ({ entry: e, pattern: e.content as PatternMemory }))
                        .filter(({ pattern }) => pattern.confidence >= (input.minConfidence || 0.6));

                    const scored = patterns.map(({ entry, pattern }) => {
                        let score = 0;
                        let matches = 0;

                        if (input.context.hour !== undefined && pattern.trigger.time?.hour !== undefined) {
                            const hourDiff = Math.abs(input.context.hour - pattern.trigger.time.hour);
                            if (hourDiff <= 1) { score += 0.4; matches++; }
                        }

                        if (input.context.dayOfWeek !== undefined && pattern.trigger.time?.dayOfWeek) {
                            if (pattern.trigger.time.dayOfWeek.includes(input.context.dayOfWeek)) {
                                score += 0.3; matches++;
                            }
                        }

                        if (input.context.currentActivity && pattern.trigger.context) {
                            const overlap = pattern.trigger.context.filter(c =>
                                input.context.currentActivity!.toLowerCase().includes(c.toLowerCase())
                            ).length;
                            if (overlap > 0) { score += 0.2 * overlap; matches++; }
                        }

                        if (input.context.lastAction && pattern.trigger.precedingAction) {
                            if (input.context.lastAction === pattern.trigger.precedingAction) {
                                score += 0.1; matches++;
                            }
                        }

                        const recencyBoost = Math.exp(-(Date.now() - entry.timestamp) / (7 * 24 * 3600000));
                        score = (score / Math.max(1, matches)) * pattern.confidence * (0.5 + 0.5 * recencyBoost);

                        return {
                            pattern: entry,
                            matchScore: score,
                            recommendation: score > 0.7 ? pattern.action : ""
                        };
                    });

                    return scored
                        .filter(s => s.matchScore > 0.3)
                        .sort((a, b) => b.matchScore - a.matchScore);
                })
        }),

        actions: router({
            record: procedure
                .input(z.object({
                    userId: z.string(),
                    actor: z.enum(['user', 'agent']),
                    action: z.string(),
                    target: z.string(),
                    result: z.enum(['success', 'failure', 'partial']),
                    duration: z.optional(z.number()),
                    toolUsed: z.optional(z.string()),
                    sideEffects: z.optional(z.array(z.string()))
                }))
                .output(z.object({ id: z.string() }))
                .mutation(async (input) => {
                    const temporal = getTemporalContext();
                    const entry: TemporalEntry<ActionMemory> = {
                        id: `act_${Date.now()}`,
                        timestamp: temporal.timestamp,
                        layer: 'actions',
                        content: {
                            actor: input.actor,
                            action: input.action,
                            target: input.target,
                            result: input.result,
                            duration: input.duration,
                            toolUsed: input.toolUsed,
                            sideEffects: input.sideEffects
                        },
                        temporal,
                        tags: ['action', input.userId, input.actor, input.result],
                        importance: input.result === 'failure' ? 0.9 : 0.5,
                        accessCount: 0,
                        lastAccessed: temporal.timestamp
                    };

                    storeEntry(entry);
                    return { id: entry.id };
                }),

            history: procedure
                .input(z.object({
                    userId: z.string(),
                    actor: z.optional(z.enum(['user', 'agent'])),
                    tool: z.optional(z.string()),
                    since: z.optional(z.number())
                }))
                .output(z.array(z.any()))
                .query(async (input) => {
                    let actions = Array.from(entries.values())
                        .filter(e => e.layer === 'actions' && e.tags.includes(input.userId));

                    if (input.actor) {
                        actions = actions.filter(e => (e.content as ActionMemory).actor === input.actor);
                    }

                    if (input.tool) {
                        actions = actions.filter(e => (e.content as ActionMemory).toolUsed === input.tool);
                    }

                    if (input.since) {
                        actions = actions.filter(e => e.timestamp >= input.since);
                    }

                    return actions.sort((a, b) => b.timestamp - a.timestamp);
                })
        }),

        temporal: router({
            slice: procedure
                .input(z.object({
                    userId: z.string(),
                    startTime: z.number(),
                    endTime: z.number(),
                    layers: z.optional(z.array(z.enum(['session', 'goals', 'movement', 'patterns', 'actions'])))
                }))
                .output(z.object({
                    entries: z.array(z.any()),
                    summary: z.object({
                        total: z.number(),
                        byLayer: z.record(z.number()),
                        significantEvents: z.array(z.any())
                    })
                }))
                .query(async (input) => {
                    const layers = input.layers || ['session', 'goals', 'movement', 'actions'];

                    const slice = Array.from(entries.values()).filter(e =>
                        e.tags.includes(input.userId) &&
                        layers.includes(e.layer) &&
                        e.timestamp >= input.startTime &&
                        e.timestamp <= input.endTime
                    ).sort((a, b) => a.timestamp - b.timestamp);

                    const byLayer = layers.reduce((acc, layer) => {
                        acc[layer] = slice.filter(e => e.layer === layer).length;
                        return acc;
                    }, {} as Record<string, number>);

                    const significant = slice.filter(e =>
                        e.layer === 'movement' && Math.abs((e.content as MovementMemory).impact) > 5 ||
                        e.layer === 'goals' && (e.content as GoalMemory).status !== 'active'
                    );

                    return {
                        entries: slice,
                        summary: {
                            total: slice.length,
                            byLayer,
                            significantEvents: significant
                        }
                    };
                }),

            context: procedure
                .input(z.object({
                    userId: z.string(),
                    lookback: z.optional(z.number()),
                    includePatterns: z.optional(z.boolean())
                }))
                .output(z.object({
                    now: z.object({
                        timeOfDay: z.string(),
                        dayOfWeek: z.number(),
                        hour: z.number()
                    }),
                    recent: z.object({
                        sessions: z.array(z.any()),
                        movements: z.array(z.any()),
                        activeGoals: z.array(z.any())
                    }),
                    patterns: z.optional(z.array(z.any())),
                    suggestedAction: z.optional(z.string())
                }))
                .query(async (input) => {
                    const now = Date.now();
                    const lookback = input.lookback || 24 * 3600000;

                    const temporal = getTemporalContext();

                    let sessions = Array.from(entries.values())
                        .filter(e => e.layer === 'session' && e.tags.includes(input.userId) && e.timestamp >= now - lookback)
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 10);

                    let movements = Array.from(entries.values())
                        .filter(e => e.layer === 'movement' && e.tags.includes(input.userId) && e.timestamp >= now - lookback)
                        .sort((a, b) => a.timestamp - b.timestamp);

                    let goals = Array.from(entries.values())
                        .filter(e => e.layer === 'goals' && e.tags.includes(input.userId) && (e.content as GoalMemory).status === 'active');

                    let patterns: any[] = [];
                    if (input.includePatterns) {
                        const patternEntries = Array.from(entries.values())
                            .filter(e => e.layer === 'patterns' && e.tags.includes(input.userId))
                            .map(e => ({ entry: e, pattern: e.content as PatternMemory }))
                            .filter(({ pattern }) => pattern.confidence >= 0.6);

                        patterns = patternEntries.map(({ entry, pattern }) => {
                            let score = 0;
                            if (pattern.trigger.time?.hour !== undefined && Math.abs(pattern.trigger.time.hour - temporal.hourOfDay) <= 1) {
                                score += 0.5;
                            }
                            return {
                                pattern: entry,
                                matchScore: score * pattern.confidence,
                                recommendation: pattern.action
                            };
                        }).filter(p => p.matchScore > 0.3).sort((a, b) => b.matchScore - a.matchScore);
                    }

                    const topPattern = patterns.find(p => p.matchScore > 0.8);

                    return {
                        now: {
                            timeOfDay: temporal.timeOfDay,
                            dayOfWeek: temporal.dayOfWeek,
                            hour: temporal.hourOfDay
                        },
                        recent: {
                            sessions,
                            movements,
                            activeGoals: goals
                        },
                        patterns: input.includePatterns ? patterns : undefined,
                        suggestedAction: topPattern?.recommendation
                    };
                })
        })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(memoryRouter);
cell.listen();

load();

cell.log("INFO", "🧠 Temporal Memory System online");
cell.log("INFO", "   Layers: session → goals → movement → patterns → actions");
cell.log("INFO", "   Time-aware | Chronological | Proactive pattern learning");

export type MemoryRouter = typeof memoryRouter;