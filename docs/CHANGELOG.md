# Development Journal & Rolling Changelog

This document tracks the technical evolution, architectural milestones, and continuous rolling release history for the WhatsApp Multi-Bots project. 

Because this bot operates on a **continuous delivery / rolling release model** rather than fixed semantic version increments, changes are organized chronologically by date and impact classification, derived directly from verified Git commit history.

---

## Release Classification Legend

| Badge | Impact Type | Criteria |
| :--- | :--- | :--- |
| `[MAJOR]` | Breaking / Architecture | Fundamental structural migrations: database storage overhauls, multi-instance concurrency coordination, addressing/identity overhauls (LID/PN), or new core protocol engines (e.g., HTML UI engine). |
| `[MINOR]` | Feature / Expansion | New command modules, third-party API integrations, analytical trackers, or non-breaking feature additions. |
| `[PATCH]` | Fix / Reliability | Bug fixes, edge-case hardening, sandbox restriction workarounds, protocol patches, or security mitigations. |
| `[CHORE]` / `[DOCS]` | Maintenance / Docs | Documentation updates, dependency maintenance, linting, or internal refactoring without outward behavioral changes. |

---

## Continuous Rolling Release Changelog

### 2026-09-04 — `[MINOR]` YouTube Audio, Spotify HTML Player & Webview Stanza Thresholds
- **Interactive Spotify Music Player**: Added `!play` (`commands/play.js`) downloading YouTube audio with highest compatible AAC (`m4a`) format and rendering an authentic Spotify Mobile Webview player with interactive play/pause, timebar scrubbing, and loop/heart toggles.
- **FFmpeg Audio Optimizer & Synthesizer**: Added `downloadAudio()`, `compressAudio()`, and `generateSyntheticAudio()` helpers to `services/ytdlp.js` for automatic bitrate tuning and test tone synthesis.
- **Diagnostic Suite & Size Probes**: Added `!play test` (lightweight ~25KB test player) and `!play test probe` (sending calibrated 25KB–2MB stanzas) to empirically pinpoint WhatsApp delivery cutoffs.
- **Automatic Document Fallback**: Implemented automatic fallback to `.html` Document attachment when audio payload exceeds the 750KB Webview stanza ceiling, preserving audio fidelity via CDN delivery.
- **Webview Stanza Size Threshold Documentation**: Documented WhatsApp's silent drop threshold (> 1MB) for inline `botForwardedMessage` stanzas in `docs/COMMAND_DEVELOPMENT.md`.

### 2026-09-03 — `[MAJOR]` Interactive HTML Webview UI Overhaul & Sandbox Hardening
- **User Display Preference Architecture**: Added `meta.displayMode` (`"ui"` vs `"text"`) with zero-migration fallback defaulting to UI mode. Configurable via `!register mode <ui|text>` and displayed in `!profile` (`6a693d9`).
- **Interactive Anime Webview**: Styled posters as 2:3 vertical rectangles, embedded posters as Base64 Data URIs to bypass WhatsApp webview sandbox restrictions, and added in-webview pagination, touch transitions, and detail views (`6a693d9`, `89f76fe`, `0fd80a9`, `45a96a0`, `7826289`).
- **Interactive Steam Webview**: Added responsive 460/215 landscape layout, inlined header banners as Base64 Data URIs to prevent broken image icons under sandbox network blocks, eliminated template literal escaping collisions in client scripts, and added defensive fallback handling (`8068ddc`, `8d6ff28`).
- **Interactive Menu Webview**: Implemented live client-side category filtering, instant search, and long-press pseudo-buttons (`a042e49`). Added persistent UI-mode education notice guiding users to `!register mode text` or `--text` flag override, keeping text mode completely alert-free.
- **Interactive HTML Renderer Command**: Added `!html` (`commands/html.js`) enabling users to render inline or quoted HTML code into interactive WhatsApp webviews with tag balancing, Node.js `node:vm` script syntax validation, CSS brace verification, and 120-second auto-deletion.
- **Design System Overhaul**: Overhauled `lib/uiEngine.js` to a minimal flat dark-mode zinc/gray aesthetic without gradients or glassmorphism (`f794445`).
- **Lifecycle & Memory Hygiene**: Implemented 120-second auto-deletion for webview messages with explicit `fromMe` key flags, eliminating viewport re-mount lag in chat history and memory leaks from redundant reply handlers (`113e984`, `1c4681c`).
- **Documentation**: Documented pseudo-button clipboard mechanics, anchor-tag concatenation behavior, sandbox networking boundaries, and webview development rules (`88dbd2e`, `1c4681c`, `7265753`).
- **Webview Empirical Capability Matrix**: Added comprehensive browser API support matrix to `docs/COMMAND_DEVELOPMENT.md` and `docs/ARCHITECTURE.md` based on in-app testing (full modern CSS layout/visuals support, all client storage (`localStorage`, `sessionStorage`, `IndexedDB`) and Web Workers blocked by sandbox/CSP, WebGL 1/2, Web Audio API, and haptic `navigator.vibrate()` operational, with UI state strictly confined to JS memory).

