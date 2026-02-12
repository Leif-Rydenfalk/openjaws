import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const cell = new TypedRheoCell(`Prediction_${process.pid}`, 0);
const GAMMA_API = "https://gamma-api.polymarket.com";

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const cache: Map<string, CacheEntry<any>> = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for trending data

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
    }
    cache.delete(key);
    return null;
}

function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL) {
    cache.set(key, {
        data,
        expiresAt: Date.now() + ttl
    });
}

// ============================================================================
// DATA ENRICHMENT
// ============================================================================

function enrichEvent(event: any): any {
    // Calculate total volume across all markets
    let totalVolume = 0;
    if (event.markets && Array.isArray(event.markets)) {
        for (const market of event.markets) {
            const vol = parseFloat(market.volume || "0");
            totalVolume += vol;
        }
    }

    // Use existing volumeNum or calculate it
    const volumeNum = event.volumeNum ? parseFloat(event.volumeNum) : totalVolume;

    return {
        ...event,
        volumeNum: volumeNum.toString(),
        volumeNumeric: volumeNum,
        marketCount: event.markets?.length || 0,
        // Add computed fields
        isHighVolume: volumeNum > 100000,
        isMediumVolume: volumeNum > 10000 && volumeNum <= 100000,
        isLowVolume: volumeNum <= 10000,
        // Parse end date
        endDateMs: event.endDate ? new Date(event.endDate).getTime() : null,
        isEndingSoon: event.endDate ? (new Date(event.endDate).getTime() - Date.now()) < (7 * 24 * 60 * 60 * 1000) : false
    };
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchWithRetry(url: string, retries: number = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return await res.json();
        } catch (e) {
            if (i === retries - 1) throw e;
            cell.log("WARN", `Fetch failed, retrying... (${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

// ============================================================================
// ROUTER
// ============================================================================

const predictionRouter = router({
    prediction: router({
        getTrending: procedure
            .input(z.object({
                limit: z.number().default(20),
                offset: z.number().default(0),
                minVolume: z.number().default(0), // NEW: Filter by volume
                sortBy: z.enum(["volume", "recent", "ending_soon"]).default("recent") // NEW: Sort options
            }))
            .output(z.array(z.any()))
            .query(async (input) => {
                const cacheKey = `trending_${input.limit}_${input.offset}_${input.minVolume}_${input.sortBy}`;
                const cached = getCached<any[]>(cacheKey);
                if (cached) {
                    cell.log("INFO", `♻️  Cache hit for getTrending (${cached.length} events)`);
                    return cached;
                }

                cell.log("INFO", `📥 Fetching events from Polymarket API (limit=${input.limit}, offset=${input.offset})...`);

                // For volume sorting, we need to fetch more and sort client-side
                // since the API doesn't support direct volume sorting
                const fetchLimit = input.sortBy === "volume" ? Math.min(input.limit * 5, 500) : Math.min(input.limit, 500);

                const params = new URLSearchParams({
                    limit: fetchLimit.toString(),
                    offset: input.offset.toString(),
                    closed: "false",
                    // Don't sort by ID when we want volume - we'll sort client-side
                    ...(input.sortBy !== "volume" && {
                        order: "id",
                        ascending: "false"
                    })
                });

                const events = await fetchWithRetry(`${GAMMA_API}/events?${params.toString()}`);

                cell.log("INFO", `📦 Received ${events.length} events from API`);

                // Enrich events with computed fields
                let enriched = events.map(enrichEvent);

                // Filter by volume
                if (input.minVolume > 0) {
                    enriched = enriched.filter((e: any) => e.volumeNumeric >= input.minVolume);
                    cell.log("INFO", `   🔍 Filtered to ${enriched.length} events with volume >= $${input.minVolume}`);
                }

                // Sort
                if (input.sortBy === "volume") {
                    enriched.sort((a: any, b: any) => b.volumeNumeric - a.volumeNumeric);
                    enriched = enriched.slice(0, input.limit); // Limit after sorting
                } else if (input.sortBy === "ending_soon") {
                    enriched = enriched.filter((e: any) => e.endDateMs !== null);
                    enriched.sort((a: any, b: any) => a.endDateMs - b.endDateMs);
                    enriched = enriched.slice(0, input.limit);
                } else {
                    // For recent, already sorted by ID descending from API
                    enriched = enriched.slice(0, input.limit);
                }

                // Log volume stats
                if (enriched.length > 0) {
                    const volumes = enriched.map((e: any) => e.volumeNumeric);
                    const total = volumes.reduce((a, b) => a + b, 0);
                    const avg = total / volumes.length;
                    const max = Math.max(...volumes);
                    const min = Math.min(...volumes);

                    cell.log("INFO", `   💰 Volume stats: Min=$${min.toFixed(0)}, Max=$${max.toFixed(0)}, Avg=$${avg.toFixed(0)}, Total=$${(total / 1e6).toFixed(1)}M`);
                }

                setCache(cacheKey, enriched);
                return enriched;
            }),

        search: procedure
            .input(z.object({
                query: z.string(),
                minVolume: z.number().default(0)
            }))
            .output(z.array(z.any()))
            .query(async (input) => {
                cell.log("INFO", `🔍 Searching for: "${input.query}"`);

                const events = await fetchWithRetry(`${GAMMA_API}/events?closed=false&limit=500&order=id&ascending=false`);

                let enriched = events.map(enrichEvent);

                // Filter by query
                const query = input.query.toLowerCase();
                enriched = enriched.filter((e: any) =>
                    e.title?.toLowerCase().includes(query) ||
                    e.description?.toLowerCase().includes(query)
                );

                // Filter by volume
                if (input.minVolume > 0) {
                    enriched = enriched.filter((e: any) => e.volumeNumeric >= input.minVolume);
                }

                cell.log("INFO", `   ✅ Found ${enriched.length} matching events`);
                return enriched;
            }),

        // NEW: Get single event by ID
        getEvent: procedure
            .input(z.object({
                eventId: z.string()
            }))
            .output(z.any())
            .query(async (input) => {
                const cacheKey = `event_${input.eventId}`;
                const cached = getCached<any>(cacheKey);
                if (cached) {
                    return cached;
                }

                cell.log("INFO", `📥 Fetching event ${input.eventId}...`);
                const event = await fetchWithRetry(`${GAMMA_API}/events/${input.eventId}`);
                const enriched = enrichEvent(event);

                setCache(cacheKey, enriched, 5 * 60 * 1000); // Cache for 5 minutes
                return enriched;
            }),

        // NEW: Get high-volume markets only
        getHighVolume: procedure
            .input(z.object({
                minVolume: z.number().default(50000),
                limit: z.number().default(50)
            }))
            .output(z.array(z.any()))
            .query(async (input) => {
                cell.log("INFO", `💎 Fetching high-volume markets (>$${input.minVolume})...`);

                // Fetch more to ensure we get enough high-volume ones
                const events = await fetchWithRetry(
                    `${GAMMA_API}/events?limit=500&offset=0&closed=false&order=id&ascending=false`
                );

                let enriched = events.map(enrichEvent);

                // Filter by volume
                enriched = enriched.filter((e: any) => e.volumeNumeric >= input.minVolume);

                // Sort by volume descending
                enriched.sort((a: any, b: any) => b.volumeNumeric - a.volumeNumeric);

                // Limit
                enriched = enriched.slice(0, input.limit);

                cell.log("INFO", `   ✅ Found ${enriched.length} high-volume markets`);
                return enriched;
            }),

        // NEW: Get statistics about the market
        getStats: procedure
            .input(z.object({
                sampleSize: z.number().default(500)
            }))
            .output(z.object({
                totalMarkets: z.number(),
                volumeDistribution: z.object({
                    under1k: z.number(),
                    under10k: z.number(),
                    under100k: z.number(),
                    under1m: z.number(),
                    over1m: z.number()
                }),
                totalVolume: z.number(),
                averageVolume: z.number(),
                medianVolume: z.number(),
                highVolumeCount: z.number(),
                sampleSize: z.number()
            }))
            .query(async (input) => {
                cell.log("INFO", `📊 Computing market statistics (sample=${input.sampleSize})...`);

                const events = await fetchWithRetry(
                    `${GAMMA_API}/events?limit=${input.sampleSize}&offset=0&closed=false&order=id&ascending=false`
                );

                const enriched = events.map(enrichEvent);
                const volumes = enriched.map((e: any) => e.volumeNumeric).sort((a, b) => a - b);

                const distribution = {
                    under1k: volumes.filter(v => v < 1000).length,
                    under10k: volumes.filter(v => v >= 1000 && v < 10000).length,
                    under100k: volumes.filter(v => v >= 10000 && v < 100000).length,
                    under1m: volumes.filter(v => v >= 100000 && v < 1000000).length,
                    over1m: volumes.filter(v => v >= 1000000).length
                };

                const totalVolume = volumes.reduce((a, b) => a + b, 0);
                const averageVolume = totalVolume / volumes.length;
                const medianVolume = volumes[Math.floor(volumes.length / 2)];
                const highVolumeCount = enriched.filter((e: any) => e.isHighVolume).length;

                const stats = {
                    totalMarkets: enriched.length,
                    volumeDistribution: distribution,
                    totalVolume,
                    averageVolume,
                    medianVolume,
                    highVolumeCount,
                    sampleSize: input.sampleSize
                };

                cell.log("INFO", `   📊 Stats: ${stats.totalMarkets} markets, $${(stats.totalVolume / 1e6).toFixed(1)}M total volume`);
                cell.log("INFO", `   📊 Distribution: <$1k: ${distribution.under1k}, <$10k: ${distribution.under10k}, <$100k: ${distribution.under100k}, <$1M: ${distribution.under1m}, >$1M: ${distribution.over1m}`);

                return stats;
            }),

        // NEW: Clear cache (for debugging)
        clearCache: procedure
            .input(z.void())
            .output(z.object({
                cleared: z.number()
            }))
            .query(async () => {
                const count = cache.size;
                cache.clear();
                cell.log("INFO", `🗑️  Cleared ${count} cache entries`);
                return { cleared: count };
            })
    })
});

cell.useRouter(predictionRouter);
cell.listen();
cell.log("INFO", `📈 Prediction Market API initialized`);

export type PredictionRouter = typeof predictionRouter;