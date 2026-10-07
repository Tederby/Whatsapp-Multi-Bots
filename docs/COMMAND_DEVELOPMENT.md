# Command Development Guide

This guide describes how to create, configure, and maintain commands within the WhatsApp Multi-Bots framework.

---

## 1. Command Structure and Auto-Registration

Commands are located in the `commands/` directory. Each command is an individual ES Module file that exports a default configuration object. The command registry (`commands/_registry.js`) automatically discovers and loads all command files on startup and watches them for hot-reload updates.

### Basic Template

```javascript
// commands/example.js
export default {
    name: "example",
    aliases: ["ex", "sample"],
    category: "general",
    description: "An example command demonstration",
    usage: "!example <query>",

    // Optional declarative permission flags
    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    ownerOnly: false,
    privateOnly: false,
    registerRequired: false,

    async handler({ message, sock, args, text, sender, isGroup, pushname, prefix }) {
        if (!text) {
            return message.reply(`Usage: ${prefix}example <query>`);
        }

        await message.reply(`Received query: ${text} from ${pushname || sender}`);
    }
};
```

---

## 2. Command Metadata Properties

| Property | Type | Description |
|:---|:---|:---|
| `name` | `string` | Primary command trigger (without prefix). Must be unique. |
| `aliases` | `string[]` | Alternative triggers for the command. |
| `category` | `string` | Categorization used in `!menu` (e.g., `general`, `group`, `downloader`, `media`, `anime`, `search`, `tools`, `botadmin`, `owner`). |
| `description` | `string` | Short description displayed in help listings. |
| `usage` | `string` | Usage syntax example. |
| `flags` | `object` | *(Optional)* Declarative POSIX flag schema. When present, `handler.js` automatically parses flags and provides structured `flags` and `cleanArgs` to the handler. See [§5](#5-declarative-posix-flag-system-libflagparserjs). |

---

## 3. Declarative Permission Flags

The middleware layer (`lib/middleware.js`) evaluates permission flags before executing the command handler:

| Flag | Type | Description |
|:---|:---|:---|
| `groupOnly` | `boolean` | Restricts command execution to group chats. Rejects direct messages. |
| `adminOnly` | `boolean` | Requires the sender to be an admin in the group. |
| `botAdminRequired` | `boolean` | Requires the bot account to possess admin rights in the group. |
| `ownerOnly` | `boolean` | Restricts execution to numbers configured in `setting.owner`. |
| `privateOnly` | `boolean` | Restricts execution to 1-on-1 private direct messages. |
| `registerRequired` | `boolean` | Requires the user to have registered in the database (`!register`). |

---

## 4. Handler Context Parameters

The `handler` method receives a destructured context object containing pre-computed metadata from `lib/contextBuilder.js`:

```javascript
async handler({
    message,          // Extended WAMessage instance with helper methods (message.reply, etc.)
    sock,             // Baileys WASocket connection instance
    args,             // Array of argument tokens (e.g., ["arg1", "arg2"])
    text,             // Full argument string after the command name
    sender,           // Canonical sender JID (normalized from LID/PN)
    isGroup,          // Boolean indicating whether the message is in a group
    pushname,         // Sender display name or pushname
    groupMetadata,    // Group metadata object (participants, subject, etc.)
    groupName,        // Group subject string (empty in DMs)
    isGroupAdmins,    // Boolean indicating if the sender is a group admin
    isBotGroupAdmins, // Boolean indicating if the bot has group admin rights
    isOwner,          // Boolean indicating if the sender is a configured owner
    isBotAdmin,       // Boolean indicating if the sender is a delegated bot admin
    prefix,           // The specific prefix used to invoke this command
    botNumber,        // Canonical JID of the current bot instance
    flags,            // Parsed POSIX flags object (e.g., { top: true, ui: true })
    cleanArgs         // Arguments with all parsed flags cleanly stripped out
}) {
    // Command implementation
}
```

---

## 5. Declarative POSIX Flag System (`lib/flagParser.js`)

Commands can declare supported CLI flags via the optional `flags` property. When declared, `handler.js` automatically parses arguments using `parseFlags()`, isolates flags from query arguments, and provides a structured `flags` object and clean `args`/`cleanArgs`.

### Features & Syntax

1. **Long Flags**: Prefixed with `--` (e.g., `--keep`, `--top`, `--ui`, `--text`, `--wait=5`).
2. **Short Flags**: Single letter with `-` (e.g., `-k`, `-t`, `-u`, `-x`).
3. **Clustered / Combined Short Flags (Linux-style)**:
   - `-tu` expands to `-t` and `-u` (e.g., direct top result + UI mode in `!steam`)
   - `-mfd` expands to `-m`, `-f`, and `-d` (e.g., mobile + fullpage + dark in `!ss`)
4. **Valued Flags**: Accepts numbers or strings via `-w 5`, `-w=5`, `--wait 5`, or `--wait=5`.
5. **Numeric Shortcut Flags**: Aliases like `-1` for `--top` can be mapped directly in the schema.
6. **Double-Dash Terminator (`--`)**: Per POSIX convention, tokens after `--` are strictly treated as positional arguments.

### Example Declaration

```javascript
// commands/example.js
export default {
    name: "example",
    usage: "!example <query> [-t/--top] [-u/--ui | -x/--text]",

    flags: {
        top:  { type: "boolean", char: "t", aliases: ["top", "direct", "1"] },
        ui:   { type: "boolean", char: "u", aliases: ["ui"] },
        text: { type: "boolean", char: "x", aliases: ["text", "txt"] },
        wait: { type: "number",  char: "w", aliases: ["wait"], default: null }
    },

    async handler({ message, args, cleanArgs, flags, prefix }) {
        // Query text is clean — flags are already stripped!
        const query = (cleanArgs || args).join(" ").trim();

        if (flags.top) {
            // User supplied -t, -1, --top, or combined flag like -tu
        }
    }
};
```

---

## 6. Interactive Reply Handlers

For multi-step flows (e.g., interactive menus, pagination, confirmation prompts), commands can register temporary reply handlers via `commands/_registry.js`:

```javascript
import { registerReplyHandler, unregisterReplyHandler } from "./_registry.js";

// Inside command handler:
const sentMsg = await message.reply("Please reply with 'confirm' or 'cancel':");
const messageKey = sentMsg.key.id;

registerReplyHandler(messageKey, {
    sender: sender,
    timeoutMs: 60000, // 60 seconds TTL
    async handle({ message, text, sender }) {
        if (text.toLowerCase() === "confirm") {
            await message.reply("Action confirmed.");
            unregisterReplyHandler(messageKey);
        } else if (text.toLowerCase() === "cancel") {
            await message.reply("Action cancelled.");
            unregisterReplyHandler(messageKey);
        }
    }
});
```

> **Group Multi-User Reply Handlers (`allowAnyUser`)**: By default, `handler.js` verifies that the replying sender matches `entry.state.userId`. To allow any participant in a group to reply (e.g. for media browsing or image rolling like `!danbooru`), set `allowAnyUser: isGroup` in the handler state.
```

---

## 7. UI and Text Formatting Standard

All structured bot responses must follow the box-drawing styling standard used across `commands/menu.js`, `commands/owner.js`, `commands/profile.js`, `commands/steamprofile.js`, and `commands/mal.js`:

### Header, Body, and Footer Pattern

```
╭━━━〔 SECTION TITLE 〕━━━
┃ Label       : Value
┃ Description : Content details
┃ Status      : Active
╰━━━━━━━━━━━━━━━━━━━━━━━━
```

### Nested Sub-Section Pattern

```
╭───「 Sub Section 」
│ Key 1 : Value 1
│ Key 2 : Value 2
╰────────────────────────
```

### Implementation Example

```javascript
const lines = [
    "╭━━━〔 USER PROFILE 〕━━━",
    `┃ Name   : ${pushname}`,
    `┃ ID     : ${sender}`,
    `┃ Status : ${isRegistered ? "Registered" : "Unregistered"}`,
    "╰━━━━━━━━━━━━━━━━━━━━━━━━"
];

await message.reply(lines.join("\n"));
```

---

## 8. Interactive HTML UI Responses

For commands requiring visual interfaces, menus, or mini-games, use `lib/uiEngine.js` to deliver rich HTML webview messages:

### Example: Rendering a Profile Card

```javascript
import { sendUI, renderPage, renderCard } from "../lib/uiEngine.js";

// Inside command handler:
const cardHtml = renderCard({
    icon: "[P]",
    title: pushname || "User Profile",
    subtitle: `ID: ${sender}`,
    rows: [
        { label: "Role", value: isOwner ? "Owner" : "Member" },
        { label: "Status", value: isRegistered ? "Registered" : "Guest" }
    ],
    sections: [
        {
            title: "Statistics",
            rows: [
                { label: "Messages", value: "142" }
            ]
        }
    ]
});

const pageHtml = renderPage({
    title: "User Profile",
    badge: isOwner ? "OWNER" : "USER",
    body: cardHtml
});

await sendUI(sock, message.chat, {
    title: "User Profile",
    html: pageHtml
});
```

### Example: Rendering Interactive Menus / Category Lists

```javascript
import { sendUI, renderPage, renderList } from "../lib/uiEngine.js";

const listHtml = renderList({
    title: "Command Categories",
    subtitle: "Select a module to view available commands",
    items: [
        { icon: "[G]", title: "General", desc: "Basic information and utilities" },
        { icon: "[M]", title: "Media", desc: "Sticker and image processing" },
        { icon: "[D]", title: "Downloader", desc: "High-speed media extraction" }
    ]
});

await sendUI(sock, message.chat, {
    title: "Bot Menu",
    html: renderPage({
        title: "Navigation Menu",
        body: listHtml
    })
});
```

### UI Best Practices: Auto-Deletion & Copy Chips

Because the webview is instantiated every time the message enters the client's viewport, persistent HTML UI messages can cause severe lag for some users. To mitigate this and work around sandbox limitations:

1. **Auto-Deletion (Mandatory for UI Payloads)**:
   Always delete HTML UI payloads after 120 seconds. Standard text messages do NOT require auto-deletion.
   ```javascript
   const uiMsg = await sendUI(sock, message.chat, { title: "Menu", html: listHtml });

   // Auto-delete after 2 minutes to prevent viewport mount lag
   setTimeout(() => {
       sock.sendMessage(message.chat, { delete: uiMsg.key }).catch(() => {});
   }, 120000);
   ```

2. **Copy Chips (Replaces Deprecated Long-Press Anchors)**:
   Standard `navigator.clipboard.writeText` calls fail in the sandboxed webview. As of September 2026 (Chrome 151+), long-pressing `<a href="...">` is intercepted by WhatsApp as a message selection gesture and no longer extracts text into the composer bar. Use copyable monospace chips with `document.execCommand('copy')` on tap instead:
   ```html
   <div class="ui-chip" onclick="copyCommand('!cmd param')">!cmd param</div>
   ```
   ```javascript
   function copyCommand(text) {
       const el = document.createElement('textarea');
       el.value = text;
       document.body.appendChild(el);
       el.select();
       document.execCommand('copy');
       document.body.removeChild(el);
   }
   ```
   See [**`docs/WEBVIEW_PAYLOAD.md` §IV.2**](WEBVIEW_PAYLOAD.md) for full deprecation details.

3. **Media Asset Inlining**:
   Remote URLs (`<img src="https://...">`) are blocked by the webview sandbox. Remote images must be fetched on the server and converted into Base64 Data URIs (`data:image/...;base64,...`) before embedding. Keep thumbnails under 30–50 KB to stay well below the 1350 KB stanza ceiling.

4. **Strict Text-Only for Auto-Detection**:
   Passive link auto-detection (`lib/autoDetect.js`) MUST ALWAYS output text messages, NEVER HTML UI webviews.

### Adaptive UI vs Text Mode Pattern

Commands supporting rich UI should respect the user's `meta.displayMode` preference with fallback to `"text"`, while honoring `flags.ui` and `flags.text` from the declarative POSIX flag system (see §5):

```javascript
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, renderCard } from "../lib/uiEngine.js";