### 2026-09-02 — `[MAJOR]` Native HTML Webview Protocol & Animated Sticker Engine
- **HTML UI Engine Protocol**: Implemented `lib/uiEngine.js` using WhatsApp's native protobuf `botForwardedMessage` wrapping `richResponseMessage` with `GenAIaeacdsnwHtmlPrimitive` payloads via `sock.relayMessage()` (`a460d99`).
- **Embedded Webview Applications**: Integrated interactive client-side mini-game engine (`commands/yuegame.js`) featuring Web Audio API sound synthesis and on-screen touch controls (`3ae7689`, `e6086d2`).
- **Animated WebP Transparency Fix**: Enforced ANMF frame disposal flags and corrected VP8X alpha bitmask configuration in `lib/mediaConverter.js`, eliminating black background tearing in animated stickers (`c6a378d`, `15087a7`).
- **Technical Documentation Suite**: Added comprehensive living documentation in `docs/` (`ARCHITECTURE.md`, `COMMAND_DEVELOPMENT.md`, `DATABASE.md`, `CONFIGURATION_DEPLOYMENT.md`) (`94d99f3`, `a0f9158`).

### 2026-08-30 – 2026-08-31 — `[MINOR]` Diagnostics Dashboard, Structured Logging & Ban Hardening
- **Environment Diagnostics**: Implemented `lib/diagnostics.js` to verify binary availability (`ffmpeg`, `yt-dlp`), API credentials, and database readiness on bot startup (`8d5e829`).
- **Structured Logging & Reports**: Added ANSI color-coded structured logging (`lib/logger.js`) and persistent SQLite `reports` table (`8d5e829`, `b811ba1`).
- **Cached Danbooru Feed**: Added `!danbooru-new` with in-memory caching and session reply handlers (`607bb97`).
- **Ban Security Hardening**: Hardened global and group ban infrastructure against LID bypass vulnerabilities (`513d61b`).

### 2026-08-24 – 2026-08-26 — `[PATCH]` Stream Recovery & Message Flow Tracing
- **Media Stream Recovery**: Resolved Danbooru stream fetch failures and error handling (`92068e4`, `b6c3280`).
- **Spam Cooldown Adjustment**: Standardized default chat cooldown to 3 seconds (`1a418a3`).
- **Group Message Drop Tracing**: Added temporary diagnostic tracing for group drop edge cases and `fromMe` handling (`5ea4109`, `fc0f197`, `f17cd50`).

### 2026-08-11 – 2026-08-16 — `[MINOR]` Gemini AI Translation, Brat Stickers & Call Block Protection
- **Gemini Translation Engine**: Integrated Google Gemini API (`!translate`) with prompt tuning for multi-language context preservation and mention formatting (`f261364`, `3d5a296`, `1d34380`, `8ca8b5e`, `288929f`, `9296030`).
- **Brat Sticker Generator**: Added `!brat` sticker generation with quoted message support (`f472f34`, `bc79d0f`, `a997aa1`).
- **Call Blocking**: Implemented automatic rejection of unauthorized incoming voice/video calls (`0ed0b17`, `637ae90`).
- **GitHub Lookup**: Added `!github` command for querying repository metadata (`56c4a3b`).
- **Quote Redesign & Privilege Hierarchy**: Updated quote card styling and enforced strict privilege hierarchy checks (`8c3fb94`, `2b5166e`).

