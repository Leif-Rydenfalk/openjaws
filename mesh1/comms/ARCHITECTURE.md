# Multi-Channel Setup Guide

This guide shows how to set up Telegram and Discord bots as proper OpenJaws cells.

## Architecture

```
┌──────────────────────────────────────────────┐
│           OpenJaws Mesh                      │
│                                              │
│  ┌─────────────┐                            │
│  │ Comms Hub   │ ← Session Management       │
│  └──────┬──────┘                            │
│         │                                    │
│    ┌────┴────┬─────────┬──────────┐        │
│    │         │         │          │         │
│  ┌─▼──┐  ┌──▼──┐  ┌──▼───┐  ┌───▼───┐    │
│  │Web │  │Tele │  │Discord│  │Kindly │    │
│  │Cell│  │gram │  │ Cell  │  │ Cell  │    │
│  └────┘  └─────┘  └───────┘  └───────┘    │
│                                              │
└──────────────────────────────────────────────┘
```

Each channel is a **separate cell** that:
- Handles its own protocol (HTTP/WebSocket/Gateway)
- Manages platform-specific authentication
- Routes conversations through Comms Hub
- Has its own capabilities for sending messages

## Telegram Bot Cell

### Prerequisites

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get your bot token
3. Set up a public webhook URL (ngrok, your domain, etc.)

### Configuration

**File: `.env` (or `telegram/Cell.toml`)**
```bash
# Required
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"

# Optional - webhook URL (required for production)
TELEGRAM_WEBHOOK_URL="https://yourdomain.com/webhook"

# Optional - custom port (default: 3001)
TELEGRAM_PORT="3001"
```

### Setup Steps

1. **Get Bot Token**:
   ```
   1. Open Telegram and search for @BotFather
   2. Send /newbot
   3. Follow prompts to name your bot
   4. Copy the token provided
   ```

2. **Set Environment Variables**:
   ```bash
   # Add to .env file at project root
   echo 'TELEGRAM_BOT_TOKEN="your_token_here"' >> .env
   echo 'TELEGRAM_WEBHOOK_URL="https://yourdomain.com/webhook"' >> .env
   ```

3. **Configure Webhook** (for production):
   
   If using ngrok for development:
   ```bash
   ngrok http 3001
   # Copy the https URL
   export TELEGRAM_WEBHOOK_URL="https://abc123.ngrok.io/webhook"
   ```

4. **Start the Cell**:
   ```bash
   # Orchestrator will start it automatically
   # Or manually:
   cd telegram
   bun run index.ts
   ```

5. **Test**:
   ```
   1. Open Telegram
   2. Search for your bot (@YourBotName)
   3. Send /start
   4. Chat with the bot!
   ```

### Available Commands

- `/start` - Start conversation
- `/help` - Show help
- `/stats` - Show your statistics
- `/clear` - Clear conversation history

### Webhook vs Polling

**Webhook (Production)**:
- Set `TELEGRAM_WEBHOOK_URL`
- Cell runs HTTP server on port 3001
- Telegram sends updates to your URL
- More reliable and faster

**Polling (Development)** (not implemented yet):
- Leave `TELEGRAM_WEBHOOK_URL` empty
- Cell polls Telegram API every few seconds
- Good for local development
- Higher latency

---

## Discord Bot Cell

### Prerequisites

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Get bot token and application ID
3. Enable required intents
4. Invite bot to your server

### Configuration

**File: `.env` (or `discord/Cell.toml`)**
```bash
# Required
DISCORD_BOT_TOKEN="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.AbCdEf.GhIjKlMnOpQrStUvWxYz"
DISCORD_APPLICATION_ID="1234567890123456789"
```

### Setup Steps

1. **Create Application**:
   ```
   1. Go to https://discord.com/developers/applications
   2. Click "New Application"
   3. Name your application
   4. Go to "Bot" section
   5. Click "Add Bot"
   6. Copy the token
   ```

2. **Enable Intents**:
   ```
   In the Bot section, enable:
   - ✅ Server Members Intent (optional)
   - ✅ Message Content Intent (REQUIRED)
   ```

3. **Set Environment Variables**:
   ```bash
   echo 'DISCORD_BOT_TOKEN="your_token_here"' >> .env
   echo 'DISCORD_APPLICATION_ID="your_app_id_here"' >> .env
   ```

4. **Invite Bot to Server**:
   ```
   Generate invite URL:
   https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=2048
   
   Permissions needed:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   ```

5. **Start the Cell**:
   ```bash
   # Orchestrator will start it automatically
   # Or manually:
   cd discord
   bun run index.ts
   ```

6. **Test**:
   ```
   1. In your Discord server
   2. Mention the bot: @YourBot hello
   3. Or DM the bot directly
   ```

### Available Commands

- `!help` - Show help
- `!stats` - Show your statistics
- `!clear` - Clear conversation history

### How It Works

**Gateway Connection**:
- Cell connects to Discord Gateway (WebSocket)
- Receives real-time events
- Automatically reconnects on disconnect
- Handles heartbeats and session resume

**Message Handling**:
- Responds to mentions: `@YourBot hello`
- Responds to DMs
- Ignores other bot messages

---

## Web Cell (Already Exists)

The web interface needs updating to use the Comms Hub. See `comms/MIGRATION.md`.

