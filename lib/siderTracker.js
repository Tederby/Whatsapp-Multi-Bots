/**
 * Sider Tracker — Report generation logic.
 *
 * Called from commands/track.js when admin triggers `!track report`.
 * Kept separate from handler.js to avoid bloating the message pipeline.
 */

import { getGroupSiders, getGroupMsgCounts, resetGroupMsgCounts,
         getGroupConfig, saveGroupConfig } from "./database.js";

/**
 * Generate sider report text + mentions for a group.
 * @param {string} chatId - Group JID
 * @returns {{ text: string, mentions: string[], siderCount: number, totalTracked: number }}
 */
export function generateSiderReport(chatId) {
    const config = getGroupConfig(chatId);
    const meta = config.meta || {};
    const threshold = meta.trackingThreshold || 10;
    const periodDays = meta.trackingPeriodDays || 30;
    const startedAt = meta.trackingStartedAt;

    const siders = getGroupSiders(chatId, threshold);
    const allCounts = getGroupMsgCounts(chatId);

    // Elapsed days since tracking started
    const elapsedDays = startedAt
        ? Math.floor((Date.now() - startedAt) / 86400000)
        : 0;

    let text = `╭━━━〔 📊 LAPORAN SIDER 〕━━━\n`;
    text += `┃ 📅 Periode   : ${elapsedDays} / ${periodDays} hari\n`;
    text += `┃ 🎯 Threshold : < ${threshold} pesan\n`;
    text += `┃ 👥 Tercatat  : ${allCounts.length} member\n`;
    text += `┃ ⚠️ Sider     : ${siders.length} member\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    const mentions = [];

    if (siders.length === 0) {
        text += `✅ *Tidak ada sider terdeteksi!*\nSemua member yang tercatat sudah aktif di atas threshold.`;
    } else {
        text += `╭───「 ⚠️ Daftar Sider 」\n`;
        for (const s of siders) {
            const baseId = s.user_id.split("@")[0];
            text += `│ ⋄ @${baseId} — ${s.count} pesan\n`;
            mentions.push(s.user_id);
        }
        text += `╰──────────────\n\n`;
        text += `💡 _Admin dapat mengambil tindakan terhadap member di atas._`;
    }

    return { text, mentions, siderCount: siders.length, totalTracked: allCounts.length };
}

/**
 * Reset tracking data and start a new cycle.
 * @param {string} chatId - Group JID
 */
export function resetAndStartNewCycle(chatId) {
    resetGroupMsgCounts(chatId);
    const config = getGroupConfig(chatId);
    config.meta = config.meta || {};
    config.meta.trackingStartedAt = Date.now();
    saveGroupConfig(chatId, config);
}
