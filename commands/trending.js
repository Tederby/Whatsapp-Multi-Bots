import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { getTrending, getPopular, cleanDescription, formatScore, formatAiringTime } from "../services/anilist.js";

const ITEMS_PER_PAGE = 5;

function generatePaginator(page, totalPages) {
    if (totalPages <= 1) return `[ 📄 Page 1/1 ] ─── ━━━━━━━━━━━━━━━━`;
    let items = [];
    let startP = Math.max(0, page - 2);
    let endP = Math.min(totalPages - 1, page + 2);
    for (let i = startP; i <= endP; i++) {
        let pNum = i + 1;
        if (i === page) items.push(`*${pNum}*`);
        else items.push(`${pNum}`);
    }
    let bar = items.join(" ─ ");
    return `[ 📄 Page ${page + 1}/${totalPages} ] ─── « ─ ${bar} ─ »`;
}

function generateListText(results, page, mode, mediaType) {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = results.slice(start, end);

    const isAnime = mediaType === "ANIME";
    const modeLabel = mode === "trending" ? "TRENDING" : "POPULAR";
    const typeLabel = isAnime ? "ANIME" : "MANGA";
    const emoji = mode === "trending" ? "🔥" : "👑";

    let text = `╭━━━〔 ${emoji} ${modeLabel} ${typeLabel} 〕━━━\n`;
    text += `┃ 📊 *Mode* : ${mode === "trending" ? "Trending Now" : "All-Time Popular"}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((media, index) => {
        const title = media.title?.romaji || media.title?.userPreferred || media.title?.english || "N/A";
        const score = formatScore(media.averageScore);
        const format = media.format || "N/A";
        const rank = start + index + 1;

        let extra;
        if (isAnime) {
            const eps = media.episodes ? `${media.episodes} Eps` : "? Eps";
            const year = media.seasonYear || media.startDate?.year || "N/A";
            extra = `│ 🎬 *Episode* : ${eps}\n│ 📅 *Tahun*   : ${year}`;
        } else {
            const chaps = media.chapters ? `${media.chapters} Chaps` : "? Chaps";
            const year = media.startDate?.year || "N/A";
            extra = `│ 📝 *Chapter* : ${chaps}\n│ 📅 *Tahun*   : ${year}`;
        }

        text += `╭───「 ${rank}. ${title} 」\n`;
        text += `│ 📺 *Tipe*    : ${format}\n`;
        text += `│ ⭐ *Skor*    : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;
        text += `${extra}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk detail. Ketik "n" next, "b" back._`;

    return text.trim();
}

export default {
    name: "trending",
    aliases: ["trend", "popular", "top"],
    category: "anime",
    description: "Melihat anime/manga trending atau terpopuler di AniList",
    usage: "!trending [anime/manga] [-t/--top/-1] | !popular [anime/manga] [-t/--top/-1]",

    flags: {
        top:   { type: "boolean", char: "t", aliases: ["top", "direct", "1"] },
        manga: { type: "boolean", char: "m", aliases: ["manga"] },
    },

    async handler({ message, args, cleanArgs, flags, sock, sender, prefix, commandName }) {
        // Determine mode from the command used
        const isPopular = commandName === "popular" || commandName === "top";
        const mode = isPopular ? "popular" : "trending";

        // Determine media type from flags or args
        let mediaType = "ANIME";
        if (flags?.manga) {
            mediaType = "MANGA";
        } else {
            const effectiveArgs = cleanArgs || args;
            for (const arg of effectiveArgs) {
                const lower = arg.toLowerCase();
                if (lower === "manga" || lower === "m") {
                    mediaType = "MANGA";
                    break;
                }
            }
        }

        const isDirect = Boolean(flags?.top);

        try {
            const fetchFn = mode === "trending" ? getTrending : getPopular;
            const results = await fetchFn(mediaType, { perPage: 25 });

            if (!results || results.length === 0) {
                await message.reply(`❌ Tidak ada data ${mode} ditemukan.`);
                return;
            }

            if (isDirect) {
                await sendMediaDetail(results[0], mediaType, message, sock);
                return;
            }

            const text = generateListText(results, 0, mode, mediaType);
            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                mode,
                mediaType,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "trending"
            });

        } catch (err) {
            console.error(`[${mode} Command Error]:`, err);
            if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
                await message.reply("❌ Server AniList sedang sibuk atau timeout. Silakan coba beberapa saat lagi.");
            } else if (err.response?.status === 429) {
                await message.reply("❌ Terlalu banyak request ke AniList API (429 Rate Limit). Mohon tunggu beberapa saat.");
            } else {
                await message.reply(`❌ Terjadi kesalahan: ${err.message || "Unknown error"}`);
            }
        }
    }
};

async function replyHandler({ message, sock, state }) {
    const text = message.text.toLowerCase().trim();
    const { results, page, mode, mediaType, messageKey } = state;
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);

    if (text === "n" || text === "next") {
        if (page < totalPages - 1) {
            state.page += 1;
            const newText = generateListText(results, state.page, mode, mediaType);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            const newText = generateListText(results, state.page, mode, mediaType);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= results.length) {
        const media = results[num - 1];
        const mediaTitle = media.title?.romaji || media.title?.userPreferred || media.title?.english || "N/A";

        deleteReplyHandler(messageKey.id);
        await sock.sendMessage(message.chat, { text: `>> *${mediaTitle}*`, edit: messageKey });

        await sendMediaDetail(media, mediaType, message, sock);
        return;
    }
}

