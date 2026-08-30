import axios from "axios";

// ── In-Memory Cache for Recent Posts (TTL: 60s) ────────────────────────────
const recentPostsCache = new Map();
const RECENT_CACHE_TTL = 60_000; // 60 detik

/**
 * Format relative time in Indonesian
 * @param {string|number|Date} dateInput 
 * @returns {string}
 */
export const formatTimeAgo = (dateInput) => {
    if (!dateInput) return "Baru saja";
    const date = new Date(dateInput);
    const now = new Date();
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffInSeconds < 60) {
        return `${diffInSeconds} detik yang lalu`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} menit yang lalu`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} jam yang lalu`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
        return `${diffInDays} hari yang lalu`;
    }
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} bulan yang lalu`;
};

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

    const response = await axios.get(`https://danbooru.donmai.us/posts/${postId}.json`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
            'Referer': 'https://danbooru.donmai.us/',
        },
        timeout: 15000,
    });

    if (!response.data || Object.keys(response.data).length === 0) {
        throw new Error("Post tidak ditemukan atau API error.");
    }

    return response.data;
};

/**
 * Validate Danbooru tags, resolving aliases automatically
 * @param {string[]} tagsArray 
 * @returns {Promise<{ validTags: string[], invalidTags: string[], corrections: object }>} 
 */
export const validateDanbooruTags = async (tagsArray) => {
    const validTags = [];
    const invalidTags = [];
    const corrections = {};

    const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
        'Referer': 'https://danbooru.donmai.us/',
    };

    for (const tag of tagsArray) {
        try {
            // Check alias first
            const aliasRes = await axios.get(
                `https://danbooru.donmai.us/tag_aliases.json?search[antecedent_name]=${encodeURIComponent(tag)}`,
                { headers, timeout: 10000 }
            );
            let tagToCheck = tag;

            if (aliasRes.data && aliasRes.data.length > 0 && aliasRes.data[0].status === 'active') {
                const canonicalName = aliasRes.data[0].consequent_name;
                corrections[canonicalName] = tag; // Store what it was corrected from
                tagToCheck = canonicalName;
            }

            // Check if tag actually exists and has posts
            const response = await axios.get(
                `https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(tagToCheck)}`,
                { headers, timeout: 10000 }
            );
            if (response.data && response.data.length > 0 && response.data[0].post_count > 0) {
                validTags.push(response.data[0].name);
            } else {
                invalidTags.push(tag);
            }
        } catch (err) {
            invalidTags.push(tag);
        }
    }
    return { validTags, invalidTags, corrections };
};

/**
 * Get tag suggestions for misspelled tags
 * @param {string} query 
 * @returns {Promise<string[]>}
 */
export const getFuzzyTagSuggestions = async (query) => {
    try {
        const response = await axios.get(
            `https://danbooru.donmai.us/autocomplete.json?search[query]=${encodeURIComponent(query)}&search[type]=tag_query&limit=3`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
                    'Referer': 'https://danbooru.donmai.us/',
                },
                timeout: 10000,
            }
        );
        if (response.data && Array.isArray(response.data)) {
            return response.data.map(item => item.value); // Autocomplete returns { type, label, value, post_count }
        }
    } catch (err) {
        // Ignore
    }
    return [];
};

/**
 * Fetch a random safe post from top 20 newest by tags
 * @param {string[]} tagsArray 
 * @returns {Promise<object>}
 */
export const fetchDanbooruByTags = async (tagsArray) => {
    if (tagsArray.length === 0) throw new Error("Tidak ada tag yang valid.");
    const tagsString = tagsArray.map(encodeURIComponent).join('+');
    const response = await axios.get(`https://danbooru.donmai.us/posts.json?tags=${tagsString}&limit=20`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
            'Referer': 'https://danbooru.donmai.us/',
        },
        timeout: 15000,
    });
    
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
 * Fetch raw recent posts with caching
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=30]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<Array<object>>}
 */
