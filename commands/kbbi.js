import axios from "axios";

export default {
    name: "kbbi",
    aliases: ["kamus", "arti"],
    category: "search",
    description: "Mencari arti kata dari Kamus Besar Bahasa Indonesia (KBBI)",
    usage: "!kbbi <kata>",
    async handler({ message, args, sock }) {
        if (args.length === 0) {
            await message.reply("❌ Berikan kata yang ingin dicari di KBBI.\nContoh: `!kbbi makan`");
            return;
        }

        const query = args.join(" ").toLowerCase();

        try {
            const response = await axios.get(`https://kbbi.web.id/${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Extract the embedded JSON data
            const match = response.data.match(/<script type="application\/json" id="jsdata">([\s\S]*?)<\/script>/);
            
            if (!match) {
                await message.reply(`❌ Kata *${query}* tidak ditemukan di KBBI.`);
                return;
            }

            const data = JSON.parse(match[1]);
            const kataDasar = data.find(item => item.x === 1);

            if (!kataDasar) {
                await message.reply(`❌ Kata *${query}* tidak ditemukan di KBBI.`);
                return;
            }

            // Formatting the HTML definition text to WhatsApp Markdown
            let text = kataDasar.d;
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/&#183;/g, ''); // Remove syllable separators
            text = text.replace(/<sup>(.*?)<\/sup>/gi, ''); // Remove superscript
            text = text.replace(/<b>(.*?)<\/b>/gi, '*$1*'); // Bold
            text = text.replace(/<em>(.*?)<\/em>/gi, '_$1_'); // Italic
            text = text.replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
            
            // Further cleanup to make it neat
            text = text.replace(/\n\*(.*?)\*/g, '\n\n*$1*'); // Add double newline before bold word that starts a new section
            text = text.replace(/ \*(\d+)\* /g, '\n  *$1.* '); // Indent numbered list and add dot
            text = text.replace(/\n{3,}/g, '\n\n'); // Normalize multiple newlines
            text = text.trim();

            let replyText = `╭━━━〔 📖 KBBI SEARCH 〕━━━\n`;
            replyText += `┃ 🔍 Kata : ${kataDasar.w.replace(/<[^>]+>/g, '')}\n`;
            replyText += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            replyText += text;

            await message.reply(replyText);

        } catch (err) {
            let errorMsg = err.message || "Unknown error";
            if (err.response) {
                // If the web returns 404, usually it means word not found
                if (err.response.status === 404) {
                    await message.reply(`❌ Kata *${query}* tidak ditemukan di KBBI.`);
                    return;
                }
                errorMsg = `HTTP ${err.response.status}: ${err.response.statusText}`;
            }

            console.error("KBBI Command Error:", err);
            await message.reply(`❌ Terjadi kesalahan saat mencari kata di KBBI: ${errorMsg}`);
        }
    }
};
