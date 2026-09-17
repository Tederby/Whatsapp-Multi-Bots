import axios from "axios";
import https from "https";

const ANILIST_API = "https://graphql.anilist.co";

const axiosConfig = {
    timeout: 15000,
    httpsAgent: new https.Agent({ family: 4 }),
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
};

/**
 * Execute GraphQL query against AniList API.
 */
async function queryAniList(query, variables = {}) {
    const response = await axios.post(
        ANILIST_API,
        { query, variables },
        axiosConfig
    );
    return response.data;
}

/**
 * Extract username from potential AniList URL or return as is.
 */
export function extractAnilistUsername(input) {
    if (!input) return null;
    const match = input.match(/anilist\.co\/user\/([^/?\s]+)/i);
    return match ? match[1] : input.trim();
}

/**
 * Clean HTML tags and markdown artifacts from synopsis/description.
 */
export function cleanDescription(text) {
    if (!text) return "Tidak ada sinopsis.";
    return text
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Format AniList score (0-100) to scale of 10.
 */
export function formatScore(score) {
    if (score === null || score === undefined || score === 0) return "N/A";
    return (score / 10).toFixed(1);
}

/**
 * Format remaining seconds into a human-readable duration (ID).
 */
export function formatAiringTime(seconds) {
    if (!seconds || seconds <= 0) return null;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days} hari`);
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0 && days === 0) parts.push(`${minutes} menit`);

    return parts.join(" ") || "segera";
}

/**
 * Search anime from AniList.
 */
export async function searchAnime(searchQuery, { perPage = 20 } = {}) {
    const query = `
    query ($search: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          format
          status
          description
          startDate {
            year
            month
            day
          }
          season
          seasonYear
          episodes
          duration
          countryOfOrigin
          isAdult
          genres
          averageScore
          popularity
          studios(isMain: true) {
            nodes {
              name
            }
          }
          coverImage {
            extraLarge
            large
            medium
            color
          }
          bannerImage
          nextAiringEpisode {
            episode
            airingAt
            timeUntilAiring
          }
          siteUrl
        }
      }
    }
    `;

    const data = await queryAniList(query, { search: searchQuery, perPage });
    return data?.data?.Page?.media || [];
}

/**
 * Search manga/manhwa/novel from AniList.
 */
export async function searchManga(searchQuery, { perPage = 20 } = {}) {
    const query = `
    query ($search: String, $perPage: Int) {
      Page (page: 1, perPage: $perPage) {
        media (search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          format
          status
          description
          startDate {
            year
            month
            day
          }
          chapters
          volumes
          countryOfOrigin
          isAdult
          genres
          averageScore
          popularity
          staff(perPage: 3) {
            edges {
              role
              node {
                name {
                  full
                }
              }
            }
          }
          coverImage {
            extraLarge
            large
            medium
            color
          }
          bannerImage
          siteUrl
        }
      }
    }
    `;

    const data = await queryAniList(query, { search: searchQuery, perPage });
    return data?.data?.Page?.media || [];
}

/**
 * Verify if an AniList account exists and return its username and URL.
 */
export async function verifyAnilistAccount(input) {
    const username = extractAnilistUsername(input);
    if (!username) return null;

    const query = `
    query ($name: String) {
      User (name: $name) {
        id
        name
        siteUrl
        avatar {
          large
        }
      }
    }
    `;

    try {
        const data = await queryAniList(query, { name: username });
        const user = data?.data?.User;
        if (user) {
            return {
                username: user.name,
                url: user.siteUrl,
                avatar: user.avatar?.large
            };
        }
        return null;
    } catch (err) {
        return null;
    }
}

/**
 * Fetch and send full AniList profile details.
 */
export async function sendAnilistProfileDetail(input, message, sock, isAutoDetect = false) {
    let sentMsg;
    if (!isAutoDetect) {
        sentMsg = await sock.sendMessage(
            message.chat,
            { text: `🔍 Mengambil profil AniList *${input}*...` },
            { quoted: message }
        );
    }

    try {
        const username = extractAnilistUsername(input);
        if (!username) throw new Error("Username tidak valid.");

        const query = `
        query ($name: String) {
          User (name: $name) {
            id
            name
            about
            avatar {
              large
            }
            bannerImage
            siteUrl
            createdAt
            statistics {
              anime {
                count
                meanScore
                minutesWatched
                episodesWatched
                statuses {
                  status
                  count
                }
              }
              manga {
                count
                meanScore
                chaptersRead
                volumesRead
                statuses {
                  status
                  count
                }
              }
            }
          }
        }
        `;

        const data = await queryAniList(query, { name: username });
        const user = data?.data?.User;
        if (!user) {
            throw new Error("Data tidak ditemukan.");
        }

        const animeStats = user.statistics?.anime || {};
        const mangaStats = user.statistics?.manga || {};

        // Parse status breakdown
        const getStatusCount = (list, target) => {
            if (!list || !Array.isArray(list)) return 0;
            const item = list.find(s => s.status === target);
            return item ? item.count : 0;
        };

        const daysWatched = animeStats.minutesWatched
            ? (animeStats.minutesWatched / 1440).toFixed(1)
            : "0";
        const animeMeanScore = animeStats.meanScore
            ? (animeStats.meanScore / 10).toFixed(1)
            : "0";
        const mangaMeanScore = mangaStats.meanScore
            ? (mangaStats.meanScore / 10).toFixed(1)
            : "0";

        let text = `╭━━━〔 🌸 ANILIST PROFILE 〕━━━\n`;
        text += `┃ 👤 *Username* : ${user.name}\n`;
        if (user.createdAt) {
            const joinDate = new Date(user.createdAt * 1000).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            });
            text += `┃ 📅 *Join*     : ${joinDate}\n`;
        }
        text += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

        text += `╭───「 📺 Anime Stats 」\n`;
        text += `│ ⏱️ *Days Watched* : ${daysWatched}\n`;
        text += `│ ⭐ *Mean Score*   : ${animeMeanScore} / 10\n`;
        text += `│ 🎬 *Total Entry*  : ${animeStats.count || 0}\n`;
        text += `│ 🟢 *Watching*     : ${getStatusCount(animeStats.statuses, "CURRENT")}\n`;
        text += `│ 🔵 *Completed*    : ${getStatusCount(animeStats.statuses, "COMPLETED")}\n`;
        text += `│ 🟡 *Paused*       : ${getStatusCount(animeStats.statuses, "PAUSED")}\n`;
        text += `│ 🔴 *Dropped*      : ${getStatusCount(animeStats.statuses, "DROPPED")}\n`;
        text += `│ ⚪ *Planning*     : ${getStatusCount(animeStats.statuses, "PLANNING")}\n`;
        text += `╰──────────────\n\n`;

        text += `╭───「 📚 Manga Stats 」\n`;
        text += `│ 📖 *Chapters Read*: ${mangaStats.chaptersRead || 0}\n`;
        text += `│ 📚 *Volumes Read* : ${mangaStats.volumesRead || 0}\n`;
        text += `│ ⭐ *Mean Score*   : ${mangaMeanScore} / 10\n`;
        text += `│ 📖 *Total Entry*  : ${mangaStats.count || 0}\n`;
        text += `│ 🟢 *Reading*      : ${getStatusCount(mangaStats.statuses, "CURRENT")}\n`;
        text += `│ 🔵 *Completed*    : ${getStatusCount(mangaStats.statuses, "COMPLETED")}\n`;
        text += `│ 🟡 *Paused*       : ${getStatusCount(mangaStats.statuses, "PAUSED")}\n`;
        text += `│ 🔴 *Dropped*      : ${getStatusCount(mangaStats.statuses, "DROPPED")}\n`;
        text += `│ ⚪ *Planning*     : ${getStatusCount(mangaStats.statuses, "PLANNING")}\n`;
        text += `╰──────────────\n\n`;

        text += `🔗 *Profil:* ${user.siteUrl}`;

        const avatarUrl = user.avatar?.large;

        if (!isAutoDetect && sentMsg?.key) {
            await sock.sendMessage(message.chat, {
                text: `>> *${user.name}*`,
                edit: sentMsg.key
            }).catch(() => {});
        }

        if (avatarUrl) {
            await sock.sendMessage(
                message.chat,
                {
                    image: { url: avatarUrl },
                    caption: text
                },
                { quoted: message }
            );
        } else {
            await sock.sendMessage(
                message.chat,
                { text },
                { quoted: message }
            );
        }

    } catch (err) {
        console.error("AniList Profile Error:", err.message);

        if (!isAutoDetect && sentMsg?.key) {
            let errText = "❌ Terjadi kesalahan saat mengambil profil AniList. Coba lagi nanti.";
            if (err.response?.status === 404 || err.message.includes("Data tidak ditemukan")) {
                errText = `❌ User AniList dengan username *${input}* tidak ditemukan.`;
            } else if (err.response?.status === 429) {
                errText = `❌ Terlalu banyak request ke AniList API (Rate Limit). Mohon tunggu beberapa saat.`;
            }

            await sock.sendMessage(message.chat, {
                text: errText,
                edit: sentMsg.key
            }).catch(() => {});
        }
    }
}
