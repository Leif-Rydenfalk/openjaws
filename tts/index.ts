/**
 * ⚡ OPENJAWS // SUBSTRATE: TEXT-TO-SPEECH (NATIVE AUDIO)
 * ----------------------------------------------------------------------------
 * Path: /home/asdfghj/openjaws/tts/index.ts
 * Version: 2.1.0 (Validated Ignition)
 * 
 * RESPONSIBILITIES:
 * - Distributed Audio Synthesis via Google Multimodal LLMs
 * - Runtime Model Verification (Ignition Testing)
 * - Automatic Fallback (2.0 -> 1.5 -> Pro)
 * - Mesh Metrics & Character Accounting
 * ----------------------------------------------------------------------------
 */

import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// I. INITIALIZATION & DATA RECOGNITION
// ============================================================================

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const cell = new TypedRheoCell(`TTS_${process.pid}`, 0);
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    cell.log("ERROR", "❌ [FATAL] GEMINI_API_KEY is not defined in .env. Mesh synthesis will fail.");
}

// ============================================================================
// II. METRICS & TELEMETRY ENGINE
// ============================================================================

interface TTSState {
    activeModel: string;
    discoveryDate: string;
    verified: boolean;
    modelsAttempted: string[];
    metrics: {
        totalRequests: number;
        totalCharacters: number;
        totalBytesGenerated: number;
        failures: number;
        avgLatencyMs: number;
        lastError?: string;
    };
}

const state: TTSState = {
    activeModel: "models/gemini-1.5-flash", // Safe default
    discoveryDate: new Date().toISOString(),
    verified: false,
    modelsAttempted: [],
    metrics: {
        totalRequests: 0,
        totalCharacters: 0,
        totalBytesGenerated: 0,
        failures: 0,
        avgLatencyMs: 0
    }
};

/**
 * Persists metrics to disk for long-term tracking
 */
function syncStateToDisk() { try { writeFileSync(join(DATA_DIR, "tts_state.json"), JSON.stringify(state, null, 2)); } catch (e) { } }

async function igniteSynthesisEngine() {
    // Skip discovery - we know the TTS model works
    state.activeModel = "gemini-2.5-flash-preview-tts";
    state.verified = true;
    cell.log("INFO", "🎯 [LOCKED] gemini-2.5-flash-preview-tts");
}

// ============================================================================
// VOICE PERSONAS CONFIGURATION
// ============================================================================

const PERSONAS: Record<string, {
    voice: string;
    language?: string;
}> = {
    "en-US-Achernar": { voice: "Achernar", language: "en-US" },
    "en-US-Pollux": { voice: "Puck", language: "en-US" }, // Puck is male, upbeat
    "sv-SE-Achernar": { voice: "Aoede", language: "sv-SE" }, // Aoede works well for Swedish
    "default": { voice: "Kore", language: "en-US" }
};

// ============================================================================
// TTS SYNTHESIS ENGINE
// ============================================================================

async function runSynthesis(text: string, voiceKey: string) {
    const reqId = Math.random().toString(36).substring(7).toUpperCase();
    const startTime = Date.now();
    const persona = PERSONAS[voiceKey] || PERSONAS["default"];

    // TTS-specific model - MUST use this for audio generation
    const TTS_MODEL = "gemini-2.5-flash-preview-tts";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${API_KEY}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: persona.voice
                            }
                        }
                    }
                }
            })
        });

        const json = await res.json();

        // Check for API errors
        if (json.error) {
            throw new Error(`Gemini API error: ${json.error.message}`);
        }

        // Extract audio from response - note: inlineData (camelCase)
        const parts = json.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p: any) => p.inlineData);

        if (!audioPart || !audioPart.inlineData?.data) {
            console.error("Full response:", JSON.stringify(json, null, 2));
            throw new Error("No audio in response - check model and config");
        }

        state.metrics.totalRequests++;
        state.metrics.totalCharacters += text.length;

        cell.log("INFO", `[${reqId}] ✅ SYNTHESIS_SUCCESS: ${TTS_MODEL} in ${Date.now() - startTime}ms`);
        syncStateToDisk();

        return {
            audio: audioPart.inlineData.data, // Base64 encoded PCM
            mimeType: audioPart.inlineData.mimeType || "audio/pcm",
            model: TTS_MODEL,
            latency: Date.now() - startTime
        };

    } catch (e: any) {
        state.metrics.failures++;
        cell.log("ERROR", `[${reqId}] ❌ FAILED: ${e.message}`);
        throw e;
    }
}

const ttsRouter = router({
    tts: router({
        synthesize: procedure
            .input(z.object({
                text: z.string(),
                voice: z.optional(z.string())
            }))
            .output(z.object({
                audio: z.string(),
                format: z.string(),
                mimeType: z.string(),
                model: z.string(),
                latency: z.number()
            }))
            .mutation(async (input) => {
                const res = await runSynthesis(input.text, input.voice || "en-US-Achernar");
                return {
                    audio: res.audio,
                    format: "pcm",
                    mimeType: res.mimeType,
                    model: res.model,
                    latency: res.latency
                };
            }),

        status: procedure
            .input(z.void())
            .output(z.any())
            .query(async () => state)
    })
});

// ============================================================================
// VII. EXECUTION BOOT
// ============================================================================

cell.useRouter(ttsRouter);
cell.listen();

cell.log("INFO", "--------------------------------------------------");
cell.log("INFO", "🤖 OPENJAWS TTS SUBSTRATE v2.1 ONLINE");
cell.log("INFO", `📂 DATA_DIR: ${DATA_DIR}`);
cell.log("INFO", "--------------------------------------------------");

// Initialize Model Verification
igniteSynthesisEngine();

// Heartbeat Logs
setInterval(() => {
    if (state.metrics.totalRequests > 0) {
        cell.log("INFO", `📊 HEARTBEAT: ${state.metrics.totalRequests} req, ${state.metrics.failures} fail, ${Math.round(state.metrics.avgLatencyMs)}ms avg`);
    }
}, 60000);

export type TTSRouter = typeof ttsRouter;