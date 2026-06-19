/**
 * Command & Reply Handler Registry
 *
 * - Commands are registered by name + aliases → looked up by exact match.
 * - Reply handlers are registered per bot-message stanzaId so that follow-up
 *   replies (e.g. ytdlf format selection) can be routed back to the originating command.
 */

import ping from "./ping.js";
import say from "./say.js";
import resend from "./resend.js";
import ytdl from "./ytdl.js";
import ytdlf from "./ytdlf.js";

// ── Command Registry ────────────────────────────────────────────────────────

const commands = new Map();

function register(cmd) {
    commands.set(cmd.name, cmd);
    if (cmd.aliases) {
        for (const alias of cmd.aliases) {
            commands.set(alias, cmd);
        }
    }
}

[ping, say, resend, ytdl, ytdlf].forEach(register);

/**
 * Look up a command by its exact name or alias.
 * @param {string} name
 * @returns {object|null}
 */
export function getCommand(name) {
    return commands.get(name) || null;
}

/** Return unique command objects (no alias duplicates). */
export function getAllCommands() {
    return [...new Set(commands.values())];
}

// ── Reply Handler Registry ──────────────────────────────────────────────────

/** @type {Map<string, { handler: Function, state: object, createdAt: number }>} */
const replyHandlers = new Map();

/**
 * Register a handler that will fire when a user replies to a specific bot message.
 * @param {string} stanzaId  - The message ID of the bot's message
 * @param {Function} handler - async ({ message, sock, state }) => void
 * @param {object} state     - Arbitrary state to pass back to the handler
 */
export function registerReplyHandler(stanzaId, handler, state) {
    replyHandlers.set(stanzaId, { handler, state, createdAt: Date.now() });
}

/** @returns {{ handler: Function, state: object, createdAt: number } | null} */
export function getReplyHandler(stanzaId) {
    return replyHandlers.get(stanzaId) || null;
}

export function deleteReplyHandler(stanzaId) {
    replyHandlers.delete(stanzaId);
}

/**
 * Remove reply handlers older than `maxAgeMs`.
 * Called periodically from the cleanup service.
 * @param {number} maxAgeMs
 * @returns {number} Number of entries purged
 */
export function cleanupExpiredReplyHandlers(maxAgeMs) {
    const now = Date.now();
    let purged = 0;
    for (const [id, entry] of replyHandlers) {
        if (now - entry.createdAt > maxAgeMs) {
            replyHandlers.delete(id);
            purged++;
        }
    }
    return purged;
}
