# 🤖 WhatsApp Multi-Bots

A scalable, high-performance, multi-instance WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) and Node.js (ES Modules). Designed to run multiple bot instances concurrently from a single unified codebase with shared SQLite storage, runtime hot-reloading, and an in-app interactive HTML webview UI engine.

---

## 📚 Documentation Suite

This `README.md` serves as a high-level summary. Detailed technical documentation, architecture deep-dives, and implementation guides are maintained in the [`docs/`](docs/) directory:

| Document | Focus & Contents |
|:---|:---|
| 📖 [**Documentation Hub**](docs/README.md) | Master index and project specifications overview. |
| 📝 [**Development Journal & Changelog**](docs/CHANGELOG.md) | Chronological rolling release notes, architectural milestones, and git-verified changelog. |
| 🏗️ [**System Architecture**](docs/ARCHITECTURE.md) | 13-stage message pipeline, multi-bot concurrency model, and webview protocol relay. |
| 🧩 [**Command Development Guide**](docs/COMMAND_DEVELOPMENT.md) | Full 55-command guide, permission flags, context builder, UI standards, and pseudo-buttons. |
| 🗄️ [**Database & Storage Architecture**](docs/DATABASE.md) | SQLite WAL configuration, table schemas, LID/PN identity mapping, and helper methods. |
| 🚀 [**Configuration & Deployment**](docs/CONFIGURATION_DEPLOYMENT.md) | Environment variables reference, PM2 multi-instance setup, headless pairing code, and OS prerequisites. |

---

## ✨ Key Highlights

- **Multi-Bot Concurrency & Zero-Duplicate Claiming** — Run multiple bot instances simultaneously via PM2. Each instance maintains its own auth session, temp storage, and Baileys socket while sharing a concurrent-safe SQLite database. An atomic `message_claims` table guarantees exactly one bot executes a command in shared groups, while `!ping` synchronizes across all active instances.
- **Interactive In-App Webview UI Engine** — Deliver graphical cards, interactive lists, and multi-screen dashboards directly inside WhatsApp's native client webview using Meta AI protobuf messaging (`GenAIaeacdsnwHtmlPrimitive`). Features a minimal dark-mode zinc/gray aesthetic, embedded Base64 media (bypassing sandbox network restrictions), client-side filtering, and tactile transitions.
- **Adaptive Display Modes (`UI` vs `Text`)** — Users choose their preferred output format globally via `!register mode <ui|text>` (viewable via `!profile`), or override on the fly with `--ui` / `--text` flags on supported commands (`!anime`, `!steam`, `!menu`).
- **Lifecycle & Memory Hygiene** — Rich webview messages automatically self-delete after 120 seconds with explicit `fromMe` keys to eliminate viewport re-mount lag and memory spikes on mobile devices.
- **Native Long-Press Pseudo-Buttons** — Overcomes webview sandbox clipboard restrictions: long-pressing an anchor tag like `<a href="param">!cmd</a>` leverages native WhatsApp text extraction to auto-paste the command directly into the chat composer bar.
- **SQLite with WAL Mode** — Centralized `better-sqlite3` database engine running in Write-Ahead Logging (WAL) mode with cached prepared statements, a 5000ms busy timeout, and automated schema migrations.
- **LID & PN Addressing Resolution** — Built-in `jidHelper.js` dynamically reconciles WhatsApp Multi-Device Linked Identity Descriptors (`@lid`) and Phone Numbers (`@s.whatsapp.net`) via the `identity_map` table so moderation, mentions, and database queries never break.
- **Modular 13-Stage Pipeline** — Decoupled message handling in `handler.js` covering replay protection, sider tracking, early ban checks, multi-bot claiming, spam rate limiting, and declarative permission validation.
- **Runtime Hot-Reloading** — Live command re-importing via Chokidar file watching with cache-busting dynamic imports—modify commands without restarting the process or dropping socket connections.
- **Resource Guardians** — Dedicated concurrency queues for media extraction (`downloadQueue.js`, max 4 concurrent downloads) and browser rendering (`puppeteerQueue.js`, serialized Chromium instances) to protect low-tier VPS environments.

---

## 🏗️ Architecture & Pipeline Overview

Incoming messages pass through a 13-stage sequential pipeline in `handler.js`:

```text
Incoming Message
  └─► 1. Guard Check          (Filter empty/malformed senders)
  └─► 2. Sider Tracker        (Record group activity before replay filter)
  └─► 3. Replay Protection    (Drop messages older than 120 seconds)
  └─► 4. Context Builder      (Normalize JID, resolve LID/PN, evaluate privileges)
  └─► 5. Early Ban Checks     (Drop banned users/groups before heavy ops)
  └─► 6. Command Parser       (Strip prefix, extract command name & arguments)
  └─► 7. Blocklist Check      (Check in-memory blocked contact cache)
  └─► 8. Message Claiming     (Atomic claim in message_claims table)
  └─► 9. Reply Handlers       (Route follow-up replies to interactive sessions)
  └─► 10. Auto-Detection      (Match passive Danbooru, Steam, or GitHub URLs)
  └─► 11. Spam Cooldown       (Enforce per-chat rate limiting)
  └─► 12. Permissions Check   (Validate adminOnly, ownerOnly, groupOnly flags)
  └─► 13. Command Execution   (Execute command handler within try-catch boundary)
```

> For full architectural specifications, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 📱 Interactive Webview UI & Display Modes

