// skills/index.ts - System Capability Knowledge Base
import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const SKILLS_PATH = join(DATA_DIR, "skills.json");
const LEARNED_PATH = join(DATA_DIR, "learned_capabilities.json");

const cell = new TypedRheoCell(`Skills_${process.pid}`, 0);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SkillCategory {
    name: string;
    description: string;
    capabilities: SkillCapability[];
}

interface SkillCapability {
    endpoint: string;
    description: string;
    example?: string;
    inputType?: string;
    outputType?: string;
    tags: string[];
    addedAt: number;
    usageCount: number;
    lastUsed?: number;
    successRate?: number;
}

interface LearnedPattern {
    pattern: string;
    description: string;
    examples: string[];
    frequency: number;
    firstSeen: number;
    lastSeen: number;
}

// ============================================================================
// DATA PERSISTENCE
// ============================================================================

function loadSkills(): SkillCategory[] {
    try {
        if (existsSync(SKILLS_PATH)) {
            return JSON.parse(readFileSync(SKILLS_PATH, 'utf8'));
        }
    } catch (e) {
        cell.log("WARN", "Failed to load skills, using defaults");
    }
    return getDefaultSkills();
}

function saveSkills(skills: SkillCategory[]) {
    writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));
}

function loadLearned(): LearnedPattern[] {
    try {
        if (existsSync(LEARNED_PATH)) {
            return JSON.parse(readFileSync(LEARNED_PATH, 'utf8'));
        }
    } catch (e) { }
    return [];
}

function saveLearned(patterns: LearnedPattern[]) {
    writeFileSync(LEARNED_PATH, JSON.stringify(patterns, null, 2));
}

// ============================================================================
// DEFAULT SKILLS (Bootstrap Knowledge)
// ============================================================================

