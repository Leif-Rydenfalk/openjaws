/**
 * ⚡ OPENJAWS // SUBSTRATE: VOICE USER INTERFACE
 * ----------------------------------------------------------------------------
 * Path: /home/asdfghj/openjaws/tts-ui/index.ts
 * Version: 3.0.0 (Cyber-Terminal Mobile)
 * 
 * RESPONSIBILITIES:
 * - Distributed Mesh Orchestration (UI -> Kindly -> TTS)
 * - Mobile Optimized Cyber-UI (Tailwind + Custom Effects)
 * - AudioContext Lifecycle Management (Bypassing Browser blocks)
 * - Real-time Transaction Logging
 * ----------------------------------------------------------------------------
 */

import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { networkInterfaces } from "node:os";

const PORT = 5139;
const cell = new TypedRheoCell(`TTS_UI_${process.pid}`, 0);

// ============================================================================
// I. MESH CONTEXT & UTILS
// ============================================================================

function getAddresses() {
    const interfaces = networkInterfaces();
    const list: string[] = [];
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]!) {
            if (net.family === 'IPv4') list.push(`${net.address}:${PORT}`); // ← No https:// prefix
        }
    }
    return list;
}

// ============================================================================
// II. CYBER-UI TERMINAL HTML (Complete 300+ Line Script)
// ============================================================================

const UI_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>OPENJAWS // VOICE_CORE</title>
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta http-equiv="Permissions-Policy" content="microphone=(self)">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');
        
        :root {
            --neon: #00ffaa;
            --neon-dim: #004d33;
            --danger: #ff3e3e;
            --bg: #050505;
        }

        body {
            background-color: var(--bg);
            color: var(--neon);
            font-family: 'Fira Code', monospace;
            height: 100dvh;
            margin: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            touch-action: manipulation;
        }

        /* Terminal Overlay Scanline */
        .scanline {
            position: fixed; inset: 0;
            background: linear-gradient(to bottom, transparent 50%, rgba(0, 255, 170, 0.02) 50%);
            background-size: 100% 4px;
            pointer-events: none; z-index: 100;
        }

        /* Glassmorphism Elements */
        .glass {
            background: rgba(10, 10, 10, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid var(--neon-dim);
        }

        /* FFT Spectrum Bars */
        #spectrum {
            width: 100%; height: 80px;
            border-bottom: 1px solid var(--neon-dim);
        }

        .chat-area {
            flex-grow: 1; overflow-y: auto; padding: 20px;
            display: flex; flex-direction: column; gap: 12px;
            scrollbar-width: none;
        }
        .chat-area::-webkit-scrollbar { display: none; }

        .log-entry {
            font-size: 11px; padding: 10px; border-radius: 2px;
            max-width: 85%; animation: flicker 0.1s ease-in;
        }
        .log-user { align-self: flex-end; border-right: 2px solid var(--neon); background: rgba(0, 255, 170, 0.05); }
        .log-ai { align-self: flex-start; border-left: 2px solid #555; background: #111; color: #fff; }
        .log-sys { align-self: center; font-size: 9px; opacity: 0.5; font-style: italic; }

        @keyframes flicker {
            0% { opacity: 0.1; }
            100% { opacity: 1; }
        }

        .btn-ignite {
            padding: 15px 40px; border: 1px solid var(--neon);
            text-transform: uppercase; letter-spacing: 4px;
            font-weight: bold; transition: all 0.3s;
        }
        .btn-ignite:hover { background: var(--neon); color: black; box-shadow: 0 0 30px var(--neon); }

        #boot-screen {
            position: fixed; inset: 0; background: #000;
            z-index: 1000; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 30px;
        }

        .mic-hex {
            width: 80px; height: 80px; background: #000;
            border: 2px solid var(--neon-dim); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.4s;
        }
        .mic-hex.active { border-color: var(--neon); box-shadow: 0 0 30px var(--neon); transform: scale(1.1); }
        .mic-hex.thinking { animation: pulse-neon 1.5s infinite; }

        @keyframes pulse-neon {
            0% { box-shadow: 0 0 0 0 rgba(0, 255, 170, 0.4); }
            70% { box-shadow: 0 0 0 20px rgba(0, 255, 170, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 255, 170, 0); }
        }
    </style>
