// discord/index.ts - Discord Bot Cell
import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;

if (!BOT_TOKEN) {
    console.error("❌ DISCORD_BOT_TOKEN not set in environment");
    process.exit(1);
}

const DISCORD_API = 'https://discord.com/api/v10';

const cell = new TypedRheoCell(`Discord_${process.pid}`, 0);

// ============================================================================
// DISCORD API HELPERS
// ============================================================================

async function discordRequest(endpoint: string, options: any = {}) {
    try {
        const response = await fetch(`${DISCORD_API}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bot ${BOT_TOKEN}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.text();
            cell.log("ERROR", `Discord API error: ${response.status} ${error}`);
            return { ok: false, error };
        }

        const data = await response.json();
        return { ok: true, result: data };
    } catch (e: any) {
        cell.log("ERROR", `Discord request failed: ${e.message}`);
        return { ok: false, error: e.message };
    }
}

async function sendMessage(channelId: string, content: string, options: any = {}) {
    return discordRequest(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
            content,
            ...options
        })
    });
}

async function sendDM(userId: string, content: string) {
    // Create DM channel
    const dmResult = await discordRequest(`/users/@me/channels`, {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId })
    });

    if (!dmResult.ok) return dmResult;

    // Send message
    return sendMessage(dmResult.result.id, content);
}

async function getGatewayBot() {
    return discordRequest('/gateway/bot');
}

// ============================================================================
// DISCORD GATEWAY CONNECTION
// ============================================================================

interface GatewayMessage {
    op: number;
    d: any;
    s?: number;
    t?: string;
}

class DiscordGateway {
    private ws: any = null;
    private heartbeatInterval: any = null;
    private sessionId: string | null = null;
    private sequence: number | null = null;
    private resuming = false;

    async connect() {
        const gatewayResult = await getGatewayBot();
        if (!gatewayResult.ok) {
            cell.log("ERROR", "Failed to get gateway URL");
            return;
        }

        const gatewayUrl = gatewayResult.result.url;
        cell.log("INFO", `🌐 Connecting to Discord Gateway: ${gatewayUrl}`);

        // Use native WebSocket (available in Bun)
        this.ws = new WebSocket(`${gatewayUrl}?v=10&encoding=json`);

        this.ws.onopen = () => {
            cell.log("INFO", "✅ Connected to Discord Gateway");
            if (!this.resuming) {
                this.identify();
            } else {
                this.resume();
            }
        };

        this.ws.onmessage = (event: any) => {
            this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onclose = (event: any) => {
            cell.log("WARN", `❌ Gateway closed: ${event.code} ${event.reason}`);
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }

            // Reconnect after delay
            if (event.code !== 4004) { // Don't reconnect on invalid token
                setTimeout(() => {
                    this.resuming = true;
                    this.connect();
                }, 5000);
            }
        };

        this.ws.onerror = (error: any) => {
            cell.log("ERROR", `Gateway error: ${error}`);
        };
    }

    private identify() {
        this.send({
            op: 2, // Identify
            d: {
                token: BOT_TOKEN,
                intents:
                    (1 << 9) |  // GUILD_MESSAGES
                    (1 << 15) | // MESSAGE_CONTENT
                    (1 << 12),  // DIRECT_MESSAGES
                properties: {
                    os: 'linux',
                    browser: 'openjaws',
                    device: 'openjaws'
                }
            }
        });
    }

    private resume() {
        if (!this.sessionId || this.sequence === null) {
            this.resuming = false;
            this.identify();
            return;
        }

        this.send({
            op: 6, // Resume
            d: {
                token: BOT_TOKEN,
                session_id: this.sessionId,
                seq: this.sequence
            }
        });
    }

    private startHeartbeat(interval: number) {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            this.send({
                op: 1, // Heartbeat
                d: this.sequence
            });
        }, interval);
    }

    private send(data: GatewayMessage) {
        if (this.ws && this.ws.readyState === 1) { // OPEN
            this.ws.send(JSON.stringify(data));
        }
    }

    private async handleMessage(msg: GatewayMessage) {
        if (msg.s) {
            this.sequence = msg.s;
        }

        switch (msg.op) {
            case 10: // Hello
                cell.log("INFO", "👋 Received Hello from Discord");
                this.startHeartbeat(msg.d.heartbeat_interval);
                break;

            case 11: // Heartbeat ACK
                // Heartbeat acknowledged
                break;

            case 0: // Dispatch
                await this.handleEvent(msg.t!, msg.d);
                break;

            case 7: // Reconnect
                cell.log("WARN", "Discord requested reconnect");
                this.ws.close();
                break;

            case 9: // Invalid Session
                cell.log("ERROR", "Invalid session, reconnecting...");
                this.sessionId = null;
                this.sequence = null;
                this.resuming = false;
                setTimeout(() => this.connect(), 2000);
                break;
        }
    }

    private async handleEvent(eventType: string, data: any) {
        switch (eventType) {
            case 'READY':
                this.sessionId = data.session_id;
                cell.log("INFO", `🤖 Bot ready: ${data.user.username}#${data.user.discriminator}`);

                // Configure channel in comms
                await cell.mesh.comms['configure-channel']({
                    channel: 'discord',
                    enabled: true,
                    config: {
                        botToken: BOT_TOKEN,
                        userId: data.user.id,
                        username: data.user.username
                    }
                }).catch(() => {
                    cell.log("WARN", "Comms cell not available yet");
                });
                break;

            case 'MESSAGE_CREATE':
                await handleMessage(data);
                break;

            case 'INTERACTION_CREATE':
                await handleInteraction(data);
                break;
        }
    }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

async function handleMessage(message: any) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond to mentions or DMs
    const botMentioned = message.mentions?.some((m: any) => m.bot);
    const isDM = message.channel_id && !message.guild_id;

    if (!botMentioned && !isDM) return;

    const userId = message.author.id;
    const username = message.author.username;
    const discriminator = message.author.discriminator;
    let text = message.content;

    // Remove bot mention from text
    text = text.replace(/<@!?\d+>/g, '').trim();

    // Handle commands
    if (text.startsWith('!')) {
        await handleCommand(message);
        return;
    }

    cell.log("INFO", `💬 Message from ${username}#${discriminator}: ${text.substring(0, 50)}`);

    try {
        // Start or get existing session via comms cell
        const session = await cell.mesh.comms['start-session']({
            channel: 'discord',
            channelUserId: userId,
            metadata: {
                username,
                discriminator,
                guildId: message.guild_id,
                channelId: message.channel_id
            }
        });

        if (session.isNew) {
            cell.log("INFO", `🆕 New Discord user: ${username}#${discriminator}`);
        }

        // Get AI response via comms cell
        const response = await cell.mesh.comms.chat({
            sessionId: session.sessionId,
            message: text,
            metadata: {
                messageId: message.id,
                guildId: message.guild_id,
                channelId: message.channel_id
            }
        });

        // Send reply
        await sendMessage(message.channel_id, response.reply, {
            message_reference: {
                message_id: message.id
            }
        });

        cell.log("INFO", `✅ Replied to ${username}#${discriminator}`);

    } catch (e: any) {
        cell.log("ERROR", `Failed to process message: ${e.message}`);

        // Send error message
        await sendMessage(message.channel_id,
            "Sorry, I'm having trouble processing your message right now. Please try again in a moment.",
            {
                message_reference: {
                    message_id: message.id
                }
            }
        );
    }
}

