# Skills System - Quick Reference

## Basic Operations

### List All Capabilities
```typescript
const skills = await cell.mesh.skills.list({});
// Returns: { categories, totalCapabilities, lastUpdated }
```

### Search for Capabilities
```typescript
const results = await cell.mesh.skills.search({
    query: "memory temporal patterns",
    limit: 5
});
// Returns: { results: [...], total }
```

### Get AI Context
```typescript
const context = await cell.mesh.skills['get-context']({
    includeExamples: true
});
// Returns: { markdown, capabilities, relevantEndpoints }
```

## Filtering

### By Tags
```typescript
// Get all AI-related capabilities
const aiSkills = await cell.mesh.skills.list({
    tags: ["ai"]
});

// Get memory capabilities
const memorySkills = await cell.mesh.skills.list({
    tags: ["memory", "temporal"]
});
```

### By Category
```typescript
// Get task management capabilities
const taskSkills = await cell.mesh.skills.list({
    category: "Task Management"
});
```

## Tracking & Learning

### Track Usage
```typescript
// After successful operation
await cell.mesh.skills['update-capability']({
    endpoint: "ai/generate",
    incrementUsage: true,
    updateSuccess: true
});
```

### Learn Pattern
```typescript
// After multi-step workflow
await cell.mesh.skills['learn-pattern']({
    pattern: "deploy-workflow",
    description: "Standard deployment sequence",
    example: "architect/consult → projects/write → projects/exec"
});
```

### Add Example
```typescript
await cell.mesh.skills['update-capability']({
    endpoint: "memory/store",
    addExample: '{ "layer": "goals", "content": "Ship v2.0" }'
});
```

## Synchronization

### Manual Sync
```typescript
const result = await cell.mesh.skills['sync-from-mesh']();
console.log(`Discovered ${result.discovered} new capabilities`);
```

**Note**: Auto-sync runs every 60 seconds automatically.

## Common Patterns

### For AI Integration
```typescript
// Get relevant capabilities for user query
const relevant = await cell.mesh.skills.search({
    query: userMessage,
    limit: 5
});

// Build system prompt
const systemPrompt = `
Available tools:
${relevant.results.map(r => `- ${r.endpoint}: ${r.description}`).join('\n')}
`;
```

### For Planning
```typescript
// Find capabilities for specific task
const tools = await cell.mesh.skills.search({
    query: "write code execute test",
    limit: 10
});

// Build execution plan
const plan = tools.results.map(t => t.endpoint).join(' → ');
```

### For Documentation
```typescript
// Generate full docs
const docs = await cell.mesh.skills['get-context']({
    includeExamples: true
});

// Write to file
await cell.mesh.projects.write({
    path: "API.md",
    content: docs.markdown
});
```

## Error Handling

All Skills operations should handle failures gracefully:

```typescript
// Good: Non-blocking
const skills = await cell.mesh.skills.list({})
    .catch(() => ({ categories: [], totalCapabilities: 0 }));

// Bad: Blocking
const skills = await cell.mesh.skills.list({}); // Throws if unavailable
```

## Default Categories

The Skills System includes these default categories:

1. **Core Mesh Operations** - Health, ping, directory
2. **AI Generation** - Gemini integration
3. **Task Management** - Lists, goals, completion
4. **Memory System** - Temporal storage, search, patterns
5. **Project Management** - Files, execution
6. **Conversational Interface** - Context-aware chat
7. **System Logging** - Audit trail
8. **Strategic Planning** - High-level decision making

## Tags

Common tags for filtering:
- `ai` - AI-powered capabilities
- `memory` - Memory and learning
- `temporal` - Time-aware operations
- `tasks` - Task management
- `productivity` - Personal productivity
- `files` - File operations
- `code` - Code execution
- `logging` - System logging
- `monitoring` - Health checks
- `planning` - Strategic planning

## Endpoints Summary

### Most Used Endpoints
- `skills/list` - Browse capabilities
- `skills/search` - Find relevant tools
- `skills/get-context` - AI documentation
- `skills/update-capability` - Track usage
- `skills/sync-from-mesh` - Discover new capabilities

### Less Common
- `skills/learn-pattern` - Record workflows
- Filtering by tags/category - Specific queries

## Performance Tips

1. **Cache context** - Don't fetch on every request
2. **Use search** - More efficient than listing all
3. **Limit results** - Default to 5-10 items
4. **Batch updates** - Update metadata in batches
5. **Trust auto-sync** - Manual sync rarely needed

## Debugging

Check Skills System status:
```typescript
const skills = await cell.mesh.skills.list({});
console.log({
    totalCapabilities: skills.totalCapabilities,
    categories: skills.categories.length,
    lastUpdated: new Date(skills.lastUpdated)
});
```

Search with verbose output:
```typescript
const results = await cell.mesh.skills.search({
    query: "your query",
    limit: 10
});

results.results.forEach(r => {
    console.log(`
    Endpoint: ${r.endpoint}
    Score: ${r.score}
    Category: ${r.category}
    Description: ${r.description}
    `);
});
```

## Integration Checklist

When integrating Skills into a cell:

- [ ] Add search for relevant capabilities
- [ ] Track usage after operations
- [ ] Learn patterns from workflows
- [ ] Handle failures gracefully
- [ ] Cache context when possible
- [ ] Use specific filters (tags/category)
- [ ] Update examples when useful
- [ ] Monitor success rates

---

For detailed documentation, see:
- [OVERVIEW.md](./OVERVIEW.md) - System architecture
- [README.md](./README.md) - Full API documentation
- [INTEGRATION.md](./INTEGRATION.md) - Integration examples