WhatsApp Multi-Bots supports two distinct presentation modes to accommodate both rich graphical interaction and ultra-lightweight text environments:

```text
# Configure personal preference
!register mode ui      # Rich graphical webview (default)
!register mode text    # Clean plain-text with box-drawing formatting

# Check current preference and user stats
!profile

# Temporary per-command flag overrides
!anime Naruto --text
!steam Elden Ring --text
!menu --text
```

| Feature | UI Mode (`"ui"`) | Text Mode (`"text"`) |
|:---|:---|:---|
| **Format** | In-app HTML webview (`GenAIaeacdsnwHtmlPrimitive`) | Standard WhatsApp message with box-drawing chars |
| **Interactivity** | In-webview client-side DOM (pagination, tabs, search) | Quoted chat replies via temporary reply handlers |
| **Lifecycle** | **Auto-deleted after 120s** to prevent mobile viewport lag | **Permanent** in chat history |
| **Media Handling** | Embedded as Base64 Data URIs to bypass sandbox restrictions | Direct image/document attachments |

---

## 📋 Command Categories Overview

The bot includes **55 built-in command modules** organized across 10 functional categories. Below is an overview of each category with representative examples:

| Category | Description | Representative Commands |
|:---|:---|:---|
| 🌟 **General & Profile** | User onboarding, system diagnostics, display preferences, latency synchronization | `!menu`, `!info`, `!ping`, `!profile`, `!register`, `!feedback` |
| 🛡️ **Group Moderation** | Participant management, greeting triggers, keyword auto-replies, sider lurker tracking | `!kick`, `!promote`, `!welcome`, `!track`, `!autoreply`, `!tag` |
| 📥 **Media Downloader** | Multi-platform video and audio extractions backed by yt-dlp concurrency queue | `!ytdl`, `!ytdlf`, `!download`, `!ytsearch` |
| 🎨 **Media & Maker** | Sticker creation, Brat-styled typography stickers, view-once media extraction | `!sticker`, `!toimg`, `!brat`, `!resend`, `!watermark` |
| 🌸 **Anime & Manga** | MyAnimeList queries with 2:3 vertical posters and Danbooru tag exploration | `!anime`, `!manga`, `!danbooru`, `!danbooru-new` |
| 🔍 **Search & Lookup** | Steam store/community search with 460/215 banners, GitHub repos, KBBI dictionary | `!steam`, `!steamprofile`, `!github`, `!kbbi` |
| 🎮 **Games & Fun** | In-app Webview RPG mini-game with Web Audio API sound synthesis and touch controls | `!yuegame` |
| 🛠️ **Tools & Utilities** | Scheduled alert reminders, Gemini AI translation, quote cards, web screenshots | `!remind`, `!translate`, `!screenshot`, `!quote` |
| 🛡️ **Bot Admin** | Cross-instance global user bans and bot profile configuration | `!gban`, `!gunban`, `!setname` |
| 💻 **System & Owner** | Bot administrator delegation, remote SSH shell, SQLite database maintenance | `!bash`, `!dbfix`, `!addbotadmin`, `!scanids` |

> 💡 *For the complete reference of all 55 commands, aliases, and permission flags, see [`docs/COMMAND_DEVELOPMENT.md`](docs/COMMAND_DEVELOPMENT.md) or send `!menu` in chat.*

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **FFmpeg**: For sticker conversion and audio processing (`sudo apt install ffmpeg`)
- **yt-dlp**: For media extraction ([installation guide](https://github.com/yt-dlp/yt-dlp#installation))
- **Chromium Dependencies**: For Puppeteer rendering (`!quote`, `!screenshot`)

### 2. Setup
```bash
# Clone and install dependencies
git clone https://github.com/Tederby/Whatsapp-Multi-Bots.git
cd Whatsapp-Multi-Bots
npm install

# Configure environment
cp .env.example .env
```

Edit `.env` with your primary settings:
```ini
BOT_ID=default
BOT_NAME=MyBot
OWNER_NUMBER=6281234567890
PREFIXES=!.#/-
SPAM_DELAY=3000
```

### 3. Run the Bot

**Single Instance (Testing)**:
```bash
npm start
# Scan terminal QR code with WhatsApp (Linked Devices > Link a Device)
```

**Multi-Instance via PM2 (Production)**:
```bash
cp ecosystem.config.example.cjs ecosystem.config.cjs
npm run pm2
pm2 logs
```

**Headless Pairing Code (No Camera / VPS)**:
Set `PAIRING_NUMBER=6281234567890` in `.env` or `ecosystem.config.cjs`. The bot will display an 8-character code in the terminal to enter under *WhatsApp > Linked Devices > Link with phone number instead*.

> For advanced deployment guides and OS dependency installation scripts, see [`docs/CONFIGURATION_DEPLOYMENT.md`](docs/CONFIGURATION_DEPLOYMENT.md).

---

## 🧩 Adding New Commands

Create a new file in `commands/` exporting a default configuration:

```javascript
// commands/hello.js
export default {
    name: "hello",
    aliases: ["hi"],
    category: "general",
    description: "Send a friendly greeting",
    usage: "!hello",

    // Optional declarative permission flags:
    // groupOnly: false, adminOnly: false, ownerOnly: false

    async handler({ message, pushname }) {
        await message.reply(`Hello ${pushname || "there"}! 👋`);
    }
};
```

Commands auto-register immediately upon file save without restarting the bot process.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
