/**
 * Track — Sider (lurker) tracking command.
 *
 * Tracks message counts per user in a group to detect inactive members.
 * Without arguments, shows current tracking info + settings menu.
 * Sub-commands: on, off, status, stats, report, reset, threshold, period,
 *               exclude, include, check.
 */

import { getGroupConfig, saveGroupConfig, getGroupMsgCounts,
         getUserMsgCount, resetGroupMsgCounts } from "../lib/database.js";
import { resolveTarget } from "../lib/jidHelper.js";
import { generateSiderReport, resetAndStartNewCycle } from "../lib/siderTracker.js";

export default {
    name: "track",
    aliases: ["sider", "tracking"],
    category: "group",
    description: "Kelola tracking aktivitas member untuk deteksi sider",
    usage: "!track [on|off|status|stats|report|reset|threshold|period|exclude|include|check]",
    groupOnly: true,

    async handler({ message, sock, args, sender, prefix, groupMetadata,
                    isGroupAdmins, isOwner }) {
        try {
            const chatId = message.chat;
            const config = getGroupConfig(chatId);
            const meta = config.meta || {};
            const sub = args[0]?.toLowerCase();

            // ── "check" subcommand — accessible by ALL members ──────
            if (sub === "check") {
                return await handleCheck(message, sock, args, sender, chatId, meta, prefix);
            }

            // ── All other subcommands require admin/owner ───────────
            if (sub && !isGroupAdmins && !isOwner) {
                return message.reply("⚠️ Hanya admin grup atau owner bot yang bisa mengelola tracking.");
            }

            // ── No subcommand: show info + menu ─────────────────────
            if (!sub) {
                return await showInfoMenu(message, sock, chatId, config, meta, prefix);
            }

            switch (sub) {
                case "on":
                    return await handleOn(message, chatId, config, meta, sender);
                case "off":
                    return await handleOff(message, chatId, config, meta);
                case "status":
                    return await handleStatus(message, chatId, meta, prefix);
                case "stats":
                    return await handleStats(message, sock, chatId, meta, groupMetadata);
                case "report":
                    return await handleReport(message, sock, chatId, meta);
                case "reset":
                    return await handleReset(message, chatId, config, meta);
                case "threshold":
                    return await handleThreshold(message, args, chatId, config, meta, prefix);
                case "period":
                    return await handlePeriod(message, args, chatId, config, meta, prefix);
                case "exclude":
                    return await handleExclude(message, sock, args, chatId, config, meta, prefix);
                case "include":
                    return await handleInclude(message, sock, args, chatId, config, meta, prefix);
                default:
                    return message.reply(
                        `❌ Subcommand *${sub}* tidak dikenali.\n` +
                        `Ketik \`${prefix}track\` untuk melihat daftar perintah.`
                    );
            }

        } catch (error) {
            console.error("[TRACK CMD]", error);
            message.reply("Terjadi kesalahan saat memproses perintah tracking.");
        }
    },
};

// ── Show Info + Menu (no subcommand) ────────────────────────────────────────

