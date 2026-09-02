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

