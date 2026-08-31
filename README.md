# 🤖 WhatsApp Multi-Bots

A scalable, high-performance, multi-instance WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) and Node.js (ES Modules). Designed to run multiple bot instances concurrently from a single unified codebase with shared SQLite storage.

---

## ✨ Key Highlights

- **Multi-Bot Concurrency** — Run multiple bot instances simultaneously via PM2. Each instance maintains its own auth session, temp files, and identity while sharing a concurrent-safe database.
- **SQLite with WAL Mode** — Centralized `better-sqlite3` database engine running in WAL mode with cached prepared statements for zero-corruption concurrent access.
- **Hot-Reload Architecture** — Edit message pipelines or command files at runtime without restarting the process. Changes take effect instantly.
- **Robust LID & PN Resolution** — Built-in `jidHelper.js` resolves WhatsApp Multi-Device addressing modes (LID vs PN) so user tagging, moderation, and database lookups never break.
- **Background Auto-Detection** — Pattern matching engine that automatically detects and previews URLs (Danbooru, Steam, GitHub, Group Auto-Replies) without requiring command prefixes.
- **Startup Diagnostics** — Automatically validates environment binaries (`ffmpeg`, `yt-dlp`) and API keys on boot, printing a clear diagnostic dashboard in the terminal.
- **Resource Protection** — Built-in concurrency queues for `yt-dlp` downloads and `Puppeteer` browser rendering to prevent VPS memory exhaustion.

---

## 📋 Command Categories

The bot comes with **54+ built-in commands** organized into clean categories:

| Category | Description | Examples |
|:---|:---|:---|
| 🌟 **General** | Bot info, interactive menu, ping, owner contact, user feedback | `!menu`, `!info`, `!ping`, `!owner` |
| 🛡️ **Group** | Moderation tools: add, kick, promote, demote, welcome/goodbye greetings, group registration, sider tracking | `!kick @user`, `!promote @user`, `!welcome`, `!track` |
| 📥 **Downloader** | High-speed media downloads via `yt-dlp` | `!ytdl <url>`, `!ytdlf <url>`, `!download` |
| 🎨 **Media & Maker** | Sticker creation, image conversion, Brat stickers, media resending | `!sticker`, `!toimg`, `!brat <text>`, `!resend` |
| 🌸 **Anime** | Anime/manga search via MyAnimeList, Danbooru search & recent feed | `!anime <title>`, `!manga <title>`, `!d <tag>`, `!dnew` |
| 🔍 **Search** | Steam game search & user profile lookup, YouTube search | `!steam <game>`, `!steamprofile <id>`, `!yts <query>` |
| 🛠️ **Tools** | User registration, reminders, AI translation, website screenshot, quote cards | `!register`, `!remind`, `!translate`, `!ss <url>`, `!quote` |
| 🛡️ **Bot Admin** | Bot administrator management and global user bans | `!addbotadmin`, `!gban`, `!gunban` |
| 💻 **System & Owner** | Database repair, ID scanner, remote terminal (SSH) | `!dbfix`, `!scanids`, `!bash` |

---

## ⚙️ System Requirements & OS Prerequisites

### 1. Requirements
- **Node.js**: v18.0.0 or higher
- **FFmpeg**: Required for sticker creation, audio conversion, and video processing.
- **yt-dlp**: Required for downloading video/audio from media platforms.

---

### 2. Linux (Ubuntu / Debian) Setup
Run this single command block to install all required OS libraries and tools:

```bash
# 1. Update package list & install build tools + FFmpeg
sudo apt update && sudo apt install -y build-essential python3 ffmpeg wget curl

# 2. Install latest yt-dlp binary
sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# 3. Install Chromium/Puppeteer dependencies (for !screenshot & !quote)
sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2
```

---

