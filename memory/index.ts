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

    // Index by time (bucket by hour for efficiency)
    const hourBucket = Math.floor(entry.timestamp / 3600000) * 3600000;
    if (!indexes.byTime.has(hourBucket)) indexes.byTime.set(hourBucket, []);
    indexes.byTime.get(hourBucket)!.push(entry.id);

    // Index by layer
    if (!indexes.byLayer.has(entry.layer)) indexes.byLayer.set(entry.layer, []);
    indexes.byLayer.get(entry.layer)!.push(entry.id);

    // Index by tags
    entry.tags.forEach(tag => {
        if (!indexes.byTag.has(tag)) indexes.byTag.set(tag, []);
        indexes.byTag.get(tag)!.push(entry.id);
    });

    // Index by goal
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
            // Rebuild indexes...
        });
        return true;
    } catch (e) {
        return false;
    }
}

// ============================================================================
// LAYER-SPECIFIC OPERATIONS
// ============================================================================

const memoryRouter = router({
    memory: router({
        // ========================================================================
        // SESSION LAYER: Raw conversation stream
        // ========================================================================
        'session/store': procedure
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

                // Auto-extract to goals layer if intent indicates goal
                if (input.intent?.includes('goal') || input.intent?.includes('want') || input.intent?.includes('need')) {
                    await autoExtractGoal(input.userId, input.text, entry.id);
                }

                // Auto-extract to movement if significant emotional change
                if (Math.abs(input.emotionalValence || 0) > 0.7) {
                    await autoExtractMovement(input.userId, input, entry.id);
                }

                return { id: entry.id, timestamp: entry.timestamp };
            }),

        'session/get': procedure
            .input(z.object({
                userId: z.string(),
                sessionId: z.optional(z.string()),
                since: z.optional(z.number()),  // timestamp
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

                // Update access stats
                results.forEach(e => {
                    e.accessCount++;
                    e.lastAccessed = Date.now();
                });

                return results.slice(0, input.limit || 50);
            }),

        // ========================================================================
        // GOALS LAYER: What the user wants to achieve
        // ========================================================================
        'goals/create': procedure
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

        'goals/list': procedure
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

        'goals/update': procedure
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
                const entry = entries.get(input.goalsId) as TemporalEntry<GoalMemory>;
                if (!entry) return { ok: false };

                Object.assign(entry.content, input.updates);
                entry.lastAccessed = Date.now();

                // If completed/abandoned, move to patterns for learning
                if (input.updates.status === 'completed' || input.updates.status === 'abandoned') {
                    await analyzeGoalOutcome(entry);
                }

                persist();
                return { ok: true };
            }),

        // ========================================================================
        // MOVEMENT LAYER: Changes, problems, successes
        // ========================================================================
        'movement/record': procedure
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

                // High-impact movements trigger pattern analysis
                if (Math.abs(input.impact) > 7) {
                    await analyzeForPatterns(input.userId, entry);
                }

                return { id: entry.id };
            }),

        'movement/timeline': procedure
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

                return movements.sort((a, b) => a.timestamp - b.timestamp); // Chronological
            }),

        // ========================================================================
        // PATTERNS LAYER: Learned behaviors for proactive action
        // ========================================================================
        'patterns/learn': procedure
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

                // Check for existing similar pattern
                const existing = findSimilarPattern(input.userId, input.trigger);

                if (existing) {
                    // Strengthen existing pattern
                    const pattern = existing.content as PatternMemory;
                    pattern.occurrences++;
                    pattern.confidence = Math.min(0.95, pattern.confidence + 0.1);
                    pattern.lastTriggered = temporal.timestamp;
                    if (input.examples) pattern.examples.push(...input.examples);
                    existing.lastAccessed = temporal.timestamp;
                    persist();

                    return { patternId: existing.id, confidence: pattern.confidence };
                }

                // Create new pattern
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

        'patterns/match': procedure
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

                    // Time match
                    if (input.context.hour !== undefined && pattern.trigger.time?.hour !== undefined) {
                        const hourDiff = Math.abs(input.context.hour - pattern.trigger.time.hour);
                        if (hourDiff <= 1) { score += 0.4; matches++; }
                    }

                    // Day match
                    if (input.context.dayOfWeek !== undefined && pattern.trigger.time?.dayOfWeek) {
                        if (pattern.trigger.time.dayOfWeek.includes(input.context.dayOfWeek)) {
                            score += 0.3; matches++;
                        }
                    }

                    // Context match
                    if (input.context.currentActivity && pattern.trigger.context) {
                        const overlap = pattern.trigger.context.filter(c =>
                            input.context.currentActivity!.toLowerCase().includes(c.toLowerCase())
                        ).length;
                        if (overlap > 0) { score += 0.2 * overlap; matches++; }
                    }

                    // Preceding action match
                    if (input.context.lastAction && pattern.trigger.precedingAction) {
                        if (input.context.lastAction === pattern.trigger.precedingAction) {
                            score += 0.1; matches++;
                        }
                    }

                    // Boost by pattern confidence and recency
                    const recencyBoost = Math.exp(-(Date.now() - entry.timestamp) / (7 * 24 * 3600000));
                    score = (score / Math.max(1, matches)) * pattern.confidence * (0.5 + 0.5 * recencyBoost);

                    return {
                        pattern: entry,
                        matchScore: score,
                        recommendation: score > 0.7 ? pattern.action : undefined
                    };
                });

                return scored
                    .filter(s => s.matchScore > 0.3)
                    .sort((a, b) => b.matchScore - a.matchScore);
            }),

        // ========================================================================
        // ACTIONS LAYER: Record of what was done
        // ========================================================================
        'actions/record': procedure
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

                // Record failures as problems in movement layer
                if (input.result === 'failure') {
                    await cell.mesh.memory.movement.record({
                        userId: input.userId,
                        type: 'problem',
                        description: `Failed to ${input.action} on ${input.target}`,
                        fromState: 'attempting',
                        toState: 'failed',
                        impact: -5
                    });
                }

                return { id: entry.id };
            }),

        'actions/history': procedure
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
            }),

        // ========================================================================
        // TEMPORAL QUERIES: Cross-layer time-based retrieval
        // ========================================================================
        'temporal/slice': procedure
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

                // Extract significant events (high impact movements, goal changes)
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

        'temporal/context': procedure
            .input(z.object({
                userId: z.string(),
                lookback: z.optional(z.number()), // milliseconds
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
                const lookback = input.lookback || 24 * 3600000; // 24 hours default

                const temporal = getTemporalContext();

                // Get recent from all layers
                const [sessions, movements, goals, patterns] = await Promise.all([
                    cell.mesh.memory.session.get({ userId: input.userId, since: now - lookback, limit: 10 }),
                    cell.mesh.memory.movement.timeline({ userId: input.userId, since: now - lookback }),
                    cell.mesh.memory.goals.list({ userId: input.userId, status: 'active' }),
                    input.includePatterns ? cell.mesh.memory.patterns.match({
                        userId: input.userId,
                        context: {
                            timeOfDay: temporal.timeOfDay,
                            hour: temporal.hourOfDay,
                            dayOfWeek: temporal.dayOfWeek
                        }
                    }) : Promise.resolve([])
                ]);

                // Find highest confidence pattern recommendation
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
});

// ============================================================================
// BACKGROUND PROCESSES
// ============================================================================

// Pattern detection job
setInterval(async () => {
    const users = new Set(Array.from(entries.values()).map(e => {
        const userTag = e.tags.find(t => t.startsWith('user_') || t.length === 36);
        return userTag;
    }).filter(Boolean));

    for (const userId of users) {
        await detectTemporalPatterns(userId!);
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Compression job (promote old session entries to summaries)
setInterval(async () => {
    const cutoff = Date.now() - 24 * 3600000; // 24 hours
    const oldSessions = Array.from(entries.values())
        .filter(e => e.layer === 'session' && e.timestamp < cutoff && e.importance < 0.5);

    for (const entry of oldSessions) {
        // Summarize and potentially remove raw data
        await compressSessionEntry(entry);
    }
}, 60 * 60 * 1000); // Every hour

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function autoExtractGoal(userId: string, text: string, sourceId: string) {
    // Use AI to extract goal from text
    const extraction = await cell.mesh.ai.generate({
        prompt: `Extract goal from: "${text}". Return JSON: {isGoal: boolean, description: string, priority: number}`,
        systemInstruction: "You extract structured goals from user statements. Be concise."
    });

    try {
        const parsed = JSON.parse(extraction.response);
        if (parsed.isGoal) {
            await cell.mesh.memory.goals.create({
                userId,
                description: parsed.description,
                priority: parsed.priority,
                sourceSessionId: sourceId
            });
        }
    } catch (e) {
        // Silent fail - not all text contains goals
    }
}

async function autoExtractMovement(userId: string, session: any, sourceId: string) {
    await cell.mesh.memory.movement.record({
        userId,
        type: session.emotionalValence > 0 ? 'success' : 'problem',
        description: `Strong emotional response: ${session.text.substring(0, 100)}`,
        fromState: 'neutral',
        toState: session.emotionalValence > 0 ? 'positive' : 'negative',
        impact: session.emotionalValence * 10
    });
}

async function analyzeGoalOutcome(goalEntry: TemporalEntry<GoalMemory>) {
    // Find related movements
    const related = Array.from(entries.values())
        .filter(e => e.layer === 'movement' && e.tags.includes(goalEntry.id));

    // Learn pattern: what led to success/failure?
    if (related.length > 2) {
        await cell.mesh.memory.patterns.learn({
            userId: goalEntry.tags.find(t => !['goal', 'active'].includes(t))!,
            trigger: {
                context: ['goal_pursuit']
            },
            action: `When pursuing goals, watch for: ${related.map(r => (r.content as MovementMemory).type).join(', ')}`,
            confidence: 0.6,
            examples: related.map(r => r.id)
        });
    }
}

async function analyzeForPatterns(userId: string, movement: TemporalEntry<MovementMemory>) {
    // Find similar movements in temporal proximity
    const similar = Array.from(entries.values())
        .filter(e =>
            e.layer === 'movement' &&
            e.tags.includes(userId) &&
            (e.content as MovementMemory).type === movement.content.type &&
            Math.abs(e.timestamp - movement.timestamp) < 7 * 24 * 3600000 // Within a week
        );

    if (similar.length >= 3) {
        // There's a pattern here
        const temporal = getTemporalContext(movement.timestamp);
        await cell.mesh.memory.patterns.learn({
            userId,
            trigger: {
                time: { hour: temporal.hourOfDay },
                context: [movement.content.type]
            },
            action: `User experiences ${movement.content.type} around ${temporal.timeOfDay}`,
            confidence: Math.min(0.9, similar.length * 0.2),
            examples: similar.map(s => s.id)
        });
    }
}

function findSimilarPattern(userId: string, trigger: any): TemporalEntry<PatternMemory> | undefined {
    return Array.from(entries.values()).find(e => {
        if (e.layer !== 'patterns' || !e.tags.includes(userId)) return false;
        const pat = e.content as PatternMemory;

        // Fuzzy match on trigger conditions
        if (trigger.time?.hour !== undefined && pat.trigger.time?.hour !== undefined) {
            if (Math.abs(trigger.time.hour - pat.trigger.time.hour) <= 1) return true;
        }

        return false;
    }) as TemporalEntry<PatternMemory> | undefined;
}

async function detectTemporalPatterns(userId: string) {
    // Advanced: Find time-based correlations across layers
    const sessions = Array.from(entries.values())
        .filter(e => e.layer === 'session' && e.tags.includes(userId));

    // Group by hour and look for recurring intents
    const byHour = new Map<number, Map<string, number>>();
    sessions.forEach(s => {
        const hour = s.temporal.hourOfDay;
        const intent = (s.content as SessionMemory).intent || 'unknown';

        if (!byHour.has(hour)) byHour.set(hour, new Map());
        const intents = byHour.get(hour)!;
        intents.set(intent, (intents.get(intent) || 0) + 1);
    });

    // Create patterns for recurring intents
    for (const [hour, intents] of byHour) {
        for (const [intent, count] of intents) {
            if (count >= 3) {
                await cell.mesh.memory.patterns.learn({
                    userId,
                    trigger: { time: { hour } },
                    action: `User often wants to ${intent} around ${hour}:00`,
                    confidence: Math.min(0.8, count * 0.15)
                });
            }
        }
    }
}

function calculateImportance(input: any): number {
    let score = 0.5;
    if (input.intent?.includes('goal')) score += 0.3;
    if (input.emotionalValence && Math.abs(input.emotionalValence) > 0.5) score += 0.2;
    if (input.entities && input.entities.length > 0) score += 0.1;
    return Math.min(1, score);
}

async function compressSessionEntry(entry: TemporalEntry<SessionMemory>) {
    // Summarize old session entries, keep only gist
    const summary = await cell.mesh.ai.generate({
        prompt: `Summarize in 10 words: "${entry.content.text}"`,
        systemInstruction: "Extreme brevity."
    });

    entry.content.text = summary.response;
    entry.content.intent = undefined; // Remove detailed analysis
    entry.importance *= 0.8; // Decay importance

    persist();
}

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