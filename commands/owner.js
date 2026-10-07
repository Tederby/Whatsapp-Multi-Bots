/**
 * Owner — Display bot owner and bot administrators contact info.
 *
 * @module commands/owner
 */

import axios from "axios";
import { jidNormalizedUser } from "baileys";
import setting from "../setting.js";
import { getAllBotAdmins, resolveUserId } from "../lib/database.js";

export default {
    name: "owner",
    aliases: ["owners", "creator", "developer", "adminbot", "botadmin", "botadmins"],
    category: "general",
    description: "Menampilkan informasi kontak owner dan admin bot",
    usage: "!owner",
    async handler({ message, sock, ownerNumbers }) {
        let text = `👑 *OWNER INFO*\n`;
        text += `────────────────────────\n`;
        text += `Kontak pembuat/pemilik bot ini.\n`;
        text += `Hubungi untuk bug/saran fitur!\n\n`;

        setting.owner.forEach((num, index) => {
            const label = setting.owner.length > 1 ? `Owner ${index + 1}` : "Owner";
            text += `*👤 ${label}*\n`;
            text += `⋄ WhatsApp : wa.me/${num}\n`;
            text += `⋄ Mention : @${num}\n\n`;
        });

        const rawAdmins = getAllBotAdmins();
        const adminMentions = [];
        let adminText = "";

        // Deduplicate and normalize admins (WhatsApp can have both plain numbers and @s.whatsapp.net, and @lid)
        const uniqueAdmins = new Set();
        rawAdmins.forEach(jid => {
            // resolveUserId: convert LID→PN if mapping exists
            let normalized = resolveUserId(jidNormalizedUser(jid));
            if (!normalized) normalized = jid;

            if (!normalized.includes("@")) {
                normalized += "@s.whatsapp.net";
            }
            uniqueAdmins.add(normalized);
        });

        if (uniqueAdmins.size > 0) {
            adminText += `*🛡️ Bot Admins*\n`;
            adminText += `Admin yang bertugas moderasi bot.\n\n`;

            let adminIndex = 1;
            uniqueAdmins.forEach((jid) => {
                const num = jid.split("@")[0];
                adminMentions.push(jid);

                adminText += `⋄ Admin ${adminIndex} : @${num}\n`;
                adminIndex++;
            });
            adminText += `\n`;
        }

        text += adminText;
        text += `────────────────────────`;
        text = text.trim();

        // Remove duplicates between owner and admins just in case
        const allMentions = [...new Set([...ownerNumbers, ...adminMentions])];

        const imageUrl = setting.branding?.ownerImage;

        // Kirim gambar beserta teks dan mention, fallback ke text jika gagal
        try {
            const response = await axios.get(imageUrl, {
                responseType: "arraybuffer",
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; WhatsAppBot/1.0)",
                    "Referer": "https://danbooru.donmai.us/"
                },
                timeout: 30000
            });
            const imageBuffer = Buffer.from(response.data);

            await sock.sendMessage(
                message.chat,
                {
                    image: imageBuffer,
                    caption: text,
                    mentions: allMentions,
                },
                { quoted: message }
            );
        } catch (err) {
            console.error("[OWNER]", err.message);
            // Image URL mungkin down atau diblokir — fallback ke text-only
            await sock.sendMessage(
                message.chat,
                {
                    text: text,
                    mentions: allMentions,
                },
                { quoted: message }
            );
        }
    }
};