const userData = getUser(resolveUserId(sender));
let forcedMode = null;
if (flags?.ui) forcedMode = "ui";
else if (flags?.text) forcedMode = "text";
const displayMode = forcedMode || userData.meta?.displayMode || "text";

if (displayMode === "ui") {
    try {
        const cardHtml = renderCard({ ... });
        const uiMsg = await sendUI(sock, message.chat, {
            title: "Result Title",
            html: renderPage({ title: "Header", body: cardHtml })
        });
        setTimeout(() => sock.sendMessage(message.chat, { delete: uiMsg.key }).catch(() => {}), 120000);
        return;
    } catch (err) {
        console.error("[UI Fallback]", err);
    }
}

// Fallback / Text Mode
await message.reply(captionText);
```

> [!TIP]
> **Complete Technical Specification & Browser Matrix**:
> For the comprehensive standalone specification, Baileys protobuf envelope deconstruction, Chromium sandbox capability matrix (CSS, Storage, CSP, Web Audio vs HTML5 audio quarantine), and the 1350 KB stanza size ceiling, see [**`docs/WEBVIEW_PAYLOAD.md`**](WEBVIEW_PAYLOAD.md).

---

## 7. Text Output Typography & Formatting Standard

To maintain visual cohesion across all command modules while ensuring durability against mobile viewport text-wrapping, WhatsApp text output adheres to a clean, borderless typography standard.

### Typography & Structure Standard

```
🏷️ *TITLE OF THE COMMAND*
────────────────────────
⋄ Label : Value
⋄ Status : ✅ Active

