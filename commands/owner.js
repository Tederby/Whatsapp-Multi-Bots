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