**Quick update**:
```typescript
// In +page.server.ts
export const actions = {
  chat: async ({ request }) => {
    const data = await request.formData();
    
    // Old way (direct to Kindly)
    // const result = await cell.mesh.kindly.chat(...);
    
    // New way (via Comms)
    const result = await cell.mesh.comms.chat({
      sessionId: data.get('sessionId'),
      message: data.get('message')
    });
    
    return { reply: result.reply };
  }
};
```

---

## Adding More Channels

Want to add SMS, WhatsApp, or Slack? Follow this pattern:

### 1. Create Cell Structure
```bash
mkdir sms
cd sms
```

### 2. Create Cell.toml
```toml
id = "sms"
command = "bun run index.ts"
critical = false

[env]
TWILIO_ACCOUNT_SID = ""
TWILIO_AUTH_TOKEN = ""
TWILIO_PHONE_NUMBER = ""
```

### 3. Create index.ts
```typescript
import { TypedRheoCell } from "../protocols/example1/typed-mesh";
import { router, procedure, z } from "../protocols/example1/router";

const cell = new TypedRheoCell(`SMS_${process.pid}`, 0);

// Handle incoming messages via webhook
async function handleIncomingSMS(from: string, body: string) {
  // Start/get session
  const session = await cell.mesh.comms['start-session']({
    channel: 'sms',
    channelUserId: from
  });
  
  // Get AI response
  const response = await cell.mesh.comms.chat({
    sessionId: session.sessionId,
    message: body
  });
  
  // Send SMS reply via Twilio
  await sendSMS(from, response.reply);
}

cell.listen();
```

### 4. Add to Orchestrator
The orchestrator will automatically discover and start the cell if it has a `Cell.toml`.

---

## Testing Multi-Channel

### Test Scenario: Same User, Multiple Channels

1. **Web**: Chat on website
2. **Telegram**: Send message on Telegram
3. **Discord**: Send message on Discord

Each channel maintains separate sessions **but** can be linked via identity:

```typescript
// If user provides auth token
const session = await cell.mesh.comms['start-session']({
  channel: 'telegram',
  channelUserId: '12345',
  identityToken: 'user_jwt_token' // Links to internal user
});

// Now all conversations share temporal memory
```

### Cross-Channel Analytics

```typescript
// Get stats across all channels
const stats = await cell.mesh.comms['get-stats']({});

console.log({
  totalSessions: stats.totalSessions,
  web: stats.channels.web.stats.activeSessions,
  telegram: stats.channels.telegram.stats.activeSessions,
  discord: stats.channels.discord.stats.activeSessions
});
```

---

## Monitoring

### Check Cell Status

```bash
# Check if cells are running
ps aux | grep telegram
ps aux | grep discord

# Check logs
tail -f .rheo/logs/telegram.log
tail -f .rheo/logs/discord.log
```

### Mesh Status

```typescript
// From any cell
const health = await cell.mesh.mesh.health();
console.log(`Active cells: ${health.totalCells}`);

const commsStats = await cell.mesh.comms['get-stats']({});
console.log(`Active sessions: ${commsStats.activeSessions}`);
```

### Test Capabilities

```typescript
// Test Telegram
await cell.mesh.telegram['send-message']({
  chatId: 'user_telegram_id',
  text: 'Test message from mesh'
});

// Test Discord
await cell.mesh.discord['send-message']({
  channelId: 'discord_channel_id',
  content: 'Test message from mesh'
});
```

---

## Troubleshooting

### Telegram Issues

**Webhook not receiving messages**:
```bash
# Check webhook status
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Delete and reset webhook
curl https://api.telegram.org/bot<TOKEN>/deleteWebhook
# Restart cell to re-register
```

**401 Unauthorized**:
- Check `TELEGRAM_BOT_TOKEN` is correct
- Token format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

### Discord Issues

**Bot not responding**:
- Check "Message Content Intent" is enabled
- Verify bot has "Send Messages" permission
- Make sure you're mentioning the bot or DMing it

**Gateway connection failing**:
- Check `DISCORD_BOT_TOKEN` is correct
- Check internet connectivity
- Look for "Invalid session" in logs

**401 Unauthorized**:
- Token might be regenerated (check Developer Portal)
- Token format: Long alphanumeric string with dots

### General Issues

**Comms cell not found**:
```typescript
// Comms cell might not be started yet
// Check orchestrator logs
// Verify comms/Cell.toml exists
```

**Sessions not persisting**:
```bash
# Check data directory
ls -la comms/data/
# Should see chat_sessions.json
```

---

## Best Practices

1. **Environment Variables**: Use `.env` file, not hardcoded tokens
2. **Webhook URLs**: Use HTTPS in production (Telegram requires it)
3. **Error Handling**: Both cells have fallback error messages
4. **Rate Limiting**: Respect platform rate limits
5. **Graceful Shutdown**: Both cells clean up on SIGTERM
6. **Logging**: All events logged via cell.log()

---

## Next Steps

1. ✅ Set up Telegram bot
2. ✅ Set up Discord bot
3. ✅ Update web UI to use Comms Hub
4. Add authentication to link users across channels
5. Build admin dashboard showing all channels
6. Add SMS support (Twilio)
7. Add WhatsApp Business API
8. Add Slack app

---

## Security Notes

- **Never commit tokens** to git
- Use `.env` for local development
- Use environment variables in production
- Rotate tokens periodically
- Monitor for abuse via Comms stats
- Implement rate limiting per user
- Validate webhook sources (Telegram secret token, Discord signature)

---

**Status**: Ready for deployment
**Required**: Comms Hub cell must be running
**Optional**: Identity cell for user linking