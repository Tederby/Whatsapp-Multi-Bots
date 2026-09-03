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
   setTimeout(() => {
       sock.sendMessage(message.chat, { delete: uiMsg.key }).catch(() => {});
   }, 120000);
   ```

2. **Pseudo-Buttons & Direct Commands**:
   - **Clipboard API Limitations**: In the sandboxed iframe/webview, standard `navigator.clipboard.writeText` calls fail due to missing clipboard permissions and lack of top-level document focus.
   - **Native WhatsApp Long-Press**: When a user long-presses an HTML anchor tag (`<a href="...">`), the native WhatsApp client intercepts the gesture and automatically extracts the link or inner text directly into the user's text composer bar (*auto-paste*).
   - **Tokenized Command Pattern**: Structure pseudo-buttons as standalone, executable bot commands (e.g., `<a href="#" class="a-btn">!anime --id 12345</a>` or `<a href="#" class="a-btn">!ytp dQw4w9WgXcQ</a>`). When released, the command appears in the chat bar ready to send with one tap. This avoids requiring manual quoted replies and eliminates complex nested condition checks in the message pipeline.

3. **State-Free Self-Contained UI**:
   If a command renders a multi-screen UI where navigation (pagination, detail drill-down) is handled entirely client-side via JavaScript, **do not register a `replyHandler` in server memory**. Registering unused reply handlers for webview messages causes memory leaks since users interact on-screen rather than sending quoted chat replies.

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

