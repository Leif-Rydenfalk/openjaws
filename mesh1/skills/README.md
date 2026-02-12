# Skills System

The Skills System is OpenJaws' knowledge base for system capabilities. It maintains a living document of what the mesh can do, learns patterns from usage, and provides AI-friendly context.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Skills Cell                        │
│  ┌───────────────────────────────────────────┐  │
│  │  Capability Registry                      │  │
│  │  - Endpoints & descriptions               │  │
│  │  - Input/output types                     │  │
│  │  - Usage statistics                       │  │
│  │  - Examples & tags                        │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Pattern Learning                         │  │
│  │  - Behavioral patterns                    │  │
│  │  - Frequency tracking                     │  │
│  │  - Example collection                     │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  AI Context Generation                    │  │
│  │  - Markdown documentation                 │  │
│  │  - Capability search                      │  │
│  │  - Usage recommendations                  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Core Capabilities

### `skills/list`
Get all system capabilities organized by category.

**Input**:
```typescript
{
  tags?: string[];        // Filter by tags (e.g., ["ai", "memory"])
  category?: string;      // Filter by category name
}
```

**Output**:
```typescript
{
  categories: SkillCategory[];
  totalCapabilities: number;
  lastUpdated: number;
}
```

**Example**:
```typescript
// Get all AI-related capabilities
const aiSkills = await cell.mesh.skills.list({
  tags: ["ai"]
});

// Get memory system capabilities
const memorySkills = await cell.mesh.skills.list({
  category: "Memory"
});
```

---

### `skills/get-context`
Generate AI-friendly documentation of system capabilities.

**Input**:
```typescript
{
  intent?: string;           // Describe what you're trying to do
  includeExamples?: boolean; // Include usage examples
}
```

**Output**:
```typescript
{
  markdown: string;              // Complete capability documentation
  capabilities: number;          // Total number of capabilities
  relevantEndpoints: string[];   // List of all endpoints
}
```

**Example**:
```typescript
// Get full system context for AI
const context = await cell.mesh.skills['get-context']({
  includeExamples: true
});

// Use in AI prompt
const aiResponse = await cell.mesh.ai.generate({
  prompt: "Plan a deployment strategy",
  systemInstruction: context.markdown
});
```

---

### `skills/search`
Find relevant capabilities based on natural language query.

**Input**:
```typescript
{
  query: string;    // Natural language search
  limit?: number;   // Max results (default: 10)
}
```

**Output**:
```typescript
{
  results: Array<{
    endpoint: string;
    description: string;
    category: string;
    score: number;        // Relevance score
    example?: string;
  }>;
  total: number;
}
```

**Example**:
```typescript
// Find capabilities related to tasks
const results = await cell.mesh.skills.search({
  query: "manage tasks and goals",
  limit: 5
});

// Results might include:
// - list/add (Task Management)
// - list/complete (Task Management)
// - memory/store (Memory System)
```

---

### `skills/update-capability`
Update metadata and usage statistics for a capability.

**Input**:
```typescript
{
  endpoint: string;
  incrementUsage?: boolean;      // Track usage
  updateSuccess?: boolean;       // Track success rate
  addExample?: string;           // Add usage example
  addTag?: string;               // Add tag
}
```

**Example**:
```typescript
// Track successful usage
await cell.mesh.skills['update-capability']({
  endpoint: "ai/generate",
  incrementUsage: true,
  updateSuccess: true
});

// Add an example
await cell.mesh.skills['update-capability']({
  endpoint: "memory/store",
  addExample: '{ "layer": "goals", "content": "Ship v2.0" }'
});
```

---

### `skills/learn-pattern`
Learn a new behavioral pattern from observation.

**Input**:
```typescript
{
  pattern: string;      // Pattern name
  description: string;  // What it does
  example: string;      // Example usage
}
```

**Example**:
```typescript
// Learn a workflow pattern
await cell.mesh.skills['learn-pattern']({
  pattern: "deploy-workflow",
  description: "Standard deployment sequence",
  example: "architect/consult → projects/write → projects/exec → log/info"
});
```

---

### `skills/sync-from-mesh`
Auto-discover new capabilities from live mesh topology.

**Output**:
```typescript
{
  discovered: number;  // New capabilities found
  updated: number;     // Existing capabilities updated
}
```

**Example**:
```typescript
// Manually trigger discovery
const result = await cell.mesh.skills['sync-from-mesh']();
console.log(`Found ${result.discovered} new capabilities`);
```

**Note**: This runs automatically every minute to keep the registry fresh.

---

## Usage Patterns

### For AI Systems

The Skills System is designed to provide AI systems with comprehensive context about what they can do:

