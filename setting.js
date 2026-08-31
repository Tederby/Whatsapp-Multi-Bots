import 'dotenv/config';

const setting = {
    // ── Bot Instance Identity ───────────────────────────────────────────
    botId: process.env.BOT_ID || "default",
    name: process.env.BOT_NAME || "Tederby18",
    owner: (process.env.OWNER_NUMBERS || process.env.OWNER_NUMBER || "6287825136146").split(",").map(v => v.trim()),
    prefixes: (process.env.PREFIXES || "!.#/-").split(""),
    pairingNumber: process.env.PAIRING_NUMBER || "",

    // ── yt-dlp ──────────────────────────────────────────────────────────
    ytdlp: {
        tempDir: `./temp/${process.env.BOT_ID || "default"}`,
        maxFileSize: 64 * 1024 * 1024,           // 64MB (WhatsApp video limit)
        maxFileSizeDoc: 2 * 1024 * 1024 * 1024,   // 2GB (WhatsApp doc limit)
        stateExpiry: 15 * 60 * 1000,              // 15 menit
        fileExpiry: 30 * 60 * 1000,               // 30 menit
        cleanupInterval: 10 * 60 * 1000,          // Scan setiap 10 menit
        cacheExpiry: 10 * 60 * 1000,              // 10 menit
        maxConcurrent: 4,                          // Max downloads global
        defaultFormats: [
            "bv*[vcodec^=avc][height<=720]+ba[ext=m4a]/bv*[ext=mp4][height<=720]+ba[ext=m4a]/bv*[height<=720]+ba/b",
            "bv*[height<=480]+ba/b",
            "bv*[height<=360]+ba/b",
            "b"                                    // Fallback: best single file
        ],
        processTimeout: 5 * 60 * 1000,            // 5 menit timeout
        purgeOnStartup: true,
    },

    // ── Steam ────────────────────────────────────────────────────────────
    steam: {
        apiKey: process.env.STEAM_API_KEY || "",
    },

    // ── YouTube Data API ────────────────────────────────────────────────
    youtube: {
        apiKey: process.env.YOUTUBE_API_KEY || "",
    },

    // ── Gemini AI ────────────────────────────────────────────────────────
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || "",
    },

    // ── SSH Terminal (!bash) ─────────────────────────────────────────────
    ssh: {
        host: process.env.SSH_HOST || "103.168.146.150",
        port: parseInt(process.env.SSH_PORT, 10) || 40015,
        user: process.env.SSH_USER || "root",
    },

    // ── Branding & Customization ─────────────────────────────────────────
    branding: {
        ownerImage: process.env.OWNER_IMAGE || "https://cdn.donmai.us/sample/3a/78/__hatsune_miku_mii_and_mikudayo_vocaloid_and_2_more_drawn_by_yunkkker__sample-3a782c2a60fa7c871f6edad47fd88dc1.jpg",
        channelUrl: process.env.CHANNEL_URL || "https://whatsapp.com/channel/0029VbB1Xqv1noz03aqgWx0s",
        stickerPack: process.env.STICKER_PACK || "WhatsApp Bot",
        stickerAuthor: process.env.STICKER_AUTHOR || (process.env.BOT_NAME || "Tederby"),
    },

    // ── Spam Filter ─────────────────────────────────────────────────────
    spamDelay: Number(process.env.SPAM_DELAY) || 3000, // ms cooldown per chat
};

export default setting;