/**
 * Auto-Detect Registry — Pattern-based auto-detection for URLs/text in messages.
 *
 * Instead of hardcoding auto-detect logic in handler.js, each module
 * registers its pattern here. The handler calls `runAutoDetects()` and
 * the first matching pattern's handler is executed.
 *
 * Adding a new auto-detect (e.g. Pixiv, Twitter media) is now just:
 *   1. Create the handler function
 *   2. Register it with `registerAutoDetect()`
 *
 * No need to touch handler.js.
 */

/** @type {Array<{ name: string, test: (text: string, message: object) => boolean, handler: (params: object) => Promise<void> }>} */
const autoDetects = [];

/**
 * Register a new auto-detect pattern.
 *
 * @param {object} config
 * @param {string} config.name - Identifier for logging (e.g. "danbooru")
 * @param {(text: string, message: object) => boolean} config.test
 *   Return true if this auto-detect should fire. Receives the message text and full message.
 * @param {(params: object) => Promise<void>} config.handler
 *   Receives { text, match, message, sock }. `match` is the regex match if test uses one.
 */
export function registerAutoDetect(config) {
    autoDetects.push(config);
}

/**
 * Run all registered auto-detects against a message.
 * Returns true if one fired (handler should stop processing).
 *
 * @param {string} text - Message text
 * @param {object} message - Full message object
 * @param {object} sock - Baileys socket
 * @returns {Promise<{ matched: boolean, name: string|null }>}
 */
export async function runAutoDetects(text, message, sock) {
    for (const ad of autoDetects) {
        if (ad.test(text, message)) {
            await ad.handler({ text, message, sock });
            return { matched: true, name: ad.name };
        }
    }
    return { matched: false, name: null };
}

// ── Built-in: Danbooru Auto-Detect ──────────────────────────────────────────

import { handleDanbooruRequest } from "./danbooru.js";

const danbooruRegex = /(?:https?:\/\/)?(?:www\.)?danbooru\.donmai\.us\/posts\/(\d+)(?:\?.*)?/i;

registerAutoDetect({
    name: "danbooru",
    test(text, _message) {
        // Mencegah bot merespon pesannya sendiri
        if (_message?.key?.fromMe) return false;

        // Don't re-trigger on the bot's own Danbooru response messages
        if (text.includes("⭐ Rating") || text.includes("⭐ *Rating:*") || text.includes("❌ Gambar NSFW (Explicit) diblokir.")) {
            return false;
        }
        return danbooruRegex.test(text);
    },
    async handler({ text, message, sock }) {
        const match = text.match(danbooruRegex);
        if (!match) return;
        await handleDanbooruRequest({ input: match[1], sock, message, isAutoDetect: true });
    },
});

// ── Built-in: Group Auto-Reply ──────────────────────────────────────────────

import { getGroupConfig } from "./database.js";
import { msgFilter } from "./utils.js";
import setting from "../setting.js";