function getDefaultSkills(): SkillCategory[] {
    return [
        {
            name: "Core Mesh Operations",
            description: "Fundamental distributed system capabilities",
            capabilities: [
                {
                    endpoint: "mesh/health",
                    description: "Check overall system health and topology",
                    tags: ["system", "monitoring"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "mesh/ping",
                    description: "Verify cell connectivity",
                    tags: ["system", "diagnostics"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "mesh/directory",
                    description: "Get complete mesh topology atlas",
                    tags: ["system", "discovery"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "AI Generation",
            description: "AI-powered content creation and analysis",
            capabilities: [
                {
                    endpoint: "ai/generate",
                    description: "Generate text using Gemini AI with optional system instructions",
                    example: '{ "prompt": "Explain quantum computing", "systemInstruction": "You are a physics teacher" }',
                    tags: ["ai", "generation", "text"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "Task Management",
            description: "Personal productivity and goal tracking",
            capabilities: [
                {
                    endpoint: "list/get",
                    description: "Retrieve current task list with capacity info",
                    tags: ["tasks", "productivity"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "list/add",
                    description: "Add new task or idea (max 5 active tasks)",
                    example: '{ "text": "Deploy to production", "type": "task" }',
                    tags: ["tasks", "productivity"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "list/complete",
                    description: "Mark task as done and build momentum",
                    example: '{ "id": "abc123" }',
                    tags: ["tasks", "productivity"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "Memory System",
            description: "Temporal memory and pattern learning",
            capabilities: [
                {
                    endpoint: "memory/store",
                    description: "Store memory in appropriate temporal layer (session/goals/movement/patterns/actions)",
                    example: '{ "layer": "goals", "content": "Launch product by Q2", "tags": ["business", "2026"] }',
                    tags: ["memory", "temporal"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "memory/search",
                    description: "Search across temporal layers with time awareness",
                    example: '{ "query": "product launch", "layers": ["goals", "actions"], "limit": 10 }',
                    tags: ["memory", "search"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "memory/suggest-from-patterns",
                    description: "Get AI suggestions based on learned behavioral patterns",
                    tags: ["memory", "ai", "patterns"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "Project Management",
            description: "File system and code execution",
            capabilities: [
                {
                    endpoint: "projects/write",
                    description: "Write file to AI workspace",
                    example: '{ "path": "script.ts", "content": "console.log(\'Hello\')" }',
                    tags: ["files", "code"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "projects/read",
                    description: "Read file from workspace",
                    tags: ["files"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "projects/exec",
                    description: "Execute command in workspace",
                    example: '{ "command": "bun", "args": ["test.ts"] }',
                    tags: ["execution", "code"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "Conversational Interface",
            description: "Natural language interaction with memory awareness",
            capabilities: [
                {
                    endpoint: "kindly/chat",
                    description: "Context-aware conversation with temporal memory integration",
                    example: '{ "message": "What did I work on yesterday?", "systemContext": { "userId": "user123", "username": "Alice", "role": "user" } }',
                    tags: ["chat", "ai", "memory"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "System Logging",
            description: "Audit trail and observability",
            capabilities: [
                {
                    endpoint: "log/info",
                    description: "Write to mesh audit log",
                    example: '{ "msg": "Deployment completed", "from": "deploy-script" }',
                    tags: ["logging", "audit"],
                    addedAt: Date.now(),
                    usageCount: 0
                },
                {
                    endpoint: "log/get",
                    description: "Retrieve recent log entries",
                    tags: ["logging", "monitoring"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        },
        {
            name: "Strategic Planning",
            description: "High-level decision making and plan generation",
            capabilities: [
                {
                    endpoint: "architect/consult",
                    description: "Generate execution plan based on codebase analysis",
                    example: '{ "goal": "Add dark mode to UI", "execute": true }',
                    tags: ["planning", "ai", "strategy"],
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ]
        }
    ];
}

// ============================================================================
// SKILLS ROUTER
// ============================================================================

const skillsRouter = router({
    skills: router({
        /**
         * Get all system capabilities organized by category
         */
        list: procedure
            .input(z.object({
                tags: z.optional(z.array(z.string())),
                category: z.optional(z.string())
            }))
            .output(z.object({
                categories: z.array(z.any()),
                totalCapabilities: z.number(),
                lastUpdated: z.number()
            }))
            .query(async (input) => {
                let skills = loadSkills();

                // Filter by category if specified
                if (input.category) {
                    skills = skills.filter(cat =>
                        cat.name.toLowerCase().includes(input.category!.toLowerCase())
                    );
                }

                // Filter by tags if specified
                if (input.tags && input.tags.length > 0) {
                    skills = skills.map(cat => ({
                        ...cat,
                        capabilities: cat.capabilities.filter(cap =>
                            input.tags!.some(tag => cap.tags.includes(tag))
                        )
                    })).filter(cat => cat.capabilities.length > 0);
                }

                const totalCapabilities = skills.reduce(
                    (sum, cat) => sum + cat.capabilities.length,
                    0
                );

                return {
                    categories: skills,
                    totalCapabilities,
                    lastUpdated: Date.now()
                };
            }),

        /**
         * Get AI-friendly context about system capabilities
         */
        'get-context': procedure
            .input(z.object({
                intent: z.optional(z.string()),
                includeExamples: z.optional(z.boolean())
            }))
            .output(z.object({
                markdown: z.string(),
                capabilities: z.number(),
                relevantEndpoints: z.array(z.string())
            }))
            .query(async (input) => {
                const skills = loadSkills();
                const learned = loadLearned();

                let markdown = `# OpenJaws System Capabilities\n\n`;
                markdown += `**Generated**: ${new Date().toISOString()}\n\n`;
                markdown += `This document describes all available mesh capabilities and learned patterns.\n\n`;

                // Add learned patterns if any
                if (learned.length > 0) {
                    markdown += `## 🔮 Learned Patterns\n\n`;
                    markdown += `The system has learned these behavioral patterns:\n\n`;

                    for (const pattern of learned.slice(0, 5)) {
                        markdown += `### ${pattern.pattern}\n`;
                        markdown += `${pattern.description}\n`;
                        markdown += `- Frequency: ${pattern.frequency} occurrences\n`;
                        markdown += `- Last seen: ${new Date(pattern.lastSeen).toLocaleDateString()}\n\n`;
                    }
                }

                // Document all capabilities
                markdown += `## Available Capabilities\n\n`;

                let totalCaps = 0;
                const relevantEndpoints: string[] = [];

                for (const category of skills) {
                    markdown += `### ${category.name}\n\n`;
                    markdown += `${category.description}\n\n`;

                    for (const cap of category.capabilities) {
                        totalCaps++;
                        relevantEndpoints.push(cap.endpoint);

                        markdown += `#### \`${cap.endpoint}\`\n\n`;
                        markdown += `${cap.description}\n\n`;

                        if (cap.example && input.includeExamples) {
                            markdown += `**Example Input**:\n\`\`\`json\n${cap.example}\n\`\`\`\n\n`;
                        }

                        if (cap.inputType) {
                            markdown += `**Input Type**: \`${cap.inputType}\`\n\n`;
                        }

                        if (cap.outputType) {
                            markdown += `**Output Type**: \`${cap.outputType}\`\n\n`;
                        }

                        markdown += `**Tags**: ${cap.tags.join(', ')}\n\n`;

                        if (cap.usageCount > 0) {
                            markdown += `**Usage**: ${cap.usageCount} calls`;
                            if (cap.successRate !== undefined) {
                                markdown += `, ${Math.round(cap.successRate * 100)}% success rate`;
                            }
                            markdown += `\n\n`;
                        }

                        markdown += `---\n\n`;
                    }
                }

                // Add mesh topology context
                markdown += `## Current Mesh Topology\n\n`;
                const meshHealth = await cell.mesh.mesh.health().catch(() => null);
                if (meshHealth) {
                    markdown += `- **Active Cells**: ${meshHealth.totalCells}\n`;
                    markdown += `- **Status**: ${meshHealth.status}\n`;
                    markdown += `- **Hot Spots**: ${meshHealth.hotSpots.join(', ')}\n\n`;
                }

                markdown += `## Usage Guidelines\n\n`;
                markdown += `1. **Always check capability availability** before attempting complex operations\n`;
                markdown += `2. **Use memory/store** to persist important decisions and context\n`;
                markdown += `3. **Leverage learned patterns** for proactive suggestions\n`;
                markdown += `4. **Chain capabilities** for complex workflows (e.g., architect/consult → projects/write → projects/exec)\n`;
                markdown += `5. **Log important events** using log/info for audit trail\n\n`;

                return {
                    markdown,
                    capabilities: totalCaps,
                    relevantEndpoints
                };
            }),

        /**
         * Update capability metadata (usage stats, examples, etc.)
         */
        'update-capability': procedure
            .input(z.object({
                endpoint: z.string(),
                incrementUsage: z.optional(z.boolean()),
                updateSuccess: z.optional(z.boolean()),
                addExample: z.optional(z.string()),
                addTag: z.optional(z.string())
            }))
            .output(z.object({
                ok: z.boolean(),
                updated: z.boolean()
            }))
            .mutation(async (input) => {
                const skills = loadSkills();
                let found = false;

                for (const category of skills) {
                    const cap = category.capabilities.find(c => c.endpoint === input.endpoint);
                    if (cap) {
                        found = true;

                        if (input.incrementUsage) {
                            cap.usageCount++;
                            cap.lastUsed = Date.now();
                        }

                        if (input.updateSuccess !== undefined) {
                            const currentRate = cap.successRate || 0;
                            const currentCount = cap.usageCount || 1;
                            cap.successRate = (currentRate * (currentCount - 1) + (input.updateSuccess ? 1 : 0)) / currentCount;
                        }

                        if (input.addExample) {
                            cap.example = input.addExample;
                        }

                        if (input.addTag && !cap.tags.includes(input.addTag)) {
                            cap.tags.push(input.addTag);
                        }

                        break;
                    }
                }

                if (found) {
                    saveSkills(skills);
                }

                return { ok: true, updated: found };
            }),

        /**
         * Learn a new pattern from observation
         */
        'learn-pattern': procedure
            .input(z.object({
                pattern: z.string(),
                description: z.string(),
                example: z.string()
            }))
            .output(z.object({
                ok: z.boolean(),
                patternId: z.string()
            }))
            .mutation(async (input) => {
                const patterns = loadLearned();

                // Check if pattern already exists
                let existing = patterns.find(p => p.pattern === input.pattern);

                if (existing) {
                    existing.frequency++;
                    existing.lastSeen = Date.now();
                    if (!existing.examples.includes(input.example)) {
                        existing.examples.push(input.example);
                        if (existing.examples.length > 5) {
                            existing.examples.shift(); // Keep only last 5 examples
                        }
                    }
                } else {
                    patterns.push({
                        pattern: input.pattern,
                        description: input.description,
                        examples: [input.example],
                        frequency: 1,
                        firstSeen: Date.now(),
                        lastSeen: Date.now()
                    });
                }

                saveLearned(patterns);

                cell.log("INFO", `📚 Learned pattern: ${input.pattern}`);

                return {
                    ok: true,
                    patternId: input.pattern
                };
            }),

        /**
         * Discover new capabilities from live mesh
         */
        'sync-from-mesh': procedure
            .input(z.void())
            .output(z.object({
                discovered: z.number(),
                updated: z.number()
            }))
            .mutation(async () => {
                const skills = loadSkills();
                const atlas = cell.atlas;

                let discovered = 0;
                let updated = 0;

                // Get all unique capabilities from mesh
                const meshCapabilities = new Set<string>();
                for (const entry of Object.values(atlas)) {
                    entry.caps.forEach(cap => meshCapabilities.add(cap));
                }

                // Cross-reference with known skills
                for (const cap of meshCapabilities) {
                    // Skip system internals
                    if (cap.startsWith("cell/") || cap === "mesh/gossip" || cap === "mesh/directory") {
                        continue;
                    }

                    // Check if we already know about this
                    let found = false;
                    for (const category of skills) {
                        if (category.capabilities.some(c => c.endpoint === cap)) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        // Try to get contract info
                        try {
                            const contract = await cell.askMesh("cell/contract" as any, { cap });
                            if (contract.ok && contract.value) {
                                const [namespace] = cap.split("/");
                                let category = skills.find(c =>
                                    c.name.toLowerCase().includes(namespace.toLowerCase())
                                );

                                if (!category) {
                                    category = {
                                        name: `${namespace.charAt(0).toUpperCase()}${namespace.slice(1)} Operations`,
                                        description: `Capabilities in the ${namespace} namespace`,
                                        capabilities: []
                                    };
                                    skills.push(category);
                                }

                                category.capabilities.push({
                                    endpoint: cap,
                                    description: contract.value.meta?.description || "Auto-discovered capability",
                                    example: contract.value.meta?.example ? JSON.stringify(contract.value.meta.example) : undefined,
                                    tags: ["auto-discovered", namespace],
                                    addedAt: Date.now(),
                                    usageCount: 0
                                });

                                discovered++;
                            }
                        } catch (e) {
                            // Can't get contract, add minimal info
                            const [namespace] = cap.split("/");
                            let category = skills.find(c =>
                                c.name.toLowerCase().includes(namespace.toLowerCase())
                            );

                            if (!category) {
                                category = {
                                    name: `${namespace.charAt(0).toUpperCase()}${namespace.slice(1)} Operations`,
                                    description: `Capabilities in the ${namespace} namespace`,
                                    capabilities: []
                                };
                                skills.push(category);
                            }

                            category.capabilities.push({
                                endpoint: cap,
                                description: "Auto-discovered capability (no contract available)",
                                tags: ["auto-discovered", namespace],
                                addedAt: Date.now(),
                                usageCount: 0
                            });

                            discovered++;
                        }
                    }
                }

                if (discovered > 0) {
                    saveSkills(skills);
                    cell.log("INFO", `🔍 Discovered ${discovered} new capabilities`);
                }

                return { discovered, updated };
            }),

        /**
         * Search for relevant capabilities based on intent
         */
        search: procedure
            .input(z.object({
                query: z.string(),
                limit: z.optional(z.number())
            }))
            .output(z.object({
                results: z.array(z.object({
                    endpoint: z.string(),
                    description: z.string(),
                    category: z.string(),
                    score: z.number(),
                    example: z.optional(z.string())
                })),
                total: z.number()
            }))
            .query(async (input) => {
                const skills = loadSkills();
                const queryLower = input.query.toLowerCase();
                const words = queryLower.split(/\s+/);

                const results: Array<{
                    endpoint: string;
                    description: string;
                    category: string;
                    score: number;
                    example?: string;
                }> = [];

                for (const category of skills) {
                    for (const cap of category.capabilities) {
                        let score = 0;

                        // Exact endpoint match
                        if (cap.endpoint.toLowerCase().includes(queryLower)) {
                            score += 10;
                        }

                        // Description match
                        const descLower = cap.description.toLowerCase();
                        words.forEach(word => {
                            if (descLower.includes(word)) score += 2;
                        });

                        // Tag match
                        cap.tags.forEach(tag => {
                            if (queryLower.includes(tag.toLowerCase())) score += 5;
                        });

                        // Category match
                        if (category.name.toLowerCase().includes(queryLower)) {
                            score += 3;
                        }

                        // Usage popularity boost
                        if (cap.usageCount > 0) {
                            score += Math.min(cap.usageCount / 10, 2);
                        }

                        if (score > 0) {
                            results.push({
                                endpoint: cap.endpoint,
                                description: cap.description,
                                category: category.name,
                                score,
                                example: cap.example
                            });
                        }
                    }
                }

                // Sort by score
                results.sort((a, b) => b.score - a.score);

                const limit = input.limit || 10;
                return {
                    results: results.slice(0, limit),
                    total: results.length
                };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(skillsRouter);
cell.listen();

cell.log("INFO", "📚 Skills System online");

// Auto-sync from mesh periodically
const syncInterval = setInterval(async () => {
    try {
        const result = await cell.mesh.skills['sync-from-mesh']();
        if (result.discovered > 0) {
            cell.log("INFO", `📡 Auto-discovered ${result.discovered} new capabilities`);
        }
    } catch (e) {
        // Mesh might not be ready yet
    }
}, 60000); // Every minute

// Initial sync after mesh stabilizes
setTimeout(async () => {
    try {
        const result = await cell.mesh.skills['sync-from-mesh']();
        cell.log("INFO", `📚 Initial sync: ${result.discovered} capabilities discovered`);
    } catch (e) {
        cell.log("WARN", "Initial sync failed, will retry");
    }
}, 15000);

// Export types
export type SkillsRouter = typeof skillsRouter;