```typescript
// In Kindly cell or any AI-powered cell
const skillsContext = await cell.mesh.skills['get-context']({
  includeExamples: true
});

const systemInstruction = `
SYSTEM CAPABILITIES:
${skillsContext.markdown}

CURRENT TASK: ${userRequest}

Use the capabilities above to accomplish the task.
Always check capability availability before suggesting actions.
`;

const response = await cell.mesh.ai.generate({
  prompt: userRequest,
  systemInstruction
});
```

### For Workflow Discovery

Find relevant capabilities for a specific task:

```typescript
// User wants to "track project milestones"
const relevant = await cell.mesh.skills.search({
  query: "track milestones goals progress",
  limit: 5
});

// Suggest workflow
const workflow = relevant.results.map(r => r.endpoint).join(' → ');
console.log(`Suggested workflow: ${workflow}`);
```

### For Learning from Usage

Track and learn from successful patterns:

```typescript
// After successful operation
await cell.mesh.skills['update-capability']({
  endpoint: "architect/consult",
  incrementUsage: true,
  updateSuccess: true
});

// Learn the pattern
if (operationsChain.length > 2) {
  await cell.mesh.skills['learn-pattern']({
    pattern: operationsChain.map(op => op.name).join('-'),
    description: `Successful ${operationsChain[0].name} workflow`,
    example: operationsChain.map(op => op.endpoint).join(' → ')
  });
}
```

---

## Data Storage

### `skills.json`
Structured capability registry with metadata:

```json
{
  "name": "Task Management",
  "description": "Personal productivity and goal tracking",
  "capabilities": [
    {
      "endpoint": "list/add",
      "description": "Add new task or idea",
      "example": "{ \"text\": \"Deploy\", \"type\": \"task\" }",
      "tags": ["tasks", "productivity"],
      "addedAt": 1234567890,
      "usageCount": 42,
      "lastUsed": 1234567890,
      "successRate": 0.95
    }
  ]
}
```

### `learned_capabilities.json`
Observed behavioral patterns:

```json
{
  "pattern": "research-and-implement",
  "description": "Pattern for implementing new features",
  "examples": [
    "architect/consult → ai/generate → projects/write",
    "skills/search → ai/generate → projects/exec"
  ],
  "frequency": 15,
  "firstSeen": 1234567890,
  "lastSeen": 1234567890
}
```

---

## Integration Examples

### Kindly Integration (Memory-Aware Chat)

```typescript
// In kindly/index.ts
const skillsContext = await cell.mesh.skills['get-context']({
  includeExamples: false
});

const temporalContext = await cell.mesh.memory['get-session']({
  userId: user.id
});

const systemInstruction = `
${skillsContext.markdown}

TEMPORAL CONTEXT:
- Session memories: ${temporalContext.memories.length}
- Active goals: ${temporalContext.activeGoals.join(', ')}

You can use any capability listed above to help the user.
Reference past conversations and suggest relevant actions.
`;
```

### Architect Integration (Plan Generation)

```typescript
// In architect/index.ts
const relevantSkills = await cell.mesh.skills.search({
  query: userGoal,
  limit: 10
});

const availableTools = relevantSkills.results
  .map(r => `- ${r.endpoint}: ${r.description}`)
  .join('\n');

const prompt = `
OBJECTIVE: ${userGoal}

AVAILABLE TOOLS:
${availableTools}

CODEBASE:
${codeContext}

Create a concrete plan using ONLY the tools listed above.
`;
```

### Auto-Discovery Hook

The Skills cell automatically discovers new capabilities when cells join the mesh:

```typescript
// Runs every 60 seconds
const result = await cell.mesh.skills['sync-from-mesh']();

if (result.discovered > 0) {
  // New capabilities found!
  // They're automatically categorized and documented
}
```

---

## Benefits

1. **Self-Documenting**: System knows what it can do
2. **AI Context**: Provides structured knowledge to AI systems
3. **Pattern Learning**: Learns from successful workflows
4. **Discovery**: Auto-finds new capabilities as mesh grows
5. **Search**: Natural language capability discovery
6. **Analytics**: Tracks usage and success rates

---

## Future Enhancements

- **Capability Versioning**: Track API changes over time
- **Performance Metrics**: Monitor latency and throughput
- **Dependency Graphs**: Visualize capability relationships
- **Auto-Documentation**: Generate full API docs from contracts
- **Recommendation Engine**: Suggest optimal capability chains
- **Capability Health**: Monitor and alert on degraded capabilities

---

## See Also

- [Memory System](../memory/README.md) - Temporal memory and pattern detection
- [Codegen](../codegen/README.md) - Type generation from live mesh
- [Architect](../architect/README.md) - Strategic planning with capability awareness