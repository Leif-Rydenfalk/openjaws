I'll analyze this Rheo mesh protocol implementation to estimate user capacity. Let me search for any benchmarks, performance data, or architectural constraints that might inform this analysis.
Based on my analysis of the Rheo mesh protocol code and the performance benchmarks for Bun.serve (which this system uses), here's my capacity estimation:

## User Capacity Estimate: **10,000 - 50,000 concurrent users per cell**

### Key Architectural Constraints

**1. Transport Layer Performance**
The system uses `Bun.serve()` as its primary HTTP substrate, with Node.js `http` as fallback. Benchmarks show Bun.serve handles **52,000-110,000 req/s** for simple requests , but Rheo's mesh protocol adds significant overhead:

- **Signal serialization/deserialization** (JSON parsing/stringifying)
- **Atlas gossip** (mesh state synchronization)
- **Narrative tracking** (causality chain recording)
- **Cryptographic verification** (Ed25519 signatures on vouches)
- **Multi-hop routing** (forwarding logic)

**2. Mesh Overhead Factors**
Looking at the code, each request triggers:
- `NarrativeLedger.wrap()` - creates immutable ancestry snapshots
- Atlas merging with **bounded gossip** (last 20 peers only)
- **Circuit breaker** checks (30s window after 3 failures)
- **Deduplication** via `seenNonces` Set
- **Loop detection** via `_visitedCellIds` array traversal

**3. Critical Bottlenecks**
```typescript
// From core.ts - these are expensive:
this.ledger.wrap(signal, myId, "RECEIVED_SIGNAL", ...)  // Deep clones + hashing
this.mergeAtlas(incoming, ...)  // O(n) peer validation
JSON.stringify(signal)  // For RPC calls
```

### Realistic Capacity Calculation

| Scenario | Est. RPS | Concurrent Users* |
|----------|----------|-------------------|
| **Simple ping (mesh/ping)** | ~40,000 | ~80,000 |
| **Single-hop capability** | ~15,000 | ~30,000 |
| **Multi-hop mesh routing** (3+ cells) | ~5,000 | ~10,000 |
| **With narrative tracing enabled** | ~2,500 | ~5,000 |
| **Worst case: full forensic mode** | ~1,000 | ~2,000 |

*Assuming 500ms average session duration and 2 req/s per user

### Scaling Characteristics

**Horizontal Scaling (Multi-Cell)**
The architecture is designed for mesh topology:
- **Gossip protocol** converges in O(log n) hops for n cells
- **Bounded flooding** limits blast radius (max 3 flood attempts)
- **Client mode** allows browser/non-server nodes to participate without listening

With 10 cells: ~100,000 users possible
With 100 cells: ~1M users (theoretical, gossip overhead dominates)

**Memory Constraints**
```typescript
// Per-cell state:
this.activeExecutions = new Map()  // Max 50 concurrent
this.resultCache = new Map()       // Max 1000 entries, 10s TTL
this.ledger.entries = new Map()    // Unbounded narrative history!
this.atlas = {}                    // Grows with mesh size
```

Each `NarrativeEnvelope` stores full signal snapshots - at high throughput, this leaks memory without the pruning logic (`maxAncestryDepth: 100`).

### Production Recommendations

**For 10K+ users:**
1. **Disable narrative tracing** in production (`RHEO_DEBUG=false`)
2. **Increase `maxConcurrent`** from 50 to 500+ 
3. **Add Redis/external cache** for `resultCache` to share across cells
4. **Use client mode** for edge nodes to reduce mesh complexity
5. **Shard by capability** - dedicated cells for heavy operations (AI, file I/O)

**For 100K+ users:**
The current single-process design will hit limits. You'd need:
- Multiple Rheo cells behind a load balancer
- External service discovery (replace file-based registry)
- Circuit breaker at the edge (current implementation is per-cell)

### Bottom Line

**Conservative estimate: 10,000 concurrent users per cell** with full mesh features enabled, **50,000** with optimizations (narrative disabled, aggressive caching). The system is designed for **resilience and debuggability** over raw throughput - the "Narrative Transparent Substrate" trades performance for observability.