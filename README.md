# WhatsApp Bot

A scalable, multi-instance WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) and Node.js. Designed to run multiple bot numbers simultaneously from a single codebase using PM2.

## Highlights

- **Multi-Bot** — Run dozens of bot numbers from one project via PM2. Each instance gets its own session, temp files, and config.
- **SQLite Database** — Concurrent-safe database with WAL mode. No more JSON corruption when multiple bots write simultaneously.
- **Hot-Reload** — Edit commands or the handler while the bot is running. Changes apply instantly without restart.
- **Middleware Pipeline** — Clean architecture: `guard → ban-check → context → auto-detect → parse → spam-filter → permissions → execute`.
- **Auto-Detect** — Background pattern matching that responds to specific URLs or text patterns without needing an explicit command prefix.

---

## Command Categories

Commands are auto-loaded from the `commands/` directory — just drop a `.js` file and it works. No manual imports needed.

| Category | Description |
|----------|-------------|
| 🌟 **General** | Bot info, menu, ping, system stats |
| 🛡️ **Group** | Moderation tools — add/kick members, ban users, welcome/goodbye messages, group registration |
| 📥 **Downloader** | YouTube and general media downloads via `yt-dlp` |
| 🎨 **Media** | Sticker creation, image conversion, media resending |
| 🌸 **Anime** | Anime/manga search via MyAnimeList, Danbooru image boards |
| 🔍 **Search** | Steam game search, Steam profile lookup, YouTube search |
| 🛠️ **Tools** | User registration, profiles, reminders, reports, feedback |
| 🛡️ **Bot Admin** | Commands to manage bot admins and global bans |
| 💻 **System** | System level commands, database fixing, bash terminal |
| 👑 **Owner** | Bot management, remote terminal, scanning IDs |

> Commands are actively maintained and expanded over time. Use `!menu` to see the full list of currently available commands.

---

## Requirements

- **Node.js** v18+
- **FFmpeg** — for sticker creation and media conversion
- **yt-dlp** — for media downloads
- **Puppeteer dependencies** — automatically installed via npm, but Linux servers may require OS dependencies (e.g., `libnss3`, `libatk1.0-0`, etc.)
- **PM2** *(optional)* — for multi-bot process management
- **build-essential** *(Linux)* or **Visual Studio Build Tools** *(Windows)* — for `better-sqlite3` native bindings

---

## Setup

```bash
# Clone & install
git clone https://github.com/Tederby/Whatsapp-Multi-Bots.git
cd Whatsapp-Multi-Bots
npm install

# Configure
cp .env.example .env
# Edit .env with your OWNER_NUMBER, BOT_NAME, API keys
```

### Single Bot

```bash
npm start
# Scan the QR code in terminal with WhatsApp → Linked Devices
```

### Multi-Bot (PM2)

```bash
# Migrate existing data (one-time)
npm run migrate

# Edit ecosystem.config.cjs to define your bot instances
# Then start all bots:
npm run pm2

# View QR code or pairing code for a specific bot:
pm2 logs bot1

# Add a new bot: uncomment/add entry in ecosystem.config.cjs, then:
pm2 start ecosystem.config.cjs --only bot2
pm2 logs bot2    # Scan QR
```

### Pairing Code (No QR)

If your VPS doesn't support viewing QR codes or your phone camera is broken, you can login using a phone number:


Set the `PAIRING_NUMBER` variable in `ecosystem.config.cjs`:
```javascript
env: {
  BOT_ID: "bot2",
  // ...
  PAIRING_NUMBER: "6281234567890", // Start with country code
}
```
Run `pm2 restart bot2`, and view `pm2 logs bot2` to see the 8-digit Pairing Code. Enter it on your phone via *Linked Devices* > *Link with phone number instead*.


---

## Project Structure

```
Whatsapp-Multi-Bots/
├── commands/               # Auto-loaded command modules
│   ├── _registry.js        # Dynamic loader & reply handler registry
│   └── *.js                # Individual commands
├── lib/                    # Core libraries
│   ├── autoDetect.js       # Background pattern matching
│   ├── commandParser.js    # Parses commands from messages
│   ├── contextBuilder.js   # Message context extraction
│   ├── database.js         # User/group CRUD operations
│   ├── db.js               # SQLite engine (WAL mode)
│   ├── events/             # Event handlers (group updates, etc.)
│   ├── Messages.js         # Baileys message wrapper
│   ├── middleware.js       # Permission guards
│   └── ...                 # Other libraries (quoteGenerator, utils, etc.)
├── services/               # Background services
│   ├── cleanup.js          # Periodic temp/state cleanup
│   ├── reminder.js         # Scheduled reminder system
│   ├── ytdlp.js            # yt-dlp download engine
│   └── ...                 # Other services (mal.js, steam.js, etc.)
├── scripts/
│   └── migrate_json_to_sqlite.js
├── sessions/               # Per-bot auth sessions (gitignored)
├── temp/                   # Per-bot temp files (gitignored)
├── index.js                # Entry point & connection lifecycle
├── handler.js              # Message processing pipeline
├── setting.js              # Configuration (reads from env)
├── ecosystem.config.example.cjs # PM2 multi-bot config template
├── ecosystem.config.cjs    # PM2 multi-bot config (gitignored)
└── database.db             # SQLite database (gitignored)
```

---

## Creating Commands

Drop a new `.js` file in `commands/` — the bot picks it up automatically (even at runtime via hot-reload).

```javascript
export default {
    name: "hello",
    aliases: ["hi"],
    category: "general",
    description: "Sends a greeting",
    // Optional flags: groupOnly, adminOnly, ownerOnly, privateOnly, botAdminRequired
    async handler({ message, sock, args, sender, isGroup }) {
        await message.reply("Hello! 👋");
    }
};
```

---

## License

[MIT](LICENSE)
