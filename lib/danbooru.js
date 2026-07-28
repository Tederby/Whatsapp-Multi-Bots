import axios from "axios";

/**
 * Fetch post data from Danbooru JSON API
 * @param {string|number} input Post ID or URL
 * @returns {Promise<object>}
 */
export const fetchDanbooruPost = async (input) => {
    let postId = String(input).trim();

    // Extract ID if input is a URL
    const regex = /(?:https?:\/\/)?(?:www\.)?danbooru\.donmai\.us\/posts\/(\d+)(?:\?.*)?/i;
    const match = postId.match(regex);
    if (match) {
        postId = match[1];
    }

    if (!/^\d+$/.test(postId)) {
        throw new Error("Invalid Danbooru Post ID or URL.");
    }

    const response = await axios.get(`https://danbooru.donmai.us/posts/${postId}.json`);

    if (!response.data || Object.keys(response.data).length === 0) {
        throw new Error("Post tidak ditemukan atau API error.");
    }

    return response.data;
};

/**
 * Validate Danbooru tags
 * @param {string[]} tagsArray 
 * @returns {Promise<string[]>} Valid tags
 */
export const validateDanbooruTags = async (tagsArray) => {
    const validTags = [];
    for (const tag of tagsArray) {
        try {
            const response = await axios.get(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(tag)}`);
            if (response.data && response.data.length > 0 && response.data[0].post_count > 0) {
                validTags.push(response.data[0].name);
            }
        } catch (err) {
            // Ignore error for individual tag, consider it invalid
        }
    }
    return validTags;
};

/**
 * Fetch a random safe post from top 20 newest by tags
 * @param {string[]} tagsArray 
 * @returns {Promise<object>}
 */
export const fetchDanbooruByTags = async (tagsArray) => {
    if (tagsArray.length === 0) throw new Error("Tidak ada tag yang valid.");
    const tagsString = tagsArray.map(encodeURIComponent).join('+');
    const response = await axios.get(`https://danbooru.donmai.us/posts.json?tags=${tagsString}&limit=20`);
    
    if (!response.data || response.data.length === 0) {
        throw new Error("Tidak ditemukan post dengan kombinasi tag tersebut.");
    }

    const safePosts = response.data.filter(post => post.rating !== 'e');
    if (safePosts.length === 0) {
        throw new Error("EXPLICIT_ONLY");
    }

    // Pick random from safe posts
    const randomPost = safePosts[Math.floor(Math.random() * safePosts.length)];
    return randomPost;
};

/**
 * Send the formatted Danbooru message
 */
export const sendDanbooruMessage = async ({ postData, sock, message, isAutoDetect = false, isGacha = false, usedTags = [] }) => {
    // Extract basic data
    const imageUrl = postData.file_url || postData.large_file_url;
    const postId = postData.id;
    const rating = postData.rating; // 'g', 's', 'q', 'e'

    if (!imageUrl) {
        if (!isAutoDetect) await message.reply("❌ Gambar tidak ditemukan atau post ini berupa video/animasi.");
        return;
    }

    // Explicit filter
    if (rating === 'e') {
        if (!isAutoDetect) {
            await message.reply(`❌ Gambar NSFW (Explicit) diblokir.\n\n🌐 *Post Link:* danbooru.donmai.us/posts/${postId}\n💡 *Tip:* Balas pesan ini dengan !tag untuk melihat daftar tags dari post ${postId}`);
        }
        return;
    }

    const ratingMap = { 'g': 'General', 's': 'Sensitive', 'q': 'Questionable', 'e': 'Explicit' };
    const ratingText = ratingMap[rating] || 'Unknown';

    let caption = `╭━━━〔 🎨 Danbooru Art 〕━━━\n`;
    if (rating === 'q') caption += `┃ ⚠️ *WARNING:* Rating Questionable\n`;
    caption += `┃ 🆔 ID       : ${postId}\n`;
    caption += `┃ ⭐ Rating   : ${ratingText}\n`;
    caption += `┃ ©️ Copyright: ${postData.tag_string_copyright || 'Original'}\n`;
    caption += `┃ 👤 Artist   : ${postData.tag_string_artist || 'Unknown'}\n`;
    caption += `┃ 📄 Character: ${postData.tag_string_character || 'Original'}\n`;
    if (usedTags.length > 0) {
        caption += `┃ 🔍 Search   : ${usedTags.join(', ')}\n`;
    }
    caption += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    caption += `╭───「 🔗 Links 」\n`;
    caption += `│ 🌐 Post: danbooru.donmai.us/posts/${postId}\n`;
    if (postData.source) caption += `│ 🔗 Src : ${postData.source}\n`;
    caption += `╰──────────────\n\n`;

    caption += `💡 *Tip:* Balas pesan ini dengan \`!tag\` untuk melihat semua tags.`;
    if (isGacha) {
        caption += `\n💡 *Tip:* Kamu juga bisa mencari spesifik menggunakan \`!d <ID/Tag>\``;
    }

    await sock.sendMessage(
        message.chat,
        {
            image: { url: imageUrl },
            caption: caption
        },
        { quoted: message }
    );
};

/**
 * Handle shared logic for processing Danbooru Request and sending the message
 * @param {object} params - { input, sock, message, isAutoDetect }
 */
export const handleDanbooruRequest = async ({ input, sock, message, isAutoDetect = false, isGacha = false }) => {
    try {
        const postData = await fetchDanbooruPost(input);
        await sendDanbooruMessage({ postData, sock, message, isAutoDetect, isGacha });
    } catch (err) {
        if (!isAutoDetect) {
            await message.reply(`❌ Error: ${err.message}`);
        } else {
            console.error("Danbooru Auto-Detect Error:", err.message);
        }
    }
};

