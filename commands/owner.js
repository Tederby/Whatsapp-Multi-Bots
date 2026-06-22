import setting from "../setting.js";

export default {
    name: "owner",
    aliases: ["owners", "creator", "developer"],
    category: "utility",
    description: "Menampilkan informasi kontak owner/pembuat bot",
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

        text = text.trim();

        const imageUrl = "https://i.pximg.net/img-master/img/2025/10/31/09/46/39/136901879_p0_master1200.jpg"; // Ganti URL ini dengan link gambar Anda

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
