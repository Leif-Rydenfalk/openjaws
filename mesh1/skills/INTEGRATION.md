# Skills System Integration Examples

This document shows how to integrate the Skills System into various cells.

## Integration Pattern

The Skills System should be integrated into any cell that:
1. Makes decisions about which capabilities to use
2. Provides AI assistance
3. Plans or orchestrates workflows
4. Needs to discover available operations

## Example 1: Kindly Cell Integration

Add capability awareness to the conversational AI:

```typescript
// In kindly/index.ts - inside the chat mutation

// ============================================================================
// SKILLS SYSTEM INTEGRATION
// ============================================================================

let skillsContext = "";
try {
    // Get relevant capabilities for this conversation
    const relevant = await cell.mesh.skills.search({
        query: message,
        limit: 5
    });
    
    if (relevant.results.length > 0) {
        skillsContext = `\n**CAPABILITIES RELEVANT TO YOUR QUERY:**\n`;
        relevant.results.forEach(r => {
            skillsContext += `- ${r.endpoint}: ${r.description}\n`;
            if (r.example) {
                skillsContext += `  Example: ${r.example}\n`;
            }
        });
        skillsContext += `\nYou can use these capabilities to help the user.\n`;
    }
    
    // For admin users, provide full context
    if (userContext.role === "admin") {
        const fullSkills = await cell.mesh.skills['get-context']({
            includeExamples: false
        });
        skillsContext += `\nTotal capabilities available: ${fullSkills.capabilities}\n`;
    }
} catch (e) {
    // Skills system might not be available yet
    skillsContext = "\n**CAPABILITIES:** Initializing...\n";
}

// Add to system instruction
const systemInstruction = `
SYSTEM: OpenJaws Mesh OS
${skillsContext}

TEMPORAL_CONTEXT:
${temporalContext}

${roleInstruction}

You have access to the capabilities listed above. Reference them when suggesting actions.
`;
```

## Example 2: Architect Cell Integration

Make the Architect aware of available tools:

```typescript
// In architect/index.ts - inside the consult mutation

// Get available capabilities
const skillsSearch = await cell.mesh.skills.search({
    query: input.goal,
    limit: 10
});

let capabilitiesContext = "\n**AVAILABLE MESH CAPABILITIES:**\n";
skillsSearch.results.forEach(cap => {
    capabilitiesContext += `- ${cap.endpoint}: ${cap.description}\n`;
    if (cap.example) {
        capabilitiesContext += `  Example: ${cap.example}\n`;
    }
});

// Include in planning prompt
const prompt = `
OBJECTIVE: ${input.goal}

${capabilitiesContext}

CODEBASE:
${codeContext}

Create a plan using ONLY the capabilities listed above.
Each step should reference a specific capability endpoint.
`;

const aiRes = await cell.mesh.ai.generate({
    prompt,
    systemInstruction: `You are a strategic planner with access to specific mesh capabilities. 
    Use only the capabilities provided. Each step must use a concrete endpoint.`
});
```

## Example 3: Usage Tracking

Track capability usage for analytics:

```typescript
// After successful operation
async function trackCapabilityUsage(endpoint: string, success: boolean) {
    try {
        await cell.mesh.skills['update-capability']({
            endpoint,
            incrementUsage: true,
            updateSuccess: success
        });
    } catch (e) {
        // Skills tracking is non-critical
    }
}

// In any cell making mesh calls
try {
    const result = await cell.mesh.ai.generate({ prompt });
    await trackCapabilityUsage("ai/generate", true);
    return result;
} catch (e) {
    await trackCapabilityUsage("ai/generate", false);
    throw e;
}
```

## Example 4: Pattern Learning

Learn from successful workflows:

