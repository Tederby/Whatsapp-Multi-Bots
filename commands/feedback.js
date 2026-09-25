/**
 * @fileoverview Submit feedback or suggestions to bot owners.
 * @module commands/feedback
 */

import setting from "../setting.js";
import { addReport, getReports, deleteReport, markAsReplied } from "../lib/reportsDb.js";

export default {
    name: "feedback",
    aliases: ["saran"],
    category: "general",
    description: "Mengirimkan saran atau ide fitur kepada owner bot",
    usage: "!feedback <pesan saran> | !feedback [-l/--list] [-d/--del <id>] [-r/--reply <id> <pesan>]",

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
                `╭━━━〔 💡 FEEDBACK 〕━━━\n` +
                `┃ ❌ Harap sertakan pesan saran atau ide fitur.\n` +
                `┃ ⋄ Format: *${p}feedback <pesan>*\n` +
                `┃ ⋄ Contoh: *${p}feedback Tolong tambahkan fitur tebak-tebakan*\n` +
                `╰━━━━━━━━━━━━━━━━━━━━`
            );
        }

        // ── Owner Flags Management ─────────────────────────────────────
        if (flags?.list) {
            if (!isOwner) return message.reply("⚠️ Hanya Owner yang bisa menggunakan flag ini.");
            
            const feedbacks = getReports("feedback");
            if (feedbacks.length === 0) {
                return message.reply("✅ Belum ada feedback yang masuk.");
            }

            let reply = `╭━━━〔 💡 DAFTAR FEEDBACK 〕━━━\n` +
                `┃ Total : ${feedbacks.length} saran\n` +
                `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
            feedbacks.forEach((fb) => {
                const date = new Date(fb.timestamp).toLocaleString("id-ID");
                reply += `╭───「 📋 ID: ${fb.id} 」\n`;
                reply += `│ ⋄ Pengirim : ${fb.pushname} (@${fb.sender.split("@")[0]})\n`;
                if (fb.isGroup) reply += `│ ⋄ Grup : ${fb.groupName}\n`;
                reply += `│ ⋄ Waktu : ${date}\n`;
                reply += `│ ⋄ Pesan : ${fb.text}\n`;
                if (fb.replied) reply += `│ ⋄ Status : ✅ Telah Dibalas\n`;
                reply += `╰──────────────\n\n`;
            });
            reply += `💡 Hapus: *${p}feedback -d <id>*\n`;
            reply += `💡 Balas: *${p}feedback -r <id> <pesan>*`;

            return message.reply(reply);
        }

        if (flags?.delete) {
            if (!isOwner) return message.reply("⚠️ Hanya Owner yang bisa menggunakan flag ini.");
            
            const id = parseInt(effectiveArgs[0], 10);
            if (isNaN(id)) {
                return message.reply(`❌ Masukkan ID feedback yang ingin dihapus.\nContoh: *${p}feedback -d 1*`);
            }

            const success = deleteReport("feedback", id);
            if (success) {
                return message.reply(`✅ Feedback ID ${id} berhasil dihapus.`);
            } else {
                return message.reply(`❌ Feedback dengan ID ${id} tidak ditemukan.`);
            }
        }

        if (flags?.reply) {
            if (!isOwner) return message.reply("⚠️ Hanya Owner yang bisa menggunakan flag ini.");
            
            const id = parseInt(effectiveArgs[0], 10);
            const replyMsg = effectiveArgs.slice(1).join(" ");
            if (isNaN(id) || !replyMsg) {
                return message.reply(`❌ Format salah.\nContoh: *${p}feedback -r 1 Oke, saran diterima*`);
            }

            const item = getReports("feedback").find(r => r.id === id);
            if (!item) {
                return message.reply(`❌ Feedback dengan ID ${id} tidak ditemukan.`);
            }

            const replyText = `╭━━━〔 📩 BALASAN OWNER 〕━━━\n` +
                `┃ ⋄ ID Feedback : ${id}\n` +
                `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
                `"${replyMsg}"\n\n` +
                `_Pesan aslimu:_\n_${item.text}_`;

            try {
                // Scenario 1: Reply directly to the original message in the original chat
                await sock.sendMessage(
                    item.chatId,
                    { text: replyText, mentions: [item.sender] },
                    { quoted: { key: item.messageKey, message: { conversation: item.text } } }
                );
                
                markAsReplied("feedback", id);
                return message.reply(`✅ Balasan berhasil dikirim ke @${item.sender.split("@")[0]} di obrolan aslinya.`);
            } catch (err) {
                // Fallback 1: Message could be expired/unavailable. Send without quoted
                try {
                    await sock.sendMessage(
                        item.chatId,
                        { text: replyText, mentions: [item.sender] }
                    );
                    markAsReplied("feedback", id);
                    return message.reply(`✅ Balasan dikirim ke grup/obrolan tanpa me-reply pesan asli karena pesan asli tidak dapat diakses.`);
                } catch (err2) {
                    // Fallback 2: Bot kicked from group, send via direct message
                    try {
                        await sock.sendMessage(
                            item.sender,
                            { text: `(Pesan dialihkan via Private Message karena grup asal tidak bisa diakses)\n\n` + replyText }
                        );
                        markAsReplied("feedback", id);
                        return message.reply(`✅ Balasan dikirim via Private Message karena obrolan asal tidak bisa diakses.`);
                    } catch (err3) {
                        return message.reply(`❌ Gagal mengirim balasan ke user tersebut sama sekali.`);
                    }
                }
            }
        }

        // ── Normal User Usage (Submitting Feedback) ─────────────────────
        const text = rawArgs.trim();
        const newItem = addReport("feedback", sender, pushname, text, isGroup, groupName, message.chat, message.key);

        // Notify Owners
        const ownerJids = setting.owner.map(num => num.includes("@s.whatsapp.net") ? num : num + "@s.whatsapp.net");
        
        let notificationMsg = `╭━━━〔 💡 FEEDBACK BARU 〕━━━\n` +
            `┃ ⋄ ID : ${newItem.id}\n` +
            `┃ ⋄ Pengirim : ${pushname} (@${sender.split("@")[0]})\n`;
        if (isGroup) notificationMsg += `┃ ⋄ Grup : ${groupName}\n`;
        notificationMsg += `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
            `╭───「 💬 Pesan 」\n` +
            `│ ${text}\n` +
            `╰──────────────\n\n` +
            `💡 Hapus: *${p}feedback -d ${newItem.id}*\n` +
            `💡 Balas: *${p}feedback -r ${newItem.id} <pesan>*`;

        let notifyCount = 0;
        for (const ownerJid of ownerJids) {
            try {
                await sock.sendMessage(ownerJid, { text: notificationMsg, mentions: [sender] });
                notifyCount++;
            } catch (err) {
                console.error(`[FEEDBACK] Failed to notify owner ${ownerJid}`, err.message);
            }
        }

        if (notifyCount > 0) {
            return message.reply("✅ Terima kasih! Saran kamu sudah dikirim langsung ke Owner bot.");
        } else {
            return message.reply("✅ Saran kamu telah dicatat, tetapi saat ini Owner tidak dapat dihubungi.");
        }
    }
};
