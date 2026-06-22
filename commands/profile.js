import { jidNormalizedUser } from "baileys";
import setting from "../setting.js";

export default {
    name: "profile",
    aliases: ["pfp", "profil"],
    category: "general",
    description: "Melihat profil, status admin, dan owner pengguna.",
    usage: "!profile [@user/reply]",

    async handler({ message, sock, sender, pushname, isGroup, groupMetadata, ownerNumbers }) {
        try {
            let target = null;
            let targetName = "Tidak diketahui";

            // 1. Penentuan Target
            if (message.mentionedJid && message.mentionedJid.length > 0) {
                target = message.mentionedJid[0];
            } else if (message.quoted) {
                target = message.quoted.sender || message.quoted.participant;
            } else {
                target = sender;
                targetName = pushname || "Tidak diketahui"; // Nama asli hanya didapat jika command untuk diri sendiri
            }

            if (!target) {
                return message.reply("Gagal mendapatkan target pengguna. Pastikan tag atau reply pesan dengan benar.");
            }

            const normalizedTarget = jidNormalizedUser(target);
            const targetBaseId = target.split(':')[0].split('@')[0];
            
            // Nama fallback jika target bukan pengirim pesan
            if (target !== sender) {
                targetName = `User`;
            }

            // 2. Cek Status Owner
            const botBaseId = sock.user.id.split(':')[0].split('@')[0];
            const isTargetOwner = 
                setting.owner.includes(targetBaseId) || 
                ownerNumbers.includes(normalizedTarget) || 
                targetBaseId === botBaseId;

            // 3. Cek Status Admin (jika dieksekusi di grup)
            let isTargetAdmin = false;
            if (isGroup && groupMetadata && groupMetadata.participants) {
                isTargetAdmin = groupMetadata.participants.some(p => {
                    const participantBaseId = p.id.split(':')[0].split('@')[0];
                    return participantBaseId === targetBaseId && p.admin;
                });
            }

            // 4. URL Gambar Profil Placeholder (Bisa diganti link gambar bot/logo lain nantinya)
            const placeholderImageUrl = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

            // 5. Susun Tampilan Profil
            let caption = `*PROFILE INFO*\n\n`;
            caption += `👤 *Nama:* ${targetName}\n`;
            caption += `🏷️ *User:* @${targetBaseId}\n`;
            caption += `👑 *Owner:* ${isTargetOwner ? "Ya" : "Tidak"}\n`;
            
            if (isGroup) {
                caption += `🛡️ *Admin Grup:* ${isTargetAdmin ? "Ya" : "Tidak"}\n`;
            }

            // Note: Kamu bisa menambahkan info lain di bawah sini nanti.

            // 6. Kirim Pesan dengan Mention
            await sock.sendMessage(
                message.chat,
                { 
                    image: { url: placeholderImageUrl }, 
                    caption: caption,
                    mentions: [normalizedTarget] 
                },
                { quoted: message }
            );

        } catch (error) {
            console.error('[PROFILE COMMAND ERROR]:', error);
            message.reply("Terjadi kesalahan sistem saat memproses profil.");
        }
    }
};