async function showInfoMenu(message, sock, chatId, config, meta, prefix) {
    const isActive = !!meta.trackingEnabled;
    const allCounts = isActive ? getGroupMsgCounts(chatId) : [];
    const threshold = meta.trackingThreshold || 10;
    const periodDays = meta.trackingPeriodDays || 30;

    let caption = `╭━━━〔 📊 Sider Tracking 〕━━━\n`;
    if (isActive) {
        const elapsed = meta.trackingStartedAt
            ? Math.floor((Date.now() - meta.trackingStartedAt) / 86400000)
            : 0;
        caption += `┃ ℹ️ *Tracking sedang AKTIF*\n`;
        caption += `┃ 📅 Berjalan : ${elapsed} / ${periodDays} hari\n`;
        caption += `┃ 🎯 Threshold: < ${threshold} pesan\n`;
        caption += `┃ 👥 Tercatat : ${allCounts.length} member\n`;
    } else {
        caption += `┃ ℹ️ *Tracking sedang NONAKTIF*\n`;
        caption += `┃ Aktifkan dengan \`${prefix}track on\`\n`;
    }
    caption += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    caption += `╭━━━〔 ⚙️ Menu Pengaturan 〕━━━\n`;
    caption += `┃ Gunakan langsung sebagai argumen:\n`;
    caption += `┃\n`;
    caption += `┃ 🔄 *Toggle*\n`;
    caption += `┃ ⋄ \`on\` aktifkan tracking\n`;
    caption += `┃ ⋄ \`off\` nonaktifkan & hapus data\n`;
    caption += `┃\n`;
    caption += `┃ 📊 *Data*\n`;
    caption += `┃ ⋄ \`status\` lihat status tracking\n`;
    caption += `┃ ⋄ \`stats\` leaderboard aktivitas\n`;
    caption += `┃ ⋄ \`report\` kirim laporan sider\n`;
    caption += `┃ ⋄ \`reset\` reset data tanpa report\n`;
    caption += `┃ ⋄ \`check\` cek jumlah pesan sendiri\n`;
    caption += `┃\n`;
    caption += `┃ ⚙️ *Konfigurasi*\n`;
    caption += `┃ ⋄ \`threshold <n>\` ubah batas pesan\n`;
    caption += `┃ ⋄ \`period <n>\` ubah periode hari\n`;
    caption += `┃ ⋄ \`exclude @user\` exclude dari tracking\n`;
    caption += `┃ ⋄ \`include @user\` re-include user\n`;
    caption += `┃\n`;
    caption += `┃ 💡 _Contoh: \`${prefix}track threshold 15\`_\n`;
    caption += `╰━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

// ── Subcommand Handlers ─────────────────────────────────────────────────────

async function handleOn(message, chatId, config, meta, sender) {
    if (meta.trackingEnabled) {
        const elapsed = meta.trackingStartedAt
            ? Math.floor((Date.now() - meta.trackingStartedAt) / 86400000)
            : 0;
        return message.reply(
            `ℹ️ Tracking sudah aktif di grup ini sejak *${elapsed} hari* yang lalu.`
        );
    }

    config.meta = meta;
    meta.trackingEnabled = true;
    meta.trackingStartedAt = Date.now();
    meta.trackingActivatedBy = sender;
    if (!meta.trackingThreshold) meta.trackingThreshold = 10;
    if (!meta.trackingPeriodDays) meta.trackingPeriodDays = 30;
    if (!meta.trackingExcluded) meta.trackingExcluded = [];
    saveGroupConfig(chatId, config);

    return message.reply(
        `✅ *Tracking diaktifkan!*\n\n` +
        `📅 Periode  : ${meta.trackingPeriodDays} hari\n` +
        `🎯 Threshold: < ${meta.trackingThreshold} pesan\n\n` +
        `Bot akan mulai mencatat jumlah pesan setiap member.\n` +
        `Gunakan \`!track report\` untuk melihat laporan sider.`
    );
}

async function handleOff(message, chatId, config, meta) {
    if (!meta.trackingEnabled) {
        return message.reply("ℹ️ Tracking sudah nonaktif di grup ini.");
    }

    // Clear tracking data
    resetGroupMsgCounts(chatId);
    config.meta = meta;
    meta.trackingEnabled = false;
    delete meta.trackingStartedAt;
    delete meta.trackingActivatedBy;
    delete meta.trackingExcluded;
    saveGroupConfig(chatId, config);

    return message.reply(
        `✅ *Tracking dinonaktifkan.*\n` +
        `Semua data counter telah dihapus.`
    );
}

async function handleStatus(message, chatId, meta, prefix) {
    if (!meta.trackingEnabled) {
        return message.reply(
            `ℹ️ Tracking tidak aktif.\nAktifkan dengan \`${prefix}track on\`.`
        );
    }

    const threshold = meta.trackingThreshold || 10;
    const periodDays = meta.trackingPeriodDays || 30;
    const elapsed = meta.trackingStartedAt
        ? Math.floor((Date.now() - meta.trackingStartedAt) / 86400000)
        : 0;
    const remaining = Math.max(0, periodDays - elapsed);
    const allCounts = getGroupMsgCounts(chatId);
    const excluded = meta.trackingExcluded || [];

    let text = `╭━━━〔 📊 Status Tracking 〕━━━\n`;
    text += `┃ 📅 Berjalan  : ${elapsed} / ${periodDays} hari\n`;
    text += `┃ ⏳ Sisa      : ${remaining} hari\n`;
    text += `┃ 🎯 Threshold : < ${threshold} pesan\n`;
    text += `┃ 👥 Tercatat  : ${allCounts.length} member\n`;
    text += `┃ 🚫 Excluded  : ${excluded.length} user\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━`;

    return message.reply(text);
}

