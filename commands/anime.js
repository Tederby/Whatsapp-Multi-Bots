import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { searchAnime, cleanDescription, formatScore, formatAiringTime } from "../services/anilist.js";

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

function generateListText(results, page, query) {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = results.slice(start, end);

    let text = `╭━━━〔 🎌 ANIME SEARCH 〕━━━\n`;
    text += `┃ 🔍 *Query* : ${query}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((anime, index) => {
        const title = anime.title?.romaji || anime.title?.userPreferred || anime.title?.english || "N/A";
        const year = anime.seasonYear || anime.startDate?.year || "N/A";
        const score = formatScore(anime.averageScore);
        const format = anime.format || "N/A";
        const eps = anime.episodes ? `${anime.episodes} Eps` : "? Eps";

        text += `╭───「 ${start + index + 1}. ${title} 」\n`;
        text += `│ 📺 *Tipe*    : ${format}\n`;
        text += `│ ⭐ *Skor*    : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;
        text += `│ 🎬 *Episode* : ${eps}\n`;
        text += `│ 📅 *Tahun*   : ${year}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk memilih. Ketik "n" next, "b" back._`;

    return text.trim();
}

export default {
    name: "anime",
    aliases: ["myanimelist", "ani", "anim"],
    category: "anime",
    description: "Mencari daftar anime dari AniList",
    usage: "!anime <judul> [--top/-1]",
    async handler({ message, args, sock, sender, prefix }) {
        if (args.length === 0) {
            await message.reply(
                "╭━━━〔 🎌 ANIME SEARCH 〕━━━\n" +
                "┃ Mencari anime dari database AniList.\n" +
                "╰━━━━━━━━━━━━━━━━━━━━\n\n" +
                "╭───「 📖 Penggunaan 」\n" +
                `│ ⋄ \`${prefix || "!"}anime <judul>\`\n` +
                `│ ⋄ \`${prefix || "!"}anime <judul> -1\` (hasil teratas)\n` +
                "╰──────────────"
            );
            return;
        }

        let isDirect = false;
        const cleanArgs = [];
        const directFlags = ["--top", "-t", "-1", "--direct", "top"];

        for (const arg of args) {
            const lower = arg.toLowerCase();
            if (directFlags.includes(lower)) {
                isDirect = true;
            } else {
                cleanArgs.push(arg);
            }
        }

        const query = cleanArgs.join(" ");

        if (!query) {
            await message.reply(`❌ Berikan judul anime yang ingin dicari.\nContoh: \`${prefix || "!"}anime frieren -1\``);
            return;
        }

        try {
            const results = await searchAnime(query, { perPage: 20 });

            if (!results || results.length === 0) {
                await message.reply(`❌ Anime dengan kata kunci *${query}* tidak ditemukan di database.`);
                return;
            }

            if (isDirect || results.length === 1) {
                await sendAnimeDetail(results[0], message, sock);
                return;
            }

            const text = generateListText(results, 0, query);
            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                query,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "anime"
            });

        } catch (err) {
            let errorMsg = err.message || "Unknown error";
            if (err.response) {
                errorMsg = `HTTP ${err.response.status}: ${err.response.statusText || ""}`;
                console.error("[Anime Command Error (Response)]:", errorMsg, err.response.data);
            } else {
                console.error("[Anime Command Error]:", err);
            }

            if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
                await message.reply("❌ Server AniList sedang sibuk atau timeout. Silakan coba beberapa saat lagi.");
            } else if (err.response && err.response.status === 429) {
                await message.reply("❌ Terlalu banyak request ke AniList API (429 Rate Limit). Mohon tunggu beberapa saat.");
            } else {
                await message.reply(`❌ Terjadi kesalahan saat mencari anime: ${errorMsg}`);
            }
        }
    }
};

async function replyHandler({ message, sock, state }) {
    const text = message.text.toLowerCase().trim();
    const { results, page, query, messageKey } = state;
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);

    if (text === "n" || text === "next") {
        if (page < totalPages - 1) {
            state.page += 1;
            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            const newText = generateListText(results, state.page, query);
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