</head>
<body>
    <div class="scanline"></div>

    <!-- STARTUP SEQUENCE -->
    <div id="boot-screen">
        <div class="text-center">
            <h1 class="text-white font-bold tracking-[0.5em] mb-2">OPENJAWS</h1>
            <p class="text-[9px] text-emerald-800 uppercase tracking-widest">Rheo Substrate // Voice Link v3.0</p>
        </div>
        <button id="ignite-btn" class="btn-ignite">INITIALIZE</button>
        <div id="pre-status" class="text-[8px] text-emerald-900 mt-10">Awaiting user authorization...</div>
    </div>

    <!-- MAIN INTERFACE -->
    <header class="p-4 pt-10 glass border-b flex justify-between items-center z-50">
        <div>
            <div class="text-[8px] text-emerald-700 uppercase font-bold tracking-tighter">Substrate Node</div>
            <div id="node-id" class="text-[10px] text-white font-bold uppercase">VOICE_TERMINAL</div>
        </div>
        <div class="text-right">
            <div class="text-[8px] text-emerald-700 uppercase font-bold tracking-tighter">Latency</div>
            <div id="stat-latency" class="text-[10px] text-emerald-400 font-bold">--- MS</div>
        </div>
    </header>

    <canvas id="spectrum"></canvas>

    <main id="chat-window" class="chat-area">
        <div class="log-sys">Encrypted session started. Integrity verified.</div>
    </main>

    <footer class="p-6 pb-12 glass border-t flex flex-col items-center gap-6">
        <div id="mic-status" class="text-[9px] uppercase tracking-widest text-emerald-900 font-bold">Terminal Standby</div>
        
        <div class="flex items-center gap-8">
            <!-- Voice Selector -->
            <select id="voice-id" class="bg-black border border-emerald-900 text-[10px] p-2 rounded appearance-none outline-none text-emerald-400">
                <option value="en-US-Achernar">🇺🇸 US FEMALE</option>
                <option value="en-US-Pollux">🇺🇸 US MALE</option>
                <option value="sv-SE-Achernar">🇸🇪 SE FEMALE</option>
            </select>

            <!-- Mic Button -->
            <button id="mic-trigger" class="mic-hex">
                <span id="mic-icon" class="text-2xl">🎙️</span>
            </button>

            <!-- Diagnostics -->
            <div class="flex flex-col gap-1">
                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <div class="w-2 h-2 rounded-full bg-emerald-900"></div>
                <div class="w-2 h-2 rounded-full bg-emerald-900"></div>
            </div>
        </div>
    </footer>

    <script>
        const chat = document.getElementById('chat-window');
        const trigger = document.getElementById('mic-trigger');
        const icon = document.getElementById('mic-icon');
        const mStatus = document.getElementById('mic-status');
        const lStatus = document.getElementById('stat-latency');
        const canvas = document.getElementById('spectrum');
        const ctx = canvas.getContext('2d');
        let recognitionLock = false;

        let aCtx, analyser, dataArray, source;
        let recording = false;
        let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        let rec = new SpeechRecognition();

        rec.continuous = false;
        rec.interimResults = false;

        // 2. Interaction
        trigger.onclick = () => {
            // Prevent any concurrent execution
            if (recognitionLock) {
                console.log("Recognition locked, ignoring click");
                return;
            }
            
            recognitionLock = true;
            
            // Stop if already recording
            if (recording) {
                console.log("Stopping active recognition");
                try { 
                    rec.stop(); 
                } catch(e) {
                    console.warn("Stop failed:", e);
                }
                recognitionLock = false;
                return;
            }
            
            // Ensure audio context is ready (synchronous check)
            if (!aCtx) {
                console.error("AudioContext not initialized");
                mStatus.innerText = "ERROR: Click INITIALIZE first";
                recognitionLock = false;
                return;
            }
            
            // CRITICAL: Check readyState before starting
            if (rec.readyState === 'listening' || rec.readyState === 2) {
                console.log("Already listening, ignoring start request");
                recognitionLock = false;
                return;
            }
            
            // Resume audio context (fire and forget, but we need gesture for rec.start)
            aCtx.resume().catch(e => console.warn("AudioContext resume failed:", e));
            
            // CRITICAL: Call rec.start() IMMEDIATELY from user gesture
            // Do not await anything between user click and this call
            try {
                console.log("Starting recognition...");
                rec.start();
            } catch (e) {
                console.error("Mic activation failed:", e);
                mStatus.innerText = "ERROR: " + (e.message || "Unknown error");
                recording = false;
                trigger.classList.remove('active');
            }
            
            // Release lock after delay
            setTimeout(() => {
                recognitionLock = false;
            }, 300);
        };

        function attachRecognitionHandlers() {
             rec.onstart = () => {
                console.log("Recognition started");
                recording = true;
                trigger.classList.add('active');
                mStatus.innerText = "Listening...";
            };

            rec.onend = () => {
                console.log("Recognition ended");
                recording = false;
                trigger.classList.remove('active');
                mStatus.innerText = "Terminal Standby";
                recognitionLock = true;
                
                setTimeout(() => {
                    try {
                        rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                        rec.continuous = false;
                        rec.interimResults = false;
                        attachRecognitionHandlers();
                    } catch (e) {
                        console.error("Failed to recreate recognition:", e);
                    } finally {
                        recognitionLock = false;
                    }
                }, 100);
            };

            // Add error handler (missing in your code!)
            rec.onerror = (e) => {
                console.error("Recognition error:", e.error);
                recording = false;
                trigger.classList.remove('active');
                
                if (e.error === 'no-speech') {
                    mStatus.innerText = "No speech detected";
                } else if (e.error === 'audio-capture') {
                    mStatus.innerText = "No microphone found";
                } else if (e.error === 'not-allowed') {
                    mStatus.innerText = "Microphone permission denied";
                } else {
                    mStatus.innerText = "ERROR: " + e.error;
                }
            };

            rec.onresult = (e) => {
                const text = e.results[0][0].transcript;
                handleRequest(text);
            };
        }

        attachRecognitionHandlers();

        // Store session in localStorage for persistence across reloads
        let sessionData = null;

        async function getSession() {
            try {
                const stored = localStorage.getItem('tts_session');
                if (stored) {
                    sessionData = JSON.parse(stored);
                    return sessionData;
                }
                
                const deviceId = localStorage.getItem('device_id') || 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
                localStorage.setItem('device_id', deviceId);
                
                const res = await fetch('/api/session?device=' + deviceId);
                if (!res.ok) throw new Error("HTTP " + res.status);
                
                sessionData = await res.json();
                localStorage.setItem('tts_session', JSON.stringify(sessionData));
                return sessionData;
            } catch (e) {
                console.error("Session failed:", e);
                // Return dummy session so UI doesn't break
                return { sessionId: 'fallback_' + Date.now(), userId: 'anonymous' };
            }
        }

        // Call on startup
        document.getElementById('ignite-btn').onclick = async () => {
            aCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = aCtx.createAnalyser();
            analyser.fftSize = 256;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            // Initialize session
            await getSession();
            
            document.getElementById('boot-screen').style.display = 'none';
            drawSpectrum();
        
        };

        async function handleRequest(text) {
            addEntry('user', text);
            trigger.classList.add('thinking');
            icon.innerText = "💭";
            mStatus.innerText = "Connecting...";
            
            let buffer = ""; // Buffer for incomplete JSON lines
            let receivedFinal = false;

            try {
                const response = await fetch('/api/converse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        text, 
                        voice: document.getElementById('voice-id').value,
                        sessionId: sessionData.sessionId,
                        userId: sessionData.userId
                    })
                });

                if (!response.ok) {
                    throw new Error("HTTP " + response.status + ": " + response.statusText);
                }

                if (!response.body) {
                    throw new Error("No response body");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                while (true) {
                    const { done, value } = await reader.read();
                    
                    // Decode chunk and add to buffer
                    const chunk = decoder.decode(value, { stream: !done });
                    buffer += chunk;
                    
                    // Process complete lines
                    const lines = buffer.split('\n');
                    // Keep the last incomplete line in buffer
                    buffer = lines.pop() || "";
                    
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        
                        try {
                            const data = JSON.parse(line);
                            
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            
                            if (data.status === "processing") {
                                mStatus.innerText = data.message || data.step;
                            } 
                            else if (data.ok) {
                                // Final result - only process once
                                if (receivedFinal) continue;
                                receivedFinal = true;
                                
                                lStatus.innerText = (data.meta?.latency || "---") + " MS";
                                addEntry('ai', data.text);
                                
                                if (data.audio) {
                                    mStatus.innerText = "Speaking...";
                                    icon.innerText = "🔊";
                                    await playStream(data.audio);
                                }
                            }
                        } catch (parseErr) {
                            console.warn("Parse error:", line, parseErr);
                        }
                    }
                    
                    if (done) break;
                }
                
                // Process any remaining data in buffer
                if (buffer.trim() && !receivedFinal) {
                    try {
                        const data = JSON.parse(buffer);
                        if (data.ok) {
                            lStatus.innerText = (data.meta?.latency || "---") + " MS";
                            addEntry('ai', data.text);
                            if (data.audio) await playStream(data.audio);
                        }
                    } catch (e) {
                        console.warn("Final buffer parse error:", e);
                    }
                }
                
            } catch (e) {
                console.error("Request failed:", e);
                addEntry('sys', "Error: " + (e.message || "Request failed"));
            } finally {
                trigger.classList.remove('thinking');
                icon.innerText = "🎙️";
                mStatus.innerText = "Terminal Standby";
            }
        }

        function addEntry(role, text) {
            const div = document.createElement('div');
            div.className = "log-entry log-" + role;
            div.innerText = (role === 'ai' ? '🤖 ' : '') + text;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        async function playStream(base64) {
            try {
                // Convert base64 PCM to WAV
                const pcmData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                const sampleRate = 24000;
                
                // Create WAV header (44 bytes)
                const wavHeader = new ArrayBuffer(44);
                const view = new DataView(wavHeader);
                
                view.setUint32(0, 0x52494646, false); // "RIFF"
                view.setUint32(4, 36 + pcmData.length, true);
                view.setUint32(8, 0x57415645, false); // "WAVE"
                view.setUint32(12, 0x666D7420, false); // "fmt "
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true); // PCM
                view.setUint16(22, 1, true); // Mono
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true);
                view.setUint16(32, 2, true);
                view.setUint16(34, 16, true);
                view.setUint32(36, 0x64617461, false); // "data"
                view.setUint32(40, pcmData.length, true);
                
                // Combine
                const wavBuffer = new Uint8Array(wavHeader.byteLength + pcmData.length);
                wavBuffer.set(new Uint8Array(wavHeader), 0);
                wavBuffer.set(pcmData, wavHeader.byteLength);
                
                // Decode and play
                const audioBuffer = await aCtx.decodeAudioData(wavBuffer.buffer);
                const source = aCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(analyser);
                analyser.connect(aCtx.destination);
                source.start(0);
                
                mStatus.innerText = "Playing...";
                
                return new Promise(resolve => {
                    source.onended = () => {
                        mStatus.innerText = "Terminal Standby";
                        resolve();
                    };
                });
                
            } catch (e) {
                console.error("Audio playback failed:", e);
                mStatus.innerText = "Audio Error";
                throw e;
            }
        }

        function drawSpectrum() {
            requestAnimationFrame(drawSpectrum);
            analyser.getByteFrequencyData(dataArray);
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            ctx.clearRect(0,0,canvas.width, canvas.height);
            
            const bWidth = (canvas.width / dataArray.length) * 2.5;
            let x = 0;
            for(let i=0; i<dataArray.length; i++) {
                const h = (dataArray[i]/255) * canvas.height;
                ctx.fillStyle = "rgba(0, 255, 170, " + (dataArray[i]/255 + 0.1) + ")";
                ctx.fillRect(x, canvas.height - h, bWidth, h);
                x += bWidth + 1;
            }
        }
    </script>
