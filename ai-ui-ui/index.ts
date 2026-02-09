import { TypedRheoCell } from "../protocols/typed-mesh";
import { networkInterfaces } from "node:os";

const PORT = 5140;
const cell = new TypedRheoCell(`AI_UI_UI_${process.pid}`, 0);

function getAddresses() {
    const interfaces = networkInterfaces();
    const list: string[] = [];
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]!) {
            if (net.family === 'IPv4') list.push(`${net.address}:${PORT}`);
        }
    }
    return list;
}

// ============================================================================
// SIMPLE CHAT UI HTML
// ============================================================================

const UI_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple AI Chat</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: #e0e0e0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        header {
            background: #1a1a1a;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        h1 {
            font-size: 1.1rem;
            font-weight: 500;
            color: #fff;
        }

        .session-info {
            font-size: 0.75rem;
            color: #666;
            font-family: monospace;
        }

        #chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .message {
            max-width: 80%;
            padding: 0.875rem 1.125rem;
            border-radius: 1rem;
            line-height: 1.5;
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            align-self: flex-end;
            background: #2563eb;
            color: white;
            border-bottom-right-radius: 0.25rem;
        }

        .message.assistant {
            align-self: flex-start;
            background: #262626;
            color: #e0e0e0;
            border-bottom-left-radius: 0.25rem;
        }

        .message.error {
            align-self: center;
            background: #7f1d1d;
            color: #fca5a5;
            font-size: 0.875rem;
        }

        .timestamp {
            font-size: 0.7rem;
            opacity: 0.6;
            margin-top: 0.25rem;
        }

        #input-area {
            background: #1a1a1a;
            padding: 1rem 1.5rem;
            border-top: 1px solid #333;
            display: flex;
            gap: 0.75rem;
        }

        #message-input {
            flex: 1;
            background: #0f0f0f;
            border: 1px solid #333;
            border-radius: 0.75rem;
            padding: 0.875rem 1rem;
            color: #fff;
            font-size: 0.9375rem;
            outline: none;
            transition: border-color 0.2s;
        }

        #message-input:focus {
            border-color: #2563eb;
        }

        #message-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        #send-btn {
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 0.75rem;
            padding: 0 1.5rem;
            font-size: 0.9375rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        #send-btn:hover:not(:disabled) {
            background: #1d4ed8;
        }

        #send-btn:disabled {
            background: #333;
            cursor: not-allowed;
        }

        .spinner {
            width: 1rem;
            height: 1rem;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .empty-state {
            text-align: center;
            color: #666;
            margin-top: 30vh;
        }

        .empty-state h2 {
            font-size: 1.25rem;
            font-weight: 400;
            margin-bottom: 0.5rem;
            color: #888;
        }

        .empty-state p {
            font-size: 0.875rem;
        }

        #loading-overlay {
            position: fixed;
            inset: 0;
            background: #0f0f0f;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            z-index: 100;
        }

        #loading-overlay.hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div id="loading-overlay">
        <div class="spinner"></div>
        <p>Connecting to AI...</p>
    </div>

    <header>
        <h1>💬 Simple AI Chat</h1>
        <span class="session-info" id="session-display">Session: ...</span>
    </header>

    <div id="chat-container">
        <div class="empty-state">
            <h2>Start a conversation</h2>
            <p>Type a message below to begin chatting with the AI</p>
        </div>
    </div>

    <form id="input-area">
        <input 
            type="text" 
            id="message-input" 
            placeholder="Type your message..." 
            autocomplete="off"
            autofocus
        >
        <button type="submit" id="send-btn">
            <span>Send</span>
        </button>
    </form>

    <script>
        // Session management
        const SESSION_KEY = 'ai_session_id';
        let sessionId = localStorage.getItem(SESSION_KEY);
        
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(SESSION_KEY, sessionId);
        }
        
        document.getElementById('session-display').textContent = 'Session: ' + sessionId.substr(0, 16) + '...';

        // DOM elements
        const chatContainer = document.getElementById('chat-container');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const inputArea = document.getElementById('input-area');
        const loadingOverlay = document.getElementById('loading-overlay');

        // Initialize session on backend
        async function initSession() {
            try {
                const res = await fetch('/api/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId })
                });
                
                if (!res.ok) throw new Error('Failed to initialize session');
                
                const data = await res.json();
                
                // Load existing messages if any
                if (data.messageCount > 0) {
                    await loadHistory();
                }
                
                loadingOverlay.classList.add('hidden');
            } catch (e) {
                showError('Failed to connect: ' + e.message);
                loadingOverlay.innerHTML = '<p style="color: #ef4444;">Connection failed. Retrying...</p>';
                setTimeout(initSession, 2000);
            }
        }

        async function loadHistory() {
            try {
                const res = await fetch('/api/history?sessionId=' + encodeURIComponent(sessionId));
                const data = await res.json();
                
                // Clear empty state
                chatContainer.innerHTML = '';
                
                data.messages.forEach(msg => addMessage(msg.role, msg.content, msg.timestamp));
            } catch (e) {
                console.error('Failed to load history:', e);
            }
        }

        function addMessage(role, content, timestamp = Date.now()) {
            // Remove empty state if present
            const emptyState = chatContainer.querySelector('.empty-state');
            if (emptyState) emptyState.remove();

            const div = document.createElement('div');
            div.className = 'message ' + role;
            
            const time = new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            div.innerHTML = `
                ${ escapeHtml(content) }
<div class="timestamp" > ${ time } </div>
    `;
            
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function showError(message) {
            const div = document.createElement('div');
            div.className = 'message error';
            div.textContent = message;
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function setLoading(loading) {
            messageInput.disabled = loading;
            sendBtn.disabled = loading;
            sendBtn.innerHTML = loading 
                ? '<div class="spinner"></div><span>Thinking...</span>'
                : '<span>Send</span>';
        }

        async function sendMessage(text) {
            if (!text.trim()) return;
            
            // Add user message immediately
            addMessage('user', text);
            messageInput.value = '';
            setLoading(true);

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, message: text })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Request failed');
                }

                const data = await res.json();
                addMessage('assistant', data.reply);
            } catch (e) {
                showError('Error: ' + e.message);
            } finally {
                setLoading(false);
                messageInput.focus();
            }
        }

        // Event listeners
        inputArea.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(messageInput.value);
        });

        // Initialize
        initSession();
    </script>
