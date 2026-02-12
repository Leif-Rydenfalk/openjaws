// prediction-analyst/index.ts - AI-Powered Prediction Market Analysis with Persistent Cache
import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";
import * as fs from "fs";
import * as path from "path";

const cell = new TypedRheoCell(`Analyst_${process.pid}`, 0);

// ============================================================================
// PERSISTENCE SETUP
// ============================================================================

const CACHE_DIR = path.join(process.cwd(), ".cache", "prediction-analyst");
const CACHE_FILE = path.join(CACHE_DIR, "analysis-cache.json");
const SEEN_MARKETS_FILE = path.join(CACHE_DIR, "seen-markets.json");

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ============================================================================
// TYPES
// ============================================================================

interface MarketAnalysis {
    eventId: string;
    title: string;
    description: string;
    odds: { yes: number; no: number };
    volume: number;

    // AI Analysis
    whatNeedsToHappen: string;
    baseRateAssessment: string;
    hiddenGotchas: string[];
    absurdityScore: number;      // 0-100
    recommendedAction: "BUY_YES" | "BUY_NO" | "AVOID" | "INVESTIGATE";
    confidenceScore: number;     // 0-100
    keyRisks: string[];
    expectedReturn: number;      // Calculated profit potential

    // Metadata
    analyzedAt: number;
    marketUrl?: string;
}

interface AnalysisCache {
    [eventId: string]: {
        analysis: MarketAnalysis;
        expiresAt: number;
    }
}

interface SeenMarkets {
    [eventId: string]: {
        firstSeen: number;
        lastChecked: number;
        analyzed: boolean;
    }
}

// ============================================================================
// PERSISTENT CACHE
// ============================================================================

let analysisCache: AnalysisCache = {};
let seenMarkets: SeenMarkets = {};
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const SEEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, "utf-8");
            analysisCache = JSON.parse(data);
            cell.log("INFO", `📂 Loaded ${Object.keys(analysisCache).length} cached analyses from disk`);
        }
    } catch (e) {
        cell.log("WARN", `Failed to load cache: ${e.message}`);
        analysisCache = {};
    }

    try {
        if (fs.existsSync(SEEN_MARKETS_FILE)) {
            const data = fs.readFileSync(SEEN_MARKETS_FILE, "utf-8");
            seenMarkets = JSON.parse(data);

            const now = Date.now();
            let cleaned = 0;
            for (const [id, info] of Object.entries(seenMarkets)) {
                if (now - info.lastChecked > SEEN_TTL) {
                    delete seenMarkets[id];
                    cleaned++;
                }
            }

            cell.log("INFO", `📂 Loaded ${Object.keys(seenMarkets).length} seen markets (cleaned ${cleaned} old entries)`);
        }
    } catch (e) {
        cell.log("WARN", `Failed to load seen markets: ${e.message}`);
        seenMarkets = {};
    }
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(analysisCache, null, 2));
        fs.writeFileSync(SEEN_MARKETS_FILE, JSON.stringify(seenMarkets, null, 2));
    } catch (e) {
        cell.log("ERROR", `Failed to save cache: ${e.message}`);
    }
}

setInterval(saveCache, 30 * 1000);

process.on("SIGINT", () => {
    cell.log("INFO", "💾 Saving cache before exit...");
    saveCache();
    process.exit(0);
});

process.on("SIGTERM", () => {
    cell.log("INFO", "💾 Saving cache before exit...");
    saveCache();
    process.exit(0);
});

function getCachedAnalysis(eventId: string): MarketAnalysis | null {
    const cached = analysisCache[eventId];
    if (cached && cached.expiresAt > Date.now()) {
        return cached.analysis;
    }
    return null;
}

function setCachedAnalysis(eventId: string, analysis: MarketAnalysis) {
    analysisCache[eventId] = {
        analysis,
        expiresAt: Date.now() + CACHE_TTL
    };

    if (seenMarkets[eventId]) {
        seenMarkets[eventId].analyzed = true;
        seenMarkets[eventId].lastChecked = Date.now();
    }

    saveCache();
}

