# Skills System - System Capability Knowledge Base

The Skills System is OpenJaws' self-aware capability registry. It maintains a living knowledge base of what the mesh can do, learns from usage patterns, and provides AI systems with structured context about available operations.

## Quick Start

```typescript
// List all capabilities
const skills = await cell.mesh.skills.list({});
console.log(`System has ${skills.totalCapabilities} capabilities`);

// Search for relevant capabilities
const results = await cell.mesh.skills.search({
    query: "manage tasks and track progress",
    limit: 5
});

// Get AI-friendly context
const context = await cell.mesh.skills['get-context']({
    includeExamples: true
});

// Use in AI prompts
const response = await cell.mesh.ai.generate({
    prompt: userRequest,
    systemInstruction: context.markdown
});
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           Skills Cell                       │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Capability Registry                  │  │
│  │  • 50+ default capabilities           │  │
│  │  • Auto-discovered from mesh          │  │
│  │  • Usage statistics                   │  │
│  │  • Examples & documentation           │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Pattern Learning Engine              │  │
│  │  • Observes successful workflows      │  │
│  │  • Tracks frequency                   │  │
│  │  • Suggests optimizations             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  AI Context Generator                 │  │
│  │  • Markdown documentation             │  │
│  │  • Natural language search            │  │
│  │  • Relevance scoring                  │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         ↓                    ↑
         ↓                    ↑
    [Provides]          [Learns from]
         ↓                    ↑
┌────────────────────────────────────────────┐
│         Other Cells                        │
│  • Kindly (conversational AI)              │
│  • Architect (strategic planning)          │
│  • Coder (code generation)                 │
│  • Memory (temporal tracking)              │
└────────────────────────────────────────────┘
```

## Key Features

### 1. **Self-Documenting**
The system maintains its own knowledge base:
- Default capabilities for core mesh operations
- Auto-discovers new cells and capabilities
- Tracks metadata (usage, success rates, examples)
- Generates markdown documentation

### 2. **AI Context Provider**
Gives AI systems structured knowledge:
- Full capability documentation
- Relevant endpoint suggestions
- Usage examples and patterns
- Natural language search

### 3. **Pattern Learning**
Learns from successful operations:
- Tracks multi-step workflows
- Identifies recurring patterns
- Suggests optimizations
- Maintains frequency statistics

### 4. **Usage Analytics**
Monitors capability health:
- Call counts and success rates
- Last used timestamps
- Performance metrics
- Health warnings

### 5. **Auto-Discovery**
Stays in sync with mesh:
- Scans topology every minute
- Detects new capabilities
- Updates registry automatically
- Maintains fresh state

## Core Capabilities

### `skills/list`
List all capabilities, optionally filtered by category or tags.

### `skills/search`
Natural language search for relevant capabilities.

### `skills/get-context`
Generate AI-friendly documentation with examples.

### `skills/update-capability`
Track usage, success rates, and add examples.

### `skills/learn-pattern`
Record successful multi-step workflows.

### `skills/sync-from-mesh`
Manually trigger capability discovery.

See [README.md](./README.md) for detailed API documentation.

## Integration Points

### For AI Systems (Kindly, Architect)
```typescript
// Get relevant capabilities for current context
const relevant = await cell.mesh.skills.search({
    query: userMessage,
    limit: 5
});

// Include in AI system prompt
const systemInstruction = `
Available capabilities:
${relevant.results.map(r => `- ${r.endpoint}: ${r.description}`).join('\n')}

Use these to help the user.
`;
```

### For Monitoring Systems
```typescript
// Check capability health
const skills = await cell.mesh.skills.list({});
const unhealthy = skills.categories
    .flatMap(c => c.capabilities)
    .filter(cap => cap.usageCount > 10 && cap.successRate < 0.8);

if (unhealthy.length > 0) {
    console.warn(`${unhealthy.length} capabilities need attention`);
}
```

### For Documentation Generation
```typescript
// Generate full API docs
const context = await cell.mesh.skills['get-context']({
    includeExamples: true
});

await cell.mesh.projects.write({
    path: "docs/API.md",
    content: context.markdown
});
```

See [INTEGRATION.md](./INTEGRATION.md) for more examples.

## Data Storage

### `data/skills.json`
Structured capability registry:
```json
{
  "name": "Memory System",
  "description": "Temporal memory and pattern learning",
  "capabilities": [
    {
      "endpoint": "memory/store",
      "description": "Store memory in temporal layer",
      "example": "{ \"layer\": \"goals\", ... }",
      "tags": ["memory", "temporal"],
      "usageCount": 42,
      "successRate": 0.95
    }
  ]
}
```

### `data/learned_capabilities.json`
Observed behavioral patterns:
```json
{
  "pattern": "feature-implementation",
  "description": "Standard feature workflow",
  "examples": [
    "architect/consult → projects/write → projects/exec"
  ],
  "frequency": 15,
  "lastSeen": 1234567890
}
```

## Testing

Run the test suite:
```bash
bun run skills/test.ts
```

This will:
1. ✓ List all capabilities
2. ✓ Search by natural language
3. ✓ Generate AI context
4. ✓ Update metadata
5. ✓ Learn patterns
6. ✓ Sync from mesh
7. ✓ Filter by tags
8. ✓ Filter by category

## Configuration

The Skills cell is **critical** and runs with:
- Auto-discovery every 60 seconds
- Usage tracking on all operations
- Pattern learning threshold: 2+ steps
- Search result limit: 10 by default
- Context generation: ~10KB markdown

## Monitoring

Check Skills System health:
```typescript
const skills = await cell.mesh.skills.list({});
console.log(`
Capabilities: ${skills.totalCapabilities}
Categories: ${skills.categories.length}
Last updated: ${new Date(skills.lastUpdated).toLocaleString()}
`);
```

## Best Practices

1. **Use search before list** - More efficient for finding specific capabilities
2. **Cache context** - Don't fetch full documentation on every request
3. **Track usage** - Help the system learn what works
4. **Learn patterns** - Record successful multi-step workflows
5. **Handle failures** - Skills system is non-critical
6. **Filter intelligently** - Use tags and categories

## Future Enhancements

- [ ] Capability versioning and changelog
- [ ] Performance metrics (latency, throughput)
- [ ] Dependency graph visualization
- [ ] Auto-generated OpenAPI specs
- [ ] Recommendation engine
- [ ] Real-time health monitoring
- [ ] Machine learning for pattern detection
- [ ] Integration with external documentation

## Related Systems

- **Memory System**: Stores temporal context and learned behaviors
- **Codegen**: Generates TypeScript types from mesh topology
- **Architect**: Uses skills for strategic planning
- **Kindly**: Provides capability-aware conversational AI

---

**Status**: ✅ Operational  
**Version**: 1.0.0  
**Maintainer**: Skills Cell  
**Critical**: Yes  
**Auto-Discovery**: Enabled  
**Pattern Learning**: Enabled