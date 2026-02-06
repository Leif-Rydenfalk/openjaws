# UI IMPLEMENTATION GUIDE

## Problems Fixed

### 1. **Bridge Cell Not Binding to Port**
**Before:** Cell had `port: 0` in manifest (ghost mode)
**After:** Cell calls `listen()` immediately to bind a port

### 2. **No Type Safety in UI**
**Before:** Manual type definitions, error-prone
**After:** Auto-imports from `protocols/typed-mesh` with full autocomplete

### 3. **Poor Error Handling**
**Before:** Silent failures, no retry logic
**After:** Status endpoint, retry logic, detailed error messages

---

## Files Updated

1. **ui/src/hooks.server.ts** - Proper cell initialization
2. **ui/src/lib/typed-mesh-runtime.ts** - Type-safe mesh client
3. **ui/src/routes/+page.svelte** - Better error handling & retry logic
4. **ui/src/app.d.ts** - TypeScript definitions for locals
5. **ui/src/routes/debug/+page.svelte** - Diagnostic page

---

## Key Changes

### hooks.server.ts

```typescript
// ✅ BEFORE: Ghost mode (port: 0)
const cell = new TypedRheoCell(...);
// No listen() call - cell never binds

// ✅ AFTER: Proper initialization
const cell = new TypedRheoCell(...);
cell.listen(); // Binds to a port immediately
cell.bootstrapFromRegistry(true); // Finds peers
```

### typed-mesh-runtime.ts

```typescript
// ✅ Uses auto-generated types
import type { 
    MeshCapabilities, 
    ValidCapability 
} from '../../../protocols/typed-mesh';

// ✅ Full type inference
const items = await mesh.list.get();
//    ^? { items: ListItem[], capacity: number, date: string }
```

### +page.svelte

```typescript
// ✅ Retry logic
if (!meshStatus || meshStatus.atlasSize <= 1) {
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(loadData, 2000); // Retry
    }
}

// ✅ Better error messages
catch (e) {
    errorMessage = `Failed: ${err.message}`;
}
```

---

## Testing Steps

### 1. Check Bridge Cell Status

Visit: `http://localhost:5174/_mesh/status`

Should return:
```json
{
  "cellId": "SvelteKit_Bridge_12345",
  "address": "http://localhost:XXXXX",
  "atlasSize": 6,
  "capabilities": [...],
  "peers": ["AI_12345", "Checklist_12345", ...]
}
```

**If `address` is null or `atlasSize` is 1:**
- Bridge cell didn't bind to a port
- Check console for errors
- Make sure `cell.listen()` is called

### 2. Check Debug Page

Visit: `http://localhost:5174/debug`

Should show:
- ✅ Bridge cell with valid address
- ✅ Atlas size > 1
- ✅ All capability tests passing

**If tests fail:**
- Check that cells are actually running: `ps aux | grep bun`
- Check orchestrator logs: `tail -f .rheo/logs/Orchestrator_*.log`
- Verify registry has entries: `ls .rheo/registry/`

### 3. Test Main UI

Visit: `http://localhost:5174/`

Should show:
- Mesh status: NOMINAL
- Active cells count
- Checklist loading
- Logs appearing

**If stuck on "Connecting to mesh":**
1. Open browser console (F12)
2. Check for errors
3. Visit `/debug` to see what's failing
4. Check network tab for `/_mesh/call` requests

---

## Common Issues

### Issue: "Mesh not converged"

**Symptoms:**
- UI shows "Connecting to mesh..."
- Atlas size is 1 or 0
- No peers found

**Fix:**
```bash
# 1. Check if cells are running
ps aux | grep bun

# 2. Check registry
ls -la .rheo/registry/

# 3. Restart orchestrator
bun run orchestrator/index.ts start

# 4. Wait 10 seconds for convergence
sleep 10

# 5. Check UI debug page
curl http://localhost:5174/_mesh/status
```

### Issue: "Property does not exist on type MeshProxy"

**Symptoms:**
- TypeScript errors in UI
- No autocomplete

**Fix:**
1. Check `mesh-types.d.ts` exists in project root
2. Verify it has capability declarations
3. Restart VS Code TypeScript server
4. Make sure codegen cell ran: `tail -f .rheo/logs/Codegen_*.log`

### Issue: "Connection refused"

**Symptoms:**
- Bridge cell not responding
- `_mesh/status` returns 404

**Fix:**
1. Check SvelteKit is running: `lsof -i :5174`
2. Check hooks.server.ts is loaded (add console.log)
3. Verify cell initialized: look for "MeshBridge] Cell initialized" in console
4. Make sure `cell.listen()` is called

---

## Architecture

```
User Browser
    ↓
    GET http://localhost:5174/
    ↓
SvelteKit (Vite Dev Server)
    ↓
hooks.server.ts initializes TypedRheoCell
    ↓
    cell.listen() → binds to random port
    cell.bootstrapFromRegistry() → finds peers
    ↓
Bridge cell joins mesh
    ↓
User clicks button → POST /_mesh/call
    ↓
hooks.server.ts intercepts
    ↓
await cell.askMesh(capability, args)
    ↓
Routes through mesh to target cell
    ↓
Response back to browser
    ↓
UI updates with typed data
```

---

## Type Safety Flow

```typescript
// 1. Backend cell defines schemas
procedure
    .input(z.object({ text: z.string() }))
    .output(z.object({ ok: z.boolean() }))

// 2. Codegen extracts to mesh-types.d.ts
"list/add": { 
    input: { text: string }, 
    output: { ok: boolean } 
}

// 3. UI imports types
import type { MeshCapabilities } from '../../../protocols/typed-mesh'

// 4. Full autocomplete in UI
const result = await mesh.list.add({ text: "..." });
//    ^? { ok: boolean }

// 5. Compile errors on wrong input
await mesh.list.add({ txt: "typo" }); // ❌ Error!
```

---

## Debugging Commands

```bash
# Check if bridge cell is in atlas
curl http://localhost:5174/_mesh/status | jq

# Test a capability directly
curl -X POST http://localhost:5174/_mesh/call \
  -H "Content-Type: application/json" \
  -d '{"capability":"mesh/health","args":{}}'

# Check cell manifests
cat ui/SvelteKit_Bridge_*.cell.json

# Watch bridge logs (if using bun directly)
# SvelteKit logs go to console where you ran `bun run dev`

# Check registry
ls -la .rheo/registry/

# See all mesh cells
ps aux | grep -E "(ai1|checklist|log|telemetry|codegen)" | grep -v grep
```

---

## Success Criteria

✅ Bridge cell has `"port": XXXXX` (not 0)  
✅ `/_mesh/status` returns valid data  
✅ Debug page shows all tests passing  
✅ Main UI loads without errors  
✅ Autocomplete works in IDE  
✅ Can add/complete tasks  
✅ Logs appear  
✅ Mesh health shows NOMINAL  

---

## Next Steps

1. Replace `ui/src/hooks.server.ts`
2. Replace `ui/src/lib/typed-mesh-runtime.ts`
3. Replace `ui/src/routes/+page.svelte`
4. Add `ui/src/routes/debug/+page.svelte`
5. Update `ui/src/app.d.ts`
6. Restart SvelteKit: `bun run dev`
7. Visit `http://localhost:5174/debug` first
8. Check all tests pass
9. Visit main page

**Time to working UI: ~2 minutes**