async function handleCommand(message: any) {
    const parts = message.content.split(' ');
    const command = parts[0].toLowerCase();
    const userId = message.author.id;
    const username = message.author.username;

    switch (command) {
        case '!help':
            await sendMessage(message.channel_id,
                `**OpenJaws AI Assistant**\n\n` +
                `**Commands:**\n` +
                `\`!help\` - Show this help\n` +
                `\`!stats\` - Show your statistics\n` +
                `\`!clear\` - Clear conversation history\n\n` +
                `**Usage:**\n` +
                `Mention me or DM me to chat!`
            );
            break;

        case '!stats':
            try {
                const session = await cell.mesh.comms['start-session']({
                    channel: 'discord',
                    channelUserId: userId
                });

                const stats = await cell.mesh.comms['get-session']({
                    sessionId: session.sessionId
                });

                if (stats.found && stats.session) {
                    const s = stats.session;
                    const createdDate = new Date(s.createdAt).toLocaleDateString();
                    const lastActiveDate = new Date(s.lastActive).toLocaleTimeString();

                    await sendMessage(message.channel_id,
                        `**Your Statistics**\n\n` +
                        `Messages: ${s.messageCount}\n` +
                        `Since: ${createdDate}\n` +
                        `Last active: ${lastActiveDate}\n` +
                        `Session: \`${session.sessionId.substring(0, 16)}...\``
                    );
                }
            } catch (e) {
                await sendMessage(message.channel_id, "Failed to fetch statistics.");
            }
            break;

        case '!clear':
            try {
                const session = await cell.mesh.comms['start-session']({
                    channel: 'discord',
                    channelUserId: userId
                });

                await cell.mesh.comms['end-session']({
                    sessionId: session.sessionId
                });

                await sendMessage(message.channel_id,
                    "✅ Conversation cleared! Mention me to start fresh."
                );
            } catch (e) {
                await sendMessage(message.channel_id, "Failed to clear conversation.");
            }
            break;
    }
}

async function handleInteraction(interaction: any) {
    // Handle slash commands and other interactions
    // Can be extended later
}

// ============================================================================
// DISCORD ROUTER (for manual controls)
// ============================================================================

const discordRouter = router({
    discord: router({
        /**
         * Send message to a Discord channel
         */
        'send-message': procedure
            .input(z.object({
                channelId: z.string(),
                content: z.string()
            }))
            .output(z.object({
                ok: z.boolean(),
                messageId: z.optional(z.string())
            }))
            .mutation(async (input) => {
                const result = await sendMessage(input.channelId, input.content);
                return {
                    ok: result.ok,
                    messageId: result.ok ? result.result.id : undefined
                };
            }),

        /**
         * Send DM to a user
         */
        'send-dm': procedure
            .input(z.object({
                userId: z.string(),
                content: z.string()
            }))
            .output(z.object({
                ok: z.boolean()
            }))
            .mutation(async (input) => {
                const result = await sendDM(input.userId, input.content);
                return { ok: result.ok };
            })
    })
});

// ============================================================================
// CELL SETUP
// ============================================================================

cell.useRouter(discordRouter);
cell.listen();

cell.log("INFO", "🎮 Discord Bot Cell starting...");

// Connect to Discord Gateway
const gateway = new DiscordGateway();
gateway.connect();

// Graceful shutdown
process.on('SIGTERM', () => {
    cell.log("INFO", "🛑 Shutting down Discord bot...");
    process.exit(0);
});

export type DiscordRouter = typeof discordRouter;