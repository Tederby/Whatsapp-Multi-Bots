export default {
    name: "say",
    aliases: [],
    category: "tools",
    description: "Echo text back to the sender",
    usage: "!say <text> atau reply pesan",
    async handler({ message, rawArgs, sock }) {
        let outText = rawArgs;
        let mentions = message.mentionedJid || [];

        // Jika tidak ada argumen tapi me-reply pesan, ambil teks dari pesan yang di-reply
        if (!outText && message.quoted && message.quoted.text) {
            outText = message.quoted.text;
            mentions = message.quoted.mentionedJid || [];
        }

        if (!outText) return message.reply("Masukkan teks atau reply pesan teks yang ingin dikirim ulang!");
        
        // Mencegah loop eksekusi jika user iseng memasukkan command bot (misal: !say !menu)
        // Dengan menyisipkan karakter tidak terlihat (Zero-Width Space) di awal
        const prefixes = ["!", ".", "#", "/", "-", "$"];
        if (prefixes.includes(outText[0])) {
            outText = "\u200B" + outText;
        }

        // Parsing manual tag angka (jika user mengetik @628123456789 manual tanpa UI WhatsApp)
        const manualMentions = [...outText.matchAll(/@(\d{10,16})/g)].map(v => v[1] + '@s.whatsapp.net');
        if (manualMentions.length > 0) {
            mentions = [...new Set([...mentions, ...manualMentions])];
        }

        // Cari URL di dalam teks
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = outText.match(urlRegex);
        
        const sendOptions = {
            text: outText,
            mentions: mentions
        };

        if (match && match.length > 0) {
            // Jika ada link, gunakan matchedText agar Baileys men-generate preview
            sendOptions.matchedText = match[0];
        }

        await sock.sendMessage(message.chat, sendOptions, { quoted: message });
    }
};
