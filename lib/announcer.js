/**
 * Announcer — WhatsApp Channel broadcast utility.
 *
 * Sends automated status notifications and manual announcements
 * to a WhatsApp Channel (Newsletter). Resolves the channel JID
 * from CHANNEL_URL at runtime via Baileys newsletterMetadata API.
 *
 * Architecture: Stateless utility (no daemon/interval). Called
 * directly by index.js lifecycle hooks and commands/announce.js.
 * Designed for future extension to Community Announcement Groups.
 *
 * @module lib/announcer
 */

import fs from "fs";
import path from "path";
import setting from "../setting.js";
import { formatUptime } from "./utils.js";
import { logger as log } from "./logger.js";

const TAG = "ANNOUNCER";

// ── Module-level state (per-instance, isolated by process) ──────────────────
let cachedChannelJid = null;
let cachedChannelName = null;
let lastStartupNotifTime = 0;

// ── Shutdown persistence paths ──────────────────────────────────────────────
const SHUTDOWN_FILE = `./sessions/shutdown_${setting.botId}.json`;

// ── Toggle persistence paths ────────────────────────────────────────────────
const TOGGLE_GLOBAL_FILE = `./sessions/announcer_global.json`;
const TOGGLE_BOT_FILE = `./sessions/announcer_${setting.botId}.json`;

// ── Debounce: skip startup notification if last one was < 60s ago ───────────
const STARTUP_DEBOUNCE_MS = 60_000;

// ── URL → Invite Code Extraction ────────────────────────────────────────────

/**
 * Extract the invite code from a WhatsApp Channel URL.
 * Supports formats:
 *   - https://whatsapp.com/channel/0029VbB1Xqv1noz03aqgWx0s
 *   - https://www.whatsapp.com/channel/0029VbB1Xqv1noz03aqgWx0s
 *
 * @param {string} url - Channel URL
 * @returns {string|null} Invite code or null if URL is invalid
 */
function extractInviteCode(url) {
    if (!url || typeof url !== "string") return null;
    const match = url.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
}

// ── WIB Timestamp Formatting ────────────────────────────────────────────────

/**
 * Format a Date (or current time) as "DD MMM YYYY, HH:mm WIB".
 * @param {Date} [date] - Date to format (defaults to now)
 * @returns {string}
 */
function formatDateWIB(date = new Date()) {
    const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const day = String(d.getDate()).padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
}

// ── Sessions Directory Safety ───────────────────────────────────────────────
function ensureSessionsDir() {
    const dir = path.resolve("./sessions");
    if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { }
    }
}

// ── Shutdown Time Persistence ───────────────────────────────────────────────

/**
 * Save shutdown timestamp and reason to persistent file.
 * Called on graceful shutdown and connection close events.
 *
 * @param {string} reason - Shutdown reason (e.g. "SIGTERM", "loggedOut")
 */
export function saveShutdownTime(reason) {
    // Ignore internal Baileys stream restart (status 515) to prevent overwriting
    // legitimate shutdown records or falsely reporting pairing/re-auth as downtime
    if (reason === "restartRequired") return;

    try {
        ensureSessionsDir();
        const data = { timestamp: Date.now(), reason: reason || "unknown" };
        fs.writeFileSync(SHUTDOWN_FILE, JSON.stringify(data));
    } catch (e) {
        // Non-critical — don't crash on write failure
    }
}

/**
 * Read and consume the last shutdown record.
 * Returns the data and deletes the file to prevent stale reads.
 *
 * @returns {{ timestamp: number, reason: string } | null}
 */
function consumeShutdownTime() {
    try {
        if (!fs.existsSync(SHUTDOWN_FILE)) return null;
        const raw = fs.readFileSync(SHUTDOWN_FILE, "utf-8");
        const data = JSON.parse(raw);
        fs.unlinkSync(SHUTDOWN_FILE);
        return data && data.timestamp ? data : null;
    } catch (e) {
        // Corrupted file — remove and treat as missing
        try { fs.unlinkSync(SHUTDOWN_FILE); } catch (_) { }
        return null;
    }
}

// ── Toggle (Enable/Disable) Persistence ─────────────────────────────────────

/**
 * Read a toggle file.
 * @param {string} filePath
 * @returns {boolean|null} true/false if file exists and valid, null if missing
 */
function readToggle(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return typeof data.enabled === "boolean" ? data.enabled : null;
    } catch {
        return null;
    }
}

/**
 * Write a toggle file.
 * @param {string} filePath
 * @param {boolean} enabled
 */
