import axios from "axios";
import https from "https";
import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, renderCard, renderList } from "../lib/uiEngine.js";

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

function generateListUI(results, page, query) {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = results.slice(start, end);

    const items = currentItems.map((anime, index) => {
        let year = anime.year || (anime.aired?.prop?.from?.year) || "N/A";
        return {
            icon: "🎌",
            title: `${start + index + 1}. ${anime.title}`,
            desc: `${anime.type || "TV"} • ⭐ ${anime.score || "N/A"} • ${anime.episodes || "?"} Eps • ${year}`,
            onClick: `showAnimeDetail(${start + index})`
        };
    });

    const listHtml = renderList({
        icon: "🔍",
        title: "Daftar Anime",
        subtitle: `Pencarian: "${query}" (Halaman ${page + 1}/${totalPages})`,
        items
    });

    const helpCard = `<div class="ui-card ui-mt-sm" style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text-accent);">` +
        `👆 <b>Ketuk anime di atas</b> untuk membuka detail langsung.` +
        (totalPages > 1 ? `<br><span style="color:var(--text-muted);font-size:10px;">Atau balas chat dengan <b>n</b> / <b>b</b> untuk ganti halaman.</span>` : "") +
        `</div>`;

    const detailScreenHtml = `
<div id="screenDetail" class="ui-screen">
  <div style="margin-bottom:12px;">
    <button type="button" class="ui-btn" onclick="backToList()" style="width:auto;padding:8px 14px;">
      ‹ Kembali ke Daftar
    </button>
  </div>
  <div id="detailImgContainer" style="text-align:center;margin-bottom:12px;border-radius:14px;overflow:hidden;border:1px solid var(--border);display:none;">
    <img id="detailImg" src="" alt="Poster" style="width:100%;max-height:260px;object-fit:cover;display:block;" onerror="this.style.display='none'" />
  </div>
  <div class="ui-card">
    <div class="ui-card-header">
      <div class="ui-card-icon">🎌</div>
      <div class="ui-card-title" id="detailTitle"></div>
      <div class="ui-card-subtitle" id="detailSubtitle"></div>
    </div>
    <div class="ui-row"><div class="ui-row-icon">⭐</div><div class="ui-row-label">Score</div><div class="ui-row-value" id="rowScore"></div></div>
    <div class="ui-row"><div class="ui-row-icon">🏆</div><div class="ui-row-label">Rank</div><div class="ui-row-value" id="rowRank"></div></div>
    <div class="ui-row"><div class="ui-row-icon">🎬</div><div class="ui-row-label">Episodes</div><div class="ui-row-value" id="rowEpisodes"></div></div>
    <div class="ui-row"><div class="ui-row-icon">⏳</div><div class="ui-row-label">Status</div><div class="ui-row-value" id="rowStatus"></div></div>
    <div class="ui-row"><div class="ui-row-icon">📅</div><div class="ui-row-label">Season</div><div class="ui-row-value" id="rowSeason"></div></div>
    <div class="ui-row"><div class="ui-row-icon">🎥</div><div class="ui-row-label">Studio</div><div class="ui-row-value" id="rowStudio"></div></div>
    <div class="ui-row"><div class="ui-row-icon">⚠️</div><div class="ui-row-label">Rating</div><div class="ui-row-value" id="rowRating"></div></div>
    <div class="ui-section">
      <div class="ui-section-title">🎭 Genres</div>
      <div class="ui-row"><div class="ui-row-icon">🏷️</div><div class="ui-row-label">List</div><div class="ui-row-value" id="rowGenres"></div></div>
    </div>
    <div class="ui-section">
      <div class="ui-section-title">📝 Synopsis</div>
      <div style="padding:12px 14px;font-size:12px;line-height:1.5;color:var(--text-value);" id="rowSynopsis"></div>
    </div>
  </div>
  <a id="detailMalBtn" href="#" target="_blank" class="ui-btn ui-mt-sm" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-align:center;padding:12px;display:none;">
    🔗 Buka di MyAnimeList
  </a>
</div>`;

    const safeAnimeData = JSON.stringify(results.map(a => {
        let year = a.year || (a.aired?.prop?.from?.year) || "N/A";
        let season = a.season ? a.season.charAt(0).toUpperCase() + a.season.slice(1) : "";
        let seasonYear = season && year ? `${season} ${year}` : (season || year || "N/A");
        return {
            title: a.title || "N/A",
            titleEng: a.title_english || "",
            type: a.type || "N/A",
            score: a.score ? String(a.score) : "N/A",
            rank: a.rank ? String(a.rank) : "N/A",
            popularity: a.popularity ? String(a.popularity) : "N/A",
            episodes: a.episodes ? String(a.episodes) : "?",
            duration: a.duration || "N/A",
            status: a.status || "N/A",
            seasonYear: seasonYear,
            studios: a.studios && a.studios.length > 0 ? a.studios.map(s => s.name).join(", ") : "N/A",
            rating: a.rating || "N/A",
            genres: a.genres && a.genres.length > 0 ? a.genres.map(g => g.name).join(", ") : "N/A",
            synopsis: (a.synopsis ? a.synopsis.replace(/\[Written by MAL Rewrite\]/i, "").trim() : "Tidak ada sinopsis."),
            image: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
            url: a.url || ""
        };
    })).replace(/</g, '\\u003c');

    const clientScript = `
<script>
var animeData = ${safeAnimeData};

function showAnimeDetail(idx) {
    var a = animeData[idx];
    if (!a) return;

    document.getElementById('detailTitle').innerText = a.title;
    document.getElementById('detailSubtitle').innerText = (a.titleEng ? a.titleEng + ' • ' : '') + a.type;

    var badge = document.querySelector('.ui-header .ui-badge');
    if (badge) badge.innerText = a.score !== 'N/A' ? '⭐ ' + a.score : a.type;

    var imgContainer = document.getElementById('detailImgContainer');
    var imgEl = document.getElementById('detailImg');
    if (a.image) {
        imgEl.src = a.image;
        imgEl.style.display = 'block';
        imgContainer.style.display = 'block';
    } else {
        imgContainer.style.display = 'none';
    }

    document.getElementById('rowScore').innerText = '⭐ ' + a.score;
    document.getElementById('rowRank').innerText = '#' + a.rank + ' (Pop #' + a.popularity + ')';
    document.getElementById('rowEpisodes').innerText = a.episodes + ' Eps (' + a.duration + ')';
    document.getElementById('rowStatus').innerText = a.status;
    document.getElementById('rowSeason').innerText = a.seasonYear;
    document.getElementById('rowStudio').innerText = a.studios;
    document.getElementById('rowRating').innerText = a.rating;
    document.getElementById('rowGenres').innerText = a.genres;
    document.getElementById('rowSynopsis').innerText = a.synopsis;

    var malBtn = document.getElementById('detailMalBtn');
    if (a.url) {
        malBtn.href = a.url;
        malBtn.style.display = 'flex';
    } else {
        malBtn.style.display = 'none';
    }

    document.getElementById('screenList').classList.remove('active');
    document.getElementById('screenDetail').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToList() {
    var badge = document.querySelector('.ui-header .ui-badge');
    if (badge) badge.innerText = 'Page ${page + 1}/${totalPages}';
    document.getElementById('screenDetail').classList.remove('active');
    document.getElementById('screenList').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>`;

    const bodyHtml = `
<div id="screenList" class="ui-screen active">
  ${listHtml}
  ${helpCard}
</div>
${detailScreenHtml}
${clientScript}`;

    return renderPage({
        title: "🎌 Anime Search",
        badge: `Page ${page + 1}/${totalPages}`,
        body: bodyHtml
    });
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

        const normalizedSender = resolveUserId(sender);
        const userData = getUser(normalizedSender);
        const userPref = userData.meta?.displayMode ?? "ui";
        const displayMode = forcedMode || userPref;

        console.log(`[Anime] Query: "${query}" | Sender: ${normalizedSender} | Flag: ${forcedMode || "none"} | UserDB: ${userPref} | Mode: ${displayMode} | Direct: ${isDirect}`);

        try {
            const response = await axios.get(`https://api.tenrai.org/v1/anime?q=${encodeURIComponent(query)}&limit=20`, {
                timeout: 15000, // Timeout 15 detik
                httpsAgent: new https.Agent({ family: 4 }), // Paksa IPv4
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.data || !response.data.data || response.data.data.length === 0) {
                console.log(`[Anime] No results found for query: "${query}"`);
                await message.reply(`❌ Anime dengan kata kunci *${query}* tidak ditemukan di database.`);
                return;
            }

            const results = response.data.data;
            console.log(`[Anime] Found ${results.length} results for "${query}"`);

            if (isDirect || results.length === 1) {
                console.log(`[Anime] Directly rendering detail for "${results[0].title}" (Mode: ${displayMode})`);
                await sendAnimeDetail(results[0], message, sock, sender, forcedMode);
                return;
            }

            if (displayMode === "ui") {
                console.log(`[Anime UI] Dispatching search list UI for "${query}" (Page 1)`);
                try {
                    const html = generateListUI(results, 0, query);
                    const sent = await sendUI(sock, message.chat, {
                        title: `🎌 Anime Search: "${query}"`,
                        html
                    });
                    console.log(`[Anime UI] Search list UI successfully dispatched. Message ID: ${sent?.messageId}`);

                    registerReplyHandler(sent.messageId, replyHandler, {
                        results,
                        page: 0,
                        query,
                        userId: sender,
                        messageKey: sent.key,
                        commandName: "anime",
                        forcedMode,
                        displayMode: "ui"
                    });
                    return;
                } catch (uiErr) {
                    console.error("[Anime UI Error] Failed to send search list UI, falling back to text:", uiErr);
                    // Fallback to text below
                }
            }

            console.log(`[Anime Text] Dispatching search list as text for "${query}" (Page 1)`);
            const text = generateListText(results, 0, query);
            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                query,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "anime",
                forcedMode,
                displayMode: "text"
            });

        } catch (err) {
            let errorMsg = err.message || "Unknown error";
            if (err.response) {
                errorMsg = `HTTP ${err.response.status}: ${err.response.statusText}`;
                console.error("[Anime Command Error (Response)]:", errorMsg, err.response.data);
            } else if (err.request) {
                console.error("[Anime Command Error (Request)]:", errorMsg);
            } else {
                console.error("[Anime Command Error]:", err);
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
    const { results, page, query, messageKey, displayMode, forcedMode } = state;
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);

    if (text === "n" || text === "next") {
        if (page < totalPages - 1) {
            state.page += 1;
            console.log(`[Anime Reply] Pagination next -> Page ${state.page + 1}/${totalPages} (Mode: ${displayMode})`);

            if (displayMode === "ui") {
                try {
                    const html = generateListUI(results, state.page, query);
                    const sent = await sendUI(sock, message.chat, {
                        title: `🎌 Anime Search: "${query}"`,
                        html
                    });
                    deleteReplyHandler(messageKey.id);
                    state.messageKey = sent.key;
                    registerReplyHandler(sent.messageId, replyHandler, state);
                    return;
                } catch (err) {
                    console.error("[Anime Reply UI Error] Failed to update UI page, falling back to text:", err);
                }
            }

            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            console.log(`[Anime Reply] Pagination back -> Page ${state.page + 1}/${totalPages} (Mode: ${displayMode})`);

            if (displayMode === "ui") {
                try {
                    const html = generateListUI(results, state.page, query);
                    const sent = await sendUI(sock, message.chat, {
                        title: `🎌 Anime Search: "${query}"`,
                        html
                    });
                    deleteReplyHandler(messageKey.id);
                    state.messageKey = sent.key;
                    registerReplyHandler(sent.messageId, replyHandler, state);
                    return;
                } catch (err) {
                    console.error("[Anime Reply UI Error] Failed to update UI page, falling back to text:", err);
                }
            }

            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= results.length) {
        const anime = results[num - 1];

        deleteReplyHandler(messageKey.id);
        console.log(`[Anime Reply] User selected #${num} "${anime.title}" (ForcedMode: ${forcedMode || "none"})`);

        if (displayMode !== "ui") {
            await sock.sendMessage(message.chat, { text: `>> *${anime.title}*`, edit: messageKey });
        }

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
    const userPref = userData.meta?.displayMode ?? "ui";
    const displayMode = forcedMode || userPref;

    console.log(`[Anime Detail] Rendering "${title}" | Sender: ${normalizedSender} | Flag: ${forcedMode || "none"} | UserDB: ${userPref} | Mode: ${displayMode}`);

    if (displayMode === "ui") {
        try {
            console.log(`[Anime UI] Building detail card for "${title}"...`);
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
                body: cardBody + cardHtml + (url ? `<a href="${url}" target="_blank" class="ui-btn ui-mt-sm" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-align:center;padding:12px;">🔗 Buka di MyAnimeList</a>` : "")
            });

            const sent = await sendUI(sock, message.chat, {
                title: `🎌 ${title} (${score !== "N/A" ? "⭐ " + score : type})`,
                html: pageHtml
            });
            console.log(`[Anime UI] Detail card successfully sent to ${message.chat}. ID: ${sent?.messageId}`);
            return;
        } catch (uiErr) {
            console.error("[Anime UI Error] Failed to send detail card, falling back to text. Error:", uiErr);
            // Fallback ke mode teks di bawah jika sendUI gagal
        }
    }

    console.log(`[Anime Text] Sending detail as text + media for "${title}"`);
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