async function handleStats(message, sock, chatId, meta, groupMetadata) {
    if (!meta.trackingEnabled) {
        return message.reply("⚠️ Tracking belum diaktifkan di grup ini.");
    }

    const allCounts = getGroupMsgCounts(chatId);
    if (allCounts.length === 0) {
        return message.reply("ℹ️ Belum ada data pesan yang tercatat.");
    }

    const threshold = meta.trackingThreshold || 10;

    // Build leaderboard (already sorted DESC by count from query)
    let text = `╭━━━〔 📊 Leaderboard Aktivitas 〕━━━\n`;
    text += `┃ 👥 Total tercatat: ${allCounts.length} member\n`;
    text += `┃ 🎯 Threshold sider: < ${threshold} pesan\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Top 10 most active
    const top = allCounts.slice(0, 10);
    text += `╭───「 🏆 Paling Aktif 」\n`;
    const mentions = [];
    for (let i = 0; i < top.length; i++) {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        const baseId = top[i].user_id.split("@")[0];
        text += `│ ${medal} @${baseId} — ${top[i].count} pesan\n`;
        mentions.push(top[i].user_id);
    }
    text += `╰──────────────\n\n`;

    // Bottom 5 least active (potential siders)
    const bottom = allCounts.slice(-5).reverse();
    text += `╭───「 ⚠️ Paling Pasif 」\n`;
    for (const entry of bottom) {
        const baseId = entry.user_id.split("@")[0];
        const label = entry.count < threshold ? "⛔" : "⚠️";
        text += `│ ${label} @${baseId} — ${entry.count} pesan\n`;
        mentions.push(entry.user_id);
    }
    text += `╰──────────────`;

    await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
}

async function handleReport(message, sock, chatId, meta) {
    if (!meta.trackingEnabled) {
        return message.reply("⚠️ Tracking belum diaktifkan di grup ini.");
    }

    const allCounts = getGroupMsgCounts(chatId);
    if (allCounts.length === 0) {
        return message.reply("ℹ️ Belum ada data pesan yang tercatat.");
    }

    const { text, mentions, siderCount } = generateSiderReport(chatId);
    await sock.sendMessage(chatId, { text, mentions }, { quoted: message });

    if (siderCount > 0) {
        await message.reply(
            `💡 Gunakan \`!track reset\` untuk reset data & mulai siklus baru.`
        );
    }
}

async function handleReset(message, chatId, config, meta) {
    if (!meta.trackingEnabled) {
        return message.reply("⚠️ Tracking belum diaktifkan di grup ini.");
    }

    resetAndStartNewCycle(chatId);

    return message.reply(
        `✅ *Data tracking telah di-reset.*\n` +
        `Siklus baru dimulai dari sekarang.`
    );
}

async function handleThreshold(message, args, chatId, config, meta, prefix) {
    const value = parseInt(args[1], 10);
    if (!args[1] || isNaN(value) || value < 1) {
        const current = meta.trackingThreshold || 10;
        return message.reply(
            `ℹ️ Threshold saat ini: *${current} pesan*\n\n` +
            `Gunakan: \`${prefix}track threshold <angka>\`\n` +
            `Contoh: \`${prefix}track threshold 15\``
        );
    }

    config.meta = meta;
    meta.trackingThreshold = value;
    saveGroupConfig(chatId, config);

    return message.reply(
        `✅ Threshold diubah menjadi *< ${value} pesan*.\n` +
        `Member dengan jumlah pesan di bawah ini akan dianggap sider.`
    );
}

async function handlePeriod(message, args, chatId, config, meta, prefix) {
    const value = parseInt(args[1], 10);
    if (!args[1] || isNaN(value) || value < 1 || value > 365) {
        const current = meta.trackingPeriodDays || 30;
        return message.reply(
            `ℹ️ Periode saat ini: *${current} hari*\n\n` +
            `Gunakan: \`${prefix}track period <hari>\`\n` +
            `Contoh: \`${prefix}track period 14\`\n` +
            `Rentang: 1 - 365 hari`
        );
    }

    config.meta = meta;
    meta.trackingPeriodDays = value;
    saveGroupConfig(chatId, config);

    return message.reply(`✅ Periode tracking diubah menjadi *${value} hari*.`);
}

