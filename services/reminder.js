/**
 * Reminder Service — SQLite Backend
 *
 * Manages user reminders with persistent storage in the centralized SQLite database.
 * Previously used per-bot JSON files which were prone to data loss and race conditions.
 *
 * Key improvements over JSON:
 *  - Atomic writes via SQLite transactions (no data loss on crash)
 *  - UNIQUE constraint prevents duplicate reminders (no race conditions)
 *  - Shared database works correctly with multi-bot setup
 *  - Timers are properly cleared on reconnect to prevent zombie callbacks
 */

import db from "../lib/db.js";
import { color } from "../lib/utils.js";

const BOT_ID = process.env.BOT_ID || "default";

// ── Prepared Statements ─────────────────────────────────────────────────────
const stmts = {
    getAll: db.prepare("SELECT * FROM reminders WHERE bot_id = ?"),
    getOne: db.prepare("SELECT * FROM reminders WHERE user_id = ? AND chat_id = ?"),
    insert: db.prepare(`
        INSERT INTO reminders (id, user_id, chat_id, trigger_time, message, created_at, bot_id)
        VALUES (@id, @user_id, @chat_id, @trigger_time, @message, @created_at, @bot_id)
    `),
    remove: db.prepare("DELETE FROM reminders WHERE user_id = ? AND chat_id = ?"),
    removeById: db.prepare("DELETE FROM reminders WHERE id = ?"),
    purgeExpired: db.prepare("DELETE FROM reminders WHERE trigger_time < ? AND bot_id = ?"),
};

// ── In-memory timer tracking ────────────────────────────────────────────────
let timers = new Map(); // key: `${userId}_${chatId}`, value: setTimeout ID
let globalSock = null;

/**
 * Clear all active timers.
 * Called before re-initialization on reconnect to prevent zombie callbacks.
 */
function clearAllTimers() {
    for (const [key, timerId] of timers) {
        clearTimeout(timerId);
    }
    timers.clear();
}

/**
 * Trigger a reminder — send message and remove from DB.
 */
async function _triggerReminder(reminder) {
    if (!globalSock) return;
    const { user_id, chat_id, message, id } = reminder;

    try {
        await globalSock.sendMessage(chat_id, {
            text: `⏰ *REMINDER*\n\n@${user_id.split("@")[0]}\n\n${message}`,
            mentions: [user_id],
        });
    } catch (err) {
        console.error(color("[REMINDER ERROR]", "red"), `Gagal mengirim reminder ke ${user_id} di ${chat_id}:`, err.message);
    }

    // Remove from DB and timer map
    try {
        stmts.remove.run(user_id, chat_id);
    } catch { /* ignore — may already be removed */ }

    const key = `${user_id}_${chat_id}`;
    timers.delete(key);
}

/**
 * Initialize all reminders on startup or reconnect.
 * Safe to call multiple times — clears all existing timers first.
 *
 * @param {object} sock Baileys socket instance
 */
export function initReminders(sock) {
    // Fix #15: Clear existing timers before re-init to prevent zombie callbacks
    clearAllTimers();

    globalSock = sock;

    // Purge reminders that expired long ago (> 1 hour)
    try {
        stmts.purgeExpired.run(Date.now() - 60 * 60 * 1000, BOT_ID);
    } catch { /* ignore */ }

    const reminders = stmts.getAll.all(BOT_ID);
    const now = Date.now();
    let triggeredCount = 0;
    let scheduledCount = 0;

    for (const reminder of reminders) {
        const key = `${reminder.user_id}_${reminder.chat_id}`;
        const delay = reminder.trigger_time - now;

        if (delay <= 0) {
            // Already expired while bot was off, trigger immediately
            _triggerReminder(reminder);
            triggeredCount++;
        } else {
            // Schedule it
            const timerId = setTimeout(() => _triggerReminder(reminder), delay);
            timers.set(key, timerId);
            scheduledCount++;
        }
    }

    if (triggeredCount > 0 || scheduledCount > 0) {
        console.log(color("[REMINDER]", "yellow"), `Loaded: ${scheduledCount} scheduled, ${triggeredCount} triggered immediately.`);
    }
}

/**
 * Check if a user already has an active reminder in a specific chat.
 * @param {string} userId
 * @param {string} chatId
 * @returns {boolean}
 */
export function hasReminder(userId, chatId) {
    const row = stmts.getOne.get(userId, chatId);
    return !!row;
}

/**
 * Add a new reminder.
 * @param {string} userId
 * @param {string} chatId
 * @param {number} triggerTime Unix timestamp in ms
 * @param {string} message
 */
export function addReminder(userId, chatId, triggerTime, message) {
    if (hasReminder(userId, chatId)) {
        throw new Error("Reminder sudah ada");
    }

    const reminder = {
        id: Date.now().toString(),
        user_id: userId,
        chat_id: chatId,
        trigger_time: triggerTime,
        message,
        created_at: Date.now(),
        bot_id: BOT_ID,
    };

    stmts.insert.run(reminder);

    const delay = triggerTime - Date.now();
    const key = `${userId}_${chatId}`;

    if (globalSock && delay > 0) {
        const timerId = setTimeout(() => _triggerReminder(reminder), delay);
        timers.set(key, timerId);
    } else if (delay <= 0) {
        _triggerReminder(reminder);
    }
}

/**
 * Remove an active reminder manually.
 * @param {string} userId
 * @param {string} chatId
 * @returns {boolean} true if removed, false if not found
 */
export function removeReminder(userId, chatId) {
    const key = `${userId}_${chatId}`;

    // Clear timeout if exists
    if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
    }

    const result = stmts.remove.run(userId, chatId);
    return result.changes > 0;
}
