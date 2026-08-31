/**
 * Reports & Feedbacks Database Module — SQLite Backend
 *
 * Replaces the old per-bot JSON file storage (database_reports_*.json)
 * with atomic SQLite operations for safe concurrent multi-bot operation.
 */

import db from "./db.js";
import setting from "../setting.js";

const BOT_ID = setting.botId || process.env.BOT_ID || "default";

// ── Prepared Statements ─────────────────────────────────────────────────────
const stmts = {
    insert: db.prepare(`
        INSERT INTO reports (type, sender, pushname, text, is_group, group_name, chat_id, message_key, replied, timestamp, bot_id)
        VALUES (@type, @sender, @pushname, @text, @is_group, @group_name, @chat_id, @message_key, @replied, @timestamp, @bot_id)
    `),
    getByType: db.prepare(`
        SELECT * FROM reports WHERE type = ? AND bot_id = ? ORDER BY id ASC
    `),
    getById: db.prepare(`
        SELECT * FROM reports WHERE id = ? AND type = ? AND bot_id = ?
    `),
    deleteById: db.prepare(`
        DELETE FROM reports WHERE id = ? AND type = ? AND bot_id = ?
    `),
    markReplied: db.prepare(`
        UPDATE reports SET replied = 1 WHERE id = ? AND type = ? AND bot_id = ?
    `),
};

/**
 * Convert a raw SQLite row into a clean JS report object
 */
function rowToReport(row) {
    if (!row) return null;
    let messageKey = null;
    if (row.message_key) {
        try {
            messageKey = JSON.parse(row.message_key);
        } catch {
            messageKey = row.message_key;
        }
    }
    return {
        id: row.id,
        sender: row.sender,
        pushname: row.pushname,
        text: row.text,
        isGroup: !!row.is_group,
        groupName: row.group_name || null,
        chatId: row.chat_id,
        messageKey,
        replied: !!row.replied,
        timestamp: row.timestamp,
    };
}

/**
 * Add a new report or feedback item.
 */
export function addReport(type, sender, pushname, text, isGroup, groupName, chatId, messageKey) {
    const timestamp = Date.now();
    const info = stmts.insert.run({
        type,
        sender,
        pushname: pushname || null,
        text,
        is_group: isGroup ? 1 : 0,
        group_name: groupName || null,
        chat_id: chatId,
        message_key: messageKey ? JSON.stringify(messageKey) : null,
        replied: 0,
        timestamp,
        bot_id: BOT_ID,
    });

    return {
        id: Number(info.lastInsertRowid),
        sender,
        pushname,
        text,
        isGroup: !!isGroup,
        groupName: groupName || null,
        chatId,
        messageKey,
        replied: false,
        timestamp,
    };
}

/**
 * Get all reports or feedbacks for the current bot.
 */
export function getReports(type) {
    const rows = stmts.getByType.all(type, BOT_ID);
    return rows.map(rowToReport);
}

/**
 * Delete a report or feedback by ID.
 */
export function deleteReport(type, id) {
    const result = stmts.deleteById.run(id, type, BOT_ID);
    return result.changes > 0;
}

/**
 * Mark a report or feedback as replied.
 */
export function markAsReplied(type, id) {
    const result = stmts.markReplied.run(id, type, BOT_ID);
    if (result.changes > 0) {
        const row = stmts.getById.get(id, type, BOT_ID);
        return rowToReport(row);
    }
    return null;
}
