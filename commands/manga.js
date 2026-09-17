import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { searchManga, cleanDescription, formatScore } from "../services/anilist.js";

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

    let text = `╭━━━〔 📖 MANGA SEARCH 〕━━━\n`;
    text += `┃ 🔍 *Query* : ${query}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((manga, index) => {
        const title = manga.title?.romaji || manga.title?.userPreferred || manga.title?.english || "N/A";
        const year = manga.startDate?.year || "N/A";
        const score = formatScore(manga.averageScore);
        const format = manga.format || manga.type || "N/A";
        const chaps = manga.chapters ? `${manga.chapters} Chaps` : "? Chaps";

        text += `╭───「 ${start + index + 1}. ${title} 」\n`;
        text += `│ 📖 *Format*  : ${format}\n`;
        text += `│ ⭐ *Skor*    : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;
        text += `│ 📝 *Chapter* : ${chaps}\n`;
        text += `│ 📅 *Tahun*   : ${year}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk memilih. Ketik "n" next, "b" back._`;

    return text.trim();
}

export default {
    name: "manga",
    aliases: ["ln", "lightnovel", "comic", "manhwa"],
    category: "anime",
    description: "Mencari daftar Manga / Light Novel / Manhwa dari AniList",
    usage: "!manga <judul manga/LN>",
    async handler({ message, args, sock, sender, prefix }) {
        if (args.length === 0) {
            await message.reply(
                "╭━━━〔 📖 MANGA SEARCH 〕━━━\n" +
                "┃ Mencari manga/manhwa/novel dari AniList.\n" +
                "╰━━━━━━━━━━━━━━━━━━━━\n\n" +
                "╭───「 📖 Penggunaan 」\n" +
                `│ ⋄ \`${prefix || "!"}manga <judul>\`\n` +
                `│ ⋄ \`${prefix || "!"}manga <judul> -1\` (hasil teratas)\n` +
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
            await message.reply(`❌ Berikan judul manga/LN yang ingin dicari.\nContoh: \`${prefix || "!"}manga solo leveling -1\``);
            return;
        }

        try {
            const results = await searchManga(query, { perPage: 20 });

            if (!results || results.length === 0) {
                await message.reply(`❌ Manga/Light Novel dengan kata kunci *${query}* tidak ditemukan di database.`);
                return;
            }

            if (isDirect || results.length === 1) {
                await sendMangaDetail(results[0], message, sock);
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
                commandName: "manga"
            });

        } catch (err) {
            let errorMsg = err.message || "Unknown error";
            if (err.response) {
                errorMsg = `HTTP ${err.response.status}: ${err.response.statusText || ""}`;
                console.error("Manga Command Error (Response):", errorMsg, err.response.data);
            } else {
                console.error("Manga Command Error:", err);
            }

            if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
                await message.reply("❌ Server AniList sedang sibuk atau timeout. Silakan coba beberapa saat lagi.");
            } else if (err.response && err.response.status === 429) {
                await message.reply("❌ Terlalu banyak request ke AniList API (429 Rate Limit). Mohon tunggu beberapa saat.");
            } else {
                await message.reply(`❌ Terjadi kesalahan saat mencari manga: ${errorMsg}`);
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
        const manga = results[num - 1];
        const mangaTitle = manga.title?.romaji || manga.title?.userPreferred || manga.title?.english || "N/A";

        deleteReplyHandler(messageKey.id);
        await sock.sendMessage(message.chat, { text: `>> *${mangaTitle}*`, edit: messageKey });

        await sendMangaDetail(manga, message, sock);
        return;
    }
}

async function sendMangaDetail(manga, message, sock) {
    const title = typeof manga.title === "object"
        ? (manga.title?.romaji || manga.title?.userPreferred || manga.title?.english || "N/A")
        : (manga.title || "N/A");
    const rawTitleEng = manga.title?.english ? manga.title.english.replace(/[()]/g, "").trim() : "";
    const status = manga.status || "N/A";
    const chapters = manga.chapters || "Unknown";
    const volumes = manga.volumes || "Unknown";
    const format = manga.format || manga.type || "N/A";
    const score = formatScore(manga.averageScore);
    const popularity = manga.popularity ? `#${manga.popularity}` : "N/A";

    let authors = "N/A";
    if (manga.staff?.edges && manga.staff.edges.length > 0) {
        authors = manga.staff.edges.map(e => `${e.node.name.full} (${e.role})`).join(", ");
    }

    const anilistUrl = manga.siteUrl || `https://anilist.co/manga/${manga.id}`;
    const malUrl = manga.idMal ? `https://myanimelist.net/manga/${manga.idMal}` : null;
    const genres = manga.genres && manga.genres.length > 0 ? manga.genres.join(", ") : "N/A";
    const synopsis = cleanDescription(manga.description);

    const imageUrl = manga.coverImage?.extraLarge || manga.coverImage?.large || manga.coverImage?.medium || null;

    let captionText = `╭━━━〔 📚 MANGA DETAIL 〕━━━\n`;
    captionText += `┃ 🏷️ *Judul*       : ${title}\n`;
    if (rawTitleEng) {
        captionText += `┃ 🔤 *Inggris*     : ${rawTitleEng}\n`;
    }
    captionText += `┃ 📖 *Format*      : ${format}\n`;
    captionText += `┃ ⭐ *Skor*        : ${score !== "N/A" ? score + " / 10" : "N/A"}\n`;
    captionText += `┃ 📝 *Chapter*     : ${chapters}\n`;
    captionText += `┃ 📚 *Volume*      : ${volumes}\n`;
    captionText += `┃ ⏳ *Status*      : ${status}\n`;
    captionText += `┃ ✍️ *Author*      : ${authors}\n`;
    captionText += `┃ 📈 *Popularitas* : ${popularity}\n`;
    captionText += `┃ 🎭 *Genre*       : ${genres}\n`;
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