registerAutoDetect({
    name: "autoreply",
    test(text, message) {
        if (!message?.chat?.endsWith("@g.us")) return false; // Only in groups
        if (message?.key?.fromMe) return false; // Prevent infinite loops

        const chat = message.chat;
        const config = getGroupConfig(chat);
        if (!config.autoReplies || Object.keys(config.autoReplies).length === 0) return false;

        const isSticker = message?.message?.stickerMessage;
        if (isSticker) {
            const hash = Buffer.from(message.message.stickerMessage.fileSha256).toString('base64');
            const stickerTrigger = `sticker:${hash}`;
            return !!config.autoReplies[stickerTrigger];
        }

        const lowerText = text.trim().toLowerCase();
        for (const trigger of Object.keys(config.autoReplies)) {
            if (lowerText === trigger.toLowerCase()) {
                return true;
            }
        }
        return false;
    },
    async handler({ text, message, sock }) {
        const chat = message.chat;
        const config = getGroupConfig(chat);
        
        const isSticker = message?.message?.stickerMessage;
        let matchedTrigger = null;
        
        if (isSticker) {
            const hash = Buffer.from(message.message.stickerMessage.fileSha256).toString('base64');
            const stickerTrigger = `sticker:${hash}`;
            if (config.autoReplies[stickerTrigger]) {
                matchedTrigger = stickerTrigger;
            }
        } else {
            const lowerText = text.trim().toLowerCase();
            for (const trigger of Object.keys(config.autoReplies)) {
                if (lowerText === trigger.toLowerCase()) {
                    matchedTrigger = trigger;
                    break;
                }
            }
        }
        
        if (matchedTrigger) {
            const responseData = config.autoReplies[matchedTrigger];
            // Terapkan cooldown (gunakan key terpisah agar tidak clash dengan command spam filter)
            const arKey = `ar:${chat}`;
            if (msgFilter.isFiltered(arKey)) return;
            msgFilter.addFilter(arKey, setting.spamDelay || 3000);

            if (responseData.type === "sticker" && responseData.mediaPath) {
                const fs = await import('fs');
                if (fs.existsSync(responseData.mediaPath)) {
                    const buffer = fs.readFileSync(responseData.mediaPath);
                    await sock.sendMessage(chat, { sticker: buffer }, { quoted: message });
                    return;
                }
            }

            // Fallback to text (atau send the custom response as text)
            await sock.sendMessage(
                chat,
                {
                    text: responseData.text,
                    mentions: responseData.mentions || []
                },
                { quoted: message }
            );
        }
    },
});

// ── Built-in: Steam Auto-Detect ─────────────────────────────────────────────

import { sendSteamGameDetail, sendSteamProfileDetail } from "../services/steam.js";

const steamGameRegex = /(?:https?:\/\/)?store\.steampowered\.com\/app\/(\d+)/i;
const steamProfileRegex = /(?:https?:\/\/)?steamcommunity\.com\/(id|profiles)\/([^/\s?]+)/i;

registerAutoDetect({
    name: "steam",
    test(text, message) {
        if (message?.key?.fromMe) return false;
        return steamGameRegex.test(text) || steamProfileRegex.test(text);
    },
    async handler({ text, message, sock }) {
        const gameMatch = text.match(steamGameRegex);
        if (gameMatch) {
            await sendSteamGameDetail(gameMatch[1], message, sock, true);
            return;
        }

        const profileMatch = text.match(steamProfileRegex);
        if (profileMatch) {
            await sendSteamProfileDetail(profileMatch[2], message, sock, true);
            return;
        }
    },
});

// ── Built-in: GitHub Auto-Detect ────────────────────────────────────────────

import { sendGitHubUserDetail, sendGitHubRepoDetail, extractGitHubFromUrl, isReservedPath } from "../services/github.js";

const githubUrlRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)(?:\/([a-zA-Z0-9_.-]+))?/i;

registerAutoDetect({
    name: "github",
    test(text, message) {
        if (message?.key?.fromMe) return false;

        // Don't re-trigger on the bot's own GitHub response messages
        if (text.includes("🐙 GITHUB PROFILE") || text.includes("📦 GITHUB REPO")) {
            return false;
        }

        const match = text.match(githubUrlRegex);
        if (!match) return false;

        // Filter out reserved GitHub paths (e.g. /about, /settings, /explore)
        const firstSegment = match[1];
        if (isReservedPath(firstSegment)) return false;

        return true;
    },
    async handler({ text, message, sock }) {
        const extracted = extractGitHubFromUrl(text);
        if (!extracted) return;

        // Double-check reserved path for the extracted username
        if (isReservedPath(extracted.username)) return;

        if (extracted.type === "repo") {
            await sendGitHubRepoDetail(extracted.username, extracted.repo, message, sock, true);
        } else {
            await sendGitHubUserDetail(extracted.username, message, sock, true);
        }
    },
});
