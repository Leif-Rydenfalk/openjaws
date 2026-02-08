// kindly/index-enhanced.ts - TEMPORAL AGENT WITH COMPREHENSIVE LOGGING
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";

const cell = new TypedRheoCell(`Kindly_${process.pid}`, 0);

// ============================================================================
// ACTIVITY TRACKING
// ============================================================================

interface ToolCall {
    id: string;
    tool: string;
    parameters: any;
    startTime: number;
    endTime?: number;
    success?: boolean;
    result?: any;
    error?: string;
}

interface SessionActivity {
    sessionId: string;
    toolCalls: ToolCall[];
    tokensUsed: number;
    startTime: number;
}

const sessionActivities = new Map<string, SessionActivity>();

function startToolCall(sessionId: string, tool: string, parameters: any): string {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let activity = sessionActivities.get(sessionId);
    if (!activity) {
        activity = {
            sessionId,
            toolCalls: [],
            tokensUsed: 0,
            startTime: Date.now()
        };
        sessionActivities.set(sessionId, activity);
    }

    const toolCall: ToolCall = {
        id: callId,
        tool,
        parameters,
        startTime: Date.now()
    };

    activity.toolCalls.push(toolCall);

    // Log to mesh
    cell.log("INFO", `🔧 [${sessionId.substring(0, 8)}] Starting: ${tool}`);

    // Log to audit
    cell.mesh.log.info({
        msg: `TOOL_START: ${tool} (session: ${sessionId.substring(0, 8)}, params: ${JSON.stringify(parameters).substring(0, 100)})`,
        from: cell.id
    }).catch(() => { });

    return callId;
}

function endToolCall(sessionId: string, callId: string, success: boolean, result?: any, error?: string) {
    const activity = sessionActivities.get(sessionId);
    if (!activity) return;

    const toolCall = activity.toolCalls.find(tc => tc.id === callId);
    if (!toolCall) return;

    toolCall.endTime = Date.now();
    toolCall.success = success;
    toolCall.result = result;
    toolCall.error = error;

    const duration = toolCall.endTime - toolCall.startTime;

    // Log completion
    const status = success ? "✅" : "❌";
    cell.log("INFO", `${status} [${sessionId.substring(0, 8)}] ${toolCall.tool} (${duration}ms)`);

    // Log to audit
    cell.mesh.log.info({
        msg: `TOOL_END: ${toolCall.tool} ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)${error ? ` - ${error}` : ''}`,
        from: cell.id
    }).catch(() => { });
}

// ============================================================================
// TEMPORAL CONTEXT BUILDER (same as before)
// ============================================================================

