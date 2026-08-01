export default {
    name: "say",
    aliases: [],
    category: "tools",
    description: "Echo text back to the sender",
    usage: "!say <text> atau reply pesan",
    async handler({ message, rawArgs, sock, pushname }) {
        let outText = rawArgs;
        let mentions = message.mentionedJid || [];

        // Jika tidak ada argumen tapi me-reply pesan, ambil teks dari pesan yang di-reply
        if (!outText && message.quoted && message.quoted.text) {
            outText = message.quoted.text;
            mentions = message.quoted.mentionedJid || [];
        }

        if (!outText) return message.reply("Masukkan teks atau reply pesan teks yang ingin dikirim ulang!");

        // Format output sebagai quote dengan nama user
        const formattedText = `> ${outText}\n- ${pushname}`;


        // Ambil ID (tanpa domain) dari mentions bawaan (bisa berupa PN atau LID)
        const existingMentionIds = mentions.map(jid => jid.split('@')[0]);

        // Parsing manual tag angka (hanya jika user mengetik manual dan tidak ada di mentionedJid)
        const manualMentions = [...outText.matchAll(/@(\d{10,16})/g)]
            .map(v => v[1])
            .filter(num => !existingMentionIds.includes(num)) // Mencegah bentrok dengan LID mode
            .map(num => num + '@s.whatsapp.net');
            
        if (manualMentions.length > 0) {
            mentions = [...mentions, ...manualMentions];
        }

        // Cari URL di dalam teks
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = outText.match(urlRegex);
        
        const sendOptions = {
            text: formattedText,
            mentions: mentions
        };

        if (match && match.length > 0) {
            // Jika ada link, gunakan matchedText agar Baileys men-generate preview
            sendOptions.matchedText = match[0];
        }

        await sock.sendMessage(message.chat, sendOptions, { quoted: message });
    }
};