async function sendMediaDetail(media, mediaType, message, sock) {
    const isAnime = mediaType === "ANIME";
    const title = typeof media.title === "object"
        ? (media.title?.romaji || media.title?.userPreferred || media.title?.english || "N/A")
        : (media.title || "N/A");
    const rawTitleEng = media.title?.english ? media.title.english.replace(/[()]/g, "").trim() : "";
    const status = media.status || "N/A";
    const format = media.format || media.type || "N/A";
    const score = formatScore(media.averageScore);
    const popularity = media.popularity ? `#${media.popularity}` : "N/A";
    const genres = media.genres && media.genres.length > 0 ? media.genres.join(", ") : "N/A";
    const synopsis = cleanDescription(media.description);

    const anilistUrl = media.siteUrl || `https://anilist.co/${isAnime ? "anime" : "manga"}/${media.id}`;
    const malUrl = media.idMal ? `https://myanimelist.net/${isAnime ? "anime" : "manga"}/${media.idMal}` : null;
    const imageUrl = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null;

    const detailEmoji = isAnime ? "🎌" : "📚";
    const detailLabel = isAnime ? "ANIME DETAIL" : "MANGA DETAIL";

    let captionText = `╭━━━〔 ${detailEmoji} ${detailLabel} 〕━━━\n`;
    captionText += `┃ 🏷️ *Judul*       : ${title}\n`;
    if (rawTitleEng) {
        captionText += `┃ 🔤 *Inggris*     : ${rawTitleEng}\n`;
    }
    captionText += `┃ 📺 *Tipe*        : ${format}\n`;
    captionText += `┃ ⭐ *Skor*        : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;

    if (isAnime) {
        const episodes = media.episodes || "Unknown";
        const duration = media.duration ? `${media.duration} mins` : "N/A";
        const season = media.season ? media.season.charAt(0).toUpperCase() + media.season.slice(1).toLowerCase() : "";
        const year = media.seasonYear || media.startDate?.year || "";
        const seasonYear = season && year ? `${season} ${year}` : (season || year || "N/A");
        const studios = media.studios?.nodes && media.studios.nodes.length > 0
            ? media.studios.nodes.map(s => s.name).join(", ")
            : "N/A";

        captionText += `┃ 🎬 *Episode*     : ${episodes}\n`;
        captionText += `┃ ⏱️ *Durasi*      : ${duration}\n`;
        captionText += `┃ ⏳ *Status*      : ${status}\n`;
        captionText += `┃ 📅 *Musim*       : ${seasonYear}\n`;
        captionText += `┃ 🎥 *Studio*      : ${studios}\n`;
    } else {
        const chapters = media.chapters || "Unknown";
        const volumes = media.volumes || "Unknown";
        let authors = "N/A";
        if (media.staff?.edges && media.staff.edges.length > 0) {
            authors = media.staff.edges.map(e => `${e.node.name.full} (${e.role})`).join(", ");
        }

        captionText += `┃ 📝 *Chapter*     : ${chapters}\n`;
        captionText += `┃ 📚 *Volume*      : ${volumes}\n`;
        captionText += `┃ ⏳ *Status*      : ${status}\n`;
        captionText += `┃ ✍️ *Author*      : ${authors}\n`;
    }

    captionText += `┃ 📈 *Popularitas* : ${popularity}\n`;
    captionText += `┃ 🎭 *Genre*       : ${genres}\n`;

    if (isAnime && media.nextAiringEpisode) {
        const remaining = formatAiringTime(media.nextAiringEpisode.timeUntilAiring);
        if (remaining) {
            captionText += `┃ ⏱️ *Next Ep*     : Ep ${media.nextAiringEpisode.episode} rilis dalam ${remaining}\n`;
        }
    }
    captionText += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

    captionText += `📝 *Sinopsis:*\n${synopsis}\n\n`;

    // Recommendations
    const recs = media.recommendations?.nodes?.filter(r => r.mediaRecommendation) || [];
    if (recs.length > 0) {
        captionText += `╭───「 💡 Rekomendasi 」\n`;
        recs.forEach((rec, i) => {
            const recTitle = rec.mediaRecommendation.title?.romaji || "N/A";
            const recScore = formatScore(rec.mediaRecommendation.averageScore);
            const recFormat = rec.mediaRecommendation.format || "";
            captionText += `│ ${i + 1}. ${recTitle}`;
            if (recScore !== "N/A") captionText += ` (${recScore} / 10)`;
            if (recFormat) captionText += ` [${recFormat}]`;
            captionText += `\n`;
        });
        captionText += `╰──────────────\n\n`;
    }

    captionText += `🔗 *Tautan:*\n`;
    captionText += `• AniList: ${anilistUrl}`;
    if (malUrl) {
        captionText += `\n• MyAnimeList: ${malUrl}`;
    }

    if (imageUrl) {
        await sock.sendMessage(
            message.chat,
            {
                image: { url: imageUrl },
                caption: captionText
            },
            { quoted: message }
        );
    } else {
        await message.reply(captionText);
    }
}
