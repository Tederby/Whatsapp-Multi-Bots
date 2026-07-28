import { fetchDanbooruPost } from "../lib/danbooru.js";
import axios from "axios";

export default {
    name: "tag",
    aliases: ["tags"],
    category: "anime",
    description: "Ambil list tag dari gambar Danbooru yang di-reply ATAU cari dictionary tag Danbooru",
    usage: "!tag [query] ATAU !tag (reply to a Danbooru post)",
    async handler({ message, sock, args }) {
        args = args.map(arg => arg.toLowerCase());
        
        if (args.length > 0) {
            // Dictionary mode
            const query = args.join("_");
            try {
                const sentMsg = await message.reply(`🔍 Mencari kamus tag untuk '${query}'...`);
                const response = await axios.get(`https://danbooru.donmai.us/tags.json?search[name_matches]=*${encodeURIComponent(query)}*&search[order]=count&limit=10`);
                
                if (!response.data || response.data.length === 0) {
                    await sock.sendMessage(message.chat, { text: `❌ Tidak ditemukan tag yang cocok dengan '${query}'.`, edit: sentMsg.key });
                    return;
                }

                let resultMsg = `🏷️ *Kamus Tag Danbooru: '${query}'*\n\n`;
                response.data.forEach((tag, index) => {
                    const postCount = tag.post_count.toLocaleString('id-ID');
                    resultMsg += `${index + 1}. \`${tag.name}\` (${postCount} post)\n`;
                });
                resultMsg += `\n💡 Gunakan \`!d <tag>\` untuk mencari gambar.`;

                await sock.sendMessage(message.chat, { text: resultMsg, edit: sentMsg.key });
            } catch (err) {
                await message.reply(`❌ Error mencari tag: ${err.message}`);
            }
            return;
        }

        if (!message.quoted) {
            await message.reply("❌ Kamu harus me-reply gambar Danbooru atau ketik `!tag <query>` untuk mencari tag.");
            return;
        }

        const quotedText = message.quoted.text || message.quoted.caption || "";
        
        // Cari ID post di teks (terutama dari URL Post Link, atau format lama)
        const idMatch = quotedText.match(/danbooru\.donmai\.us\/posts\/(\d+)/i) || quotedText.match(/post(?:[ :*]+)?(\d+)/i);
        
        if (!idMatch) {
            await message.reply("❌ Tidak dapat menemukan ID Danbooru di pesan yang di-reply.");
            return;
        }

        const postId = idMatch[1];
        
        try {
            await message.reply(`⏳ Mengambil tags untuk post ${postId}...`);
            const postData = await fetchDanbooruPost(postId);
            
            const tags = [
                `🏷️ *Tags untuk Post ${postId}*`,
                "",
                `👤 *Character:* ${postData.tag_string_character || 'N/A'}`,
                `©️ *Copyright:* ${postData.tag_string_copyright || 'N/A'}`,
                `🎨 *Artist:* ${postData.tag_string_artist || 'N/A'}`,
                `📝 *General:* ${postData.tag_string_general || 'N/A'}`
            ].join("\n");
            
            await message.reply(tags);
        } catch (err) {
            await message.reply(`❌ Error mengambil tag: ${err.message}`);
        }
    }
};
