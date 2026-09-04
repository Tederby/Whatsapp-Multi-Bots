# System Architecture

This document details the internal architecture, message processing pipeline, concurrency model, and subsystem design of the WhatsApp Multi-Bots framework.

---

## 1. High-Level Architecture Overview

WhatsApp Multi-Bots is built on Node.js using ES Modules (`"type": "module"`). It connects to WhatsApp Web via the Baileys library and leverages SQLite (`better-sqlite3`) in Write-Ahead Logging (WAL) mode for local state persistence.

The system is designed around four primary architectural pillars:
1. Multi-Instance Concurrency: Multiple bot numbers can run concurrently from a single shared codebase using PM2, sharing a concurrency-safe database.
2. Modular Pipeline: Message handling is decoupled into discrete stages, from raw message ingress to command execution.
3. Hot-Reloading: Command files and auto-detection triggers can be updated live without restarting the Node.js process.
4. Resource Isolation: Heavy external processes (Chromium and yt-dlp) are governed by dedicated queue managers to protect host memory.

---

## 2. Message Processing Pipeline

Incoming messages from the Baileys socket (`messages.upsert`) are processed through a sequential pipeline in `handler.js`:

```
[ Incoming Message ]
         |
         v
  [ 1. Guard Check ] ---- (Empty sender?) ----> [ Drop ]
         |
         v
  [ 2. Sider Tracker ] -> (Update message count in group_message_counts)
         |
         v
  [ 3. Replay Protection ] -> (Timestamp > 120s old?) -> [ Drop ]
         |
         v
  [ 4. Context Builder ] -> (Resolve LID/PN, fetch cached metadata)
         |
         v
  [ 5. Early Ban Checks ] -> (User/Group banned?) -> [ Drop ]
         |
         v
  [ 6. Command Parser ] -> (Extract prefix, command name, arguments)
         |
         v
  [ 7. Blocklist Check ] -> (Sender in socket blocklist?) -> [ Drop ]
         |
         v
  [ 8. Message Claiming ] -> (Claim message ID in message_claims)
         |
         v
  [ 9. Reply Handler ] -> (Active interactive session?) -> [ Dispatch ]
         |
         v
  [ 10. Auto-Detection ] -> (Match Danbooru / Steam / Custom URL?) -> [ Trigger ]
         |
         v
  [ 11. Spam Cooldown ] -> (Exceeds chat rate limit?) -> [ Drop ]
         |
         v
  [ 12. Permissions Check ] -> (Validate admin/owner/group flags)
         |
         v
  [ 13. Command Execution ] -> (Execute handler with error boundary)
```

### Pipeline Stage Details

1. Guard Check:
   Filters out malformed messages where the sender identifier is empty or undefined.

2. Sider Tracker:
   Tracks member activity in groups when `trackingEnabled` is active in group metadata. Executed before timestamp filtering to count backlog messages during reconnection.

3. Replay Protection:
   Compares message timestamp against current server time. Messages older than 120 seconds (e.g., historical messages replayed on socket reconnect) are discarded.

4. Context Construction (`lib/contextBuilder.js`):
   Normalizes the sender JID, resolves addressing modes (`LID` vs `PN`), retrieves cached group metadata, and evaluates sender privilege flags (`isOwner`, `isBotAdmin`, `isGroupAdmins`, `isBotGroupAdmins`).

5. Early Ban Checks:
   Checks SQLite tables (`users`, `groups`, `group_banned_users`) to silently drop interactions from banned users or deactivated groups before resource-intensive operations.

6. Command Parsing (`lib/commandParser.js`):
   Detects configured command prefixes (`setting.prefixes`), strips prefix characters, extracts the primary command name, and splits arguments into structured arrays and raw strings.

7. Blocklist Validation:
   Checks the in-memory cached WhatsApp blocklist (with 60-second TTL) to drop messages from blocked contacts.

8. Multi-Bot Message Claiming:
   When multiple bot instances operate in the same WhatsApp group, each bot attempts to insert the message ID into the `message_claims` table (`claimMessage(messageId, botId)`). Only the instance that successfully acquires the claim handles the command, preventing duplicate responses.