function writeToggle(filePath, enabled) {
    try {
        ensureSessionsDir();
        fs.writeFileSync(filePath, JSON.stringify({ enabled, updatedAt: Date.now() }));
    } catch (e) {
        log.warn(TAG, `Failed to write toggle file: ${e.message}`);
    }
}

/**
 * Check if the announcer is enabled.
 *
 * Priority: global toggle → per-bot toggle → default (true)
 *   - If global file says disabled → disabled for ALL bots
 *   - If per-bot file says disabled → disabled for THIS bot only
 *   - If no toggle files exist → enabled by default
 *
 * @returns {boolean}
 */
export function isEnabled() {
    const globalToggle = readToggle(TOGGLE_GLOBAL_FILE);
    if (globalToggle === false) return false;

    const botToggle = readToggle(TOGGLE_BOT_FILE);
    if (botToggle === false) return false;

    return true;
}

/**
 * Set the announcer enabled/disabled state.
 *
 * @param {'global'|'bot'} scope - "global" for all bots, "bot" for this instance
 * @param {boolean} enabled - true to enable, false to disable
 */
export function setEnabled(scope, enabled) {
    const filePath = scope === "global" ? TOGGLE_GLOBAL_FILE : TOGGLE_BOT_FILE;
    if (enabled) {
        // Enabling = remove the toggle file (revert to default)
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { }
        log.info(TAG, `Announcer ${scope === "global" ? "globally" : `for ${setting.botId}`} enabled (toggle file removed).`);
    } else {
        writeToggle(filePath, false);
        log.info(TAG, `Announcer ${scope === "global" ? "globally" : `for ${setting.botId}`} disabled.`);
    }
}

// ── Channel Resolution ──────────────────────────────────────────────────────

/**
 * Initialize channel: resolve CHANNEL_URL to newsletter JID.
 * Must be called once after connection opens. Caches the result
 * in module memory for the lifetime of this socket session.
 *
 * @param {object} sock - Baileys socket
 * @returns {Promise<boolean>} true if channel resolved successfully
 */
export async function initChannel(sock) {
    const channelUrl = setting.branding?.channelUrl;
    if (!channelUrl) {
        log.info(TAG, "No CHANNEL_URL configured — announcer disabled.");
        cachedChannelJid = null;
        return false;
    }

    const inviteCode = extractInviteCode(channelUrl);
    if (!inviteCode) {
        log.warn(TAG, `Invalid CHANNEL_URL format: ${channelUrl}`);
        cachedChannelJid = null;
        return false;
    }

    try {
        const meta = await sock.newsletterMetadata("invite", inviteCode);
        if (!meta || !meta.id) {
            log.warn(TAG, `Failed to resolve channel from invite code: ${inviteCode}`);
            cachedChannelJid = null;
            return false;
        }

        cachedChannelJid = meta.id;
        cachedChannelName = meta.name || "Unknown Channel";
        log.info(TAG, `Channel resolved: "${cachedChannelName}" → ${cachedChannelJid}`);
        return true;
    } catch (err) {
        log.warn(TAG, `Channel resolution failed: ${err.message}`);
        cachedChannelJid = null;
        return false;
    }
}

/**
 * Get cached channel JID (resolved during initChannel).
 * @returns {string|null} Channel JID or null if not configured/resolved
 */
export function getChannelJid() {
    return cachedChannelJid;
}

/**
 * Get cached channel name (resolved during initChannel).
 * @returns {string|null} Channel name or null
 */
export function getChannelName() {
    return cachedChannelName;
}

// ── Message Formatting ──────────────────────────────────────────────────────

/**
 * Format a bot status notification message.
 *
 * @param {'startup'} event - Lifecycle event type
 * @param {object} metadata - { downtime?: number, reason?: string }
 * @returns {string} Formatted message text
 */
function formatStatusMessage(event, metadata = {}) {
    const botName = setting.name || setting.botId || "Bot";
    const now = formatDateWIB();

    let text = "";
    text += `🟢 *BOT ONLINE*\n`;
    text += `────────────────────────\n`;
    text += `• *Bot:* ${botName}\n`;
    text += `• *Status:* Online & Siap Digunakan\n`;
    text += `• *Waktu:* ${now}\n`;

    if (metadata.downtime != null && metadata.downtime > 0) {
        const downtimeStr = formatUptime(metadata.downtime / 1000);
        const reasonStr = metadata.reason ? ` (${metadata.reason})` : "";
        text += `• *Downtime:* ${downtimeStr}${reasonStr}\n`;
    } else if (metadata.reason === "first_startup") {
        text += `• *Sesi:* First startup (sesi baru)\n`;
    }

    text += `────────────────────────`;
    return text;
}

