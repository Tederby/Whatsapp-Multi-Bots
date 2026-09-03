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
    botNumber         // Canonical JID of the current bot instance
}) {
    // Command implementation
}
```

---

## 5. Interactive Reply Handlers

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

---

## 6. UI and Text Formatting Standard

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

## 7. Interactive HTML UI Responses

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

### UI Best Practices: Auto-Deletion & Pseudo-Buttons

Because the webview is instantiated every time the message enters the client's viewport, persistent HTML UI messages can cause severe lag for some users. To mitigate this and work around sandbox limitations:

1. **Auto-Deletion (UI Payloads Only)**:
   Always delete HTML UI payloads after a set duration (e.g., 2 minutes for read-only info like `!anime`) or immediately after a user resolves an interaction (e.g., selecting a media item to download). Standard text messages do NOT require auto-deletion.
   ```javascript
   const uiMsg = await sendUI(sock, message.chat, { title: "Menu", html: listHtml });

   // Auto-delete after 2 minutes to prevent client lag
   // Note: uiMsg.key from sendUI includes fromMe: true so revocation works in both groups and 1-on-1 chats
   setTimeout(() => {
       sock.sendMessage(message.chat, { delete: uiMsg.key }).catch(() => {});
   }, 120000);
   ```

2. **Pseudo-Buttons & Direct Commands**:
   - **Clipboard API Limitations**: In the sandboxed iframe/webview, standard `navigator.clipboard.writeText` calls fail due to missing clipboard permissions and lack of top-level document focus.
   - **Native WhatsApp Long-Press Extraction Mechanics**: When a user long-presses an HTML anchor tag (`<a href="...">`), the native WhatsApp client intercepts the gesture and automatically extracts both the anchor's inner text and its resolved target link, concatenating them as: `[innerText] [href]` directly into the user's text composer bar (*auto-paste*).
   - **Tokenized Parameterized Command Pattern (Recommended)**:
     Structure pseudo-buttons where the **link text is the command name/prefix** and the **`href` contains the dynamic argument or target URL**:
     ```html
     <!-- Long-press yields: "!ytdl https://youtu.be/dQw4w9WgXcQ" in chat bar -->
     <a href="https://youtu.be/dQw4w9WgXcQ" class="btn">!ytdl</a>

     <!-- Long-press yields: "!anime --id 12345" in chat bar -->
     <a href="12345" class="btn">!anime --id</a>
     ```
     When released, the complete executable command with its parameter appears directly in the chat bar ready to send with one tap. This eliminates the need for manual quoted replies, saves user friction from copying long URLs/IDs, and keeps the server pipeline stateless.
   - **The `about:blank#` Trap (Avoid for Parameterless Commands)**:
     Because the webview is loaded from a raw data buffer without a base URL, the document's `document.baseURI` is `about:blank`. Using a dummy relative anchor like `<a href="#">!ping</a>` will cause the browser to resolve `href` to `about:blank#`, resulting in `!ping about:blank#` (or `about:blank#`) being pasted into the chat bar.
     - **For commands WITHOUT parameters** (e.g. `!ping` in `!menu`): Do NOT use anchor tags with dummy `href="#"`. Instead, render them as selectable chips (`user-select: all` / `user-select: text`) or simple non-anchor badges.
     - **For commands WITH parameters** (e.g. `ytsearch`, `download`, `anime` details): Use `<a href="<param>">!cmd</a>` to leverage native concatenation and assemble the full command string automatically.

3. **State-Free Self-Contained UI**:
   If a command renders a multi-screen UI where navigation (pagination, detail drill-down) is handled entirely client-side via JavaScript, **do not register a `replyHandler` in server memory**. Registering unused reply handlers for webview messages causes memory leaks since users interact on-screen rather than sending quoted chat replies.

4. **Strict Text-Only for Auto-Detection**:
   When a message is triggered passively by link auto-detection (`lib/autoDetect.js`), it MUST ALWAYS be sent in text mode (`displayMode = 'text'`), NEVER as an HTML Webview UI payload. Delivering floating or auto-deleting webviews on passive URL matches causes viewport clutter, race conditions, and disruption in active group/personal chats.

5. **Media Artwork Proportions & Aspect Ratios**:
   Always match CSS containers and thumbnails to the native aspect ratio of the content domain:
   - **Anime / Manga (MAL)**: Portrait format (`~2:3` or `3:4`). Use 38×54 px for list thumbnails and 140×200 px for detail posters.
   - **Games (Steam / Store)**: Landscape banner format (`~2.14:1` or `16:9`). Use 72×32 px for capsule thumbnails and responsive `aspect-ratio: 460/215` (max-width 380 px) for header banners. Never squeeze landscape banners into portrait frames.

6. **Prohibition of External Outbound Link Buttons**:
   Outbound hyperlinks (`<a href="https://...">`), `window.open()`, and `window.location` are **strictly blocked by the WhatsApp client webview sandbox**. Clicking external links will NOT launch the external system browser or open web pages. Never include external link buttons (such as "View on MyAnimeList", "View on Steam Store", etc.) in webview payloads as they are completely non-functional. If an interaction needs to trigger an action, format it as a tokenized pseudo-button command (`<a href="<target_url>">!cmd</a>`) that uses native long-press text extraction to assemble the command into the WhatsApp composer bar.