### 2026-08-01 – 2026-08-05 — `[MINOR]` Sider Lurker Tracker, Puppeteer Quotes & Multi-Bot Ping
- **Sider Tracking System**: Introduced `!track` command to monitor group lurkers, hooked into `handler.js` before the 120-second replay filter (`633710f`).
- **Puppeteer Quote Card Generator**: Added local browser-rendered quote card generator (`!quote`) with self-quote support, phone number formatting, and pushname resolution (`d4c910e`, `9d0077f`, `a6baede`).
- **Auto-Registration**: Added automatic user profile generation upon first valid command invocation (`2a4beba`).
- **Multi-Bot Ping Synchronization**: Updated `!ping` to allow all listening bot instances in a shared group to respond concurrently (`601a230`).
- **JID Standardized Routing**: Documented Multi-Device addressing rules and standardized JID routing in pipeline (`f55e577`, `49c9a73`).

### 2026-07-28 – 2026-07-29 — `[MINOR]` Danbooru Tag Engine, Autoreply Evolution & Protocol Patches
- **Danbooru Tag Engine**: Added tag dictionary, fuzzy suggestion algorithm, tag alias resolution, and UI formatting (`e7e10c5`, `a14a24f`, `c5ca6ab`, `1788928`).
- **Autoreply Media & Index Deletion**: Upgraded autoreply system to support quoted text, stickers, and index-based trigger deletion (`859493a`, `ae297cf`, `d7b8886`).
- **Baileys tcToken Patch**: Applied `patch-package` upstream fix for Baileys `tcToken` protocol bug (`5009a1d`).
- **Watermark Command**: Added `!watermark` for custom sticker metadata (`a816ac6`).
- **Network Resilience**: Resolved DNS resolution and timeout failures when fetching user profile pictures (`1c54892`, `7e85027`).

### 2026-07-13 – 2026-07-22 — `[MINOR]` Puppeteer Screenshot, KBBI Dictionary & Admin DM Handling
- **Webpage Screenshot Utility**: Added `!screenshot` command backed by Puppeteer with configurable wait delays (`d3fd1f1`, `f66d06f`).
- **KBBI Dictionary**: Added `!kbbi` command for querying the official Indonesian dictionary (`7276b5f`, `f0086f8`, `6dc84ac`).
- **Owner Direct Message Flow**: Fixed permission handling for owner commands executed in direct messages (`06ec51f`, `f1d861a`).
- **Sticker Document Handling**: Fixed sticker creation when source image is sent as a document (`6ac4009`).

### 2026-07-06 – 2026-07-08 — `[PATCH]` Codebase Audit & Exploit Mitigations
- **Codebase Edge-Case Audit**: Resolved 12 critical edge cases across command handlers and pipeline guards (`8382439`, `119d12f`).
- **Say Exploit Mitigation**: Patched command injection vulnerabilities in `!say` (`6ede404`, `ab00b83`, `b71c349`).
- **Group Role Management**: Fixed permission checks in `!promote` and `!demote` (`90f9947`).
- **Registration Command**: Fixed direct parameter parsing in `!register` and resolved undefined variables (`143b734`, `3b6913c`).