9. Reply Handler Routing:
   Checks if the message is a reply to an interactive session registered via `registerReplyHandler()`. If matched, execution is routed directly to the session callback.

10. Auto-Detection Engine (`lib/autoDetect.js`):
    Runs non-prefixed message text against registered pattern detectors (e.g., Danbooru post URLs, Steam community links, GitHub repositories, and group auto-replies).

11. Spam Cooldown (`lib/utils.js`):
    Enforces a configurable per-chat cooldown (`setting.spamDelay`) to prevent flood attacks.

12. Permission Validation (`lib/middleware.js`):
    Validates declarative permission constraints defined on the command export (`groupOnly`, `adminOnly`, `botAdminRequired`, `ownerOnly`, `privateOnly`, `registerRequired`).

13. Command Execution:
    Executes the command `handler` function within a try-catch error boundary that logs exceptions and provides informative feedback to the user.

---

## 3. Concurrency and Multi-Instance Model

WhatsApp Multi-Bots supports running multiple isolated bot numbers from a single repository checkout.

### State Isolation vs State Sharing

- Isolated per instance:
  - Authentication sessions (`sessions/<botId>/`)
  - Temporary download directories (`temp/<botId>/`)
  - Active Baileys socket connections
  - In-memory reply handlers and local caches

- Shared across instances:
  - SQLite database file (`database.db`) operating in WAL mode with a 5000ms busy timeout
  - Command implementations (`commands/*.js`)
  - Background service logic (`services/*.js`)

### Instance Configuration via PM2

Instances are orchestrated via PM2 using `ecosystem.config.cjs`. Each instance is assigned a unique `BOT_ID` environment variable:

```javascript
module.exports = {
  apps: [
    {
      name: "bot1",
      script: "index.js",
      env: {
        BOT_ID: "bot1",
        BOT_NAME: "Primary Bot",
        PAIRING_NUMBER: "6281234567890"
      }
    },
    {
      name: "bot2",
      script: "index.js",
      env: {
        BOT_ID: "bot2",
        BOT_NAME: "Secondary Bot",
        PAIRING_NUMBER: "6289876543210"
      }
    }
  ]
};
```

---

## 4. Hot-Reload Architecture

The bot incorporates runtime hot-reloading for commands via `chokidar` in `commands/_registry.js`:

1. File Watcher:
   A file watcher monitors the `commands/` directory for file creations, modifications, and deletions.

2. Dynamic Import Invalidation:
   When a command file changes, the registry clears the internal command map and re-imports the module with a cache-busting query parameter (`import(`${filePath}?v=${Date.now()}`)`).

3. Zero Downtime:
   New commands, bug fixes, and permission modifications take effect instantly without restarting running bot processes or severing active WhatsApp socket connections.

---

## 5. Background Services and Resource Queues

### Download Queue (`services/downloadQueue.js`)
Manages yt-dlp media extractions with concurrency throttling (`maxConcurrent: 4`). Prevents CPU and bandwidth saturation when multiple users request video downloads simultaneously.

### Puppeteer Queue (`services/puppeteerQueue.js`)
Serializes Chromium browser instances used for generating quote graphics (`!quote`) and rendering website screenshots (`!screenshot`). Enforces strict single-instance or limited-concurrency execution to prevent high RAM consumption on low-tier VPS environments.

### Cleanup Service (`services/cleanup.js`)
Periodically scans temporary directories (`temp/`) and purges expired media files and cached artifacts based on configured retention thresholds (`setting.ytdlp.fileExpiry`).

---

## 6. Interactive HTML UI Engine and Protocol Relay

The framework includes an interactive HTML UI rendering engine (`lib/uiEngine.js`) that enables commands to deliver full graphical webviews directly to the WhatsApp mobile and desktop clients.

### Protocol Message Construction

Interactive UI messages are packaged into the WhatsApp `richResponseMessage` protobuf format and relayed through `sock.relayMessage()`:

1. Payload Assembly:
   HTML and CSS assets are structured into a JSON payload with `__typename: "GenAIaeacdsnwHtmlPrimitive"` and serialized into a Base64 string:

