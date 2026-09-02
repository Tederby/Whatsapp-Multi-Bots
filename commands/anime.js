import axios from "axios";
import https from "https";
import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, renderCard } from "../lib/uiEngine.js";

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
    text += `┃ 🔍 Query : ${query}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((anime, index) => {
        let year = anime.year || (anime.aired?.prop?.from?.year) || "N/A";
        text += `╭───「 ${start + index + 1}. ${anime.title} 」\n`;
        text += `│ 📺 ${anime.type || "N/A"} | ⭐ ${anime.score || "N/A"} | 🎬 ${anime.episodes || "?"} Eps | 📅 ${year}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk memilih. Ketik "n" next, "b" back._`;

    return text.trim();
}

export default {
    name: "anime",
    aliases: ["myanimelist"],
    category: "anime",
    description: "Mencari daftar anime dari MyAnimeList",
    usage: "!anime <judul> [--top/-1] [--ui/--text]",
    async handler({ message, args, sock, sender }) {
        if (args.length === 0) {
            await message.reply("❌ Berikan judul anime yang ingin dicari.\nContoh: `!anime naruto`\n\n💡 *Tip:* Tambahkan `-1` atau `--top` untuk langsung mendapatkan hasil paling relevan tanpa memilih list. Contoh: `!anime naruto -1`\n💡 *Mode:* Tambahkan `--ui` untuk paksa UI interaktif atau `--text` untuk teks biasa.");
            return;
        }

        let isDirect = false;
        let forcedMode = null;
        const cleanArgs = [];
        const directFlags = ["--top", "-t", "-1", "--direct", "top"];

        for (const arg of args) {
            const lower = arg.toLowerCase();
            if (directFlags.includes(lower)) {
                isDirect = true;
            } else if (lower === "--ui") {
                forcedMode = "ui";
            } else if (lower === "--text" || lower === "--txt") {
                forcedMode = "text";
            } else {
                cleanArgs.push(arg);
            }
        }

        const query = cleanArgs.join(" ");

        if (!query) {
            await message.reply("❌ Berikan judul anime yang ingin dicari.\nContoh: `!anime naruto -1`");
            return;
        }

        try {
            const response = await axios.get(`https://api.tenrai.org/v1/anime?q=${encodeURIComponent(query)}&limit=20`, {
                timeout: 15000, // Timeout 15 detik
                httpsAgent: new https.Agent({ family: 4 }), // Paksa IPv4
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.data || !response.data.data || response.data.data.length === 0) {
                await message.reply(`❌ Anime dengan kata kunci *${query}* tidak ditemukan di database.`);
                return;
            }

            const results = response.data.data;

            if (isDirect || results.length === 1) {
                await sendAnimeDetail(results[0], message, sock, sender, forcedMode);
                return;
            }

            const text = generateListText(results, 0, query);

            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            // Register reply handler for pagination and detail selection
            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                query,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "anime",
                forcedMode
            });

        } catch (err) {
            let errorMsg = err.message || "Unknown error";
            if (err.response) {
                // Server merespon dengan status code selain 2xx
                errorMsg = `HTTP ${err.response.status}: ${err.response.statusText}`;
                console.error("Anime Command Error (Response):", errorMsg, err.response.data);
            } else if (err.request) {
                // Request terkirim tapi tidak ada respon (timeout/network error)
                console.error("Anime Command Error (Request):", errorMsg);
            } else {
                console.error("Anime Command Error:", err);
            }

            if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                await message.reply(`❌ Server MyAnimeList (Jikan API) sedang sibuk atau down. Silakan coba beberapa saat lagi.`);
            } else if (err.response && err.response.status === 403) {
                await message.reply(`❌ Akses ditolak oleh API Jikan (403 Forbidden). Ini sering terjadi jika IP server/VPS diblokir oleh sistem keamanan mereka (Cloudflare).`);
            } else if (err.response && err.response.status === 429) {
                await message.reply(`❌ Terlalu banyak request ke Jikan API (429 Rate Limit). Mohon tunggu beberapa saat.`);
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

        deleteReplyHandler(messageKey.id);
        await sock.sendMessage(message.chat, { text: `>> *${anime.title}*`, edit: messageKey });

        await sendAnimeDetail(anime, message, sock, state.userId, state.forcedMode);
        return;
    }
}