### 2026-07-01 – 2026-07-05 — `[MAJOR]` Multi-Bot Concurrency, SQLite WAL Migration & LID/PN Resolution
- **SQLite WAL Architecture**: Replaced fragile JSON file storage with `better-sqlite3` in Write-Ahead Logging (WAL) mode (`lib/db.js`, `lib/database.js`), enabling atomic transactions and multi-process concurrency (`a6a15d6`).
- **PM2 Multi-Instance Concurrency**: Added PM2 ecosystem configuration and coordination rules for running multiple bot numbers concurrently (`a6a15d6`, `eee90c6`, `072558f`).
- **Headless Pairing Code Authentication**: Implemented pairing code auth flow as an alternative to QR codes for headless servers (`af6e1f7`, `8c950d0`).
- **Multi-Bot Claiming System**: Implemented `message_claims` table with zero-config bot priority to eliminate duplicate responses when multiple bots share a group (`f3dc411`).
- **LID vs PN Resolution Overhaul**: Architected `lib/jidHelper.js` and `identity_map` SQLite table to unify WhatsApp Multi-Device Linked Identity Descriptors (`@lid`) and Phone Numbers (`@s.whatsapp.net`), fixing ban evasion and broken lookups (`3dfa963`, `6a78e3e`, `db88f81`).
- **Local Custom Profile Pictures**: Added `!setpfp` with Jimp 1:1 image cropping and local filesystem storage (`4167386`, `0daa7c5`).
- **Bot Admin Delegation**: Added `!addbotadmin` and `!delbotadmin` hierarchy delegation (`68a13ec`, `1bb7dea`, `57adb8a`).
- **Steam Auto-Detect & Profile Lookup**: Added `!steamprofile` and Steam URL auto-detect trigger (`5c94f78`, `9a35e32`, `59bfea1`).
- **Group Autoreply System**: Added custom keyword triggers with mentions support (`a44508c`, `0e369cd`).

### 2026-06-24 – 2026-06-29 — `[MINOR]` Connection Resilience & Remote Bot Terminal
- **Connection Overhaul**: Implemented exponential backoff reconnection, graceful SIGINT/SIGTERM shutdown, and QR generation rate limiting (`0f45fe1`, `2540617`, `569a2fe`, `ecce83d`, `b5d3a1b`).
- **Remote Terminal Shell**: Added secure owner-only `!bash` command for executing remote server commands via WhatsApp (`89f3028`, `74963bb`, `deaaa5c`, `86729ea`).
- **Media Resend**: Added `!resend` command to extract and forward quoted disappearing or restricted media (`45a5078`).
- **yt-dlp Stability**: Fixed audio/video codec extraction edge cases in `lib/ytdlp.js` (`c9a75b5`, `a024772`).

### 2026-06-21 – 2026-06-23 — `[MAJOR]` Modular Message Pipeline & Command Wave
- **Modular Pipeline**: Refactored monolithic message handling into a 13-stage pipeline in `handler.js` (`adb856e`).
- **Dynamic Command Registry**: Built auto-loading and hot-reloading command registry via Chokidar in `commands/_registry.js` (`adb856e`, `2d2a92b`).
- **Declarative Middleware**: Introduced declarative command flags (`groupOnly`, `adminOnly`, `botAdminRequired`, `ownerOnly`) in `lib/middleware.js` (`7a3aa8b`).
- **Massive Command Rollout**:
  - Media & Download: `!download` / `!ytdl` with message editing status updates, `!ytsearch` (`39d823d`, `bedc0c0`, `e79199a`).
  - Search & Anime: `!anime` and `!manga` via Jikan API, `!steam` store search, `!danbooru` gacha feed (`7af7599`, `3d746b1`, `a0dda85`).
  - Administration & Tools: `!del`, `!kick`, `!join`, `!setname`, `!profile`, `!info`, `!reminder`, `!report`, `!feedback` (`929d237`, `6d18d04`, `4faa4e1`, `9030706`, `f1a8a0e`, `303cfb4`).
  - Bot Architecture: Multi-owner support and paginated menu navigation (`30b0189`, `dcb4968`, `b557d94`).

### 2026-06-19 – 2026-06-20 — `[MAJOR]` Project Genesis & Bot Standup
- **Core Architecture**: Repositori inisiasi oleh Tederby menggunakan Node.js ES Modules (`"type": "module"`) dan Baileys (`b721bef`, `bc2f05f`, `0836f63`, `ff6fe90`).
- **Initial Feature Set**: Added foundational commands (`!menu`, `!sticker`, `!toimg`), session stability patches, and initial documentation (`f9b6ce0`, `45460bc`, `4753763`).

