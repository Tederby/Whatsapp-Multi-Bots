# Simple WhatsApp Bot 🤖

A fast, modular, and lightweight WhatsApp bot built with Node.js and the powerful [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) library.

This project has evolved from a barebone base into a feature-rich, highly scalable bot using a **middleware pipeline architecture** and an **automated dynamic command loader**. It is intended for both personal utility and group management, providing a robust base to build custom WhatsApp automation.

---

## ✨ Features

### 🧩 Modular Command System
Commands are automatically loaded from the `commands/` directory via `_registry.js`. You don't need to manually import new commands! Current built-in features include:

*   **🛡️ Group Moderation & Management**
    *   `add` / `kick`: Add or remove members from a group.
    *   `ban` / `gban`: Ban a user from a group or globally restrict them from using the bot.
    *   `welcome` / `goodbye`: Toggle automated welcome and farewell messages for group events.
    *   `groupprofile` / `setname`: Manage group metadata (profile picture, subject).
    *   `groupregister`: Register a group into the bot's database.
    *   `join`: Make the bot join a group via an invite link.

*   **👥 User & Profile System**
    *   `register`: Register a user profile into the bot's database.
    *   `profile`: Check user profile and stats.
    *   `owner`: View owner information.

*   **📥 Media Downloaders**
    *   `ytdl` / `ytdlf`: Robust YouTube and general media downloading via `yt-dlp` integration.
    *   `download`: Universal downloader for various platforms.

*   **🌸 Anime & Image Boards**
    *   `anime` / `manga` / `mal`: Search for anime and manga details via MyAnimeList.
    *   `danbooru` / `tag`: Fetch high-quality images and tags from Danbooru.

*   **🎨 Media Creation**
    *   `sticker` (`s`, `stiker`): Convert images/videos into WhatsApp stickers.
    *   `toimg`: Convert static stickers back into images.

*   **⚙️ Core & Utilities**
    *   `menu` (`help`, `list`): Dynamically displays all available bot commands.
    *   `ping`: Checks bot response time and server status.
    *   `say`: Makes the bot repeat your message.
    *   `del`: Delete the bot's or other user's messages (if admin).
    *   `resend`: Extracts and resends "View Once" media or messages.
    *   `info`: View bot statistics and system information.
    *   `steam`: Search for Steam games and info.

### 🕵️ Auto-Detect System
The bot features a modular background auto-detect registry (`lib/autoDetect.js` / middleware) that automatically responds to specific patterns in messages without needing explicit commands (e.g., Danbooru URL Detection).

---

## 💻 Tech Stack & Requirements

*   **Runtime:** Node.js (v18+ recommended)
*   **Library:** [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
*   **Key Dependencies:** `axios`, `wa-sticker-formatter`, `dotenv`, `chokidar` (for hot-reloading).
*   **External Requirements:**
    *   [FFmpeg](https://ffmpeg.org/) (Required for sticker creation and media conversion).
    *   [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Required for downloading media via `ytdl` commands).

---

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YourUsername/simple-wa-bot.git
   cd simple-wa-bot
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Install System Dependencies (Important):**
   Make sure you have `ffmpeg` and `yt-dlp` installed and added to your system's PATH.

4. **Environment Variables:**
   Copy the example environment file and configure your details:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to set your `OWNER_NUMBER` and `BOT_NAME`.

5. **Start the bot:**
   ```bash
   npm start
   ```

6. **Link to WhatsApp:**
   Upon running the bot for the first time, a **QR code** will be generated in the terminal. Open WhatsApp on your phone, go to **Linked Devices**, and scan the QR code. The session will be saved in the `./session` folder for subsequent logins.

---

## 📂 Project Structure

```text
simple-whatsapp-bot/
├── commands/           # Modular command files (Auto-loaded)
│   ├── _registry.js    # Dynamic command loader
│   └── ...             # All command files (.js)
├── lib/                # Core library and middleware
│   └── Messages.js     # Baileys message wrapper/serializer
├── services/           # External API services or specific heavy logic
├── session/            # WhatsApp authentication session data
├── temp/               # Temporary folder for media processing
├── index.js            # Main application entry point & connection logic
├── handler.js          # Middleware pipeline (context -> autodetect -> parse -> execute)
├── setting.js          # Global configuration structures
├── .env                # Private environment variables (Owner, Bot Name)
└── package.json        # Project metadata and dependencies
```

---

## 🛠️ Creating New Commands

Adding a new command is as simple as creating a new `.js` file inside the `commands/` directory. The bot uses an auto-loader, so you **do not** need to manually import it anywhere.

**Example `commands/hello.js`:**
```javascript
export default {
    name: "hello",
    aliases: ["hi", "greet"],
    category: "core", // Used for grouping in the menu
    usage: "hello",   // Example usage
    description: "Sends a greeting message",
    async handler({ message }) {
        await message.reply("Hello there! 👋");
    }
};
```

---

## 📜 License
This project is open-sourced under the [MIT License](LICENSE).
