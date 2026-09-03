# Development Journal and Changelog

This document tracks the technical evolution, development journal entries, architectural decisions, and release history for the WhatsApp Multi-Bots project.

---

## Technical Development Journal

### Architecture Evolution: Migration from JSON to SQLite (WAL Mode)

In earlier iterations, the bot relied on JSON file-based persistence for storing user data, group settings, and registration states. While sufficient for a single instance with low traffic, JSON storage introduced significant bottlenecks:
- Lack of atomic transactions leading to potential data corruption under high message concurrency.
- Inability to safely run multiple bot instances against the same storage pool.
- High memory and I/O overhead from reading and rewriting entire JSON structures on every state change.

To resolve this, the storage layer was re-engineered around `better-sqlite3` configured in Write-Ahead Logging (WAL) mode (`lib/db.js`). WAL mode allows concurrent readers alongside a single writer without locking conflicts. Cached prepared statements were implemented in `lib/database.js` to provide microsecond query execution and zero-corruption multi-process concurrency. A migration script (`scripts/migrate_json_to_sqlite.js`) was developed to transition legacy JSON records into normalized SQLite tables.

### Identity Resolution: WhatsApp Multi-Device Addressing (LID vs PN)

WhatsApp's transition to Multi-Device addressing introduced Linked Identity Descriptors (`LID`), which differ from standard Phone Number JIDs (`PN`). In community groups and channels, messages frequently arrive with `@lid` JIDs rather than `@s.whatsapp.net` JIDs.

This caused edge cases in earlier versions:
- Moderation commands (`!kick`, `!ban`) failing to identify users tagged via LID.
- User profile and balance lookups missing database records due to mismatched key formats.
- Ban evasion vulnerabilities when users interacted using LID addresses.

The solution was the implementation of `lib/jidHelper.js` and the `identity_map` SQLite table. The helper intercepts incoming messages, learns LID-to-PN associations dynamically, and exposes `resolveUserId()` to ensure all database lookups, moderation checks, and mention resolutions operate on a unified, canonical identity.

### Modular Message Pipeline Refactoring

The message processing handler (`handler.js`) was refactored from a monolithic routine into a clean, declarative stage pipeline:
1. Guard: Drops invalid/empty sender frames.
2. Sider Tracking: Records group message activity for lurker analytics before drop conditions.
3. Replay Protection: Drops offline replay messages older than 120 seconds.
4. Context Construction: Builds a normalized context object (`lib/contextBuilder.js`) with cached group metadata.
5. Early Ban Checks: Silently drops requests from banned entities.
6. Command Parsing: Tokenizes text and resolves command aliases (`lib/commandParser.js`).
7. Blocklist Check: Validates sender against cached blocklist.
8. Multi-Bot Claiming: Prevents duplicate command execution across multiple bot numbers in the same group.
9. Reply Handler Routing: Routes contextual replies to registered interactive sessions.
10. Auto-Detection: Triggers URL and keyword preview hooks (`lib/autoDetect.js`).
11. Rate Limiting: Applies per-chat cooldown filters (`lib/utils.js`).
12. Permission Validation: Enforces declarative command requirements (`lib/middleware.js`).
13. Execution and Error Boundary: Executes command handlers with error isolation and logging.

### Media Processing and Queue Infrastructure

High-memory operations (Puppeteer browser rendering and yt-dlp media extraction) previously risked exhausting VPS resources during traffic bursts. Two dedicated queue managers were introduced:
- `services/puppeteerQueue.js`: Serializes Chromium operations for quote card generation (`!quote`) and webpage screenshots (`!screenshot`).
- `services/downloadQueue.js`: Implements concurrency-limited job processing for media downloads with automated cleanup routines for temporary assets.

### Animated WebP Sticker Fixes

Animated sticker creation and conversion encountered frame disposal and transparency issues in WhatsApp Web and mobile clients. The media converter (`lib/mediaConverter.js`) was patched to enforce proper ANMF frame disposal flags and ensure correct VP8X alpha bitmask configuration, eliminating black-background artifacts and frame tearing.

### Interactive HTML UI Engine and WhatsApp Protocol Integration

To expand beyond text-based box-drawing interfaces, an interactive UI engine (`lib/uiEngine.js`) was designed to render dynamic HTML content directly within WhatsApp's native client webview.

Key architectural highlights:
- Protobuf Payload Architecture: Utilizes WhatsApp's `botForwardedMessage` wrapping `richResponseMessage` with base64-encoded `GenAIaeacdsnwHtmlPrimitive` view models, delivered via `sock.relayMessage()`.
- Built-in Dark-Mode CSS Design System: Flat, minimal design using neutral zinc/gray palette. Provides CSS variables, layout shells (`.ui-page`, `.ui-header`, `.ui-badge`), cards (`.ui-card`, `.ui-card-header`), key-value rows (`.ui-row`), and category lists (`.ui-list`, `.ui-list-item`). Per-command CSS overrides supported via `renderPage({ styles })`. No gradients, glassmorphism, or entrance animations.
- Pure Component Generators: Exposes `renderPage()`, `renderCard()`, `renderList()`, and `sendUI()` for declarative graphical dashboard construction with built-in HTML character escaping to prevent injection vulnerabilities.
- Interactive Rich Applications: Powers client-side mini-games (`commands/yuegame.js`) complete with Web Audio API sound synthesis, touch directional pads, real-time score counters, and responsive game states.