### 2025-10-29 – 2025-12-06 — `[CHORE]` Upstream Base Initialization
- **Upstream Origin**: Initial repository scaffolding by Sansekai (`67462e4`, `0a09088`).
- **Dependency Bump**: Upgraded Baileys dependency to `7.0.0-rc.9` by M Yusril (`97f9732`).

---

## Architectural Deep Dives

### 1. Storage Engine: Migration from JSON to SQLite (WAL Mode)

In earlier iterations, the bot relied on JSON file-based persistence for storing user data, group settings, and registration states. While sufficient for a single instance with low traffic, JSON storage introduced significant bottlenecks:
- Lack of atomic transactions leading to potential data corruption under high message concurrency.
- Inability to safely run multiple bot instances against the same storage pool.
- High memory and I/O overhead from reading and rewriting entire JSON structures on every state change.

To resolve this, the storage layer was re-engineered around `better-sqlite3` configured in Write-Ahead Logging (WAL) mode (`lib/db.js`). WAL mode allows concurrent readers alongside a single writer without locking conflicts. Cached prepared statements were implemented in `lib/database.js` to provide microsecond query execution and zero-corruption multi-process concurrency. A migration script (`scripts/migrate_json_to_sqlite.js`) was developed to transition legacy JSON records into normalized SQLite tables.

### 2. Identity Resolution: WhatsApp Multi-Device Addressing (LID vs PN)

WhatsApp's transition to Multi-Device addressing introduced Linked Identity Descriptors (`LID`), which differ from standard Phone Number JIDs (`PN`). In community groups and channels, messages frequently arrive with `@lid` JIDs rather than `@s.whatsapp.net` JIDs.

This caused edge cases in earlier versions:
- Moderation commands (`!kick`, `!ban`) failing to identify users tagged via LID.
- User profile and balance lookups missing database records due to mismatched key formats.
- Ban evasion vulnerabilities when users interacted using LID addresses.

The solution was the implementation of `lib/jidHelper.js` and the `identity_map` SQLite table. The helper intercepts incoming messages, learns LID-to-PN associations dynamically, and exposes `resolveUserId()` to ensure all database lookups, moderation checks, and mention resolutions operate on a unified, canonical identity.

### 3. Modular Message Pipeline Architecture

The message processing handler (`handler.js`) was refactored from a monolithic routine into a clean, declarative 13-stage pipeline:
1. **Guard**: Drops invalid or empty sender frames.
2. **Sider Tracking**: Records group message activity for lurker analytics before drop conditions.
3. **Replay Protection**: Drops offline replay messages older than 120 seconds.
4. **Context Construction**: Builds a normalized context object (`lib/contextBuilder.js`) with cached group metadata.
5. **Early Ban Checks**: Silently drops requests from banned entities.
6. **Command Parsing**: Tokenizes text and resolves command aliases (`lib/commandParser.js`).
7. **Blocklist Check**: Validates sender against cached blocklist.
8. **Multi-Bot Claiming**: Prevents duplicate command execution across multiple bot numbers in the same group.
9. **Reply Handler Routing**: Routes contextual replies to registered interactive sessions.
10. **Auto-Detection**: Triggers URL and keyword preview hooks (`lib/autoDetect.js`).
11. **Rate Limiting**: Applies per-chat cooldown filters (`lib/utils.js`).
12. **Permission Validation**: Enforces declarative command requirements (`lib/middleware.js`).
13. **Execution and Error Boundary**: Executes command handlers with error isolation and logging.

### 4. Concurrency Infrastructure & Media Queues

High-memory operations (Puppeteer browser rendering and yt-dlp media extraction) previously risked exhausting server resources during traffic bursts. Two dedicated queue managers were introduced:
- `services/puppeteerQueue.js`: Serializes Chromium operations for quote card generation (`!quote`) and webpage screenshots (`!screenshot`).
- `services/downloadQueue.js`: Implements concurrency-limited job processing for media downloads with automated cleanup routines for temporary assets.

### 5. Animated WebP Frame Disposal & Alpha Masks