*📦 Sub-section*
⋄ Key 1 : Value
⋄ Key 2 : Value

*ℹ️ Notes:* Teks panjang mengalir bebas tanpa terdistorsi oleh text-wrap.
────────────────────────
```

- **Header**: Emoji followed by bold uppercase command title (`🏷️ *TITLE*`).
- **Dividers**: Exactly 24 light horizontal characters (`────────────────────────`, `\u2500` x 24). Placed directly under the header and at the very bottom of the card.
- **Key-Value Items**: Standardize on `⋄` (diamond bullet, `\u22C4`). Clean spacing `⋄ Label : Value`. Sub-items indented with 2 spaces (`  └ ` or `  ◦ `).
- **Sub-sections**: Preceded by an empty line, bold title with emoji (`*📦 Sub-section*`), followed immediately by key-value rows.
- **Notes / Free Text**: Preceded by an empty line (`*ℹ️ Notes:* ...` or `*💡 Tip:* ...`). Paragraf mengalir alami tanpa pembatas vertikal kiri (`┃` / `│`), sehingga aman dari kerusakan akibat *line wrapping* di layar smartphone.
- **Status Emoji Indicators**:
  - `✅` Success / Registered / Enabled
  - `⚠️` Warning / Sub-optimal / Missing Permissions
  - `❌` Error / Validation Failure / Unregistered
  - `ℹ️` Information / Notice

### Dynamic Prefix Handling

Handlers must never hardcode `!` in usage cards or reply hints. Always destructure `prefix` from the handler context:

```javascript
async handler({ message, prefix, ... }) {
    const p = prefix || "!";
    if (!args.length) {
        return message.reply(
            `ℹ️ *USAGE*\n` +
            `────────────────────────\n` +
            `❌ Parameter tidak lengkap.\n` +
            `⋄ Format: *${p}command <query>*\n` +
            `────────────────────────`
        );
    }
}
```

### Shared Utilities (`lib/utils.js`)

Common formatting helpers are centralized in `lib/utils.js`:

| Export | Type | Description |
|:---|:---|:---|
| `ITEMS_PER_PAGE` | `number` (5) | Standard pagination page size constant across all paginator commands. |
| `generatePaginator(page, totalPages)` | `function` | Generates a uniform pagination footer string: `\n\n[ Page 1 / 5 ]\n◀ Previous • Next ▶`. |
| `formatUptime(seconds, options)` | `function` | Formats uptime durations. Supports `{ short: false }` for full Indonesian text and `{ short: true }` for compact counters (`1d 4h 12m 30s`). |

### Logging Convention

All command modules catch and log errors using a unified uppercase tag matching the command filename:

```javascript
try {
    // Command logic
} catch (err) {
    console.error("[COMMAND_NAME]", err);
    await message.reply("❌ Terjadi kesalahan saat memproses permintaan.");
}
```

---

## 8. Media Processing and Conversion Architecture

The framework provides an end-to-end media transcoding pipeline orchestrated by `commands/convert.js`, `lib/mediaConverter.js`, and `services/mediaQueue.js`.

### Supported Inputs and Formats

The media converter accepts media via direct caption or quoted reply across three input channels:
1. **Direct Media**: `imageMessage`, `videoMessage`, `audioMessage`, `ptvMessage`.
2. **Documents**: `documentMessage` containing media streams (preserves high-fidelity audio/video sent without WhatsApp compression).
3. **Stickers**: `stickerMessage` (both static and animated WebP stickers are accepted as valid input media).

| Target Category | Supported Formats | Delivery Mode |
|:---|:---|:---|
| **Video** | `mp4`, `webm`, `gif`, `ptv` | `videoMessage` (streaming playback; fallback to document if >64 MB) |
| **Audio** | `mp3`, `ogg`, `wav`, `m4a`, `flac`, `ptt` | `audioMessage` (`ptt: true` for voice notes; `wav`/`flac` as document) |
| **Image** | `jpg`, `png`, `webp` | `imageMessage` (clean image; `--doc` preserves raw bitstream) |

### Smart Default Conversion Matrix

When invoked with media but without a target format (`!convert`), the engine applies a context-aware default:
- **Video Input** ➔ `mp4` (re-encodes stream, applies compression)
- **Audio / Voice Note Input** ➔ `mp3` (extracts/re-encodes to universal audio)
- **Static Sticker Input** ➔ `jpg` (extracts full-resolution image)
- **Animated Sticker Input** ➔ `mp4` (converts animated WebP into playable MP4)
- **WebP Image Input** ➔ `jpg` (converts WebP graphic into standard JPEG)

### Re-Encoding & Compression

Commands support re-encoding media of the same format (e.g. `!convert mp4` on an MP4 video or `!convert jpg` on a JPEG) to re-align PTS timestamps, fix container issues, or apply bitrate reduction. Passing `--compress` (`-c`) engages aggressive optimization (CRF 30 / 720p scaling for video, 96 kbps for audio).

### Concurrency and Host Safety

Media transcoding is CPU/RAM-intensive and strictly guarded:
- **Concurrency Throttling (`services/mediaQueue.js`)**: Maximum 2 concurrent FFmpeg operations; excess requests wait with queue position feedback.
- **Input Limit**: 50 MB ceiling (`MAX_INPUT_SIZE`).
- **Output Limit**: 100 MB ceiling (`MAX_OUTPUT_SIZE`) matching WhatsApp document transport limits.
- **Probe Hardening**: `probeMedia()` and `convertMedia()` leverage `-analyzeduration 100M -probesize 100M` to reliably parse complex animated stickers and variable-frame-rate inputs.
- **Storage Isolation**: Temporary artifacts are isolated to `./temp/${botId}/` with unique timestamps and cryptographically random tokens, with guaranteed deletion in `finally` blocks.



