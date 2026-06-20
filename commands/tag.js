import { fetchDanbooruPost } from "../lib/danbooru.js";

export default {
    name: "tag",
    aliases: ["tags"],
    description: "Ambil list tag dari gambar Danbooru yang di-reply",
    async handler({ message, sock }) {
        if (!message.quoted) {
            await message.reply("❌ Kamu harus me-reply gambar Danbooru atau pesan peringatan dari bot untuk menggunakan command ini.");
            return;
        }

        const quotedText = message.quoted.text || message.quoted.caption || "";
        
        // Cari ID post di teks menggunakan regex
        const idMatch = quotedText.match(/post(?:[ :*]+)?(\d+)/i);
        
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
