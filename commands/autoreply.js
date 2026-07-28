import { getGroupConfig, saveGroupConfig } from "../lib/database.js";

export default {
    name: "autoreply",
    aliases: ["ar", "autorespond"],
    category: "group",
    description: "Mengatur balasan otomatis khusus untuk grup ini (Admin Only).",
    usage: "!autoreply kata kunci | teks balasan\n!autoreply --list\n!autoreply --del kata kunci",
    groupOnly: true,
    adminOnly: true,
    async handler({ message, rawArgs, prefix }) {
        const textArgs = (rawArgs || "").trim();
        const chat = message.chat;
        const config = getGroupConfig(chat);

        if (!textArgs && !message.quoted) {
            return await message.reply(`❌ Format salah. Gunakan:\n1. Tambah: \`${prefix}autoreply kata kunci | teks balasan\`\n2. Hapus: \`${prefix}autoreply --del kata kunci\`\n3. Lihat daftar: \`${prefix}autoreply --list\``);
        }

        if (textArgs.toLowerCase() === "--list") {
            const replies = config.autoReplies || {};
            const keys = Object.keys(replies);
            
            if (keys.length === 0) {
                return await message.reply("Belum ada auto-reply yang disetel di grup ini.");
            }
            
            let listMsg = "📝 *Daftar Auto-Reply Grup Ini:*\n\n";
            keys.forEach((key, index) => {
                const displayKey = key.startsWith("sticker:") ? "[Stiker]" : key;
                const displayRes = replies[key].type === "sticker" ? "[Balasan Stiker]" : replies[key].text;
                listMsg += `${index + 1}. *Trigger:* ${displayKey}\n   *Balasan:* ${displayRes}\n\n`;
            });
            
            return await message.reply(listMsg.trim());
        }

        if (textArgs.toLowerCase() === "--del" || textArgs.toLowerCase().startsWith("--del ")) {
            let triggerToDelete = "";
            
            if (textArgs.toLowerCase() === "--del" && message.quoted) {
                if (message.quoted.message?.stickerMessage) {
                    const hash = Buffer.from(message.quoted.message.stickerMessage.fileSha256).toString('base64');
                    triggerToDelete = `sticker:${hash}`;
                } else if (message.quoted.text) {
                    triggerToDelete = message.quoted.text.toLowerCase();
                }
            } else {
                triggerToDelete = textArgs.slice(6).trim().toLowerCase();
            }
            
            if (!triggerToDelete) {
                return await message.reply(`❌ Masukkan kata kunci atau index yang ingin dihapus, atau reply pesan yang ingin dihapus trigger-nya. Contoh: \`${prefix}autoreply --del halo\` atau \`${prefix}autoreply --del 1\``);
            }

            const replies = config.autoReplies || {};
            const keys = Object.keys(replies);
            let deleted = false;
            let mediaPathToDelete = null;
            let finalDeletedTrigger = triggerToDelete;
            
            // 1. Coba hapus berdasarkan EXACT MATCH trigger terlebih dahulu
            for (const key of keys) {
                if (key.toLowerCase() === triggerToDelete.toLowerCase()) {
                    if (replies[key].type === "sticker" && replies[key].mediaPath) {
                        mediaPathToDelete = replies[key].mediaPath;
                    }
                    delete replies[key];
                    deleted = true;
                    finalDeletedTrigger = key;
                    break;
                }
            }

            // 2. Jika tidak ada exact match dan input adalah angka, coba hapus berdasarkan index
            if (!deleted && /^\d+$/.test(triggerToDelete)) {
                const indexToDelete = parseInt(triggerToDelete, 10) - 1; // 0-based index
                if (indexToDelete >= 0 && indexToDelete < keys.length) {
                    const key = keys[indexToDelete];
                    if (replies[key].type === "sticker" && replies[key].mediaPath) {
                        mediaPathToDelete = replies[key].mediaPath;
                    }
                    delete replies[key];
                    deleted = true;
                    finalDeletedTrigger = key;
                }
            }

            if (deleted) {
                if (mediaPathToDelete && (await import('fs')).existsSync(mediaPathToDelete)) {
                    (await import('fs')).unlinkSync(mediaPathToDelete);
                }
                config.autoReplies = replies;
                saveGroupConfig(chat, config);
                const displayKey = finalDeletedTrigger.startsWith("sticker:") ? "[Stiker]" : finalDeletedTrigger;
                return await message.reply(`✅ Berhasil menghapus auto-reply untuk: *${displayKey}*`);
            } else {
                return await message.reply(`❌ Kata kunci atau index tidak ditemukan di daftar auto-reply.`);
            }
        }

        // Add auto reply
        const splitArgs = textArgs.split("|");
        
        let trigger = splitArgs[0] ? splitArgs[0].trim() : "";
        let responseText = splitArgs.slice(1).join("|").trim();
        
        let responseType = "text";
        let responseMediaPath = "";

        const isQuotedSticker = !!message.quoted?.message?.stickerMessage;
        const quotedText = message.quoted?.text || "";
        const quotedStickerMsg = message.quoted?.message?.stickerMessage;

        // Case 1: !ar trigger| (Response is the quoted msg)
        if (trigger && !responseText && textArgs.includes("|") && message.quoted) {
            if (isQuotedSticker) {
                responseType = "sticker";
                await message.reply("⏳ Menyimpan stiker untuk autoreply...");
                
                // Fix DNS for downloading media if needed
                if (quotedStickerMsg?.url && quotedStickerMsg.url.includes('a.whatsapp.net')) {
                    quotedStickerMsg.url = quotedStickerMsg.url.replace('a.whatsapp.net', 'mmg.whatsapp.net');
                }
                const { downloadContentFromMessage } = await import("baileys");
                const fs = await import("fs");
                const path = await import("path");
                
                const stream = await downloadContentFromMessage(quotedStickerMsg, 'sticker');
                const chunks = [];
                for await (const chunk of stream) { chunks.push(chunk); }
                const buffer = Buffer.concat(chunks);
                
                const arDir = path.resolve(process.cwd(), "database", "autoreply");
                if (!fs.existsSync(arDir)) fs.mkdirSync(arDir, { recursive: true });
                
                responseMediaPath = path.join(arDir, `${chat.split('@')[0]}_${Date.now()}.webp`);
                fs.writeFileSync(responseMediaPath, buffer);
                responseText = "[Stiker]";
            } else if (quotedText) {
                responseText = quotedText;
            } else {
                return await message.reply("❌ Harap reply teks atau stiker untuk balasannya.");
            }
        }
        // Case 2: !ar |respond (Trigger is the quoted msg)
        else if (!trigger && responseText && textArgs.includes("|") && message.quoted) {
            if (isQuotedSticker) {
                const hash = Buffer.from(quotedStickerMsg.fileSha256).toString('base64');
                trigger = `sticker:${hash}`;
            } else if (quotedText) {
                trigger = quotedText.trim();
            } else {
                return await message.reply("❌ Harap reply teks atau stiker untuk trigger-nya.");
            }
        }

        if (!trigger || !responseText) {
            return await message.reply(`❌ Format salah. Gunakan tanda *|* (pipa) untuk memisahkan kata kunci dan balasan.\nContoh: \`${prefix}autoreply Halo | Halo juga\``);
        }

        // Ambil mention dari pesan
        const mentions = message.mentionedJid || [];

        if (!config.autoReplies) config.autoReplies = {};
        
        // Cek jika sudah ada dengan key yang sama tapi case berbeda, hapus dulu
        for (const key of Object.keys(config.autoReplies)) {
            if (key.toLowerCase() === trigger.toLowerCase()) {
                if (config.autoReplies[key].type === "sticker" && config.autoReplies[key].mediaPath) {
                    const fs = await import('fs');
                    if (fs.existsSync(config.autoReplies[key].mediaPath)) {
                        fs.unlinkSync(config.autoReplies[key].mediaPath);
                    }
                }
                delete config.autoReplies[key];
            }
        }

        config.autoReplies[trigger] = {
            type: responseType,
            text: responseText,
            mediaPath: responseMediaPath,
            mentions: mentions
        };

        saveGroupConfig(chat, config);

        const displayKey = trigger.startsWith("sticker:") ? "[Stiker]" : trigger;
        const displayRes = responseType === "sticker" ? "[Balasan Stiker]" : responseText;
        await message.reply(`✅ Berhasil menambahkan auto-reply!\n\n*Trigger:* ${displayKey}\n*Balasan:* ${displayRes}`);
    }
};