### Adaptive UI vs Text Mode Pattern

When building commands that support rich HTML UI, respect the user's `meta.displayMode` preference with default fallback to `"ui"`, and allow on-the-fly override flags (`--ui` / `--text`):

```javascript
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, renderCard } from "../lib/uiEngine.js";

// Determine active mode: flag override > DB preference > default "ui"
const userData = getUser(resolveUserId(sender));
const displayMode = forcedMode || (userData.meta?.displayMode ?? "ui");

if (displayMode === "ui") {
    try {
        const cardHtml = renderCard({ ... });
        await sendUI(sock, message.chat, {
            title: "Result Title",
            html: renderPage({ title: "Header", body: cardHtml })
        });
        return;
    } catch (err) {
        console.error("[UI Fallback]", err);
        // Fallback to text below
    }
}

// Fallback / Text Mode
await message.reply(captionText);
```

#### Lifecycle & Architecture: UI Mode vs Text Mode

| Dimension | UI Mode (`"ui"`) | Text Mode (`"text"`) |
|:---|:---|:---|
| **Payload Type** | `GenAIaeacdsnwHtmlPrimitive` (Webview) | Plain text (Box-drawing characters) |
| **Client Impact** | Re-mount lag spike when entering viewport | Zero lag, native message list |
| **Interactivity** | In-webview client-side DOM (pagination, screens) | Quoted chat replies via `registerReplyHandler` |
| **Auto-Deletion** | **Mandatory** (120s timer) to prune laggy payloads | **Disabled** (persists in chat history) |
| **Server State** | **State-free** (no reply handlers in memory) | Cleaned up on response or 15m background purge |

#### Guidelines for Webview UI Commands
1. **Media Assets**: Always convert remote images into Base64 Data URIs (`data:image/...;base64,...`) on the server before embedding in the webview to bypass sandbox network restrictions.
2. **Per-Command CSS Overrides**: Use `renderPage({ styles: '...' })` to inject command-specific CSS that overrides the base design system when the default look doesn't fit. See `commands/anime.js` for a full example using custom `a-*` prefixed classes.
3. **Design Philosophy**: Keep UI flat and minimal. Avoid gradients, glassmorphism, heavy shadows, excessive emoji icons, and entrance animations. Use the neutral zinc/gray palette from the base design system.
4. **Immersive Navigation**: For paginated or multi-screen commands, embed the dataset into `<script>` and provide client-side controls (`.ui-screen.active`, `← Prev` / `Next →` buttons) so users do not have to break immersion by typing chat replies.

### WhatsApp In-App Webview Runtime & Capability Matrix

HTML payloads rendered via `sendUI()` execute inside WhatsApp's native sandboxed WebView (Chromium-based on Android/Desktop). The following empirical matrix defines supported vs blocked browser APIs:

| Category | Supported (`✓`) | Blocked / Unsupported (`✗`) | Developer Guidelines |
|:---|:---|:---|:---|
| **CSS Layout** | `display: grid`, `flex`, `subgrid`, Container Queries (`container-type`), `aspect-ratio`, `gap`, `position: sticky`, `:has()`, `:is()` | — | Full modern responsive CSS is 100% safe to use without polyfills. |
| **CSS Visual** | `backdrop-filter`, `filter`, `clip-path`, `mix-blend-mode`, `color: oklch()`, `accent-color`, `scroll-snap-type`, `view-transition-name`, `animation-timeline` | — | High-fidelity styling, shapes, and scroll-driven CSS animations work natively. |
| **Storage** | — | `localStorage`, `sessionStorage`, `IndexedDB` | **ALL CLIENT STORAGE IS BLOCKED**. `localStorage` throws `SecurityError` and `IndexedDB.open()` fails/is quarantined due to `about:blank` origin. Keep all UI and navigation state strictly in JavaScript memory variables. |
| **JavaScript & CSP** | Native ES6+ syntax (`async/await`, Promises, `fetch`, `WebSocket`, `structuredClone`, `BroadcastChannel`) | Dynamic `eval()`, `new Function()`, Web Workers, Service Workers | CSP restricts `unsafe-eval` and worker spawning (Blob/data URL workers fail). Native ES6+ (including `async/await`) executes normally when written directly in `<script>` tags without string evaluation. |
| **Device & Haptics** | `navigator.vibrate`, Touch Events, Gamepad API | Clipboard API (`navigator.clipboard`), Geolocation, Battery Status, Device Orientation, Bluetooth, USB | Use `navigator.vibrate([15])` for haptic tap feedback. Never rely on Clipboard API (use pseudo-button `<a href="...">` long-press instead). Hardware permissions (GPS, camera, mic, clipboard) are quarantined. |
| **Media & Graphics** | WebGL, WebGL2, Web Audio API, `MediaRecorder`, Picture-in-Picture, WebRTC | `getUserMedia` (camera/mic), WebGPU | Canvas 2D/3D games and synthesized Web Audio effects work out-of-the-box. Camera and microphone access are quarantined. |
| **System & Browser** | `prefers-color-scheme` (dark mode), `navigator.onLine`, Permissions API | Notification API, Web Share API, Wake Lock API, Idle Detection, Payment Request | Automatic theme detection works. System push dialogs, wake locks, and OS share sheets are blocked. |