export const fetchRecentDanbooruPosts = async ({ page = 1, limit = 30, forceRefresh = false } = {}) => {
    const cacheKey = `recent_page_${page}_limit_${limit}`;
    const now = Date.now();

    if (!forceRefresh && recentPostsCache.has(cacheKey)) {
        const cached = recentPostsCache.get(cacheKey);
        if (now - cached.timestamp < RECENT_CACHE_TTL) {
            return cached.data;
        }
    }

    const response = await axios.get(`https://danbooru.donmai.us/posts.json?limit=${limit}&page=${page}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
            'Referer': 'https://danbooru.donmai.us/',
        },
        timeout: 15000,
    });

    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error("Gagal mengambil feed recent post dari Danbooru atau feed kosong.");
    }

    recentPostsCache.set(cacheKey, { data: response.data, timestamp: now });
    return response.data;
};

/**
 * Fetch a random or specific recent post with safe filtering
 * @param {object} options
 * @param {string} [options.ratingFilter=null] - 'safe' or 'g' for General only, 's' for Sensitive, 'q' for Questionable, null for all safe (!= 'e')
 * @param {number} [options.page=1]
 * @param {number} [options.specificIndex=null] - 1-indexed specific item from recent list
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<{ post: object, totalSafe: number, index: number, page: number, allSafePosts: Array<object> }>}
 */
export const fetchRandomRecentDanbooru = async ({ ratingFilter = null, page = 1, specificIndex = null, forceRefresh = false } = {}) => {
    let currentPage = page;
    let attempts = 0;
    let safePosts = [];

    while (attempts < 3) {
        attempts++;
        const rawPosts = await fetchRecentDanbooruPosts({ page: currentPage, limit: 30, forceRefresh });

        // Filter out NSFW (e = explicit)
        let filtered = rawPosts.filter(p => p.rating !== 'e' && (p.file_url || p.large_file_url));

        if (ratingFilter === "safe" || ratingFilter === "g") {
            filtered = filtered.filter(p => p.rating === 'g');
        } else if (ratingFilter === "s") {
            filtered = filtered.filter(p => p.rating === 's');
        } else if (ratingFilter === "q") {
            filtered = filtered.filter(p => p.rating === 'q');
        }

        if (filtered.length > 0) {
            safePosts = filtered;
            break;
        }

        // If no safe posts on this page, advance to next page
        currentPage++;
    }

    if (safePosts.length === 0) {
        throw new Error("Tidak ditemukan post aman (SFW) pada feed recent saat ini. Coba lagi dalam beberapa saat.");
    }

    let selectedPost = null;
    let resolvedIndex = 1;

    if (specificIndex !== null && typeof specificIndex === "number") {
        const targetIdx = Math.max(1, Math.min(specificIndex, safePosts.length)) - 1;
        selectedPost = safePosts[targetIdx];
        resolvedIndex = targetIdx + 1;
    } else {
        const randIdx = Math.floor(Math.random() * safePosts.length);
        selectedPost = safePosts[randIdx];
        resolvedIndex = randIdx + 1;
    }

    return {
        post: selectedPost,
        totalSafe: safePosts.length,
        index: resolvedIndex,
        page: currentPage,
        allSafePosts: safePosts,
    };
};

/**
 * Download an image from Danbooru CDN as a buffer with proper headers.
 * Baileys' internal fetch has no User-Agent/Referer, which causes cdn.donmai.us
 * to reject the request. We download it ourselves and pass the buffer instead.
 * Falls back from file_url → large_file_url if the primary download fails.
 * @param {object} postData
 * @returns {Promise<Buffer|null>}
 */
export const downloadDanbooruImage = async (postData) => {
    const urls = [postData.file_url, postData.large_file_url].filter(Boolean);
    if (urls.length === 0) return null;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
        'Referer': 'https://danbooru.donmai.us/',
    };

    for (const url of urls) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers,
                timeout: 30000,
            });
            return Buffer.from(response.data);
        } catch (err) {
            // If this URL failed and we have another to try, continue
            console.error(`[Danbooru] Failed to download ${url}: ${err.message}`);
        }
    }

    return null;
};

/**
 * Send the formatted Danbooru message
 * @param {object} params
 * @returns {Promise<object|null>} Sent message object from Baileys
 */
export const sendDanbooruMessage = async ({
    postData,
    sock,
    message,
    isAutoDetect = false,
    isGacha = false,
    isRecent = false,
    recentInfo = null,
    usedTags = [],
    corrections = {}
}) => {
    const postId = postData.id;
    const rating = postData.rating; // 'g', 's', 'q', 'e'

    // Download image buffer (handles CDN headers + fallback)
    const imageBuffer = await downloadDanbooruImage(postData);

    if (!imageBuffer) {
        if (!isAutoDetect) await message.reply("❌ Gambar tidak ditemukan, gagal di-download, atau post ini berupa video/animasi.");
        return null;
    }

    // Explicit filter
    if (rating === 'e') {
        if (!isAutoDetect) {
            await message.reply(`❌ Gambar NSFW (Explicit) diblokir.\n\n🌐 *Post Link:* danbooru.donmai.us/posts/${postId}\n💡 *Tip:* Balas pesan ini dengan !tag untuk melihat daftar tags dari post ${postId}`);
        }
        return null;
    }

    const ratingMap = { 'g': 'General', 's': 'Sensitive', 'q': 'Questionable', 'e': 'Explicit' };
    const ratingText = ratingMap[rating] || 'Unknown';

    let headerTitle = isRecent ? "🆕 Danbooru Recent" : "🎨 Danbooru Art";
    let caption = `╭━━━〔 ${headerTitle} 〕━━━\n`;
    if (rating === 'q') caption += `┃ ⚠️ *WARNING:* Rating Questionable\n`;
    caption += `┃ 🆔 ID       : ${postId}\n`;
    caption += `┃ ⭐ Rating   : ${ratingText}\n`;
    caption += `┃ ©️ Copyright: ${postData.tag_string_copyright || 'Original'}\n`;
    caption += `┃ 👤 Artist   : ${postData.tag_string_artist || 'Unknown'}\n`;
    caption += `┃ 📄 Character: ${postData.tag_string_character || 'Original'}\n`;

    if (postData.created_at) {
        caption += `┃ 🕒 Uploaded : ${formatTimeAgo(postData.created_at)}\n`;
    }

    if (isRecent && recentInfo) {
        caption += `┃ 📌 Feed     : #${recentInfo.index} of ${recentInfo.totalSafe} (Page ${recentInfo.page || 1})\n`;
    }

    if (usedTags.length > 0) {
        const searchDisplay = usedTags.map(t => {
            if (corrections[t]) return `${t} (terkoreksi dari: ${corrections[t]})`;
            return t;
        }).join(', ');
        caption += `┃ 🔍 Search   : ${searchDisplay}\n`;
    }
    caption += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    caption += `╭───「 🔗 Links 」\n`;
    caption += `│ 🌐 Post: danbooru.donmai.us/posts/${postId}\n`;
    if (postData.source) caption += `│ 🔗 Src : ${postData.source}\n`;
    caption += `╰──────────────\n\n`;

    if (isRecent) {
        caption += `💡 *Tip:* Balas pesan ini dengan *"next"* atau *"lagi"* untuk roll art terbaru lainnya.`;
        caption += `\n💡 *Tip:* Ketik \`!dnew help\` untuk opsi filter lengkap.`;
        caption += `\n💡 *Tip:* Balas pesan ini dengan \`!tag\` untuk melihat daftar tags.`;
    } else {
        caption += `💡 *Tip:* Balas pesan ini dengan \`!tag\` untuk melihat semua tags.`;
        if (isGacha) {
            caption += `\n💡 *Tip:* Kamu juga bisa mencari spesifik dengan \`!d <ID/Tag>\` atau lihat art terbaru dengan \`!dnew\``;
        }
    }

    const sent = await sock.sendMessage(
        message.chat,
        {
            image: imageBuffer,
            caption: caption
        },
        { quoted: message }
    );

    return sent;
};

/**
 * Handle shared logic for processing Danbooru Request and sending the message
 * @param {object} params - { input, sock, message, isAutoDetect }
 */
export const handleDanbooruRequest = async ({ input, sock, message, isAutoDetect = false, isGacha = false }) => {
    try {
        const postData = await fetchDanbooruPost(input);
        return await sendDanbooruMessage({ postData, sock, message, isAutoDetect, isGacha });
    } catch (err) {
        if (!isAutoDetect) {
            await message.reply(`❌ Error: ${err.message}`);
        } else {
            console.error("Danbooru Auto-Detect Error:", err.message);
        }
        return null;
    }
};