### 3. Windows Setup
Install FFmpeg and yt-dlp using [Winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) or [Scoop](https://scoop.sh/):

```powershell
# Using Winget (Built-in Windows 10/11)
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp

# Note for better-sqlite3: Ensure Python and Visual Studio C++ Build Tools are installed
# If compilation fails: npm install --global --production windows-build-tools
```

---

## 🚀 Quick Start & Installation

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/Tederby/Whatsapp-Multi-Bots.git
cd Whatsapp-Multi-Bots
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and edit with your settings:
```ini
BOT_NAME=MyBot
OWNER_NUMBER=6281234567890
PREFIXES=!.#/-
SPAM_DELAY=3000
```

---

### Step 3: Run the Bot

#### Option A: Single Bot Mode (Quick Test)
```bash
npm start
```
Scan the QR code displayed in the terminal with WhatsApp (*Linked Devices > Link a Device*).

#### Option B: Multi-Bot Mode via PM2 (Production)
1. Copy `ecosystem.config.example.cjs` to `ecosystem.config.cjs`:
   ```bash
   cp ecosystem.config.example.cjs ecosystem.config.cjs
   ```
2. Configure your bot instances in `ecosystem.config.cjs`.
3. Start all bot instances:
   ```bash
   npm run pm2
   ```
4. View logs and scan QR for a specific bot:
   ```bash
   pm2 logs bot1
   ```

---

## 📱 Pairing Code Login (Alternative to QR Code)

If your VPS terminal cannot render QR codes properly, or you are running headless without camera access:

1. In `ecosystem.config.cjs` (or `.env`), set `PAIRING_NUMBER`:
   ```javascript
   env: {
     BOT_ID: "bot1",
     PAIRING_NUMBER: "6281234567890", // Start with country code without '+'
   }
   ```
2. Start the bot (`npm start` or `pm2 start ecosystem.config.cjs --only bot1`).
3. View the terminal/logs to see the **8-digit Pairing Code** (e.g. `ABC1-XYZ2`).
4. On your phone: Open WhatsApp → **Linked Devices** → **Link with phone number instead** → Enter the 8-digit code.

---

## 🔑 Third-Party API Keys Matrix

All external API keys are **optional**. If a key is missing, only the corresponding command will be deactivated with an informative message; the rest of the bot works normally.

| Command | Feature | Environment Variable | Free Registration Link |
|:---|:---|:---|:---|
| `!translate` | AI Translation | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
| `!yts` | YouTube Search | `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/) (Enable *YouTube Data API v3*) |
| `!steamprofile` | Steam Profile Info | `STEAM_API_KEY` | [Steam Community API](https://steamcommunity.com/dev/apikey) |
| `!bash` | Remote Server Shell | `SSH_HOST`, `SSH_USER` | Server Owner VPS SSH |

---

## 🎨 Branding & Customization

You can customize the bot's branding directly in `.env` without modifying any code:

```ini
# Photo sent when user runs !owner
OWNER_IMAGE=https://example.com/my-photo.jpg

# WhatsApp Channel link displayed in !info
CHANNEL_URL=https://whatsapp.com/channel/xxxxxxx

# Default sticker pack name and author for !brat / !sticker
STICKER_PACK=My Awesome Bot
STICKER_AUTHOR=Admin
```

---

## 🧩 Adding New Commands

Creating a new command is effortless. Simply create a new `.js` file inside the `commands/` directory:

```javascript
// commands/hello.js
export default {
    name: "hello",
    aliases: ["hi", "hey"],
    category: "general",
    description: "Send a friendly greeting",
    usage: "!hello",
    
    // Optional permission flags:
    // groupOnly: true,
    // adminOnly: true,
    // botAdminRequired: true,
    // ownerOnly: true,
    // privateOnly: true,

    async handler({ message, sock, args, sender, isGroup, pushname }) {
        await message.reply(`Hello ${pushname || "there"}! 👋`);
    }
};
```
The command will be auto-registered immediately, even while the bot is running (via Hot-Reload)!

---

## ❓ Troubleshooting & FAQ

### 1. `better-sqlite3` fails to build during `npm install`
- **Cause**: Missing C++ compiler / build tools on your machine.
- **Fix (Linux)**: `sudo apt install -y build-essential python3`
- **Fix (Windows)**: Run PowerShell as Administrator and run `npm install --global --production windows-build-tools` or install Visual Studio C++ Desktop Development tools.

### 2. Puppeteer / Chromium fails to launch (`error while loading shared libraries`)
- **Cause**: Headless Linux servers lack GUI rendering libraries.
- **Fix**: Install required Chromium packages:
  ```bash
  sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
  ```

### 3. `yt-dlp: command not found`
- **Cause**: `yt-dlp` binary is not in your system's PATH.
- **Fix**: Make sure `yt-dlp` is placed in `/usr/local/bin/yt-dlp` (Linux) or added to Windows Environment Variables. Test with `yt-dlp --version` in your terminal.

### 4. Phone numbers in tags resolving incorrectly (LID Mode)
- In community groups and channels, WhatsApp sends participant IDs in LID format (`@lid`). The bot's built-in `lib/jidHelper.js` automatically converts and learns LID ↔ PN mappings in SQLite `identity_map` on every interaction.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