/**
 * Format changelog entries into an announcement message.
 * Clean newsletter typography optimized for WhatsApp Channels (no box-drawing borders).
 *
 * @param {Array<{date: string, badge: string, title: string, bullets: string[]}>} entries
 * @returns {string} Formatted message text
 */
export function formatChangelogMessage(entries) {
    if (!entries || entries.length === 0) return "";

    const blocks = [];
    for (const entry of entries) {
        let block = "";
        block += `📢 *BOT UPDATE*\n`;
        block += `📅 *Tanggal:* ${entry.date}`;
        if (entry.badge) {
            block += ` • \`${entry.badge}\``;
        }
        block += `\n📌 *${entry.title}*\n`;
        block += `────────────────────────\n\n`;

        const bulletLines = [];
        for (const rawLine of entry.bullets.slice(0, 15)) {
            const isSub = /^\s+[-*]\s*/.test(rawLine);
            const clean = rawLine
                .trim()
                .replace(/^[-*]\s*/, "")
                .replace(/^\*\*(.+?)\*\*:?\s*/, "*$1*: ")
                .trim();

            if (isSub) {
                bulletLines.push(`  ◦ ${clean}`);
            } else {
                const prefix = bulletLines.length > 0 ? "\n• " : "• ";
                bulletLines.push(`${prefix}${clean}`);
            }
        }

        block += bulletLines.join("\n");

        if (entry.bullets.length > 15) {
            block += `\n\n_...dan ${entry.bullets.length - 15} perubahan lainnya_`;
        }

        block += `\n────────────────────────`;
        blocks.push(block);
    }

    return blocks.join("\n\n\n");
}

// ── Changelog Parser ────────────────────────────────────────────────────────

/**
 * Parse CHANGELOG.md and extract the N most recent entries.
 *
 * Parsing strategy:
 *   1. Read docs/CHANGELOG.md
 *   2. Find entries by "### " header pattern
 *   3. Extract date, badge, title, and bullet points
 *
 * @param {number} count - Number of entries to extract (default: 1)
 * @returns {Array<{date: string, badge: string, title: string, bullets: string[]}>}
 */
export function parseChangelog(count = 1) {
    const changelogPath = path.resolve("docs/CHANGELOG.md");
    try {
        if (!fs.existsSync(changelogPath)) return [];
        const content = fs.readFileSync(changelogPath, "utf-8");

        const entries = [];
        // Match: ### 2026-09-25 — `[MAJOR]` Title here
        const headerPattern = /^### (\d{4}-\d{2}-\d{2})(?:\s*[—–-]\s*(?:\d{4}-\d{2}-\d{2}\s*[—–-]\s*)?)?\s*`\[(\w+)\]`\s*(.+)$/gm;
        let match;
        const headers = [];

        while ((match = headerPattern.exec(content)) !== null) {
            headers.push({
                index: match.index,
                date: match[1],
                badge: `[${match[2]}]`,
                title: match[3].trim(),
            });
        }

        // Extract bullets for each header
        for (let i = 0; i < Math.min(headers.length, count); i++) {
            const start = headers[i].index;
            const end = i + 1 < headers.length ? headers[i + 1].index : content.length;
            const section = content.substring(start, end);

            // Extract bullet points (top-level and sub-bullets)
            const bullets = [];
            for (const line of section.split("\n")) {
                if (/^\s*[-*]\s/.test(line)) {
                    bullets.push(line);
                }
            }

            entries.push({
                date: headers[i].date,
                badge: headers[i].badge,
                title: headers[i].title,
                bullets,
            });
        }

        return entries;
    } catch (err) {
        log.warn(TAG, `Failed to parse CHANGELOG.md: ${err.message}`);
        return [];
    }
}

// ── Public Send Functions ───────────────────────────────────────────────────

/**
 * Send a free-text (or image) announcement to the configured channel.
 *
 * @param {object} sock - Baileys socket
 * @param {object} content - { text: string, image?: Buffer }
 * @returns {Promise<boolean>} true if sent successfully
 */
