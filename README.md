Claude AI-powered Google Ads auditor delivered to your WhatsApp — daily reports, task lists, real-time alerts, and conversational Q&A.

---

## What it does

| Feature | How to trigger |
|---|---|
| Daily audit + task list | Auto-sent every day at 8:00 AM |
| Hourly alert checks | Auto — only messages if something is wrong |
| Manual full audit | Type `audit` |
| Today's task list | Type `tasks` |
| Performance snapshot | Type `summary` or `today` |
| Ask anything | Just chat naturally |

---

## Step 1 — Get your API keys

### Twilio (WhatsApp)
1. Sign up at https://twilio.com
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Follow the sandbox setup — you'll scan a QR code to connect your number
4. Note your **Account SID**, **Auth Token**, and sandbox number (`+14155238886`)
5. For production: apply for a WhatsApp Business number in the Twilio console

### Anthropic (Claude)
1. Go to https://console.anthropic.com
2. Create an API key
3. Copy it — starts with `sk-ant-`

### Google Ads API
1. Go to https://developers.google.com/google-ads/api/docs/get-started/introduction
2. Create a **Google Cloud project** and enable the Google Ads API
3. Create **OAuth 2.0 credentials** (Desktop app type)
4. Apply for a **Developer Token** in your Google Ads Manager account
5. Run the OAuth flow to get a **refresh token**:
   ```bash
   npx google-auth-library-nodejs-samples oauth2
   ```
6. Your **Customer ID** is the 10-digit number in your Google Ads account (format: 123-456-7890, enter without dashes)

---

## Step 2 — Install and configure

```bash
# Clone / copy files to your VPS
cd /your/project/folder

# Install dependencies
npm install

# Copy the env file and fill in your keys
cp .env.example .env
nano .env
```

Fill in every value in `.env` — nothing will work without them.

---

## Step 3 — Expose your server to the internet

Twilio needs to reach your webhook. Use **nginx** as a reverse proxy with SSL:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Or use **ngrok** for testing:
```bash
ngrok http 3000
# Copy the https URL — use it as your webhook
```

---

## Step 4 — Set the Twilio webhook

1. In Twilio console → **Messaging → Settings → WhatsApp Sandbox Settings**
2. Set **"When a message comes in"** to:
   ```
   https://yourdomain.com/webhook/whatsapp
   ```
3. Method: **HTTP POST**
4. Save

---

## Step 5 — Run the bot

```bash
# Start the server
npm start

# Or with auto-restart on crash (recommended for VPS)
npm install -g pm2
pm2 start src/server.js --name ads-bot
pm2 save
pm2 startup
```

---

## Step 6 — Test it

Send `help` to your Twilio WhatsApp sandbox number. You should get the command menu back within a few seconds.

---

## Troubleshooting

**Bot not responding?**
- Check `pm2 logs ads-bot` for errors
- Verify the webhook URL is reachable: `curl https://yourdomain.com/health`
- Make sure your WhatsApp number in `.env` matches exactly (include `whatsapp:+` prefix)

**Google Ads errors?**
- Developer token must be approved (can take 1-2 days for new accounts)
- Refresh token expires if not used — re-run OAuth flow if needed
- Customer ID must be numbers only, no dashes

**WhatsApp not sending?**
- Twilio sandbox requires you to opt-in by sending a join code first
- Check Twilio console logs for delivery errors

---

## File structure

```
src/
  server.js     — Express app + cron scheduler
  whatsapp.js   — Twilio send/receive + command routing
  claude.js     — Claude AI prompt builder
  googleAds.js  — Google Ads API queries
  scheduler.js  — Daily audit + alert jobs
.env.example    — All required environment variables
package.json    — Dependencies
```
