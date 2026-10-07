/**
 * Remind — Schedule one-time relative or absolute time reminders.
 *
 * @module commands/remind
 */

import moment from "moment-timezone";
import { addReminder, hasReminder, getReminder, removeReminder } from "../services/reminder.js";
import { resolveTarget } from "../lib/jidHelper.js";
import { formatUptime } from "../lib/utils.js";
import { logger } from "../lib/logger.js";

const TIMEZONE = "Asia/Jakarta"; // WIB (UTC+7)
const MAX_REMINDER_DAYS = 24; // Safe ceiling to avoid 32-bit signed int overflow in Node.js setTimeout
const MAX_LIMIT_MS = MAX_REMINDER_DAYS * 24 * 60 * 60 * 1000;

/**
 * Parse relative duration string.
 * Supports shorthand (1d, 12h, 30m, 15s) and Indonesian words (hari, jam, menit, detik).
 * @param {string} str
 * @returns {number|null} Duration in milliseconds
 */
function parseDuration(str) {
    let normalized = str.toLowerCase()
        .replace(/(\d+)\s*(?:hari|hr|days?|d)\b/g, "$1d")
        .replace(/(\d+)\s*(?:jam|hours?|hrs?|h)\b/g, "$1h")
        .replace(/(\d+)\s*(?:menit|mins?|minutes?|m)\b/g, "$1m")
        .replace(/(\d+)\s*(?:detik|secs?|seconds?|s)\b/g, "$1s")
        .replace(/\s+/g, "");

    const match = normalized.match(/^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!match) return null;
    if (!match[1] && !match[2] && !match[3] && !match[4]) return null;

    let ms = 0;
    if (match[1]) ms += parseInt(match[1], 10) * 86400000;
    if (match[2]) ms += parseInt(match[2], 10) * 3600000;
    if (match[3]) ms += parseInt(match[3], 10) * 60000;
    if (match[4]) ms += parseInt(match[4], 10) * 1000;
    return ms;
}

/**
 * Parse absolute time string in WIB (Asia/Jakarta).
 * Supports HH:mm (today or tomorrow), DD/MM/YYYY HH:mm, and YYYY-MM-DD HH:mm.
 * @param {string} str
 * @returns {number|null} Timestamp in milliseconds
 */
function parseAbsoluteTime(str) {
    const now = moment().tz(TIMEZONE);

    // 1. Format: HH:mm (e.g. 20:30)
    let matchTime = str.match(/^(\d{1,2}):(\d{2})$/);
    if (matchTime) {
        const hour = parseInt(matchTime[1], 10);
        const min = parseInt(matchTime[2], 10);
        if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;

        let target = now.clone().hour(hour).minute(min).second(0).millisecond(0);
        if (target.valueOf() <= now.valueOf()) {
            target.add(1, "day"); // tomorrow if time already passed today
        }
        return target.valueOf();
    }

    // 2. Format: DD/MM/YYYY HH:mm
    let matchDate1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (matchDate1) {
        let parsed = moment.tz(str, "D/M/YYYY H:mm", TIMEZONE);
        if (parsed.isValid()) return parsed.valueOf();
    }

    // 3. Format: YYYY-MM-DD HH:mm
    let matchDate2 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (matchDate2) {
        let parsed = moment.tz(str, "YYYY-M-D H:mm", TIMEZONE);
        if (parsed.isValid()) return parsed.valueOf();
    }

    return null;
}

/**
 * Format timestamp to human-readable WIB string.
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
    return moment(timestamp).tz(TIMEZONE).format("DD MMM YYYY, HH:mm [WIB]");
}

/**
 * Extract all mentioned JIDs from message context and raw text.
 * @param {object} message
 * @param {string} text
 * @returns {string[]} Canonical PN JIDs
 */
function extractMentions(message, text = "") {
    const rawMentions = [
        ...(message.mentionedJid || []),
        ...(message.quoted?.mentionedJid || [])
    ];

    if (message.quoted?.sender || message.quoted?.participant) {
        rawMentions.push(message.quoted.sender || message.quoted.participant);
    }

    // Manual numeric mention tags (@628123456789)
    const manualNums = [...(text.matchAll(/@(\d{10,16})/g) || [])].map(m => m[1]);
    for (const num of manualNums) {
        rawMentions.push(num + "@s.whatsapp.net");
    }

    // Manual LID mention tags (@123456789@lid)
    const manualLids = [...(text.matchAll(/@(\d{10,20})@lid/g) || [])].map(m => m[1]);
    for (const lid of manualLids) {
        rawMentions.push(lid + "@lid");
    }

    // Normalize and resolve all to canonical PN
    return Array.from(new Set(
        rawMentions
            .map(j => resolveTarget(j).jid)
            .filter(Boolean)
    ));
}

