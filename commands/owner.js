import setting from "../setting.js";
import { getAllBotAdmins, resolveUserId } from "../lib/database.js";
import { jidNormalizedUser } from "baileys";

export default {
    name: "owner",
    aliases: ["owners", "creator", "developer", "adminbot", "botadmin", "botadmins"],
    category: "general",
    description: "Menampilkan informasi kontak owner dan admin bot",
    usage: "!owner",
    async handler({ message, sock, ownerNumbers }) {
        let text = `╭━━━〔 👑 Owner Info 〕━━━\n`;
        text += `┃ Kontak pembuat/pemilik bot ini.\n`;
        text += `┃ Hubungi untuk bug/saran fitur!\n`;
        text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

        setting.owner.forEach((num, index) => {
            text += `╭───「 👤 Owner ${setting.owner.length > 1 ? index + 1 : ""} 」\n`;
            text += `│ ⋄ WhatsApp : wa.me/${num}\n`;
            text += `│ ⋄ Mention  : @${num}\n`;
            text += `╰──────────────\n\n`;
        });

        // Clean up "Owner  " to "Owner " if there's only 1 owner
        text = text.replace(/Owner  /g, "Owner ");

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
            adminText += `╭━━━〔 🛡️ Bot Admins 〕━━━\n`;
            adminText += `┃ Admin yang bertugas moderasi bot.\n`;
            
            let adminIndex = 1;
            uniqueAdmins.forEach((jid) => {
                const num = jid.split("@")[0];
                adminMentions.push(jid);
                
                adminText += `┃ ⋄ Admin ${adminIndex}  : @${num}\n`;
                adminIndex++;
            });
            adminText += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        text += adminText;
        text = text.trim();
        
        // Remove duplicates between owner and admins just in case
        const allMentions = [...new Set([...ownerNumbers, ...adminMentions])];

        const imageUrl = "https://cdn.donmai.us/sample/3a/78/__hatsune_miku_mii_and_mikudayo_vocaloid_and_2_more_drawn_by_yunkkker__sample-3a782c2a60fa7c871f6edad47fd88dc1.jpg"; // Ganti URL ini dengan link gambar Anda

        // Kirim gambar beserta teks dan mention, fallback ke text jika gagal
        try {
            const axios = (await import("axios")).default;
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
            console.error("Owner Image Error:", err.message);
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
