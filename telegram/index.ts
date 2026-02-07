// telegram/index.ts - Telegram Bot Cell
import { TypedRheoCell } from "../protocols/typed-mesh";
import { router, procedure, z } from "../protocols/example2";
import { createServer } from "node:http";
import { config } from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_USERS = new Set([
    "6795072586", // your Telegram user ID
    // add others
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const PORT = parseInt(process.env.TELEGRAM_PORT || "3001");

if (!BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN not set in environment");
    process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const cell = new TypedRheoCell(`Telegram_${process.pid}`, 0);

// ============================================================================
// TELEGRAM API HELPERS
// ============================================================================

async function telegramRequest(method: string, params: any = {}) {
    try {
        const response = await fetch(`${TELEGRAM_API}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        const data = await response.json();

        if (!data.ok) {
            cell.log("ERROR", `Telegram API error: ${data.description}`);
            return { ok: false, error: data.description };
        }

        return { ok: true, result: data.result };
    } catch (e: any) {
        cell.log("ERROR", `Telegram request failed: ${e.message}`);
        return { ok: false, error: e.message };
    }
}

async function sendMessage(chatId: string | number, text: string, options: any = {}) {
    return telegramRequest('sendMessage', {
        chat_id: chatId,
        text,
        ...options
    });
}

async function setWebhook(url: string) {
    return telegramRequest('setWebhook', { url });
}

async function deleteWebhook() {
    return telegramRequest('deleteWebhook');
}

async function getMe() {
    return telegramRequest('getMe');
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

async function handleUpdate(update: any) {
    // Handle text messages
    if (update.message && update.message.text) {
        const message = update.message;
        const userId = message.from.id.toString();
        const chatId = message.chat.id;
        const username = message.from.username || message.from.first_name || 'User';
        const text = message.text;

        cell.log("INFO", `📱 Message from ${username}: ${text.substring(0, 50)}`);

        if (!ALLOWED_USERS.has(userId)) {
            await sendMessage(chatId, "You are not one of the choosen few. Go to openjaws github page to contact me and request access.");
            return;
        }

        try {
            // Start or get existing session via comms cell
            const session = await cell.mesh.comms['start-session']({
                channel: 'telegram',
                channelUserId: userId,
                metadata: {
                    username: message.from.username,
                    firstName: message.from.first_name,
                    lastName: message.from.last_name,
                    languageCode: message.from.language_code,
                    chatId: chatId.toString()
                }
            });

            if (session.isNew) {
                cell.log("INFO", `🆕 New Telegram user: ${username}`);
            }

            // Get AI response via comms cell
            const response = await cell.mesh.comms.chat({
                sessionId: session.sessionId,
                message: text,
                metadata: {
                    messageId: message.message_id,
                    chatType: message.chat.type
                }
            });

            // Send reply
            await sendMessage(chatId, response.reply, {
                // parse_mode: 'Markdown',
                reply_to_message_id: message.message_id
            });

            cell.log("INFO", `✅ Replied to ${username}`);

        } catch (e: any) {
            cell.log("ERROR", `Failed to process message: ${e.message}`);

            // Send error message to user
            await sendMessage(chatId,
                "Sorry, I'm having trouble processing your message right now. Please try again in a moment.",
                { reply_to_message_id: message.message_id }
            );
        }
    }

    // Handle commands
    else if (update.message && update.message.text?.startsWith('/')) {
        await handleCommand(update.message);
    }

    // Handle callback queries (inline buttons)
    else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
    }
}

async function handleCommand(message: any) {
    const chatId = message.chat.id;
    const command = message.text.split(' ')[0].toLowerCase();
    const username = message.from.username || message.from.first_name;

    switch (command) {
        case '/start':
            await sendMessage(chatId,
                `Welcome to OpenJaws, ${username}! 👋\n\n` +
                `I'm an AI assistant powered by a distributed mesh system. ` +
                `I have access to memory, skills, and various capabilities.\n\n` +
                `Just send me a message and I'll help you out!`,
                { reply_to_message_id: message.message_id }
            );
            break;

        case '/help':
            await sendMessage(chatId,
                `*Available Commands:*\n\n` +
                `/start - Start conversation\n` +
                `/help - Show this help\n` +
                `/stats - Show your statistics\n` +
                `/clear - Clear conversation history\n\n` +
                `Just send regular messages to chat with me!`,
                {
                    parse_mode: 'Markdown',
                    reply_to_message_id: message.message_id
                }
            );
            break;

        case '/stats':
            try {
                const userId = message.from.id.toString();

                // Get session
                const session = await cell.mesh.comms['start-session']({
                    channel: 'telegram',
                    channelUserId: userId
                });

                const stats = await cell.mesh.comms['get-session']({
                    sessionId: session.sessionId
                });

                if (stats.found && stats.session) {
                    const s = stats.session;
                    const createdDate = new Date(s.createdAt).toLocaleDateString();
                    const lastActiveDate = new Date(s.lastActive).toLocaleTimeString();

                    await sendMessage(chatId,
                        `*Your Statistics:*\n\n` +
                        `Messages: ${s.messageCount}\n` +
                        `Since: ${createdDate}\n` +
                        `Last active: ${lastActiveDate}\n` +
                        `Session: \`${session.sessionId.substring(0, 16)}...\``,
                        {
                            parse_mode: 'Markdown',
                            reply_to_message_id: message.message_id
                        }
                    );
                } else {
                    await sendMessage(chatId, "No statistics available yet.");
                }
            } catch (e) {
                await sendMessage(chatId, "Failed to fetch statistics.");
            }
            break;

        case '/clear':
            try {
                const userId = message.from.id.toString();

                // Get and end session
                const session = await cell.mesh.comms['start-session']({
                    channel: 'telegram',
                    channelUserId: userId
                });

                await cell.mesh.comms['end-session']({
                    sessionId: session.sessionId
                });

                await sendMessage(chatId,
                    "✅ Conversation cleared! Start fresh with /start",
                    { reply_to_message_id: message.message_id }
                );
            } catch (e) {
                await sendMessage(chatId, "Failed to clear conversation.");
            }
            break;

        default:
            await sendMessage(chatId,
                `Unknown command. Use /help to see available commands.`,
                { reply_to_message_id: message.message_id }
            );
    }
}

async function handleCallbackQuery(query: any) {
    // Handle inline button clicks
    const chatId = query.message.chat.id;
    const data = query.data;

    // Acknowledge the callback
    await telegramRequest('answerCallbackQuery', {
        callback_query_id: query.id,
        text: "Processing..."
    });

    // Handle different callback actions
    // Add custom handlers here
}

// ============================================================================
// WEBHOOK SERVER
// ============================================================================

const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const update = JSON.parse(body);
                await handleUpdate(update);
                res.writeHead(200);
                res.end('OK');
            } catch (e: any) {
                cell.log("ERROR", `Webhook error: ${e.message}`);
                res.writeHead(500);
                res.end('Error');
            }
        });
    } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// ============================================================================
