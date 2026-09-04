# WhatsApp In-App Webview Payload Specification & UI Engine

> **Comprehensive Technical Specification & Implementation Guide**
> Covers both the universal, transport-agnostic WhatsApp in-app webview protocol (`GenAIaeacdsnwHtmlPrimitive`) for any Baileys bot, and the project-specific UI engine architecture (`lib/uiEngine.js`).

---

## 0. Overview & Research Status

WhatsApp clients (Android, iOS, and Web/Desktop) contain a native sandboxed WebView container initially deployed for Meta AI rich interactive responses. By constructing an undocumented protobuf stanza structure, third-party bots can deliver rich, interactive HTML/CSS/JavaScript webviews directly into WhatsApp chat threads.

> [!WARNING]
> **Undocumented Protocol Primitive**:
> This feature relies on undocumented Meta AI protobuf primitives (`GenAIaeacdsnwHtmlPrimitive` wrapped in `botForwardedMessage` and `richResponseMessage`). WhatsApp may alter or deprecate these fields in future client builds. All specifications documented here are derived from empirical testing and live reverse-engineering.

---

## PART I: UNIVERSAL PROTOCOL SPECIFICATION (BAILEYS-AGNOSTIC)

This section provides a standalone reference for any bot developer using [Baileys](https://github.com/WhiskeySockets/Baileys) (or equivalent WhatsApp Web API libraries).

### 1. Protobuf Hierarchy & Envelope

Webview payloads cannot be transmitted via standard `conversation` or `extendedTextMessage` fields. They must be packaged inside a multi-layered protobuf hierarchy:

```text
Message (Stanza Root)
  └─► messageContextInfo
  │     ├─► deviceListMetadata: {}
  │     ├─► deviceListMetadataVersion: 2
  │     └─► botMetadata
  │           └─► botResponseId: <UUIDv4>
  └─► botForwardedMessage
        └─► message
              └─► richResponseMessage
                    ├─► messageType: 1
                    ├─► submessages: [
                    │     └─► messageType: 2
                    │     └─► messageText: "<Message Preview / Title>"
                    │   ]
                    ├─► unifiedResponse
                    │     └─► data: <Base64-encoded JSON payload>
                    └─► contextInfo
                          ├─► forwardingScore: 1
                          ├─► isForwarded: true
                          ├─► forwardOrigin: 4
                          └─► forwardedAiBotMessageInfo
                                └─► botJid: "867051314767696@bot"
```

### 2. JSON Payload Schema

The `unifiedResponse.data` field requires a Base64-encoded JSON string adhering to the following schema:

```json
{
  "response_id": "<UUIDv4>",
  "sections": [
    {
      "view_model": {
        "primitive": {
          "__typename": "GenAIaeacdsnwHtmlPrimitive",
          "payload": "<!DOCTYPE html><html>...</html>",
          "trusted_sources": []
        },
        "__typename": "GenAISingleLayoutViewModel"
      }
    }
  ]
}
```

#### Field Definitions
- `response_id` (*string*, required): Unique UUIDv4 matching `botResponseId`.
- `sections[].view_model.__typename` (*string*): Must be `"GenAISingleLayoutViewModel"`.
- `sections[].view_model.primitive.__typename` (*string*): Must be `"GenAIaeacdsnwHtmlPrimitive"`.
- `sections[].view_model.primitive.payload` (*string*): Complete HTML document markup, including `<style>` and `<script>`.
- `sections[].view_model.primitive.trusted_sources` (*array*): Array of strings (leave empty `[]`).

### 3. Minimal Standalone Baileys Snippet

Any bot developer can copy and adapt this standalone function to dispatch HTML webviews:

```javascript
import { randomUUID } from "crypto";

/**
 * Dispatches an interactive HTML webview message to a WhatsApp chat.
 * Compatible with Baileys socket instances.
 *
 * @param {import("baileys").WASocket} sock - Baileys socket
 * @param {string} chatId - Target JID (e.g. "628xxx@s.whatsapp.net" or "xxx@g.us")
 * @param {object} options
 * @param {string} options.title - Preview title shown in push notifications and chat previews
 * @param {string} options.html - Full HTML markup string
 * @returns {Promise<{ key: object, messageId: string }>}
 */
export async function sendHtmlWebview(sock, chatId, { title, html }) {
    const responseId = randomUUID();
    const BOT_JID = "867051314767696@bot"; // Universal Meta AI bot JID

    // 1. Serialize the HTML primitive into Base64
    const payload = Buffer.from(
        JSON.stringify({
            response_id: responseId,
            sections: [
                {
                    view_model: {
                        primitive: {
                            __typename: "GenAIaeacdsnwHtmlPrimitive",
                            payload: html,
                            trusted_sources: [],
                        },
                        __typename: "GenAISingleLayoutViewModel",
                    },
                },
            ],
        })
    ).toString("base64");

    // 2. Relay the message with botForwardedMessage envelope
    await sock.relayMessage(
        chatId,
        {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: {
                    botResponseId: responseId,
                },
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [
                            {
                                messageType: 2,
                                messageText: title || "Interactive UI",
                            },
                        ],
                        unifiedResponse: {
                            data: payload,
                        },
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardOrigin: 4,
                            forwardedAiBotMessageInfo: {
                                botJid: BOT_JID,
                            },
                        },
                    },
                },
            },
        },
        { messageId: responseId }
    );

    return {
        key: { remoteJid: chatId, fromMe: true, id: responseId },
        messageId: responseId,
    };
}
```

---

## PART II: EMPIRICAL RUNTIME CAPABILITY MATRIX

The WhatsApp client renders the payload inside an isolated, sandboxed WebView (`about:blank` origin). The following matrix defines verified working vs blocked web technologies:

| Category | Supported (`✓`) | Blocked / Quarantined (`✗`) | Empirical Findings & Guidelines |
|:---|:---|:---|:---|
| **CSS Layout** | `display: grid`, `flex`, `subgrid`, Container Queries (`container-type`), `aspect-ratio`, `position: sticky`, `:has()`, `:is()` | — | Full modern CSS layout is 100% functional. Responsive fluid designs work cleanly. |
| **CSS Visuals** | `backdrop-filter`, `filter`, `clip-path`, `mix-blend-mode`, `color: oklch()`, `accent-color`, `scroll-snap-type`, scroll-driven animations | — | High-fidelity dark mode, custom shapes, glassmorphism, and smooth scroll snapping work natively. |
| **Client Storage** | — | `localStorage`, `sessionStorage`, `IndexedDB`, `Cookies` | **ALL CLIENT STORAGE IS BLOCKED**. Accessing `localStorage` throws `SecurityError`. `IndexedDB.open()` fails. Keep all UI state, filters, and page indexes in JavaScript memory variables. |
| **JavaScript & CSP** | Modern ES6+ syntax (`async/await`, Promises, arrow functions, `structuredClone`, `BroadcastChannel`) | Dynamic `eval()`, `new Function()`, Web Workers, Service Workers | Content Security Policy prohibits `unsafe-eval` and worker spawning (Blob/Data workers fail). Scripts inside `<script>` run normally as long as they do not invoke string evaluation. |
| **Device & Haptics** | `navigator.vibrate([ms])`, Touch events, Gamepad API | Clipboard API (`navigator.clipboard`), Geolocation, Battery, Device Orientation, Web Bluetooth | `navigator.vibrate([15])` provides excellent tactile button feedback. Clipboard access is completely blocked due to lack of top-level document focus. |
| **Media & Audio** | Canvas 2D, WebGL 1/2, Web Audio API (`AudioContext` oscillators), `MediaRecorder` | HTML5 `<audio>`, Base64 Audio Playback, `getUserMedia` (Camera/Mic), WebGPU | Canvas games and synthesized Web Audio effects (`AudioContext` oscillators) work out of the box. **HTML5 `<audio>` elements and Base64 audio playback are quarantined** (audio hardware output is muted/blocked). |
| **System & Browser** | `prefers-color-scheme`, `navigator.onLine` | Outbound links (`<a href="http...">`), `window.open()`, `window.location`, Web Share API, Notifications | Outbound links are strictly intercepted and blocked by the sandbox container. External browser will NOT open. Push dialogs and OS share sheets are disabled. |

---

## PART III: STANZA SIZE BOUNDARIES & NETWORK ROUTING

Because the payload is embedded directly into the WhatsApp protocol stanza (rather than uploaded to WhatsApp media servers via CDN), the router enforces strict message size limits.

### 1. Stanza Ceiling Tiers (Tested Empirically)

| Tier | Payload Size | Client Delivery | Latency & Performance Impact |
|:---|:---|:---|:---|
| **Safe Zone** | `< 250 KB` | 100% Reliable | Instant render. Zero mobile viewport stutter. |
| **Moderate Zone** | `250 KB – 700 KB` | 100% Reliable | Brief mount delay on lower-end devices. |
| **Maximum Ceiling** | `750 KB – 1000 KB` | Delivered | Measurable mount latency spike. Max confirmed: **1000 KB (1,010,652 Bytes)**. |
| **Drop Zone (Silent Drop)** | `> 1000 KB` (~1 MB+) | **SILENT DROP** | **Message is acknowledged by socket, but dropped by the WhatsApp router.** The message never reaches the recipient device. Tested: **2000 KB (2,021,000 Bytes) dropped**. |

### 2. Asset Inlining Rules (Base64 vs Remote URLs)

- **Remote Media Blocked**: WhatsApp webview sandbox restricts cross-origin network requests (`fetch`, `<img> src="https://..."`) to prevent user IP tracking. External image URLs will render as broken image icons.
- **Server-Side Inlining Required**: The bot must download remote thumbnails/posters on the server, convert them to Base64 Data URIs (`data:image/jpeg;base64,...`), and inline them into the HTML payload.
- **Image Budgeting**: Because of the 1000 KB ceiling, keep thumbnails compact (under 30–50 KB each) or limit list sizes to 5–10 items per payload.

---

## PART IV: CLIENT UX & INTERACTIVITY PATTERNS

Because the webview sandbox is **strictly one-way** (no WebSocket, HTTP `fetch`, or IPC back to the bot process), interactions must follow specific UX patterns:

### 1. In-Webview Client-Side SPA (Single Page Application)
Multi-screen navigation (e.g. searching, pagination, detail screens) must be pre-bundled and handled entirely inside the webview using JavaScript DOM manipulation:
```javascript
// Example client-side view switching inside <script>
function showScreen(screenId) {
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
}
```

### 2. Pseudo-Buttons (Native Long-Press Extraction)
Since `navigator.clipboard.writeText` is blocked and outbound `<a href="...">` links do not open external browsers, interactive commands utilize WhatsApp's **native long-press gesture extraction**:

1. **How It Works**: When a user long-presses an HTML anchor tag (`<a href="...">`), the native WhatsApp client intercepts the gesture and copies `[innerText] [href]` directly into the chat composer bar.
2. **Parameterized Command Pattern**:
   ```html
   <!-- Long-pressing yields: "!ytdl https://youtu.be/..." in composer bar -->
   <a href="https://youtu.be/dQw4w9WgXcQ" class="ui-btn">!ytdl</a>

   <!-- Long-pressing yields: "!anime --id 12345" in composer bar -->
   <a href="12345" class="ui-btn">!anime --id</a>
   ```
   The user simply lifts their finger and taps "Send".
3. **The `about:blank#` Trap (Critical Gotcha)**:
   Because the document base URI is `about:blank`, using a dummy relative anchor like `<a href="#">!ping</a>` causes the browser to resolve the link to `about:blank#`, pasting `!ping about:blank#` into the chat bar.
   - **For commands WITHOUT parameters**: Do NOT use anchor tags. Render them as selectable chips (`user-select: all` / `user-select: text`) or simple buttons.
   - **For commands WITH parameters**: Use `<a href="<param>">!cmd</a>`.

---

## PART V: PROJECT IMPLEMENTATION GUIDE (`lib/uiEngine.js`)

In this project, the webview subsystem is centralized in [`lib/uiEngine.js`](../lib/uiEngine.js).

### 1. Core API Functions

| Function | Purpose |
|:---|:---|
| `sendUI(sock, chatId, { title, html })` | Packages and relays the HTML payload. Returns `{ key: { remoteJid, fromMe: true, id }, messageId }`. |
| `renderPage({ title, body, badge, styles })` | Generates the HTML shell with the base design system, viewport tags, and optional custom CSS. |
| `renderCard({ icon, title, subtitle, rows, sections })` | Builds structured key-value cards with standard spacing and borders. |
| `renderList({ icon, title, subtitle, items })` | Builds interactive item lists with optional click handlers. |
| `esc(text)` | Escapes HTML entities to prevent XSS/rendering breakage. |

### 2. Base Design System (`BASE_CSS`)

The project follows a strict **flat, minimal, content-first** design philosophy:
- **Palette**: Dark mode neutral zinc/gray (`--bg-page: #0d0f13`, `--bg-card: #141619`, `--border: #1e2028`, `--text-primary: #e4e4e7`).
- **Typography**: System sans-serif stack (`'Segoe UI', system-ui, -apple-system, sans-serif`).
- **Forbidden**: Heavy gradients, glassmorphism, heavy drop-shadows, and bloated entrance animations.

### 3. Lifecycle & Memory Hygiene Rules

1. **Mandatory 120-Second Auto-Deletion**:
   Every time a webview message enters the mobile viewport, the WhatsApp client re-mounts the webview from scratch. Leaving dozens of webview payloads in chat history causes severe lag spikes.
   Commands delivering webviews **must** schedule deletion after 120 seconds:
   ```javascript
   const uiMsg = await sendUI(sock, message.chat, { title: "Title", html });
   setTimeout(() => {
       sock.sendMessage(message.chat, { delete: uiMsg.key }).catch(() => {});
   }, 120000);
   ```
2. **No Server Reply Handlers for Pure Webviews**:
   If a command's UI is navigated client-side via JavaScript, do not register a server `registerReplyHandler()`. Doing so leaks server memory.
3. **Strict Text-Only for Link Auto-Detection**:
   Passive triggers in [`lib/autoDetect.js`](../lib/autoDetect.js) MUST NEVER send webviews. Only explicit user commands may send webviews.

### 4. Adaptive UI vs Text Mode Pattern

Commands check user preference (`userData.meta?.displayMode`) and flag overrides (`--ui` / `--text`):

```javascript
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, renderCard } from "../lib/uiEngine.js";

const userData = getUser(resolveUserId(sender));
const displayMode = (args.includes("--text") ? "text" : (args.includes("--ui") ? "ui" : null))
    || userData.meta?.displayMode || "ui";

if (displayMode === "ui") {
    try {
        const uiMsg = await sendUI(sock, message.chat, {
            title: "Result",
            html: renderPage({ title: "Result", body: renderCard({ ... }) })
        });
        setTimeout(() => sock.sendMessage(message.chat, { delete: uiMsg.key }).catch(() => {}), 120000);
        return;
    } catch (err) {
        console.error("[UI Fallback]", err);
    }
}

// Fallback to text mode
await message.reply(plainTextMessage);
```

### 5. Production Reference Implementations

- [`commands/menu.js`](../commands/menu.js) — Main bot menu with live client-side category filtering, instant search, and pseudo-buttons.
- [`commands/anime.js`](../commands/anime.js) — Anime search with Base64 poster inlining (2:3 aspect ratio), detail view transitions, and client-side pagination.
- [`commands/steam.js`](../commands/steam.js) — Steam game lookup with landscape banners (460/215 aspect ratio) and interactive game specs.
- [`commands/yuegame.js`](../commands/yuegame.js) — Full canvas RPG mini-game with on-screen D-pad and Web Audio API synthesized sound effects.
- [`commands/html.js`](../commands/html.js) — Developer sandbox tool that compiles and renders user HTML directly into the webview with AST and syntax validation.
- [`commands/wvtest.js`](../commands/wvtest.js) — Empirical diagnostic suite with 35+ automated in-webview browser capability checks, calibrated stanza size probes, protobuf schema mutations, and URI interception tests.

---

## PART VI: AUDIO & MEDIA PLAYER ARCHITECTURE

Because WhatsApp's in-app webview sandbox **quarantines the HTML5 `<audio>` element and Base64 audio decoding**, inline audio playback is strictly impossible inside `GenAIaeacdsnwHtmlPrimitive`.

### The Standalone Document Pattern
For commands providing interactive audio players (such as music or podcast players):
1. Construct the complete player HTML file.
2. Send it as an attached `.html` document:
   ```javascript
   await sock.sendMessage(chatId, {
       document: Buffer.from(playerHtml, "utf-8"),
       mimetype: "text/html",
       fileName: "player.html",
       caption: "Tap to open interactive player in your browser"
   });
   ```
3. When opened, the file launches in the user's external system browser (Chrome/Safari), which possesses unconstrained audio hardware decoding and background playback capabilities.