export default {
    name: "remind",
    aliases: ["reminder", "pengingat"],
    category: "tools",
    description: "Membuat pengingat (waktu relatif / waktu spesifik) dengan dukungan tag/mention.",
    usage: "!remind 10m Cek oven\n!remind 1d 12h Bayar tagihan\n!remind 20:30 Nonton bola @user\n!remind list\n!remind cancel",

    flags: {
        list: { type: "boolean", char: "l", aliases: ["list", "status"] },
        cancel: { type: "boolean", char: "c", aliases: ["cancel", "unremind", "batal"] },
    },

    async handler({ message, rawArgs, args, cleanArgs, flags, sender, prefix }) {
        const p = prefix || "!";
        const { jid: canonicalSender } = resolveTarget(sender);
        const resolvedSender = canonicalSender || sender;
        const chatId = message.chat;

        // ── Subcommand: List / Status ──────────────────────────────────────
        const isListAction = flags?.list || args?.[0]?.toLowerCase() === "list" || args?.[0]?.toLowerCase() === "status";
        if (isListAction) {
            const activeReminder = getReminder(resolvedSender, chatId);
            if (!activeReminder) {
                return message.reply(`⚠️ Kamu tidak memiliki pengingat yang aktif di obrolan ini.\nKetik \`${p}remind <waktu> <pesan>\` untuk membuatnya.`);
            }

            const remainingSec = Math.max(0, Math.floor((activeReminder.trigger_time - Date.now()) / 1000));
            const remainingStr = formatUptime(remainingSec);
            const cardLines = [
                "⏰ *PENGINGAT AKTIF*",
                "────────────────────────",
                `⋄ Waktu : ${formatTime(activeReminder.trigger_time)}`,
                `⋄ Sisa : ${remainingStr}`,
                `⋄ Catatan : ${activeReminder.message}`,
                "",
                `*ℹ️ Catatan:* Ketik *${p}unremind* untuk membatalkan`,
                "────────────────────────"
            ];
            return message.reply(cardLines.join("\n"));
        }

        // ── Subcommand: Cancel / Batal ─────────────────────────────────────
        const isCancelAction = flags?.cancel || args?.[0]?.toLowerCase() === "cancel" || args?.[0]?.toLowerCase() === "batal" || args?.[0]?.toLowerCase() === "unremind";
        if (isCancelAction) {
            const isRemoved = removeReminder(resolvedSender, chatId);
            if (isRemoved) {
                return message.reply("✅ Pengingat aktifmu di obrolan ini telah dibatalkan.");
            } else {
                return message.reply("⚠️ Kamu tidak memiliki pengingat yang aktif di obrolan ini.");
            }
        }

        const inputRaw = (cleanArgs && cleanArgs.length > 0) ? cleanArgs.join(" ") : (rawArgs || "").trim();

        // ── Bare Command: Help or Active Status ─────────────────────────────
        if (!inputRaw || inputRaw.trim() === "") {
            const activeReminder = getReminder(resolvedSender, chatId);
            if (activeReminder) {
                const remainingSec = Math.max(0, Math.floor((activeReminder.trigger_time - Date.now()) / 1000));
                const remainingStr = formatUptime(remainingSec);
                return message.reply(
                    `⏰ *PENGINGAT AKTIF*\n` +
                    `────────────────────────\n` +
                    `⋄ Waktu : ${formatTime(activeReminder.trigger_time)}\n` +
                    `⋄ Sisa : ${remainingStr}\n` +
                    `⋄ Catatan : ${activeReminder.message}\n\n` +
                    `*ℹ️ Notes:* Ketik *${p}unremind* untuk membatalkan\n` +
                    `────────────────────────`
                );
            }

            return message.reply(
                `⏰ *SET REMINDER*\n` +
                `────────────────────────\n` +
                `Buat pengingat waktu relatif atau spesifik.\n\n` +
                `*⏳ Durasi Relatif*\n` +
                `⋄ \`${p}remind 10m Cek oven\`\n` +
                `⋄ \`${p}remind 1 jam 30 menit Rapat\`\n` +
                `⋄ \`${p}remind 1d 12h Bayar tagihan\`\n\n` +
                `*📅 Waktu Spesifik (WIB)*\n` +
                `⋄ \`${p}remind 20:30 Nonton bola @user\`\n` +
                `⋄ \`${p}remind 31/12/2026 23:59 Tahun Baru\`\n\n` +
                `*⚙️ Opsi Lain*\n` +
                `⋄ \`${p}remind list\` : Cek pengingat aktif\n` +
                `⋄ \`${p}unremind\` : Batalkan pengingat\n` +
                `────────────────────────`
            );
        }

        // Cek limitasi 1 remind per user per chat
        if (hasReminder(resolvedSender, chatId)) {
            const active = getReminder(resolvedSender, chatId);
            const remaining = active ? ` (${formatUptime(Math.max(0, Math.floor((active.trigger_time - Date.now()) / 1000)))})` : "";
            return message.reply(`⚠️ Kamu masih memiliki pengingat aktif di obrolan ini${remaining}.\nKetik *${p}unremind* untuk membatalkannya terlebih dahulu.`);
        }

        let raw = inputRaw.trim();
        let triggerTime = null;
        let messageStr = "";

        // 1. Coba parsing waktu absolut
        let matchAbs1 = raw.match(/^(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})\s*(.*)/i);
        let matchAbs2 = raw.match(/^(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})\s*(.*)/i);
        let matchAbs3 = raw.match(/^(\d{1,2}:\d{2})\s*(.*)/i);

        if (matchAbs1) {
            triggerTime = parseAbsoluteTime(matchAbs1[1]);
            if (triggerTime) messageStr = matchAbs1[2].trim();
        } else if (matchAbs2) {
            triggerTime = parseAbsoluteTime(matchAbs2[1]);
            if (triggerTime) messageStr = matchAbs2[2].trim();
        } else if (matchAbs3) {
            triggerTime = parseAbsoluteTime(matchAbs3[1]);
            if (triggerTime) messageStr = matchAbs3[2].trim();
        }

        // 2. Coba parsing waktu relatif (durasi shorthand & kata bahasa Indonesia)
        if (!triggerTime) {
            let matchRel = raw.match(/^((?:\d+\s*(?:hari|jam|menit|detik|hr|hours?|mins?|secs?|[dhms])\s*)+)(.*)/i);
            if (matchRel) {
                let duration = parseDuration(matchRel[1]);
                if (duration) {
                    triggerTime = Date.now() + duration;
                    messageStr = matchRel[2].trim();
                }
            }
        }

        // Fallback: Jika me-reply pesan dan catatan kosong, gunakan teks pesan yang di-reply
        if (!messageStr && message.quoted && message.quoted.text) {
            messageStr = message.quoted.text;
        }

        // 3. Validasi akhir
        if (!triggerTime || !messageStr) {
            return message.reply(`❌ Gagal mem-parsing waktu atau pesan pengingat kosong.\nContoh: \`${p}remind 15m Angkat jemuran\` atau \`${p}remind 20:30 Rapat @teman\``);
        }

        if (triggerTime < Date.now()) {
            return message.reply("❌ Waktu pengingat sudah berlalu.");
        }

        if (triggerTime - Date.now() > MAX_LIMIT_MS) {
            return message.reply(`❌ Pengingat maksimal adalah ${MAX_REMINDER_DAYS} hari dari sekarang.`);
        }

        // Kumpulkan seluruh mention JID yang terlibat
        const mentions = extractMentions(message, raw);

        try {
            addReminder(resolvedSender, chatId, triggerTime, messageStr, mentions);
            const remainingStr = formatUptime(Math.max(0, Math.floor((triggerTime - Date.now()) / 1000)));

            const successLines = [
                "⏰ *PENGINGAT DISIMPAN*",
                "────────────────────────",
                `⋄ Waktu : ${formatTime(triggerTime)}`,
                `⋄ Sisa : ${remainingStr}`,
                `⋄ Catatan : ${messageStr}`,
                "────────────────────────"
            ];
            message.reply(successLines.join("\n"));
        } catch (error) {
            logger.error("REMIND", error);
            message.reply("❌ Gagal membuat pengingat.");
        }
    }
};

