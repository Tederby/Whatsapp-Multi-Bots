/**
 * Seasonal — Browse seasonal anime charts from AniList.
 */

import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { getSeasonal, getCurrentSeason, getNextSeason, cleanDescription, formatScore, formatAiringTime } from "../services/anilist.js";
import { generatePaginator, ITEMS_PER_PAGE } from "../lib/utils.js";

const SEASON_LABELS = {
    WINTER: "❄️ Winter", SPRING: "🌸 Spring",
    SUMMER: "☀️ Summer", FALL: "🍂 Fall"
};

function generateListText(results, page, season, year) {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = results.slice(start, end);

    const label = SEASON_LABELS[season] || season;

    let text = `╭━━━〔 📺 SEASONAL ANIME 〕━━━\n`;
    text += `┃ 📅 *Musim* : ${label} ${year}\n`;
    text += `┃ 📊 *Total* : ${results.length} judul\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((anime, index) => {
        const title = anime.title?.romaji || anime.title?.userPreferred || anime.title?.english || "N/A";
        const score = formatScore(anime.averageScore);
        const format = anime.format || "N/A";
        const eps = anime.episodes ? `${anime.episodes} Eps` : "? Eps";
        const status = anime.status || "N/A";

        let nextEp = "";
        if (anime.nextAiringEpisode) {
            const remaining = formatAiringTime(anime.nextAiringEpisode.timeUntilAiring);
            if (remaining) nextEp = ` ⏱️ Ep ${anime.nextAiringEpisode.episode} in ${remaining}`;
        }

        text += `╭───「 ${start + index + 1}. ${title} 」\n`;
        text += `│ 📺 *Tipe*    : ${format}\n`;
        text += `│ ⭐ *Skor*    : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;
        text += `│ 🎬 *Episode* : ${eps}\n`;
        text += `│ ⏳ *Status*  : ${status}${nextEp}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk detail. Ketik "n" next, "b" back._`;

    return text.trim();
}

export default {
    name: "seasonal",
    aliases: ["season", "musim"],
    category: "anime",
    description: "Melihat daftar anime berdasarkan musim (seasonal chart)",
    usage: "!seasonal [next/winter/spring/summer/fall] [year]",
    async handler({ message, args, sock, sender, prefix }) {
        // Parse args to determine season/year
        let targetSeason, targetYear;
        const current = getCurrentSeason();

        if (args.length === 0) {
            // Default: current season
            targetSeason = current.season;
            targetYear = current.year;
        } else {
            const firstArg = args[0].toUpperCase();

            if (firstArg === "NEXT") {
                const next = getNextSeason(current.season, current.year);
                targetSeason = next.season;
                targetYear = next.year;
            } else if (["WINTER", "SPRING", "SUMMER", "FALL"].includes(firstArg)) {
                targetSeason = firstArg;
                targetYear = args[1] ? parseInt(args[1], 10) : current.year;
                if (isNaN(targetYear) || targetYear < 1970 || targetYear > 2100) {
                    await message.reply(`❌ Tahun tidak valid. Contoh: \`${prefix || "!"}seasonal winter 2025\``);
                    return;
                }
            } else {
                // Maybe just a year?
                const yearArg = parseInt(firstArg, 10);
                if (!isNaN(yearArg) && yearArg >= 1970 && yearArg <= 2100) {
                    targetSeason = current.season;
                    targetYear = yearArg;
                } else {
                    await message.reply(
                        `╭━━━〔 📺 SEASONAL 〕━━━\n` +
                        `┃ Melihat anime berdasarkan musim.\n` +
                        `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `╭───「 📖 Penggunaan 」\n` +
                        `│ ⋄ \`${prefix || "!"}seasonal\` (musim ini)\n` +
                        `│ ⋄ \`${prefix || "!"}seasonal next\` (musim depan)\n` +
                        `│ ⋄ \`${prefix || "!"}seasonal winter 2025\`\n` +
                        `│ ⋄ \`${prefix || "!"}seasonal fall 2026\`\n` +
                        `╰──────────────\n\n` +
                        `📅 *Musim*: Winter (Jan-Mar), Spring (Apr-Jun), Summer (Jul-Sep), Fall (Oct-Dec)`
                    );
                    return;
                }
            }
        }

        try {
            const results = await getSeasonal(targetSeason, targetYear);

            if (!results || results.length === 0) {
                const label = SEASON_LABELS[targetSeason] || targetSeason;
                await message.reply(`❌ Tidak ada anime ditemukan untuk *${label} ${targetYear}*.`);
                return;
            }

            const text = generateListText(results, 0, targetSeason, targetYear);
            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                season: targetSeason,
                year: targetYear,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "seasonal"
            });

        } catch (err) {
            console.error("[SEASONAL]", err);
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
    const { results, page, season, year, messageKey } = state;
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);

    if (text === "n" || text === "next") {
        if (page < totalPages - 1) {
            state.page += 1;
            const newText = generateListText(results, state.page, season, year);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            const newText = generateListText(results, state.page, season, year);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= results.length) {
        const anime = results[num - 1];
        const animeTitle = anime.title?.romaji || anime.title?.userPreferred || anime.title?.english || "N/A";

        deleteReplyHandler(messageKey.id);
        await sock.sendMessage(message.chat, { text: `>> *${animeTitle}*`, edit: messageKey });

        await sendAnimeDetail(anime, message, sock);
        return;
    }
}