```javascript
const payload = Buffer.from(JSON.stringify({
    response_id: responseId,
    sections: [{
        view_model: {
            primitive: {
                __typename: "GenAIaeacdsnwHtmlPrimitive",
                payload: htmlString,
                trusted_sources: []
            },
            __typename: "GenAISingleLayoutViewModel"
        }
    }]
})).toString("base64");
```

2. Message Relay:
   The payload is wrapped in `botForwardedMessage` with context metadata linking to the bot JID (`867051314767696@bot`) and dispatched via `sock.relayMessage(chatId, messageStructure, { messageId: responseId })`.

3. Client-Side Rendering & Media Embedding:
   The WhatsApp client receives the message and renders the embedded HTML, styling, and JavaScript logic inside an isolated sandbox webview. To prevent cross-origin network blocks and IP tracking restrictions enforced by the client sandbox, media assets (such as posters and thumbnails) are converted by the server into self-contained Base64 Data URIs (`data:image/jpeg;base64,...`).

4. Client-Side Navigation and Interactivity:
   Multi-screen interfaces utilize `.ui-screen` and `.ui-screen.active` toggles, client-side pagination controllers (`‹ Prev` / `Next ›`), and tactile `.ui-btn` states (`:active`) to maintain complete immersion without requiring round-trip chat messages.

### Client-Side Sandbox Behaviors & Limitations

1. **Initial Download Gate**: Because `GenAIaeacdsnwHtmlPrimitive` carries heavy interactive payloads, the WhatsApp client enforces a download safety gate requiring the user to explicitly tap a blue "Download" label before instantiating the webview. This protects bandwidth and avoids unsolicited webview rendering.
2. **Viewport Re-mount & Lag Spikes**: The webview is re-mounted from scratch every time the message enters the client viewport (e.g. opening the chat or scrolling past the message). Persistent or accumulated webview payloads in chat history cause severe memory spikes and lag on mid/low-end devices.
3. **One-Way Sandbox & Complete Pre-baking**: The webview sandbox operates strictly one-way without an inbound channel (`fetch`, WebSocket, or IPC) back to the bot process. All dataset records, pagination pages, and detail views must be pre-baked and bundled directly into inline DOM/JSON payloads upfront.
4. **Link Blocking vs DOM Click Interactivity**:
   - **Internal DOM Events**: Client-side JavaScript click events, pagination, and multi-screen toggles (`showAnimeDetail()`, `.ui-screen.active`) execute normally inside the local webview.
   - **External Navigation**: Outbound anchor tags (`<a href="...">`), `window.open`, and `window.location` are strictly blocked by the client sandbox container and will not launch external browsers or open external links.
5. **Storage & CSP Isolation**: `localStorage`, `sessionStorage`, and `IndexedDB` access is blocked or quarantined with errors due to partitioned sandbox origins (`about:blank`). Dynamic string execution (`eval`, `new Function`) and Web Worker spawning are blocked by CSP/sandbox boundaries. UI state must be managed strictly in ephemeral JavaScript memory.
6. **Hardware & Media Sandbox**: WebGL 1/2, Web Audio API, and `navigator.vibrate` (haptics) are fully operational. Clipboard access, camera/microphone (`getUserMedia`), Web Share, and system dialogs are completely quarantined.

### Core Rendering Primitives

- `renderPage({ title, body, badge, styles })`: Renders the complete HTML document shell with base dark-mode styling, viewport constraints, referrer policies, and custom CSS injection.
- `renderCard({ icon, title, subtitle, rows, sections })`: Builds structured information cards with key-value pairs and optional nested sections.
- `renderList({ icon, title, subtitle, items })`: Generates interactive lists and menu selectors supporting item `onClick` event handlers.
- `sendUI(sock, chatId, { title, html })`: Dispatches the interactive HTML payload to the target chat and returns `{ key, messageId }` for reply tracking.

> For complete protocol specifications, standalone Baileys implementation, the empirical Chromium capability matrix, stanza size boundaries, and pseudo-button mechanics, see [**`docs/WEBVIEW_PAYLOAD.md`**](WEBVIEW_PAYLOAD.md).