```typescript
// After completing a multi-step operation
async function learnWorkflowPattern(steps: string[], description: string) {
    if (steps.length < 2) return; // Need at least 2 steps to be a pattern
    
    const pattern = steps.join('-');
    const example = steps.join(' → ');
    
    try {
        await cell.mesh.skills['learn-pattern']({
            pattern,
            description,
            example
        });
    } catch (e) {
        // Pattern learning is non-critical
    }
}

// Usage
const operations = [
    { endpoint: "architect/consult", description: "Generated plan" },
    { endpoint: "projects/write", description: "Created implementation" },
    { endpoint: "projects/exec", description: "Executed tests" },
    { endpoint: "log/info", description: "Logged success" }
];

await learnWorkflowPattern(
    operations.map(op => op.endpoint),
    "Feature implementation workflow"
);
```

## Example 5: Dynamic UI Generation

Use skills to generate dynamic interfaces:

```typescript
// In UI code (e.g., Svelte component)
import { onMount } from 'svelte';

let capabilities = [];
let categories = {};

onMount(async () => {
    const response = await fetch('/_mesh/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            capability: 'skills/list',
            args: {}
        })
    });
    
    const result = await response.json();
    if (result.ok) {
        categories = result.value.categories;
        
        // Generate dynamic menu
        categories.forEach(category => {
            console.log(`Category: ${category.name}`);
            category.capabilities.forEach(cap => {
                console.log(`  - ${cap.endpoint}`);
            });
        });
    }
});
```

## Example 6: Auto-Documentation

Generate API documentation from skills:

```typescript
// In a documentation generator cell
const fullContext = await cell.mesh.skills['get-context']({
    includeExamples: true
});

// Write to file
await cell.mesh.projects.write({
    path: "docs/API.md",
    content: fullContext.markdown
});

// Or serve via HTTP
app.get('/api/docs', async (req, res) => {
    const context = await cell.mesh.skills['get-context']({
        includeExamples: true
    });
    res.send(context.markdown);
});
```

## Example 7: Capability Health Monitoring

Monitor capability success rates:

```typescript
// In a monitoring cell
setInterval(async () => {
    const skills = await cell.mesh.skills.list({});
    
    const unhealthy = [];
    for (const category of skills.categories) {
        for (const cap of category.capabilities) {
            if (cap.usageCount > 10 && cap.successRate < 0.8) {
                unhealthy.push({
                    endpoint: cap.endpoint,
                    successRate: cap.successRate,
                    usageCount: cap.usageCount
                });
            }
        }
    }
    
    if (unhealthy.length > 0) {
        await cell.mesh.log.info({
            msg: `⚠️  ${unhealthy.length} capabilities below 80% success rate`,
            from: "health-monitor"
        });
    }
}, 60000); // Check every minute
```

## Best Practices

1. **Always handle failures gracefully** - Skills system is non-critical
2. **Cache context when possible** - Don't fetch on every request
3. **Update usage stats** - Help the system learn what works
4. **Search before listing** - More efficient for specific needs
5. **Learn patterns** - Contribute to collective knowledge
6. **Check availability** - Don't assume capabilities exist

## Anti-Patterns

❌ **Don't block on Skills System**
```typescript
// Bad: Blocks if skills unavailable
const skills = await cell.mesh.skills.list({});
// Continue processing...
```

✅ **Do handle gracefully**
```typescript
// Good: Continues even if skills unavailable
const skills = await cell.mesh.skills.list({}).catch(() => ({ categories: [], totalCapabilities: 0 }));
// Continue processing...
```

❌ **Don't fetch full context repeatedly**
```typescript
// Bad: Fetches 10KB+ on every chat message
for (const message of messages) {
    const context = await cell.mesh.skills['get-context']({ includeExamples: true });
    // Use context...
}
```

✅ **Do cache and search**
```typescript
// Good: Search for relevant subset
for (const message of messages) {
    const relevant = await cell.mesh.skills.search({ query: message, limit: 3 });
    // Use relevant.results...
}
```

---

## Summary

The Skills System is designed to be:
- **Non-intrusive**: Optional, fails gracefully
- **Self-maintaining**: Auto-discovers new capabilities
- **AI-friendly**: Provides structured context
- **Learning**: Tracks usage and patterns
- **Searchable**: Natural language queries

Integrate it wherever you need to know "what can this system do?"