function markMarketSeen(eventId: string) {
    const now = Date.now();
    if (!seenMarkets[eventId]) {
        seenMarkets[eventId] = {
            firstSeen: now,
            lastChecked: now,
            analyzed: false
        };
    } else {
        seenMarkets[eventId].lastChecked = now;
    }
}

function hasBeenAnalyzed(eventId: string): boolean {
    return seenMarkets[eventId]?.analyzed === true || !!getCachedAnalysis(eventId);
}

// ============================================================================
// IMPROVED AI ANALYSIS ENGINE
// ============================================================================

async function analyzeMarketWithAI(event: any): Promise<MarketAnalysis | null> {
    const eventId = event.id;

    markMarketSeen(eventId);

    const cached = getCachedAnalysis(eventId);
    if (cached) {
        cell.log("INFO", `♻️  Using cached analysis: ${event.title.substring(0, 50)}...`);
        return cached;
    }

    const firstMarket = event.markets?.[0];
    if (!firstMarket) return null;

    const prices = JSON.parse(firstMarket.outcomePrices || "[0.5, 0.5]");
    const yesPrice = parseFloat(prices[0] || 0);
    const noPrice = parseFloat(prices[1] || 0);
    const volume = parseFloat(event.volumeNum || "0");

    const prompt = `You are an expert prediction market analyst. Analyze this market for mispricing opportunities.

MARKET TITLE: "${event.title}"
MARKET DESCRIPTION: "${event.description || 'No description provided'}"
RESOLUTION CRITERIA: "${firstMarket.description || 'Standard resolution'}"
CURRENT ODDS: YES ${(yesPrice * 100).toFixed(1)}% / NO ${(noPrice * 100).toFixed(1)}%
VOLUME TRADED: $${(volume / 1000).toFixed(0)}k
END DATE: ${event.endDate || 'Unknown'}

Analyze this step by step:

1. WHAT NEEDS TO HAPPEN: In 1-2 sentences, what specific event or condition would cause this market to resolve YES?

2. BASE RATE ANALYSIS: Based on historical precedent, base rates, and current facts, what is the ACTUAL probability of this happening? Give a specific percentage estimate (e.g., "approximately 15%" or "less than 1%").

3. HIDDEN GOTCHAS: List specific, non-obvious resolution criteria, edge cases, or structural issues that bettors are missing. DO NOT list obvious things like "team must qualify for playoffs" or "market volatility exists". Focus on:
   - Unusual resolution clauses or timing windows
   - Definition ambiguities that could affect settlement
   - Capital lockup periods that make the bet uneconomical
   - Structural market design flaws

4. ABSURDITY SCORE (0-100): Rate how mispriced these odds are.

   **CRITICAL CALIBRATION RULES:**
   - If odds are 0% or 100%, MINIMUM absurdity is 85 (probabilities are never truly 0% or 100%)
   - If expected return > 500%, MINIMUM absurdity is 70
   - If expected return > 1000%, MINIMUM absurdity is 80
   - If expected return > 5000%, absurdity should be 90+
   - Consider BOTH direction (over/underpriced) AND magnitude
   
   Scale:
   - 0-20: Fairly priced, no clear edge
   - 21-40: Slightly mispriced, marginal opportunity (5-15% edge)
   - 41-60: Noticeably wrong, decent opportunity (15-30% edge)
   - 61-80: Obviously wrong, strong opportunity (30-50%+ edge)
   - 81-100: Absurdly wrong, extreme mispricing (100%+ edge or impossible price)
   
   Calibration examples:
   - Competitive election at 48-52 split = 10-15 (fairly priced)
   - Team priced at 25% with true 35% chance = 35 (slight edge)
   - 0% odds on any real-world event = 85+ (0% is mathematically impossible)
   - 100% odds on any event with non-zero risk = 85+ (100% is impossible)
   - "Will US president be sworn in 2029?" at 50% = 95 (should be 99.9%)

5. RECOMMENDED ACTION:
   - BUY_YES: Market odds significantly underestimate true probability
   - BUY_NO: Market odds significantly overestimate true probability
   - AVOID: Resolution risk, capital lockup, or opportunity cost exceeds profit potential
   - INVESTIGATE: Promising but need more information
   
   **Guidelines:**
   - Use BUY_YES/BUY_NO aggressively if absurdity > 60
   - AVOID only if expected return < 10% OR if resolution criteria are dangerously ambiguous
   - Do NOT use AVOID just because odds are extreme (0.01% can still be BUY_YES if true prob is 5%)
   - Even longshots (0.1% odds) should get BUY_YES if absurdity > 70

6. CONFIDENCE SCORE (0-100): How confident are you in this assessment?
   - Consider: data quality, historical precedent, time to resolution, ambiguity in criteria

7. KEY RISKS: List 2-3 SPECIFIC event-driven risks that could invalidate your thesis. 
   
   **DO NOT USE GENERIC PHRASES:**
   ❌ "Opportunity cost of locking capital"
   ❌ "Market volatility"
   ❌ "Unexpected events"
   
   **DO USE SPECIFIC SCENARIOS:**
   ✅ "A constitutional amendment allowing term limit exceptions"
   ✅ "Mass injuries to top-5 MVP candidates in the same month"
   ✅ "League cancellation due to labor strike"

Respond in this exact JSON format:
{
    "whatNeedsToHappen": "string",
    "baseRateAssessment": "string (must include specific % estimate)",
    "hiddenGotchas": ["string", "string"],
    "absurdityScore": number,
    "recommendedAction": "BUY_NO" | "BUY_YES" | "AVOID" | "INVESTIGATE",
    "confidenceScore": number,
    "keyRisks": ["string", "string", "string"]
}`;

    try {
        cell.log("INFO", `🤖 Analyzing NEW market: ${event.title.substring(0, 60)}...`);

        const aiResponse = await cell.mesh.ai.generate({
            prompt,
            systemInstruction: "You are a ruthless, data-driven prediction market analyst. Find extreme mispricings where emotions override logic. Be aggressive with BUY recommendations when absurdity > 60. AVOID is for resolution risk only, not for longshots. Always provide valid JSON.",
            jsonMode: true
        });

        const tokensUsed = aiResponse.response?.length || 0;
        cell.log("INFO", `   💬 AI responded (${tokensUsed} chars, ~${Math.ceil(tokensUsed / 4)} tokens)`);

        let parsed;
        try {
            const jsonMatch = aiResponse.response.match(/```json\s*([\s\S]*?)```/) ||
                aiResponse.response.match(/{[\s\S]*}/);
            const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiResponse.response;
            parsed = JSON.parse(jsonStr);
            cell.log("INFO", `   ✅ Parsed AI response: Absurdity=${parsed.absurdityScore}, Action=${parsed.recommendedAction}`);
        } catch (e) {
            cell.log("WARN", `Failed to parse AI response for ${eventId}: ${e.message}`);
            return null;
        }

        // Calculate expected return
        let expectedReturn = 0;
        if (parsed.recommendedAction === "BUY_NO" && noPrice > 0) {
            expectedReturn = ((1 / noPrice) - 1) * 100;
        } else if (parsed.recommendedAction === "BUY_YES" && yesPrice > 0) {
            expectedReturn = ((1 / yesPrice) - 1) * 100;
        }

        // VALIDATION: Enforce absurdity rules
        if ((yesPrice === 0 || noPrice === 1) && parsed.absurdityScore < 85) {
            cell.log("WARN", `   ⚠️  AI gave absurdity ${parsed.absurdityScore} for 0%/100% odds - forcing to 85`);
            parsed.absurdityScore = 85;
        }
        if (expectedReturn > 500 && parsed.absurdityScore < 70) {
            cell.log("WARN", `   ⚠️  AI gave absurdity ${parsed.absurdityScore} for ${expectedReturn.toFixed(0)}% return - forcing to 70`);
            parsed.absurdityScore = 70;
        }
        if (expectedReturn > 1000 && parsed.absurdityScore < 80) {
            cell.log("WARN", `   ⚠️  AI gave absurdity ${parsed.absurdityScore} for ${expectedReturn.toFixed(0)}% return - forcing to 80`);
            parsed.absurdityScore = 80;
        }

        const analysis: MarketAnalysis = {
            eventId,
            title: event.title,
            description: event.description || "",
            odds: { yes: yesPrice, no: noPrice },
            volume,
            whatNeedsToHappen: parsed.whatNeedsToHappen,
            baseRateAssessment: parsed.baseRateAssessment,
            hiddenGotchas: parsed.hiddenGotchas || [],
            absurdityScore: Math.min(100, Math.max(0, parsed.absurdityScore || 0)),
            recommendedAction: parsed.recommendedAction,
            confidenceScore: Math.min(100, Math.max(0, parsed.confidenceScore || 0)),
            keyRisks: parsed.keyRisks || [],
            expectedReturn,
            analyzedAt: Date.now(),
            marketUrl: `https://polymarket.com/event/${event.slug || eventId}`
        };

        setCachedAnalysis(eventId, analysis);
        return analysis;

    } catch (e) {
        cell.log("ERROR", `AI analysis failed for ${eventId}: ${e.message}`);
        return null;
    }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

async function analyzeBatch(events: any[], skipAnalyzed: boolean = true): Promise<MarketAnalysis[]> {
    const results: MarketAnalysis[] = [];
    let skipped = 0;
    let analyzed = 0;
    let failed = 0;

    for (const event of events) {
        const eventId = event.id;

        if (skipAnalyzed && hasBeenAnalyzed(eventId)) {
            const cached = getCachedAnalysis(eventId);
            if (cached) {
                results.push(cached);
            }
            skipped++;
            continue;
        }

        try {
            const analysis = await analyzeMarketWithAI(event);
            if (analysis) {
                results.push(analysis);
                analyzed++;
            } else {
                failed++;
            }
        } catch (e) {
            cell.log("WARN", `Failed to analyze ${eventId}: ${e.message}`);
            failed++;
        }

        await new Promise(r => setTimeout(r, 100));
    }

    if (skipped > 0 || failed > 0) {
        cell.log("INFO", `⏭️  Batch complete: ${analyzed} analyzed, ${skipped} skipped, ${failed} failed`);
    }

    return results;
}

// ============================================================================
// ROUTER
// ============================================================================

const analystRouter = router({
    analyst: router({
        // NEW: Get all cached opportunities immediately (no AI calls)
        getCachedOpportunities: procedure
            .input(z.object({
                minAbsurdity: z.number().default(40),
                minVolume: z.number().default(10000),
                limit: z.number().default(50)
            }))
            .output(z.object({
                opportunities: z.array(z.any()),
                total: z.number(),
                cached: z.boolean(),
                oldestAnalysis: z.string(),
                newestAnalysis: z.string()
            }))
            .query(async (input) => {
                const validAnalyses = Object.values(analysisCache)
                    .filter(c => c.expiresAt > Date.now())
                    .map(c => c.analysis)
                    .filter(a =>
                        a.absurdityScore >= input.minAbsurdity &&
                        a.volume >= input.minVolume
                    )
                    .sort((a, b) => (b.absurdityScore * b.confidenceScore) - (a.absurdityScore * a.confidenceScore))
                    .slice(0, input.limit);

                const timestamps = validAnalyses.map(a => a.analyzedAt).sort((a, b) => a - b);

                return {
                    opportunities: validAnalyses.map(o => ({
                        id: o.eventId,
                        title: o.title,
                        odds: o.odds,
                        volume: o.volume,
                        absurdityScore: o.absurdityScore,
                        confidenceScore: o.confidenceScore,
                        recommendedAction: o.recommendedAction,
                        expectedReturn: Math.round(o.expectedReturn * 10) / 10,
                        whatNeedsToHappen: o.whatNeedsToHappen,
                        baseRateAssessment: o.baseRateAssessment,
                        hiddenGotchas: o.hiddenGotchas,
                        keyRisks: o.keyRisks,
                        isQuickWin: o.absurdityScore >= 70 && o.confidenceScore >= 75,
                        marketUrl: o.marketUrl || "",
                        analyzedAt: o.analyzedAt,
                        isCached: true
                    })),
                    total: validAnalyses.length,
                    cached: true,
                    oldestAnalysis: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : "None",
                    newestAnalysis: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : "None"
                };
            }),

        // MODIFIED: Deep scan now reports cache usage more clearly
        deepScan: procedure
            .input(z.object({
                minVolume: z.number().default(5000),
                maxMarkets: z.number().default(100),
                minAbsurdity: z.number().default(40),
                forceReanalyze: z.boolean().default(false)
            }))
            .output(z.object({
                opportunities: z.array(z.any()),
                summary: z.string(),
                scanned: z.number(),
                analyzed: z.number(),
                fromCache: z.number(),
                newlyAnalyzed: z.number(),
                quickWins: z.number(),
                scanTimeMs: z.number()
            }))
            .query(async (input) => {
                const startTime = Date.now();
                cell.log("INFO", `🔍 Starting deep scan of up to ${input.maxMarkets} markets (forceReanalyze: ${input.forceReanalyze})...`);

                const rawData = await cell.mesh.prediction.getTrending({
                    limit: input.maxMarkets,
                    sortBy: "volume"
                });

                cell.log("INFO", `📥 Received ${rawData.length} total markets from API`);

                const highVolumeMarkets = rawData.filter((e: any) => {
                    const vol = parseFloat(e.volumeNum || "0");
                    return vol >= input.minVolume;
                });

                cell.log("INFO", `📊 Found ${highVolumeMarkets.length} markets with >$${input.minVolume} volume`);

                const BATCH_SIZE = 10;
                const beforeCount = Object.keys(analysisCache).length;
                let allAnalyses: MarketAnalysis[] = [];

                for (let i = 0; i < highVolumeMarkets.length; i += BATCH_SIZE) {
                    const batch = highVolumeMarkets.slice(i, i + BATCH_SIZE);
                    cell.log("INFO", `📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(highVolumeMarkets.length / BATCH_SIZE)} (${batch.length} markets)...`);

                    const batchResults = await analyzeBatch(batch, !input.forceReanalyze);
                    allAnalyses = allAnalyses.concat(batchResults);

                    if (Date.now() - startTime > 90000) {
                        cell.log("WARN", `⏱️  Stopping scan after ${Math.floor((Date.now() - startTime) / 1000)}s to avoid timeout`);
                        break;
                    }
                }

                const afterCount = Object.keys(analysisCache).length;
                const newlyAnalyzed = afterCount - beforeCount;
                const fromCache = allAnalyses.length - newlyAnalyzed;

                const opportunities = allAnalyses.filter(a => a.absurdityScore >= input.minAbsurdity);

                opportunities.sort((a, b) =>
                    (b.absurdityScore * b.confidenceScore) - (a.absurdityScore * a.confidenceScore)
                );

                const quickWins = opportunities.filter(o =>
                    o.absurdityScore >= 70 &&
                    o.confidenceScore >= 75 &&
                    o.recommendedAction !== "AVOID"
                );

                const scanTime = Date.now() - startTime;

                cell.log("INFO", `✅ Deep scan complete: ${allAnalyses.length} total (${fromCache} cached, ${newlyAnalyzed} new), ${opportunities.length} opportunities, ${quickWins.length} quick wins (${scanTime}ms)`);

                return {
                    opportunities: opportunities.map(o => ({
                        id: o.eventId,
                        title: o.title,
                        odds: o.odds,
                        volume: o.volume,
                        absurdityScore: o.absurdityScore,
                        confidenceScore: o.confidenceScore,
                        recommendedAction: o.recommendedAction,
                        expectedReturn: Math.round(o.expectedReturn * 10) / 10,
                        whatNeedsToHappen: o.whatNeedsToHappen,
                        baseRateAssessment: o.baseRateAssessment,
                        hiddenGotchas: o.hiddenGotchas,
                        keyRisks: o.keyRisks,
                        isQuickWin: quickWins.includes(o),
                        marketUrl: o.marketUrl || "",
                        isCached: hasBeenAnalyzed(o.eventId)
                    })),
                    summary: `Analyzed ${allAnalyses.length} markets (${fromCache} from cache, ${newlyAnalyzed} newly analyzed) in ${scanTime}ms. Found ${opportunities.length} mispriced opportunities (${quickWins.length} quick wins).`,
                    scanned: highVolumeMarkets.length,
                    analyzed: allAnalyses.length,
                    fromCache,
                    newlyAnalyzed,
                    quickWins: quickWins.length,
                    scanTimeMs: scanTime
                };
            }),

        getCacheStats: procedure
            .input(z.void())
            .output(z.object({
                totalAnalyzed: z.number(),
                totalSeen: z.number(),
                cacheSize: z.string(),
                oldestAnalysis: z.string(),
                newestAnalysis: z.string()
            }))
            .query(async () => {
                const analyses = Object.values(analysisCache)
                    .filter(c => c.expiresAt > Date.now())
                    .map(c => c.analysis);

                const timestamps = analyses.map(a => a.analyzedAt).sort((a, b) => a - b);

                return {
                    totalAnalyzed: analyses.length,
                    totalSeen: Object.keys(seenMarkets).length,
                    cacheSize: `${(JSON.stringify(analysisCache).length / 1024).toFixed(1)} KB`,
                    oldestAnalysis: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : "None",
                    newestAnalysis: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : "None"
                };
            }),

        debugMarkets: procedure
            .input(z.object({
                limit: z.number().default(10),
                sortBy: z.enum(["volume", "recent"]).default("volume")
            }))
            .output(z.object({
                count: z.number(),
                markets: z.array(z.any()),
                volumeStats: z.object({
                    min: z.number(),
                    max: z.number(),
                    avg: z.number(),
                    total: z.number()
                })
            }))
            .query(async (input) => {
                const rawData = await cell.mesh.prediction.getTrending({
                    limit: 100,
                    sortBy: input.sortBy
                });

                const markets = rawData.slice(0, input.limit).map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    volume: parseFloat(e.volumeNum || "0"),
                    volumeRaw: e.volumeNum,
                    markets: e.markets?.length || 0,
                    endDate: e.endDate
                }));

                const volumes = rawData.map((e: any) => parseFloat(e.volumeNum || "0")).filter(v => v > 0);
                const volumeStats = {
                    min: volumes.length > 0 ? Math.min(...volumes) : 0,
                    max: volumes.length > 0 ? Math.max(...volumes) : 0,
                    avg: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0,
                    total: volumes.reduce((a, b) => a + b, 0)
                };

                return {
                    count: rawData.length,
                    markets,
                    volumeStats
                };
            }),

        analyzeOne: procedure
            .input(z.object({
                eventId: z.string()
            }))
            .output(z.object({
                found: z.boolean(),
                analysis: z.any()
            }))
            .query(async (input) => {
                const cached = getCachedAnalysis(input.eventId);
                if (cached) {
                    return { found: true, analysis: cached };
                }

                const allMarkets = await cell.mesh.prediction.getTrending({ limit: 500 });
                const event = allMarkets.find((e: any) => e.id === input.eventId);

                if (!event) {
                    return { found: false, analysis: null };
                }

                const analysis = await analyzeMarketWithAI(event);
                return { found: !!analysis, analysis };
            }),

        getRecommendations: procedure
            .input(z.object({
                riskTolerance: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).default("MODERATE"),
                minVolume: z.number().default(10000)
            }))
            .output(z.object({
                recommendations: z.array(z.object({
                    title: z.string(),
                    action: z.string(),
                    stake: z.string(),
                    expectedReturn: z.string(),
                    rationale: z.string(),
                    urgency: z.string()
                })),
                portfolioSummary: z.string()
            }))
            .query(async (input) => {
                const scan = await (cell.mesh.analyst.deepScan as any)({
                    minVolume: input.minVolume,
                    maxMarkets: 50,
                    minAbsurdity: input.riskTolerance === "CONSERVATIVE" ? 60 :
                        input.riskTolerance === "MODERATE" ? 40 : 20,
                    forceReanalyze: false
                });

                const topPicks = scan.opportunities.slice(0, 5);

                const recommendations = topPicks.map((opp: any) => ({
                    title: opp.title.length > 60 ? opp.title.substring(0, 60) + "..." : opp.title,
                    action: opp.recommendedAction === "BUY_YES" ? "Bet YES" :
                        opp.recommendedAction === "BUY_NO" ? "Bet NO" : "Avoid",
                    stake: opp.volume > 1000000 ? "High Confidence" :
                        opp.volume > 100000 ? "Medium Confidence" : "Low Confidence",
                    expectedReturn: `+${opp.expectedReturn.toFixed(1)}%`,
                    rationale: opp.baseRateAssessment,
                    urgency: opp.absurdityScore > 75 ? "HIGH" :
                        opp.absurdityScore > 50 ? "MEDIUM" : "LOW"
                }));

                const totalExpectedReturn = topPicks.reduce((sum: number, opp: any) =>
                    sum + (opp.recommendedAction === "AVOID" ? 0 : opp.expectedReturn), 0
                ) / (topPicks.filter((o: any) => o.recommendedAction !== "AVOID").length || 1);

                return {
                    recommendations,
                    portfolioSummary: `${topPicks.length} opportunities found with avg ${totalExpectedReturn.toFixed(1)}% expected return. Risk level: ${input.riskTolerance}.`
                };
            })
    })
});