async function handleExclude(message, sock, args, chatId, config, meta, prefix) {
    const excluded = meta.trackingExcluded || [];

    // No mention → show excluded list
    const mentioned = message.mentionedJid || [];
    if (mentioned.length === 0) {
        if (excluded.length === 0) {
            return message.reply(
                `ℹ️ Belum ada user yang di-exclude dari tracking.\n\n` +
                `Gunakan: \`${prefix}track exclude @user\`\n` +
                `Atau: \`${prefix}track include @user\` untuk re-include.`
            );
        }

        let text = `╭───「 🚫 User yang Di-exclude 」\n`;
        const mentions = [];
        for (const jid of excluded) {
            const baseId = jid.split("@")[0];
            text += `│ ⋄ @${baseId}\n`;
            mentions.push(jid);
        }
        text += `╰──────────────\n\n`;
        text += `💡 _Gunakan \`${prefix}track exclude @user\` untuk menambah,\n`;
        text += `   atau \`${prefix}track include @user\` untuk menghapus._`;

        return await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
    }

    // Add mentioned users to exclusion list
    const added = [];
    for (const jid of mentioned) {
        const { jid: resolved } = resolveTarget(jid);
        if (!excluded.includes(resolved)) {
            excluded.push(resolved);
            added.push(resolved);
        }
    }

    if (added.length === 0) {
        return message.reply("ℹ️ Semua user yang di-tag sudah ada di daftar exclusion.");
    }

    config.meta = meta;
    meta.trackingExcluded = excluded;
    saveGroupConfig(chatId, config);

    const names = added.map(jid => `@${jid.split("@")[0]}`).join(", ");
    return await sock.sendMessage(
        chatId,
        {
            text: `✅ Berhasil meng-exclude ${added.length} user dari tracking:\n${names}`,
            mentions: added,
        },
        { quoted: message }
    );
}

async function handleInclude(message, sock, args, chatId, config, meta, prefix) {
    const excluded = meta.trackingExcluded || [];

    // No mention → show excluded list (same as exclude without args)
    const mentioned = message.mentionedJid || [];
    if (mentioned.length === 0) {
        if (excluded.length === 0) {
            return message.reply(
                `ℹ️ Belum ada user yang di-exclude dari tracking.\n` +
                `Tidak ada yang perlu di-include kembali.`
            );
        }

        let text = `╭───「 🚫 User yang Di-exclude 」\n`;
        const mentions = [];
        for (const jid of excluded) {
            const baseId = jid.split("@")[0];
            text += `│ ⋄ @${baseId}\n`;
            mentions.push(jid);
        }
        text += `╰──────────────\n\n`;
        text += `💡 _Tag user di atas untuk me-include mereka kembali:\n`;
        text += `   \`${prefix}track include @user\`_`;

        return await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
    }

    // Remove mentioned users from exclusion list
    const removed = [];
    for (const jid of mentioned) {
        const { jid: resolved } = resolveTarget(jid);
        const idx = excluded.indexOf(resolved);
        if (idx !== -1) {
            excluded.splice(idx, 1);
            removed.push(resolved);
        }
    }

    if (removed.length === 0) {
        return message.reply("ℹ️ Tidak ada user yang di-tag ditemukan di daftar exclusion.");
    }

    config.meta = meta;
    meta.trackingExcluded = excluded;
    saveGroupConfig(chatId, config);

    const names = removed.map(jid => `@${jid.split("@")[0]}`).join(", ");
    return await sock.sendMessage(
        chatId,
        {
            text: `✅ Berhasil me-include kembali ${removed.length} user:\n${names}\n\nPesan mereka akan mulai dihitung kembali.`,
            mentions: removed,
        },
        { quoted: message }
    );
}

async function handleCheck(message, sock, args, sender, chatId, meta, prefix) {
    if (!meta.trackingEnabled) {
        return message.reply(
            `ℹ️ Tracking tidak aktif di grup ini.\nAdmin bisa mengaktifkan dengan \`${prefix}track on\`.`
        );
    }

    // Determine target user
    const mentioned = message.mentionedJid || [];
    let targetJid = sender;
    let isSelf = true;

    if (mentioned.length > 0) {
        const { jid: resolved } = resolveTarget(mentioned[0]);
        targetJid = resolved;
        isSelf = (targetJid === sender);
    }

    const count = getUserMsgCount(chatId, targetJid);
    const threshold = meta.trackingThreshold || 10;
    const baseId = targetJid.split("@")[0];

    const status = count >= threshold ? "✅ Aman" : "⚠️ Di bawah threshold";

    if (isSelf) {
        return message.reply(
            `📊 Kamu sudah mengirim *${count} pesan* dalam periode tracking ini.\n` +
            `🎯 Threshold: ${threshold} pesan — ${status}`
        );
    }

    return await sock.sendMessage(
        chatId,
        {
            text: `📊 @${baseId} sudah mengirim *${count} pesan* dalam periode tracking ini.\n` +
                  `🎯 Threshold: ${threshold} pesan — ${status}`,
            mentions: [targetJid],
        },
        { quoted: message }
    );
}