</body>
</html>
`;

// ============================================================================
// III. BACKEND MESH BRIDGE (The Orchestration Hub)
// ============================================================================

import { networkInterfaces } from "node:os";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Auto-generate TLS certificates for HTTPS
const CERT_DIR = join(process.cwd(), "certs");
const CERT_FILE = join(CERT_DIR, "cert.pem");
const KEY_FILE = join(CERT_DIR, "key.pem");

function getLocalIPs(): string[] {
    const interfaces = networkInterfaces();
    const ips: string[] = ["localhost", "127.0.0.1", "::1"];
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]!) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push(net.address);
            }
        }
    }
    return ips;
}

function generateSelfSignedCert(): { cert: string; key: string } {
    const forge = require("node-forge");

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
        { name: "commonName", value: "openjaws.local" },
        { name: "countryName", value: "SE" },
        { name: "stateOrProvinceName", value: "Local" },
        { name: "localityName", value: "Local" },
        { name: "organizationName", value: "OpenJaws" }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Build Subject Alternative Names - only valid IPs, DNS names for hostnames
    const altNames: any[] = [];

    getLocalIPs().forEach(ip => {
        if (ip === "localhost" || ip.includes(":") === false && isNaN(parseInt(ip.split(".")[0]))) {
            // DNS name (localhost or other hostnames)
            altNames.push({ type: 2, value: ip });
        } else if (ip.includes(":")) {
            // IPv6
            altNames.push({ type: 7, ip: ip });
        } else {
            // IPv4
            altNames.push({ type: 7, ip: ip });
        }
    });

    cert.setExtensions([
        { name: "basicConstraints", cA: true },
        { name: "keyUsage", keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
        { name: "extKeyUsage", serverAuth: true, clientAuth: true },
        { name: "subjectAltName", altNames: altNames }
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

    if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });
    writeFileSync(CERT_FILE, certPem);
    writeFileSync(KEY_FILE, keyPem);

    cell.log("INFO", `🔐 Generated self-signed certificate with ${altNames.length} SANs`);

    return { cert: certPem, key: keyPem };
}

function loadOrGenerateCerts(): { cert: string; key: string } {
    try {
        // Try to load existing certs
        if (existsSync(CERT_FILE) && existsSync(KEY_FILE)) {
            const cert = readFileSync(CERT_FILE, "utf8");
            const key = readFileSync(KEY_FILE, "utf8");
            cell.log("INFO", "🔐 Loaded existing certificates");
            return { cert, key };
        }
    } catch (e) {
        cell.log("WARN", "Failed to load existing certs, regenerating...");
    }

    return generateSelfSignedCert();
}

// Store session in memory (could use Redis for multi-instance)
const sessions = new Map<string, {
    sessionId: string;
    userId: string;
    createdAt: number;
}>();

function getOrCreateSession(deviceId: string) {
    if (!sessions.has(deviceId)) {
        sessions.set(deviceId, {
            sessionId: `tts_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: `voice-user-${deviceId}`,
            createdAt: Date.now()
        });
    }
    return sessions.get(deviceId)!;
}