async function sendAnimeDetail(anime, message, sock) {
    const title = typeof anime.title === "object"
        ? (anime.title?.romaji || anime.title?.userPreferred || anime.title?.english || "N/A")
        : (anime.title || "N/A");
    const rawTitleEng = anime.title?.english ? anime.title.english.replace(/[()]/g, "").trim() : "";
    const status = anime.status || "N/A";
    const episodes = anime.episodes || "Unknown";
    const type = anime.format || anime.type || "N/A";
    const score = formatScore(anime.averageScore);
    const popularity = anime.popularity ? `#${anime.popularity}` : "N/A";
    const season = anime.season ? anime.season.charAt(0).toUpperCase() + anime.season.slice(1).toLowerCase() : "";
    const year = anime.seasonYear || anime.startDate?.year || "";
    const seasonYear = season && year ? `${season} ${year}` : (season || year || "N/A");
    const studios = anime.studios?.nodes && anime.studios.nodes.length > 0
        ? anime.studios.nodes.map(s => s.name).join(", ")
        : "N/A";
    const duration = anime.duration ? `${anime.duration} mins` : "N/A";

    const anilistUrl = anime.siteUrl || `https://anilist.co/anime/${anime.id}`;
    const malUrl = anime.idMal ? `https://myanimelist.net/anime/${anime.idMal}` : null;
    const genres = anime.genres && anime.genres.length > 0 ? anime.genres.join(", ") : "N/A";
    const synopsis = cleanDescription(anime.description);

    let nextAiringText = "";
    if (anime.nextAiringEpisode) {
        const remaining = formatAiringTime(anime.nextAiringEpisode.timeUntilAiring);
        if (remaining) {
            nextAiringText = `Ep ${anime.nextAiringEpisode.episode} rilis dalam ${remaining}`;
        }
    }

    const imageUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium || null;

    let captionText = `╭━━━〔 🎌 ANIME DETAIL 〕━━━\n`;
    captionText += `┃ 🏷️ *Judul*       : ${title}\n`;
    if (rawTitleEng) {
        captionText += `┃ 🔤 *Inggris*     : ${rawTitleEng}\n`;
    }
    captionText += `┃ 📺 *Tipe*        : ${type}\n`;
    captionText += `┃ ⭐ *Skor*        : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;
    captionText += `┃ 🎬 *Episode*     : ${episodes}\n`;
    captionText += `┃ ⏱️ *Durasi*      : ${duration}\n`;
    captionText += `┃ ⏳ *Status*      : ${status}\n`;
    captionText += `┃ 📅 *Musim*       : ${seasonYear}\n`;
    captionText += `┃ 🎥 *Studio*      : ${studios}\n`;
    captionText += `┃ 📈 *Popularitas* : ${popularity}\n`;
    captionText += `┃ 🎭 *Genre*       : ${genres}\n`;
    if (nextAiringText) {
        captionText += `┃ ⏱️ *Next Ep*     : ${nextAiringText}\n`;
    }
    captionText += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

    captionText += `📝 *Sinopsis:*\n${synopsis}\n\n`;

    // Recommendations
    const recs = anime.recommendations?.nodes?.filter(r => r.mediaRecommendation) || [];
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