Animated sticker creation and conversion encountered frame disposal and transparency issues in WhatsApp Web and mobile clients. The media converter (`lib/mediaConverter.js`) was patched to enforce proper ANMF frame disposal flags and ensure correct VP8X alpha bitmask configuration, eliminating black-background artifacts and frame tearing.

### 6. Interactive HTML UI Engine (Protobuf GenAI Primitives)

To expand beyond text-based box-drawing interfaces, an interactive UI engine (`lib/uiEngine.js`) was designed to render dynamic HTML content directly within WhatsApp's native client webview.

Key architectural highlights:
- **Protobuf Payload Architecture**: Utilizes WhatsApp's `botForwardedMessage` wrapping `richResponseMessage` with base64-encoded `GenAIaeacdsnwHtmlPrimitive` view models, delivered via `sock.relayMessage()`.
- **Built-in Dark-Mode CSS Design System**: Flat, minimal design using neutral zinc/gray palette (`#18181b`, `#27272a`, `#3f3f46`). Provides layout shells (`.ui-page`, `.ui-header`, `.ui-badge`), cards (`.ui-card`, `.ui-card-header`), key-value rows (`.ui-row`), and category lists (`.ui-list`, `.ui-list-item`). Per-command CSS overrides supported via `renderPage({ styles })`. Strictly avoids artificial gradients, glassmorphism, or viewport entrance animations.
- **Pure Component Generators**: Exposes `renderPage()`, `renderCard()`, `renderList()`, and `sendUI()` for declarative graphical dashboard construction with built-in HTML character escaping (`esc()`) to prevent injection vulnerabilities.
- **Interactive Rich Applications**: Powers client-side mini-games (`commands/yuegame.js`) complete with Web Audio API sound synthesis, touch directional pads, real-time score counters, and responsive game states.

### 7. User Display Preference & Sandbox Security Boundary

With the introduction of the interactive HTML UI engine (`lib/uiEngine.js`), commands can render rich webviews directly inside supported WhatsApp clients. However, user environments vary:
- **Zero-Migration Fallback**: By leveraging the in-code nullish coalescing pattern (`userData.meta?.displayMode ?? "ui"`), all existing database records default seamlessly to `"ui"` mode without requiring schema changes or database migration runs.
- **Preference Controls**: Users configure preference via `!register mode <ui|text>` (or via the interactive registration reply menu) and view their active mode via `!profile`.
- **Adaptive Command Rendering**: Implemented in `commands/anime.js` (`!anime`), `commands/steam.js` (`!steam`), and `commands/menu.js` (`!menu`), dynamically rendering custom flat HTML layouts for UI mode and fallback poster/banner image or interactive text for Text mode. Includes on-the-fly override flags (`--ui` and `--text`).
- **Media Proportions & Aspect Ratio Adaptation**: Tailored layout containers to native media formats — portrait (`~2:3`) for anime posters versus landscape (`~2.14:1`) for Steam game banners (`aspect-ratio: 460/215` responsive).
- **Auto-Detection Stability Boundary**: Formally established that passive URL triggers (`lib/autoDetect.js`) MUST strictly output text messages and are strictly forbidden from emitting HTML UI webviews, maintaining chat thread stability and preventing viewport re-render storms.
- **Sandbox Lifecycle & Memory Hygiene**: Established UI-exclusive auto-deletion (120s timer) with explicit `fromMe` keys to eliminate viewport re-mount lag spikes in client chat history. Eliminated redundant `registerReplyHandler` registrations in memory for self-contained webview interfaces, keeping server memory completely leak-free.
- **Pseudo-Buttons & Interaction Modeling**: Documented sandbox clipboard limitations, native WhatsApp long-press auto-paste behavior, and direct tokenized command patterns for external bot interactions without nested condition checks.
- **External Navigation Prohibition**: Pruned non-functional outbound anchor links across webview templates because external hyperlinks are strictly blocked by WhatsApp's sandbox.
- **Webview Asset Inlining**: Enforced Base64 Data URI conversion for posters and detail banners in `commands/anime.js` and `commands/steam.js` with defensive `onerror` handling to bypass WhatsApp's network-blocking webview sandbox.