### User Display Preference Architecture (UI vs Text Mode)

With the introduction of the interactive HTML UI engine (`lib/uiEngine.js`), commands can render rich webviews directly inside supported WhatsApp clients. However, user environments vary (some devices or clients may prefer lightweight, text-first messages or lack webview support).

A user preference setting (`meta.displayMode` with values `"ui"` or `"text"`) was introduced:
- Zero-Migration Fallback: By leveraging the in-code nullish coalescing pattern (`userData.meta?.displayMode ?? "ui"`), all existing database records default seamlessly to `"ui"` mode without requiring schema changes or database migration runs.
- Preference Controls: Users can configure their preference via `!register mode <ui|text>` (or via the interactive registration reply menu) and view their active mode via `!profile`.
- Adaptive Command Rendering: Implemented in `commands/anime.js` (`!anime`) and `commands/steam.js` (`!steam`), dynamically rendering custom flat HTML layouts with per-command CSS overrides (`renderPage({ styles })`) for UI mode and fallback poster/banner image with formatted caption for Text mode. Includes on-the-fly override flags (`--ui` and `--text`).
- Media Proportions & Domain Adaptation: Tailored layout containers to native media formats — portrait (`~2:3`) for anime posters versus landscape (`~2.14:1`) for Steam game banners (`aspect-ratio: 460/215` responsive).
- Auto-Detection Stability Boundary: Formally established that passive URL triggers (`lib/autoDetect.js`) MUST strictly output text messages and are strictly forbidden from emitting HTML UI webviews, maintaining chat thread stability and preventing viewport re-render storms.
- Sandbox Lifecycle & Memory Hygiene: Established UI-exclusive auto-deletion (120s timer) to eliminate viewport re-mount lag spikes in client chat history. Eliminated redundant `registerReplyHandler` registrations in memory for self-contained webview interfaces, keeping server memory completely leak-free.
- Pseudo-Buttons & Interaction Modeling: Documented sandbox clipboard limitations, native WhatsApp long-press auto-paste behavior, and direct tokenized command patterns for external bot interactions without nested condition checks.
- External Navigation Prohibition: Pruned non-functional outbound anchor links ("View on MyAnimeList", "View on Steam Store") across webview templates and codified the rule that external hyperlinks are strictly blocked by WhatsApp's sandbox.

---

## Release Changelog

### Version 1.0.0

#### Core Engine and Pipeline
- Implemented modular message processing pipeline in `handler.js`.
- Added hot-reload watcher (`chokidar`) in `commands/_registry.js` for instant command updates during runtime.
- Added multi-bot message claiming mechanism (`message_claims` table) to prevent duplicate responses when multiple bot instances share a group.
- Integrated startup diagnostics in `lib/diagnostics.js` to verify environment binaries (`ffmpeg`, `yt-dlp`) and API configuration.
- Added comprehensive structured logging with ANSI color coding (`lib/logger.js`).

#### Database and Persistence
- Transitioned persistence engine to `better-sqlite3` with WAL mode.
- Created normalized tables: `users`, `groups`, `group_banned_users`, `message_claims`, `bot_registry`, `identity_map`, `reminders`, `group_message_counts`, and `reports`.
- Added automatic identity mapping to bridge WhatsApp LID and PN identifiers.
- Added JSON-to-SQLite database migration script (`scripts/migrate_json_to_sqlite.js`).

#### Moderation and Security
- Hardened global ban (`!gban`, `!gunban`) and local group ban (`!ban`, `!unban`) infrastructure.
- Added support for LID identity resolution in all moderation commands.
- Implemented call-blocking mechanisms to reject unauthorized direct WhatsApp calls.
- Added sider (lurker) tracking system (`!track`) to identify inactive group members.

#### Commands and Features
- Downloader: Media extraction via yt-dlp (`!ytdl`, `!ytdlf`, `!download`) with concurrency queue.
- Media: Sticker creation (`!sticker`), Brat sticker maker (`!brat`), image conversion (`!toimg`), and media resend (`!resend`).
- AI and Translation: Integrated Google Gemini API for context-aware multi-language translation (`!translate`).
- Search and Lookup: Steam game search and profile lookup (`!steam`, `!steamprofile`), Danbooru feed and search (`!danbooru`, `!danbooru-new`), MyAnimeList search (`!anime`, `!manga`), YouTube search (`!ytsearch`), and KBBI dictionary (`!kbbi`).
- Tools and Utilities: Reminder engine (`!remind`, `!unremind`), Puppeteer quote card maker (`!quote`), webpage screenshot tool (`!screenshot`), and registration system (`!register`, `!profile`, `!groupprofile`).
- Owner and Administration: Remote terminal shell execution (`!bash`), database repair utilities (`!dbfix`), ID scanner (`!scanids`), and bot administrator delegation (`!addbotadmin`, `!delbotadmin`).
- Interactive Experiments: Added interactive text-based engine tests (`commands/yuegame.js`).
- User Interface and Display Modes: Added user display preference (`meta.displayMode`) with default `"ui"`, `!register mode <ui|text>`, profile status indicator, adaptive webview rendering in `!anime` and `!steam`, Base64 Data URI poster/banner embedding for sandbox bypass, landscape aspect ratio support for game artwork, strict text-only auto-detection policy, in-webview client-side pagination, and flat minimal design system (no gradients/glassmorphism).
