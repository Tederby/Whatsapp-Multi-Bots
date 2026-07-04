import setting from "../setting.js";
import { getAllBotAdmins } from "../lib/database.js";
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
            text += `╭───「 👤 Owner ${index + 1} 」\n`;
            text += `│ ⋄ WhatsApp : wa.me/${num}\n`;
            text += `│ ⋄ Mention  : @${num}\n`;
            text += `╰──────────────\n\n`;
        });

        const botAdmins = getAllBotAdmins();
        const adminMentions = [];

        if (botAdmins.length > 0) {
            text += `╭━━━〔 🛡️ Bot Admins 〕━━━\n`;
            text += `┃ Admin yang bertugas moderasi bot.\n`;
            text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            botAdmins.forEach((jid, index) => {
                const num = jid.split("@")[0];
                const normalized = jidNormalizedUser(jid);
                if (!adminMentions.includes(normalized)) {
                    adminMentions.push(normalized);
                }
                
                text += `╭───「 🛡️ Admin ${index + 1} 」\n`;
                text += `│ ⋄ WhatsApp : wa.me/${num}\n`;
                text += `│ ⋄ Mention  : @${num}\n`;
                text += `╰──────────────\n\n`;
            });
        }

        text = text.trim();
        
        // Remove duplicates between owner and admins just in case
        const allMentions = [...new Set([...ownerNumbers, ...adminMentions])];

        const imageUrl = "https://cdn.donmai.us/sample/3a/78/__hatsune_miku_mii_and_mikudayo_vocaloid_and_2_more_drawn_by_yunkkker__sample-3a782c2a60fa7c871f6edad47fd88dc1.jpg"; // Ganti URL ini dengan link gambar Anda

        // Kirim gambar beserta teks dan mention
        await sock.sendMessage(
            message.chat,
            {
                image: { url: imageUrl },
                caption: text,
                mentions: allMentions,
            },
            { quoted: message }
        );
    }
};