export async function sendAnnouncement(sock, content) {
    if (!cachedChannelJid) return false;
    if (!isEnabled()) return false;
    if (!content || (!content.text && !content.image)) return false;

    try {
        const msg = content.image
            ? { image: content.image, caption: content.text || "" }
            : { text: content.text };

        await sock.sendMessage(cachedChannelJid, msg);
        log.info(TAG, `Announcement sent to ${cachedChannelName || cachedChannelJid}`);
        return true;
    } catch (err) {
        log.error(TAG, `Failed to send announcement: ${err.message}`);
        return false;
    }
}

/**
 * Send bot lifecycle status notification to the configured channel.
 * Includes debounce logic to prevent spam during rapid restarts.
 *
 * @param {object} sock - Baileys socket
 * @param {'startup'} event - Lifecycle event type
 * @param {object} [metadata] - { downtime?: number, reason?: string }
 * @returns {Promise<boolean>}
 */
export async function sendBotStatus(sock, event, metadata = {}) {
    if (!cachedChannelJid) return false;
    if (!isEnabled()) {
        log.info(TAG, "Startup notification skipped (announcer disabled).");
        return false;
    }

    // Debounce: skip if last startup notification was < 60s ago
    const now = Date.now();
    if (now - lastStartupNotifTime < STARTUP_DEBOUNCE_MS) {
        log.info(TAG, "Startup notification skipped (debounce — last sent < 60s ago).");
        return false;
    }

    const text = formatStatusMessage(event, metadata);
    try {
        await sock.sendMessage(cachedChannelJid, { text });
        lastStartupNotifTime = now;
        log.info(TAG, `Bot status (${event}) sent to channel.`);
        return true;
    } catch (err) {
        log.error(TAG, `Failed to send bot status: ${err.message}`);
        return false;
    }
}

/**
 * Send changelog entries as a formatted announcement.
 *
 * @param {object} sock - Baileys socket
 * @param {Array<{date: string, badge: string, title: string, bullets: string[]}>} entries
 * @returns {Promise<boolean>}
 */
export async function sendChangelog(sock, entries) {
    if (!cachedChannelJid) return false;
    if (!isEnabled()) return false;
    if (!entries || entries.length === 0) return false;

    const text = formatChangelogMessage(entries);
    if (!text) return false;

    try {
        await sock.sendMessage(cachedChannelJid, { text });
        log.info(TAG, `Changelog announcement sent (${entries.length} entries).`);
        return true;
    } catch (err) {
        log.error(TAG, `Failed to send changelog: ${err.message}`);
        return false;
    }
}

/**
 * Resolve a channel invite URL to its JID and metadata.
 * Useful as a setup helper (e.g. !announce resolve <url>).
 *
 * @param {object} sock - Baileys socket
 * @param {string} url - Channel invite URL
 * @returns {Promise<{jid: string, name: string, description: string}|null>}
 */
export async function resolveChannelFromUrl(sock, url) {
    const inviteCode = extractInviteCode(url);
    if (!inviteCode) return null;

    try {
        const meta = await sock.newsletterMetadata("invite", inviteCode);
        if (!meta || !meta.id) return null;
        return {
            jid: meta.id,
            name: meta.name || "",
            description: meta.description || "",
        };
    } catch (err) {
        log.warn(TAG, `Channel resolve failed for ${url}: ${err.message}`);
        return null;
    }
}

/**
 * Handle startup lifecycle: resolve channel, calculate downtime, send notification.
 * Called from index.js when connection === "open".
 *
 * @param {object} sock - Baileys socket
 * @returns {Promise<void>}
 */
export async function handleStartup(sock) {
    // Step 0: Check if announcer is enabled
    if (!isEnabled()) {
        log.info(TAG, "Announcer disabled — skipping startup sequence.");
        return;
    }

    // Debounce: prevent duplicate notifications and preserve shutdown record during rapid restart cycles
    const now = Date.now();
    if (now - lastStartupNotifTime < STARTUP_DEBOUNCE_MS) {
        log.info(TAG, "Startup notification skipped (debounce — last sent < 60s ago).");
        return;
    }

    // Step 1: Resolve channel
    const resolved = await initChannel(sock);
    if (!resolved) return;

    // Step 2: Read shutdown record and calculate downtime
    const shutdownData = consumeShutdownTime();
    const metadata = {};

    if (shutdownData && shutdownData.reason !== "restartRequired") {
        metadata.downtime = Date.now() - shutdownData.timestamp;
        metadata.reason = shutdownData.reason;
    } else {
        metadata.reason = "first_startup";
    }

    // Step 3: Send startup notification
    await sendBotStatus(sock, "startup", metadata);
}