async function buildTemporalContext(userId: string, sessionId: string) {
    const temporal = getTemporalContext();

    // Load full temporal state in ONE call
    const context = await cell.mesh.memory['temporal/context']({
        userId,
        lookback: 7 * 24 * 3600000, // 1 week
        includePatterns: true
    });

    const parts: string[] = [];

    // Current time awareness
    parts.push(`## TEMPORAL STATE
Time: ${temporal.timeOfDay} (hour ${temporal.hourOfDay}, ${getDayName(temporal.dayOfWeek)})
Week: ${temporal.weekNumber}, Season: ${temporal.season}
`);

    // Active goals
    if (context.recent.activeGoals.length > 0) {
        parts.push(`## ACTIVE GOALS`);
        context.recent.activeGoals.forEach(g => {
            const goal = g.content as GoalMemory;
            const progress = Math.round(goal.progress * 100);
            const status = goal.status === 'blocked' ? '🚫 BLOCKED' :
                goal.status === 'completed' ? '✅ DONE' :
                    `${progress}%`;
            parts.push(`- ${goal.description} [${status}]`);
            if (goal.blockingFactors?.length) {
                parts.push(`  ⚠️  Blocked by: ${goal.blockingFactors.join(', ')}`);
            }
        });
        parts.push('');
    }

    // Recent movements
    if (context.recent.movements.length > 0) {
        const significant = context.recent.movements
            .filter(m => Math.abs((m.content as MovementMemory).impact) > 5)
            .slice(-5);

        if (significant.length > 0) {
            parts.push(`## RECENT EVENTS`);
            significant.forEach(m => {
                const mov = m.content as MovementMemory;
                const emoji = mov.type === 'success' ? '✓' :
                    mov.type === 'problem' ? '⚠' :
                        mov.type === 'insight' ? '💡' : '→';
                const time = formatTimestamp(m.timestamp);
                parts.push(`${emoji} ${time}: ${mov.description}`);
                if (mov.relatedGoal) {
                    parts.push(`   (Related to goal: ${mov.relatedGoal})`);
                }
            });
            parts.push('');
        }
    }

    // Learned patterns
    if (context.patterns && context.patterns.length > 0) {
        parts.push(`## LEARNED PATTERNS`);
        const topPatterns = context.patterns.slice(0, 3);
        topPatterns.forEach(p => {
            const pattern = p.pattern.content as PatternMemory;
            const confidence = Math.round(p.matchScore * 100);
            parts.push(`- ${pattern.action} (${confidence}% match)`);
            if (pattern.trigger.time?.hour !== undefined) {
                parts.push(`  Triggers: Around ${pattern.trigger.time.hour}:00`);
            }
        });
        parts.push('');
    }

    // Proactive suggestion
    if (context.suggestedAction) {
        parts.push(`## PROACTIVE INSIGHT`);
        parts.push(`Based on patterns: ${context.suggestedAction}`);
        parts.push('');
    }

    // Recent conversation
    if (context.recent.sessions.length > 0) {
        parts.push(`## RECENT CONVERSATION`);
        context.recent.sessions.slice(-3).forEach(s => {
            const sess = s.content as SessionMemory;
            const time = formatTimestamp(s.timestamp);
            const preview = sess.text.substring(0, 80);
            parts.push(`[${time}] ${sess.speaker}: ${preview}${sess.text.length > 80 ? '...' : ''}`);
        });
        parts.push('');
    }

    return {
        markdown: parts.join('\n'),
        context,
        temporal
    };
}

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

function getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
}

function formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

async function getAvailableTools(): Promise<any[]> {
    return [
        {
            name: "memory_goals_create",
            description: "Store a new goal the user wants to achieve",
            parameters: {
                userId: "string",
                description: "string",
                priority: "number (0-1, optional)",
                targetDate: "number (unix timestamp, optional)",
                successCriteria: "string[] (optional)"
            }
        },
        {
            name: "memory_goals_update",
            description: "Update goal status or progress",
            parameters: {
                goalId: "string",
                updates: {
                    status: "'active' | 'completed' | 'abandoned' | 'blocked'",
                    progress: "number (0-1)",
                    description: "string"
                }
            }
        },
        {
            name: "list_add",
            description: "Add task to user's daily list",
            parameters: {
                text: "string",
                type: "'task' | 'idea'"
            }
        },
        {
            name: "list_get",
            description: "Get current task list",
            parameters: {}
        }
    ];
}

// ============================================================================
// ENHANCED TOOL EXECUTOR WITH LOGGING
// ============================================================================

async function executeTool(sessionId: string, toolName: string, params: any): Promise<any> {
    const callId = startToolCall(sessionId, toolName, params);

    try {
        const parts = toolName.split('_');
        if (parts.length < 2) {
            throw new Error(`Invalid tool name: ${toolName}`);
        }

        const namespace = parts[0];
        const method = parts.slice(1).join('/');

        const result = await (cell.mesh as any)[namespace][method](params);

        endToolCall(sessionId, callId, true, result);

        return {
            success: true,
            result
        };

    } catch (e: any) {
        endToolCall(sessionId, callId, false, undefined, e.message);

        return {
            success: false,
            error: e.message
        };
    }
}

// ============================================================================
// ENHANCED AGENTIC ROUTER WITH ACTIVITY TRACKING
// ============================================================================

