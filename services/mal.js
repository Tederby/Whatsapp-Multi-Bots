import axios from "axios";
import https from "https";

const JIKAN_API = "https://api.jikan.moe/v4";

const axiosConfig = {
    timeout: 15000,
    httpsAgent: new https.Agent({ family: 4 }),
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

/**
 * Extract username from a potential MyAnimeList URL or return as is.
 */
export function extractMalUsername(input) {
    if (!input) return null;
    const match = input.match(/myanimelist\.net\/profile\/([^/?]+)/i);
    return match ? match[1] : input.trim();
}

/**
 * Verify if a MAL account exists and return its username and URL.
 * Returns null if not found.
 */
export async function verifyMalAccount(input) {
    const username = extractMalUsername(input);
    if (!username) return null;

    try {
        const response = await axios.get(`${JIKAN_API}/users/${username}`, axiosConfig);
        if (response.data && response.data.data) {
            return {
                username: response.data.data.username,
                url: response.data.data.url
            };
        }
        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Fetch and send full MAL profile details.
 */
export async function sendMalProfileDetail(input, message, sock, isAutoDetect = false) {
    let sentMsg;
    if (!isAutoDetect) {
        sentMsg = await sock.sendMessage(
            message.chat,
            { text: `🔍 Mengambil profil MAL *${input}*...` },
            { quoted: message }
        );
    }

    try {
        const username = extractMalUsername(input);
        if (!username) throw new Error("Username tidak valid.");

        // Fetch full profile info
        const response = await axios.get(`${JIKAN_API}/users/${username}/full`, axiosConfig);
        if (!response.data || !response.data.data) {
            throw new Error("Data tidak ditemukan.");
        }

        const user = response.data.data;
        const stats = user.statistics?.anime || {};
        const mangaStats = user.statistics?.manga || {};

        let text = `╭━━━〔 🎌 MAL PROFILE 〕━━━\n`;
        text += `┃ 👤 *Username* : ${user.username}\n`;
        if (user.location) text += `┃ 📍 *Lokasi*   : ${user.location}\n`;
        if (user.joined) {
            const joinedDate = new Date(user.joined).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
            text += `┃ 📅 *Join*     : ${joinedDate}\n`;
        }
        text += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

        text += `╭───「 📺 Anime Stats 」\n`;
        text += `│ ⏱️ *Days Watched* : ${stats.days_watched || 0}\n`;
        text += `│ ⭐ *Mean Score*   : ${stats.mean_score || 0}\n`;
        text += `│ 🎬 *Total Entry*  : ${stats.total_entries || 0}\n`;
        text += `│ 🟢 *Watching*     : ${stats.watching || 0}\n`;
        text += `│ 🔵 *Completed*    : ${stats.completed || 0}\n`;
        text += `│ 🟡 *On Hold*      : ${stats.on_hold || 0}\n`;
        text += `│ 🔴 *Dropped*      : ${stats.dropped || 0}\n`;
        text += `│ ⚪ *Plan to Watch*: ${stats.plan_to_watch || 0}\n`;
        text += `╰──────────────\n\n`;

        text += `╭───「 📚 Manga Stats 」\n`;
        text += `│ ⏱️ *Days Read*    : ${mangaStats.days_read || 0}\n`;
        text += `│ ⭐ *Mean Score*   : ${mangaStats.mean_score || 0}\n`;
        text += `│ 📖 *Total Entry*  : ${mangaStats.total_entries || 0}\n`;
        text += `│ 🟢 *Reading*      : ${mangaStats.reading || 0}\n`;
        text += `│ 🔵 *Completed*    : ${mangaStats.completed || 0}\n`;
        text += `╰──────────────\n\n`;

        text += `🔗 *Profil:* ${user.url}`;

        const imageUrl = user.images?.jpg?.image_url;

        if (!isAutoDetect) {
            await sock.sendMessage(message.chat, {
                text: `>> *${user.username}*`,
                edit: sentMsg.key
            });
        }

        if (imageUrl) {
            await sock.sendMessage(
                message.chat,
                {
                    image: { url: imageUrl },
                    caption: text
                },
                { quoted: message }
            );
        } else {
            await sock.sendMessage(
                message.chat,
                { text: text },
                { quoted: message }
            );
        }

    } catch (err) {
        console.error("MAL Profile Error:", err.message);

        if (!isAutoDetect) {
            let errText = "❌ Terjadi kesalahan saat mengambil profil MAL. Coba lagi nanti.";
            if (err.response?.status === 404) {
                errText = `❌ User MAL dengan username *${input}* tidak ditemukan.`;
            } else if (err.response?.status === 429) {
                errText = `❌ Terlalu banyak request ke Jikan API. Mohon tunggu beberapa saat.`;
            }

            await sock.sendMessage(message.chat, {
                text: errText,
                edit: sentMsg.key
            }).catch(() => {});
        }
    }
}
