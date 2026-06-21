import setting from "../setting.js";

export default {
    name: "owner",
    aliases: ["owners", "creator", "developer"],
    category: "utility",
    description: "Menampilkan informasi kontak owner/pembuat bot",
    usage: "!owner",
    async handler({ message, sock, ownerNumbers }) {
        let text = `✨ ━━━ *INFORMASI OWNER* ━━━ ✨\n\n`;
        text += `Kontak pembuat/pemilik dari *${setting.name}*.\nJika kamu menemukan bug, memiliki saran fitur baru, atau sekadar ingin bertanya, jangan ragu untuk menghubungi nomor di bawah ini!\n\n`;
        text += `🎗️ *Daftar Kontak Owner:*\n`;

        setting.owner.forEach((num, index) => {
            text += `\n👤 *Owner ${index + 1}*\n`;
            text += ` ➭ WhatsApp: https://wa.me/${num}\n`;
            text += ` ➭ Mention: @${num}\n`;
        });

        text += `\n✨ ━━━━━━━━━━━━━━━━━ ✨`;

        const imageUrl = "https://cdn.donmai.us/sample/3a/78/__hatsune_miku_mii_and_mikudayo_vocaloid_and_2_more_drawn_by_yunkkker__sample-3a782c2a60fa7c871f6edad47fd88dc1.jpg"; // Ganti URL ini dengan link gambar Anda

        // Kirim gambar beserta teks dan mention
        await sock.sendMessage(
            message.chat,
            {
                image: { url: imageUrl },
                caption: text,
                mentions: ownerNumbers,
            },
            { quoted: message }
        );
    }
};