</body>
</html>
`;

// ============================================================================
// HTTP SERVER
// ============================================================================

Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    async fetch(req) {
        const url = new URL(req.url);
        const pathname = url.pathname;

        // Serve UI
        if (pathname === "/") {
            return new Response(UI_HTML, {
                headers: { "Content-Type": "text/html" }
            });
        }

        // API: Initialize session
        if (pathname === "/api/session" && req.method === "POST") {
            try {
                const { sessionId } = await req.json();

                const result = await cell.mesh['simple-ai'].session({ sessionId });

                return Response.json({
                    sessionId: result.sessionId,
                    messageCount: result.messageCount,
                    isNew: result.isNew
                });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // API: Chat
        if (pathname === "/api/chat" && req.method === "POST") {
            try {
                const { sessionId, message } = await req.json();

                if (!sessionId || !message) {
                    return new Response(JSON.stringify({ error: "Missing sessionId or message" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                const result = await cell.mesh['simple-ai'].chat({ sessionId, message });

                return Response.json({
                    reply: result.reply,
                    messageCount: result.messageCount
                });
            } catch (e: any) {
                cell.log("ERROR", `Chat failed: ${e.message}`);
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // API: Get history
        if (pathname === "/api/history" && req.method === "GET") {
            try {
                const sessionId = url.searchParams.get("sessionId");
                if (!sessionId) {
                    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }

                const result = await cell.mesh['simple-ai'].history({ sessionId });

                return Response.json({
                    messages: result.messages,
                    total: result.total
                });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        // API: Clear session
        if (pathname === "/api/clear" && req.method === "POST") {
            try {
                const { sessionId } = await req.json();
                await cell.mesh['simple-ai'].clear({ sessionId });
                return Response.json({ ok: true });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
});

// ============================================================================
// BOOT
// ============================================================================

cell.listen();

cell.log("INFO", "🌐 AI-UI Web Interface Online");
cell.log("INFO", "=".repeat(50));
getAddresses().forEach(addr => cell.log("INFO", `📱 Open: http://${addr}`));
cell.log("INFO", "=".repeat(50));