// ============================================================================
// BACKGROUND REFRESH
// ============================================================================

let backgroundScanRunning = false;

async function backgroundScan() {
    if (backgroundScanRunning) return;
    backgroundScanRunning = true;

    try {
        cell.log("INFO", "🔄 Background: Checking for new high-volume markets...");

        const markets = await cell.mesh.prediction.getTrending({
            limit: 100,
            sortBy: "volume"
        });
        const highVolume = markets.filter((e: any) => parseFloat(e.volumeNum || "0") > 50000);

        const unanalyzed = highVolume.filter((e: any) => !hasBeenAnalyzed(e.id));

        if (unanalyzed.length === 0) {
            cell.log("INFO", `✅ Background: All ${highVolume.length} high-volume markets already analyzed`);
        } else {
            cell.log("INFO", `🆕 Background: Found ${unanalyzed.length} new high-volume markets to analyze`);

            const batch = unanalyzed.slice(0, 5);
            await analyzeBatch(batch, false);

            cell.log("INFO", `✅ Background: Analyzed ${batch.length} new markets`);
        }
    } catch (e) {
        cell.log("WARN", `Background scan failed: ${e.message}`);
    } finally {
        backgroundScanRunning = false;
    }
}

setInterval(backgroundScan, 5 * 60 * 1000);
setTimeout(backgroundScan, 10 * 1000);

// ============================================================================
// CELL SETUP
// ============================================================================

loadCache();

cell.useRouter(analystRouter);
cell.listen();

const cacheStats = Object.keys(analysisCache).length;
const seenStats = Object.keys(seenMarkets).length;
cell.log("INFO", `🧠 AI-POWERED PREDICTION_ANALYST: Deep analysis engine online`);
cell.log("INFO", `   💾 Cache: ${cacheStats} analyses, ${seenStats} markets tracked`);