async function sendAnimeDetail(anime, message, sock, sender, forcedMode = null) {
    const title = anime.title || "N/A";
    const titleEng = anime.title_english ? ` (${anime.title_english})` : "";
    const status = anime.status || "N/A";
    const episodes = anime.episodes || "Unknown";
    const type = anime.type || "N/A";
    const score = anime.score || "N/A";
    const rank = anime.rank || "N/A";
    const popularity = anime.popularity || "N/A";
    const season = anime.season ? anime.season.charAt(0).toUpperCase() + anime.season.slice(1) : "";
    const year = anime.year || "";
    const seasonYear = season && year ? `${season} ${year}` : (season || year || "N/A");
    const studios = anime.studios && anime.studios.length > 0 ? anime.studios.map(s => s.name).join(", ") : "N/A";
    const duration = anime.duration || "N/A";
    const rating = anime.rating || "N/A";

    const url = anime.url;
    const genres = anime.genres && anime.genres.length > 0 ? anime.genres.map(g => g.name).join(", ") : "N/A";

    let synopsis = "Tidak ada sinopsis.";
    if (anime.synopsis) {
        synopsis = anime.synopsis.replace(/\[Written by MAL Rewrite\]/i, "").trim();
    }

    let imageUrl = null;
    if (anime.images?.jpg?.large_image_url) {
        imageUrl = anime.images.jpg.large_image_url;
    } else if (anime.images?.jpg?.image_url) {
        imageUrl = anime.images.jpg.image_url;
    }

    // Tentukan mode tampilan: flag eksplisit > preferensi user di DB > fallback default "ui"
    const normalizedSender = resolveUserId(sender);
    const userData = getUser(normalizedSender);
    const displayMode = forcedMode || (userData.meta?.displayMode ?? "ui");

    if (displayMode === "ui") {
        try {
            let cardBody = "";
            if (imageUrl) {
                cardBody += `<div style="text-align:center;margin-bottom:12px;border-radius:14px;overflow:hidden;border:1px solid var(--border);">` +
                    `<img src="${imageUrl}" alt="${title}" style="width:100%;max-height:260px;object-fit:cover;display:block;" onerror="this.style.display='none'" />` +
                    `</div>`;
            }

            const cardHtml = renderCard({
                icon: "🎌",
                title: title,
                subtitle: titleEng ? `${titleEng.replace(/[()]/g, '').trim()} • ${type}` : type,
                rows: [
                    { label: "Score", value: `⭐ ${score}` },
                    { label: "Rank", value: `#${rank} (Pop #${popularity})` },
                    { label: "Episodes", value: `${episodes} Eps (${duration})` },
                    { label: "Status", value: status },
                    { label: "Season", value: seasonYear },
                    { label: "Studio", value: studios },
                    { label: "Rating", value: rating }
                ],
                sections: [
                    {
                        title: "🎭 Genres",
                        rows: [
                            { label: "List", value: genres }
                        ]
                    },
                    {
                        title: "📝 Synopsis",
                        rows: [
                            { label: "Summary", value: synopsis.length > 320 ? synopsis.slice(0, 317) + "..." : synopsis }
                        ]
                    }
                ]
            });

            const pageHtml = renderPage({
                title: "🎌 Anime Information",
                badge: score !== "N/A" ? `⭐ ${score}` : "MAL",
                body: cardBody + cardHtml
            });

            await sendUI(sock, message.chat, {
                title: `🎌 ${title} (${score !== "N/A" ? "⭐ " + score : type})`,
                html: pageHtml
            });
            return;
        } catch (uiErr) {
            console.error("[Anime UI Error - Fallback to Text]", uiErr);
            // Fallback ke mode teks di bawah jika sendUI gagal
        }
    }

    let captionText = `🎌 *${title}*${titleEng}\n\n`;
    captionText += `🔗 *MyAnimeList:* ${url}\n\n`;
    captionText += `⭐ *Score:* ${score}\n`;
    captionText += `🏆 *Rank:* #${rank} | 📈 *Popularity:* #${popularity}\n`;
    captionText += `📺 *Type:* ${type}\n`;
    captionText += `🎬 *Episodes:* ${episodes}\n`;
    captionText += `⏳ *Status:* ${status}\n`;
    captionText += `📅 *Season:* ${seasonYear}\n`;
    captionText += `🎥 *Studio:* ${studios}\n`;
    captionText += `⏱️ *Duration:* ${duration}\n`;
    captionText += `⚠️ *Rating:* ${rating}\n`;
    captionText += `🎭 *Genres:* ${genres}\n\n`;
    captionText += `📝 *Synopsis:*\n${synopsis}`;

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