const kindlyRouter = router({
    kindly: router({
        chat: procedure
            .input(z.object({
                message: z.string(),
                systemContext: z.object({
                    userId: z.string(),
                    username: z.string(),
                    role: z.string(),
                    sessionId: z.optional(z.string()),
                    channel: z.optional(z.string())
                })
            }))
            .output(z.object({
                reply: z.string(),
                contextUsed: z.object({
                    userKnown: z.boolean(),
                    username: z.string(),
                    role: z.string(),
                    toolCalls: z.number(),
                    reasoning: z.optional(z.string()),
                    sessionMemories: z.optional(z.number()),
                    activeGoals: z.optional(z.number()),
                    patternsDetected: z.optional(z.number()),
                    suggestedActions: z.optional(z.array(z.string())),
                    tokensUsed: z.optional(z.number()),
                    toolActivity: z.optional(z.array(z.object({
                        tool: z.string(),
                        duration: z.number(),
                        success: z.boolean()
                    })))
                })
            }))
            .mutation(async ({ message, systemContext }) => {
                const { userId, username, role, sessionId } = systemContext;
                const session = sessionId || `session_${Date.now()}`;

                // Create session activity tracker
                sessionActivities.set(session, {
                    sessionId: session,
                    toolCalls: [],
                    tokensUsed: 0,
                    startTime: Date.now()
                });

                cell.log("INFO", `💬 New chat request from ${username}`);

                // Store incoming message
                await cell.mesh.memory['session/store']({
                    userId,
                    sessionId: session,
                    speaker: 'user',
                    text: message,
                    intent: await classifyIntent(message)
                });

                // Build temporal context
                const { markdown: contextMarkdown, context, temporal } =
                    await buildTemporalContext(userId, session);

                // Agentic loop
                const tools = await getAvailableTools();
                const maxIterations = 10;
                let iteration = 0;
                let conversationLog: string[] = [];
                let totalTokensUsed = 0;

                conversationLog.push(`USER: ${message}`);

                const systemPrompt = `You are Kindly, an autonomous AI agent with PERFECT TEMPORAL MEMORY.

# CURRENT TEMPORAL STATE
${contextMarkdown}

# YOUR CAPABILITIES
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

# DECISION PROTOCOL
1. **Understand Context**: You see user goals.
2. **VOICE OPTIMIZATION**: Keep responses under 150 characters. Be punchy and immediate.
2. **Think Temporally**: Consider time of day, day of week, and seasonal patterns
3. **Be Proactive**: If patterns suggest an action, do it without asking
4. **Plan Tools**: Decide which tools to call and in what order
5. **Execute**: Call tools by responding with JSON
6. **Learn**: Record significant events as movements, update goals, learn patterns

# RESPONSE FORMATS

To call a tool:
\`\`\`json
{
  "type": "tool_call",
  "tool": "tool_name",
  "parameters": { ... },
  "reasoning": "why I'm calling this"
}
\`\`\`

To respond to user:
\`\`\`json
{
  "type": "final_response",
  "message": "your message to the user",
  "reasoning": "what you accomplished"
}
\`\`\`

# CURRENT CONTEXT
- User: ${username} (${role})
- Session: ${session}
- Time: ${temporal.timeOfDay}, ${getDayName(temporal.dayOfWeek)}
- Active Goals: ${context.recent.activeGoals.length}
- Recent Events: ${context.recent.movements.length}
- Learned Patterns: ${context.patterns?.length || 0}

# CONVERSATION
${conversationLog.join('\n')}

What do you do next?`;

                while (iteration < maxIterations) {
                    iteration++;

                    cell.log("INFO", `🔄 Iteration ${iteration}/${maxIterations}`);

                    try {
                        const aiResponse = await cell.mesh.ai.generate({
                            prompt: conversationLog[conversationLog.length - 1],
                            systemInstruction: systemPrompt,
                            requestId: `${session}_${iteration}`
                        });

                        // Track tokens
                        totalTokensUsed += aiResponse.usage.totalTokens;
                        const activity = sessionActivities.get(session)!;
                        activity.tokensUsed = totalTokensUsed;

                        cell.log("INFO", `📊 Tokens: ${aiResponse.usage.totalTokens} (total: ${totalTokensUsed})`);

                        const responseText = aiResponse.response.trim();
                        conversationLog.push(`AI: ${responseText}`);

                        // Parse decision
                        let decision: any;
                        try {
                            const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
                                responseText.match(/```\n?([\s\S]*?)\n?```/) ||
                                [null, responseText];

                            decision = JSON.parse(jsonMatch[1] || responseText);
                        } catch (e) {
                            decision = {
                                type: "final_response",
                                message: responseText,
                                reasoning: "Natural language response"
                            };
                        }

                        if (decision.type === "tool_call") {
                            cell.log("INFO", `🔧 Tool call: ${decision.tool}`);

                            const toolResult = await executeTool(session, decision.tool, decision.parameters);

                            conversationLog.push(
                                `TOOL_RESULT (${decision.tool}): ${JSON.stringify(toolResult)}`
                            );

                            continue;

                        } else if (decision.type === "final_response") {
                            // Store agent's response
                            await cell.mesh.memory['session/store']({
                                userId,
                                sessionId: session,
                                speaker: 'agent',
                                text: decision.message
                            });

                            // Compile activity summary
                            const activity = sessionActivities.get(session)!;
                            const toolActivity = activity.toolCalls.map(tc => ({
                                tool: tc.tool,
                                duration: (tc.endTime || Date.now()) - tc.startTime,
                                success: tc.success || false
                            }));

                            return {
                                reply: decision.message,
                                contextUsed: {
                                    userKnown: true,
                                    username,
                                    role,
                                    toolCalls: activity.toolCalls.length,
                                    reasoning: decision.reasoning,
                                    sessionMemories: context.recent.sessions.length,
                                    activeGoals: context.recent.activeGoals.length,
                                    patternsDetected: context.patterns?.length || 0,
                                    suggestedActions: context.patterns
                                        ?.filter(p => p.matchScore > 0.7)
                                        .map(p => p.recommendation),
                                    tokensUsed: totalTokensUsed,
                                    toolActivity
                                }
                            };
                        }

                    } catch (e: any) {
                        cell.log("ERROR", `Agentic loop error: ${e.message}`);

                        return {
                            reply: `System error during execution. Please try again.`,
                            contextUsed: {
                                userKnown: true,
                                username,
                                role,
                                toolCalls: sessionActivities.get(session)?.toolCalls.length || 0,
                                tokensUsed: totalTokensUsed
                            }
                        };
                    }
                }

                return {
                    reply: "Task complex - broke into steps. Check your task list.",
                    contextUsed: {
                        userKnown: true,
                        username,
                        role,
                        toolCalls: sessionActivities.get(session)?.toolCalls.length || 0,
                        reasoning: "Max iterations reached",
                        tokensUsed: totalTokensUsed
                    }
                };
            }),

        /**
         * Get activity log for a session
         */
        'get-activity': procedure
            .input(z.object({
                sessionId: z.string()
            }))
            .output(z.object({
                found: z.boolean(),
                activity: z.any()
            }))
            .query(async ({ sessionId }) => {
                const activity = sessionActivities.get(sessionId);
                return {
                    found: !!activity,
                    activity: activity || null
                };
            })
    })
});

async function classifyIntent(message: string): Promise<string> {
    try {
        const result = await cell.mesh.ai.generate({
            prompt: `Classify intent in ONE word: "${message}"
Options: goal, question, command, update, feedback, chat`,
            systemInstruction: "Return only one word"
        });

        return result.response.trim().toLowerCase();
    } catch (e) {
        return 'chat';
    }
}

cell.useRouter(kindlyRouter);
cell.listen();

cell.log("INFO", "🧠 Enhanced Kindly online - with activity tracking");

export type KindlyRouter = typeof kindlyRouter;

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

interface SessionMemory {
    speaker: 'user' | 'agent';
    text: string;
    intent?: string;
    entities?: string[];
    emotionalValence?: number;
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