// TELEGRAM ROUTER (for manual controls)
// ============================================================================

const telegramRouter = router({
    telegram: router({
        /**
         * Send message to a Telegram user
         */
        'send-message': procedure
            .input(z.object({
                chatId: z.string(),
                text: z.string(),
                parseMode: z.optional(z.enum(['Markdown', 'HTML']))
            }))
            .output(z.object({
                ok: z.boolean(),
                messageId: z.optional(z.number())
            }))
            .mutation(async (input) => {
                const result = await sendMessage(input.chatId, input.text, {
                    parse_mode: input.parseMode
                });

                return {
                    ok: result.ok,
                    messageId: result.ok ? result.result.message_id : undefined
                };
            }),

        /**
         * Get bot information
         */
        'get-me': procedure
            .input(z.void())
            .output(z.object({
                ok: z.boolean(),
                botInfo: z.any()
            }))
            .query(async () => {
                const result = await getMe();
                return {
                    ok: result.ok,
                    botInfo: result.ok ? result.result : null
                };
            }),

        /**
         * Broadcast message to all active sessions
         */
        broadcast: procedure
            .input(z.object({
                message: z.string()
            }))
            .output(z.object({
                sent: z.number(),
                failed: z.number()
            }))
            .mutation(async (input) => {
                const stats = await cell.mesh.comms['get-stats']({ channel: 'telegram' });

                let sent = 0;
                let failed = 0;

                // Get all telegram sessions from comms
                // This would need to be implemented in comms cell
                // For now, we'll skip this feature

                return { sent, failed };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(telegramRouter);
cell.listen();

cell.log("INFO", "🤖 Telegram Bot Cell starting...");

// Configure channel in comms cell
cell.mesh.comms['configure-channel']({
    channel: 'telegram',
    enabled: true,
    config: { botToken: BOT_TOKEN }
}).catch(() => {
    cell.log("WARN", "Comms cell not available yet, will retry");
});

// ============================================================================
// CONNECTION MODE: Webhook (production) or Polling (development)
// ============================================================================

const USE_POLLING = process.env.TELEGRAM_POLLING === "true";

if (USE_POLLING) {
    cell.log("INFO", "📡 Starting in POLLING mode (no webhook required)");

    let offset = 0;

    async function poll() {
        while (true) {
            try {
                const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&limit=100`);
                const data = await res.json();

                if (data.ok && data.result.length > 0) {
                    for (const update of data.result) {
                        offset = update.update_id + 1;
                        await handleUpdate(update);
                    }
                }
            } catch (e: any) {
                cell.log("WARN", `Polling error: ${e.message}`);
            }

            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Get bot info first
    getMe().then(meResult => {
        if (meResult.ok) {
            const bot = meResult.result;
            cell.log("INFO", `🤖 Bot: @${bot.username} (${bot.first_name})`);
        }
    });

    poll();
} else {
    // Webhook mode
    server.listen(PORT, async () => {
        cell.log("INFO", `📡 Telegram webhook listening on port ${PORT}`);

        const meResult = await getMe();
        if (meResult.ok) {
            const bot = meResult.result;
            cell.log("INFO", `🤖 Bot: @${bot.username} (${bot.first_name})`);
        }

        if (WEBHOOK_URL) {
            const webhookResult = await setWebhook(WEBHOOK_URL);
            if (webhookResult.ok) {
                cell.log("INFO", `✅ Webhook set: ${WEBHOOK_URL}`);
            } else {
                cell.log("ERROR", `❌ Failed to set webhook: ${webhookResult.error}`);
            }
        } else {
            cell.log("WARN", "⚠️  TELEGRAM_WEBHOOK_URL not set");
        }
    });

    // Graceful shutdown for webhook mode
    process.on('SIGTERM', async () => {
        cell.log("INFO", "🛑 Shutting down Telegram bot...");
        await deleteWebhook();
        server.close();
        process.exit(0);
    });
}

export type TelegramRouter = typeof telegramRouter;