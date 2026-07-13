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

            // Decode HTML entities
            let text = kataDasar.d;
            text = text.replace(/&#183;/g, '');
            text = text.replace(/&#8220;/g, '"');
            text = text.replace(/&#8221;/g, '"');
            text = text.replace(/&quot;/g, '"');
            text = text.replace(/&lt;/g, '<');
            text = text.replace(/&gt;/g, '>');
            text = text.replace(/&amp;/g, '&');
            
            // Break definitions onto newlines
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/<sup>(.*?)<\/sup>/gi, '');
            
            // Format bold elements 
            text = text.replace(/<b>\s*(\d+)\s*<\/b>/g, '\n$1. '); // Numbers to numbered lists
            text = text.replace(/<b>(.*?)<\/b>/g, '*$1*'); // Bold
            
            // Format italic
            text = text.replace(/<em>(.*?)<\/em>/g, '_$1_');
            
            // Remove remaining tags
            text = text.replace(/<[^>]+>/g, '');
            
            // Construct structured layout
            let lines = text.split('\n');
            let formattedLines = [];
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (!line) continue;
                
                if (line.match(/^\d+\.\s/)) {
                    // Numbered list item
                    formattedLines.push(line);
                } else if (line.startsWith('*')) {
                    // Main or sub-entry (e.g. "*suam* _a_ hangat: ...")
                    let match = line.match(/^((?:\*[^*]+\*\s*(?:_[^_]+_\s*|,?\s*)*)+)(.*)$/);
                    if (match && match[2].trim()) {
                        formattedLines.push(match[1].trim());
                        if (match[2].trim()) {
                            formattedLines.push("> " + match[2].trim());
                        }
                    } else {
                        formattedLines.push(line);
                    }
                } else {
                    formattedLines.push("> " + line);
                }
            }
            
            text = formattedLines.join('\n');

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