// Load or generate certificates
const { cert, key } = loadOrGenerateCerts();

Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    tls: {
        cert,
        key,
    },
    async fetch(req) {
        const url = new URL(req.url);
        const reqId = Math.random().toString(36).substring(7).toUpperCase();

        // 1. Serve Terminal UI
        if (url.pathname === "/") {
            cell.log("INFO", `[${reqId}] 📱 New UI session requested from ${req.headers.get("user-agent")?.split(" ")[0] || "unknown"}`);
            return new Response(UI_HTML, { headers: { "Content-Type": "text/html" } });
        }

        // 2. API: Get or create session (call this on page load)
        if (url.pathname === "/api/session") {
            const deviceId = url.searchParams.get("device") || `anon_${Math.random().toString(36).substr(2, 8)}`;
            const session = getOrCreateSession(deviceId);

            return Response.json({
                deviceId,
                sessionId: session.sessionId,
                userId: session.userId
            });
        }

        // In the fetch handler, for /api/converse:
        // API: Conversation Pipeline
        if (url.pathname === "/api/converse") {
            const startTime = Date.now();
            const reqId = Math.random().toString(36).substring(7).toUpperCase();

            // Create streaming response
            const stream = new TransformStream();
            const writer = stream.writable.getWriter();
            const encoder = new TextEncoder();

            // Track writer state to prevent double-close
            let writerClosed = false;
            const safeWrite = (obj: any) => {
                if (writerClosed) return;
                try {
                    const line = JSON.stringify(obj) + "\n";
                    writer.write(encoder.encode(line));
                } catch (e) {
                    // Writer might be closed, ignore
                }
            };
            const safeClose = () => {
                if (writerClosed) return;
                writerClosed = true;
                writer.close().catch(() => { });
            };

            // Process request in background
            (async () => {
                try {
                    const body = await req.json();
                    const userText = body.text;  // <-- text is defined here
                    const voiceId = body.voice || "en-US-Achernar";
                    const sessionId = body.sessionId;
                    const userId = body.userId || "voice-term-01";

                    // MOVE THE LOG HERE - after parsing body.text
                    cell.log("INFO", `[${reqId}] 📥 VOICE_START: "${userText.substring(0, 50)}..."`);

                    if (!userText) {
                        safeWrite({ error: "No text provided", code: "NO_TEXT" });
                        safeClose();
                        return;
                    }

                    if (!sessionId) {
                        safeWrite({ error: "No session ID provided", code: "NO_SESSION" });
                        safeClose();
                        return;
                    }

                    // Step 1: Kindly
                    safeWrite({ status: "processing", step: "thinking", message: "AI analyzing..." });

                    const chatRes = await cell.mesh.kindly.chat({
                        message: userText,
                        systemContext: {
                            userId: userId,
                            username: "Administrator",
                            role: "admin",
                            channel: "voice",
                            sessionId: sessionId
                        }
                    });

                    const kLatency = Date.now() - startTime;
                    cell.log("INFO", `[${reqId}] 🧠 KINDLY_RESPONSE: ${kLatency}ms`);

                    // Step 2: TTS
                    safeWrite({ status: "processing", step: "speaking", message: "Synthesizing voice..." });

                    const ttsRes = await cell.mesh.tts.synthesize({
                        text: chatRes.reply,
                        voice: voiceId
                    });

                    const tLatency = ttsRes.latency || (Date.now() - startTime - kLatency);
                    const totalLatency = Date.now() - startTime;

                    cell.log("INFO", `[${reqId}] 🔊 TTS_RESPONSE: ${tLatency}ms using ${ttsRes.model}`);

                    // Send final result
                    safeWrite({
                        ok: true,
                        text: chatRes.reply,
                        audio: ttsRes.audio,
                        mimeType: ttsRes.mimeType || "audio/pcm",
                        meta: {
                            reqId,
                            latency: totalLatency,
                            brain: kLatency,
                            voice: tLatency,
                            model: ttsRes.model
                        }
                    });

                    cell.log("INFO", `[${reqId}] ✅ TRANSACTION_COMPLETE: ${totalLatency}ms`);

                } catch (e: any) {
                    cell.log("ERROR", `[${reqId}] 🚨 MESH_ORCHESTRATION_FAILED: ${e.message}`);
                    safeWrite({
                        error: e.message || "Pipeline failed",
                        code: "PIPELINE_FAIL",
                        reqId
                    });
                } finally {
                    safeClose();
                }
            })();

            return new Response(stream.readable, {
                headers: {
                    "Content-Type": "application/x-ndjson",
                    "Cache-Control": "no-cache",
                    "X-Request-ID": reqId
                }
            });
        }

        return new Response("Not Found", { status: 404 });
    }
});

/**
 * Sends a diagnostic update to the central log cell
 */
async function sysAudit(reqId: string, msg: string) {
    cell.mesh.log.info({
        msg: `[${reqId}] VOICE_UI: ${msg}`,
        from: cell.id
    }).catch(() => { });
}

// ============================================================================
// IV. BOOT LOGS
// ============================================================================

cell.log("INFO", "🚀 VOICE TERMINAL SUBSTRATE ONLINE (HTTPS)");
cell.log("INFO", "=".repeat(60));
getAddresses().forEach(addr => cell.log("INFO", `📡 RELAY_LINK: https://${addr}`));
cell.log("INFO", "⚠️  Accept the self-signed certificate warning in your browser");
cell.log("INFO", "=".repeat(60));

cell.listen();