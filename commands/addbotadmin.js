import { jidNormalizedUser } from "baileys";
import { setBotAdmin, resolveUserId, isBotAdmin } from "../lib/database.js";
import setting from "../setting.js";

export default {
    name: "addbotadmin",
    aliases: ["promote-bot"],
    category: "system",
    description: "Mengangkat seseorang menjadi Bot Admin (System Owner Only)",
    usage: "!addbotadmin @user",
    ownerOnly: true, // HANYA hardcoded owner yang bisa eksekusi

    async handler({ message, sock, args, sender, prefix }) {
        try {
            let target = null;
            if (message.mentionedJid && message.mentionedJid.length > 0) {
                target = message.mentionedJid[0];
            } else if (message.quoted) {
                target = message.quoted.sender || message.quoted.participant;
            } else if (args[0]) {
                const num = args[0].replace(/[^0-9]/g, "");
                if (num) target = num + "@s.whatsapp.net";
            }

            if (!target) {
                return message.reply(`Tag, reply, atau masukkan nomor user yang ingin diangkat menjadi Bot Admin.\nContoh: \`${prefix}addbotadmin @user\``);
            }

            // Resolve LID → PN agar bot admin tersimpan dengan key PN yang konsisten
            const normalizedTarget = resolveUserId(jidNormalizedUser(target));
            const targetBaseId = normalizedTarget.split("@")[0];

            // Prevent adding bot as BotAdmin (nonsensical)
            const botBaseId = jidNormalizedUser(sock.user.id).split(":")[0].split("@")[0];
            if (targetBaseId === botBaseId) {
                return message.reply("❌ Bot tidak bisa dijadikan Bot Admin.");
            }

            // Owner already has all BotAdmin privileges automatically
            const normalizeNum = (n) => n.startsWith("0") ? "62" + n.slice(1) : n;
            if (setting.owner.some(num => normalizeNum(num) === targetBaseId)) {
                return sock.sendMessage(
                    message.chat,
                    {
                        text: `⚠️ @${targetBaseId} adalah Owner bot dan sudah memiliki semua privilege Bot Admin secara otomatis.`,
                        mentions: [normalizedTarget],
                    },
                    { quoted: message }
                );
            }

            // Check if target is already a BotAdmin
            if (isBotAdmin(normalizedTarget)) {
                return sock.sendMessage(
                    message.chat,
                    {
                        text: `⚠️ @${targetBaseId} sudah menjadi Bot Admin.`,
                        mentions: [normalizedTarget],
                    },
                    { quoted: message }
                );
            }

            setBotAdmin(normalizedTarget, true);

            return sock.sendMessage(
                message.chat,
                {
                    text: `✅ @${targetBaseId} telah diangkat menjadi *Bot Admin*.\nMereka sekarang memiliki akses ke command moderasi bot (seperti ban, broadcast, dll).`,
                    mentions: [normalizedTarget],
                },
                { quoted: message }
            );
        } catch (error) {
            console.error("[ADDBOTADMIN CMD]", error);
            message.reply("❌ Terjadi kesalahan saat mengangkat Bot Admin.");
        }
    }
};
