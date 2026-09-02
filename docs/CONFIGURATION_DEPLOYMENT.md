# Configuration and Deployment Guide

This document provides step-by-step instructions for configuring, provisioning, and deploying WhatsApp Multi-Bots in production and local environments.

---

## 1. Environment Variables Reference

Copy `.env.example` to `.env` to configure global settings:

```ini
# Bot Identity
BOT_ID=default
BOT_NAME=TederbyBot
OWNER_NUMBER=6287825136146
PREFIXES=!.#/-
PAIRING_NUMBER=

# Rate Limiting
SPAM_DELAY=3000

# Optional Third-Party APIs
GEMINI_API_KEY=
YOUTUBE_API_KEY=
STEAM_API_KEY=

# Remote Shell Credentials (!bash)
SSH_HOST=127.0.0.1
SSH_PORT=22
SSH_USER=root

# Visual Branding
OWNER_IMAGE=https://example.com/owner.jpg
CHANNEL_URL=https://whatsapp.com/channel/xxxx
STICKER_PACK=WhatsApp Multi-Bots
STICKER_AUTHOR=Tederby
```

---

## 2. Multi-Bot Concurrency Setup via PM2

To run multiple bot instances concurrently from the same codebase:

1. Create `ecosystem.config.cjs` by copying the template:
   ```bash
   cp ecosystem.config.example.cjs ecosystem.config.cjs
   ```

2. Define your bot instances:
   ```javascript
   module.exports = {
     apps: [
       {
         name: "bot-primary",
         script: "index.js",
         instances: 1,
         autorestart: true,
         watch: false,
         env: {
           NODE_ENV: "production",
           BOT_ID: "bot-primary",
           BOT_NAME: "Support Bot 1",
           PAIRING_NUMBER: "6281234567890"
         }
       },
       {
         name: "bot-secondary",
         script: "index.js",
         instances: 1,
         autorestart: true,
         watch: false,
         env: {
           NODE_ENV: "production",
           BOT_ID: "bot-secondary",
           BOT_NAME: "Support Bot 2",
           PAIRING_NUMBER: "6289876543210"
         }
       }
     ]
   };
   ```

3. Start all instances:
   ```bash
   npm run pm2
   ```

4. View status or logs:
   ```bash
   pm2 status
   pm2 logs bot-primary
   ```

---

## 3. Pairing Code Authentication (Headless VPS)

If deploying to a headless VPS without a GUI or QR code rendering capabilities:

1. Supply the `PAIRING_NUMBER` variable in `.env` or in `ecosystem.config.cjs` (country code prefix without `+` or spaces, e.g. `6281234567890`).
2. Start the bot. The console will display an 8-character pairing code:
   ```
   [PAIRING] Pairing code for 6281234567890: ABCD-1234
   ```
3. Open WhatsApp on your primary device:
   - Navigate to Linked Devices.
   - Select "Link with phone number instead".
   - Enter the 8-character pairing code.

---

## 4. Operating System Prerequisites

### Linux (Ubuntu / Debian)

Run the following command to install build tools, FFmpeg, yt-dlp, and Chromium rendering libraries:

```bash
# Update and install core build tools + FFmpeg
sudo apt update && sudo apt install -y build-essential python3 ffmpeg wget curl

# Download and register yt-dlp
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Install Chromium rendering dependencies (for Puppeteer quote cards and screenshots)
sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2
```

### Windows (PowerShell)

Install FFmpeg and yt-dlp via Winget:

```powershell
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
```

For SQLite native compilation, ensure Python and Visual Studio C++ Build Tools are present.

---

## 5. Startup Diagnostics

On startup, `lib/diagnostics.js` executes automated pre-flight checks and prints a diagnostic summary to the console:

- Node.js version validation.
- Binary availability check (`ffmpeg`, `yt-dlp`).
- Optional API key validation (`GEMINI_API_KEY`, `STEAM_API_KEY`, `YOUTUBE_API_KEY`).
- SQLite database connection and WAL mode confirmation.
- Session directory accessibility.
