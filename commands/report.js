/**
 * @fileoverview Report bugs, errors, or issues to bot owners.
 * @module commands/report
 */

import setting from "../setting.js";
import { addReport, getReports, deleteReport, markAsReplied } from "../lib/reportsDb.js";

export default {
    name: "report",
    aliases: ["bug", "keluhan"],
    category: "general",
    description: "Melaporkan bug, error, atau keluhan terkait bot kepada owner",
    usage: "!report <pesan laporan> | !report [-l/--list] [-d/--del <id>] [-r/--reply <id> <pesan>]",

    flags: {
        list:   { type: "boolean", char: "l", aliases: ["list"] },
        delete: { type: "boolean", char: "d", aliases: ["del", "delete"] },
        reply:  { type: "boolean", char: "r", aliases: ["reply"] },
    },

    async handler({ message, sock, args, cleanArgs, flags, rawArgs, sender, pushname, isGroup, groupName, isOwner, prefix }) {
        const p = prefix || "!";
        const effectiveArgs = cleanArgs || args;
        if (args.length === 0 && effectiveArgs.length === 0) {
            return message.reply(
                `╭━━━〔 🚨 REPORT 〕━━━\n` +
                `┃ ❌ Harap sertakan pesan laporan atau detail masalah.\n` +
                `┃ ⋄ Format: *${p}report <pesan>*\n` +
                `┃ ⋄ Contoh: *${p}report Fitur download error saat memproses link*\n` +
                `╰━━━━━━━━━━━━━━━━━━━━`
            );
        }

        // ── Owner Flags Management ─────────────────────────────────────
        if (flags?.list) {
            if (!isOwner) return message.reply("⚠️ Hanya Owner yang bisa menggunakan flag ini.");
            
            const reports = getReports("report");
            if (reports.length === 0) {
                return message.reply("✅ Belum ada laporan/bug yang masuk.");
            }

            let reply = `╭━━━〔 🐛 DAFTAR LAPORAN BUG 〕━━━\n` +
                `┃ Total : ${reports.length} laporan\n` +
                `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
            reports.forEach((rep) => {
                const date = new Date(rep.timestamp).toLocaleString("id-ID");
                reply += `╭───「 📋 ID: ${rep.id} 」\n`;
                reply += `│ ⋄ Pelapor : ${rep.pushname} (@${rep.sender.split("@")[0]})\n`;
                if (rep.isGroup) reply += `│ ⋄ Grup : ${rep.groupName}\n`;
                reply += `│ ⋄ Waktu : ${date}\n`;
                reply += `│ ⋄ Masalah : ${rep.text}\n`;
                if (rep.replied) reply += `│ ⋄ Status : ✅ Telah Dibalas\n`;
                reply += `╰──────────────\n\n`;
            });
            reply += `💡 Hapus: *${p}report -d <id>*\n`;
            reply += `💡 Balas: *${p}report -r <id> <pesan>*`;

            return message.reply(reply);
        }

        if (flags?.delete) {
            if (!isOwner) return message.reply("⚠️ Hanya Owner yang bisa menggunakan flag ini.");
            
            const id = parseInt(effectiveArgs[0], 10);
            if (isNaN(id)) {
                return message.reply(`❌ Masukkan ID laporan yang ingin dihapus.\nContoh: *${p}report -d 1*`);
            }

            const success = deleteReport("report", id);
            if (success) {
                return message.reply(`✅ Laporan ID ${id} berhasil dihapus.`);
            } else {
                return message.reply(`❌ Laporan dengan ID ${id} tidak ditemukan.`);
            }
        }

        if (flags?.reply) {
            if (!isOwner) return message.reply("⚠️ Hanya Owner yang bisa menggunakan flag ini.");
            
            const id = parseInt(effectiveArgs[0], 10);
            const replyMsg = effectiveArgs.slice(1).join(" ");
            if (isNaN(id) || !replyMsg) {
                return message.reply(`❌ Format salah.\nContoh: *${p}report -r 1 Oke, bug sedang diperbaiki*`);
            }

            const item = getReports("report").find(r => r.id === id);
            if (!item) {
                return message.reply(`❌ Laporan dengan ID ${id} tidak ditemukan.`);
            }

            const replyText = `╭━━━〔 📩 BALASAN OWNER 〕━━━\n` +
                `┃ ⋄ ID Laporan : ${id}\n` +
                `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
                `"${replyMsg}"\n\n` +
                `_Laporan aslimu:_\n_${item.text}_`;

            try {
                // Scenario 1: Reply directly to the original message in the original chat
                await sock.sendMessage(
                    item.chatId,
                    { text: replyText, mentions: [item.sender] },
                    { quoted: { key: item.messageKey, message: { conversation: item.text } } }
                );
                
                markAsReplied("report", id);
                return message.reply(`✅ Balasan berhasil dikirim ke @${item.sender.split("@")[0]} di obrolan aslinya.`);
            } catch (err) {
                // Fallback 1: Message expired or unavailable. Send without quoted
                try {
                    await sock.sendMessage(
                        item.chatId,
                        { text: replyText, mentions: [item.sender] }
                    );
                    markAsReplied("report", id);
                    return message.reply(`✅ Balasan dikirim ke grup/obrolan tanpa me-reply pesan asli karena pesan asli tidak dapat diakses.`);
                } catch (err2) {
                    // Fallback 2: Bot kicked from group, send via direct message
                    try {
                        await sock.sendMessage(
                            item.sender,
                            { text: `(Pesan dialihkan via Private Message karena grup asal tidak bisa diakses)\n\n` + replyText }
                        );
                        markAsReplied("report", id);
                        return message.reply(`✅ Balasan dikirim via Private Message karena obrolan asal tidak bisa diakses.`);
                    } catch (err3) {
                        return message.reply(`❌ Gagal mengirim balasan ke user tersebut sama sekali.`);
                    }
                }
            }
        }

        // ── Normal User Usage (Submitting Report) ─────────────────────
        const text = rawArgs.trim();
        const newItem = addReport("report", sender, pushname, text, isGroup, groupName, message.chat, message.key);

        // Notify Owners
        const ownerJids = setting.owner.map(num => num.includes("@s.whatsapp.net") ? num : num + "@s.whatsapp.net");
        
        let notificationMsg = `╭━━━〔 🚨 LAPORAN BUG BARU 〕━━━\n` +
            `┃ ⋄ ID : ${newItem.id}\n` +
            `┃ ⋄ Pelapor : ${pushname} (@${sender.split("@")[0]})\n`;
        if (isGroup) notificationMsg += `┃ ⋄ Grup : ${groupName}\n`;
        notificationMsg += `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
            `╭───「 💬 Masalah 」\n` +
            `│ ${text}\n` +
            `╰──────────────\n\n` +
            `💡 Hapus: *${p}report -d ${newItem.id}*\n` +
            `💡 Balas: *${p}report -r ${newItem.id} <pesan>*`;

        let notifyCount = 0;
        for (const ownerJid of ownerJids) {
            try {
                await sock.sendMessage(ownerJid, { text: notificationMsg, mentions: [sender] });
                notifyCount++;
            } catch (err) {
                console.error(`[REPORT] Failed to notify owner ${ownerJid}`, err.message);
            }
        }

        if (notifyCount > 0) {
            return message.reply("✅ Laporan telah diterima! Terima kasih telah memberitahu kami, Owner akan segera mengeceknya.");
        } else {
            return message.reply("✅ Laporan kamu telah dicatat, tetapi saat ini Owner tidak dapat dihubungi.");
        }
    }
};
