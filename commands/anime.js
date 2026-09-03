import axios from "axios";
import https from "https";
import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage } from "../lib/uiEngine.js";

const ITEMS_PER_PAGE = 5;

/**
 * Fetch remote image and convert it to a self-contained Base64 Data URI.
 * This guarantees the image displays inside WhatsApp's sandboxed webview
 * without being blocked by CSP or cross-origin network policies.
 */
async function fetchImageAsBase64(url) {
    if (!url) return null;
    try {
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 4000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const contentType = res.headers["content-type"] || "image/jpeg";
        return `data:${contentType};base64,${Buffer.from(res.data).toString("base64")}`;
    } catch (err) {
        console.warn(`[Anime Image] Failed to convert image to Base64 for ${url}:`, err.message);
        return null;
    }
}

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

function generateListUI(results, query) {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);

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
            year: String(year),
            studios: a.studios && a.studios.length > 0 ? a.studios.map(s => s.name).join(", ") : "N/A",
            rating: a.rating || "N/A",
            genres: a.genres && a.genres.length > 0 ? a.genres.map(g => g.name) : [],
            synopsis: (a.synopsis ? a.synopsis.replace(/\[Written by MAL Rewrite\]/i, "").trim() : "Tidak ada sinopsis."),
            image: a.imageBase64 || a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
            url: a.url || ""
        };
    })).replace(/</g, '\\u003c');

    // Minimal, flat CSS overrides scoped to anime UI
    const animeStyles = `
.ui-page{background:#0d0f13;border:none;box-shadow:none;border-radius:0;padding:16px}
.ui-header{border-bottom:1px solid #1e2028;padding-bottom:12px;margin-bottom:16px}
.ui-header-title{font-size:15px;font-weight:700;letter-spacing:0;color:#e4e4e7}
.ui-badge{background:none;border:1px solid #2a2d37;border-radius:4px;font-size:10px;color:#71717a;font-weight:600;letter-spacing:0;text-transform:none;padding:3px 8px}

/* Search list */
.a-search-label{font-size:11px;color:#71717a;margin-bottom:12px;font-weight:500}
.a-list{display:flex;flex-direction:column;gap:1px;background:#18191f;border-radius:6px;overflow:hidden}
.a-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0d0f13;cursor:pointer;transition:background .1s}
.a-item:active{background:#18191f}
.a-thumb{width:38px;height:54px;border-radius:3px;overflow:hidden;flex-shrink:0;background:#18191f}
.a-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.a-thumb-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;color:#3f3f46}
.a-info{flex:1;min-width:0}
.a-title{font-size:13px;font-weight:600;color:#e4e4e7;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.a-meta{font-size:10px;color:#71717a;margin-top:2px}
.a-score{font-size:11px;color:#a1a1aa;font-weight:600;flex-shrink:0;text-align:right}
.a-score span{color:#facc15;font-size:10px}

/* Pagination */
.a-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
.a-pager-btn{background:none;border:1px solid #2a2d37;border-radius:4px;color:#a1a1aa;font-size:11px;font-weight:600;padding:6px 14px;cursor:pointer;transition:border-color .1s}
.a-pager-btn:active{border-color:#52525b}
.a-pager-btn[disabled]{opacity:.25;pointer-events:none}
.a-pager-info{font-size:10px;color:#52525b;font-weight:500}

/* Detail screen */
.a-back{background:none;border:none;color:#71717a;font-size:12px;font-weight:500;cursor:pointer;padding:0;margin-bottom:16px;display:inline-flex;align-items:center;gap:4px}
.a-back:active{color:#a1a1aa}
.a-poster{display:flex;justify-content:center;margin-bottom:16px}
.a-poster img{width:140px;height:200px;object-fit:cover;border-radius:4px;display:block}
.a-detail-title{font-size:16px;font-weight:700;color:#e4e4e7;line-height:1.3;text-align:center}
.a-detail-sub{font-size:11px;color:#71717a;text-align:center;margin-top:4px}
.a-detail-score{text-align:center;margin-top:10px;font-size:20px;font-weight:700;color:#e4e4e7}
.a-detail-score small{font-size:11px;color:#52525b;font-weight:500;margin-left:4px}

.a-table{width:100%;margin-top:16px;border-top:1px solid #1e2028}
.a-table-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2028;font-size:12px}
.a-table-label{color:#71717a;font-weight:500}
.a-table-value{color:#a1a1aa;font-weight:500;text-align:right;max-width:60%}

.a-section-label{font-size:10px;color:#52525b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:16px;margin-bottom:8px}
.a-tags{display:flex;flex-wrap:wrap;gap:4px}
.a-tag{font-size:10px;color:#a1a1aa;background:#18191f;border:1px solid #1e2028;border-radius:3px;padding:2px 8px;font-weight:500}
.a-synopsis{font-size:12px;color:#a1a1aa;line-height:1.6;margin-top:4px}
`;

    const detailScreenHtml = `
<div id="screenDetail" class="ui-screen">
  <button type="button" class="a-back" onclick="backToList()">← Kembali</button>
  <div id="detailImgContainer" class="a-poster" style="display:none;">
    <img id="detailImg" alt="Poster" referrerpolicy="no-referrer" />
  </div>
  <div class="a-detail-title" id="detailTitle"></div>
  <div class="a-detail-sub" id="detailSubtitle"></div>
  <div class="a-detail-score" id="detailScore"></div>

  <div class="a-table">
    <div class="a-table-row"><span class="a-table-label">Type</span><span class="a-table-value" id="rowType"></span></div>
    <div class="a-table-row"><span class="a-table-label">Episodes</span><span class="a-table-value" id="rowEpisodes"></span></div>
    <div class="a-table-row"><span class="a-table-label">Status</span><span class="a-table-value" id="rowStatus"></span></div>
    <div class="a-table-row"><span class="a-table-label">Season</span><span class="a-table-value" id="rowSeason"></span></div>
    <div class="a-table-row"><span class="a-table-label">Studio</span><span class="a-table-value" id="rowStudio"></span></div>
    <div class="a-table-row"><span class="a-table-label">Rank</span><span class="a-table-value" id="rowRank"></span></div>
    <div class="a-table-row"><span class="a-table-label">Rating</span><span class="a-table-value" id="rowRating"></span></div>
  </div>

  <div class="a-section-label">Genres</div>
  <div class="a-tags" id="rowGenres"></div>

  <div class="a-section-label">Synopsis</div>
  <div class="a-synopsis" id="rowSynopsis"></div>
</div>`;

    const clientScript = `
<script>
var animeData = ${safeAnimeData};
var currentPage = 0;
var itemsPerPage = 5;
var totalPages = Math.ceil(animeData.length / itemsPerPage);

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderPageItems(page) {
    currentPage = page;
    var start = page * itemsPerPage;
    var end = Math.min(start + itemsPerPage, animeData.length);
    var container = document.getElementById('listItemsContainer');
    if (!container) return;

    var html = '';
    for (var i = start; i < end; i++) {
        var anime = animeData[i];
        var thumbHtml = anime.image
            ? '<img src="' + anime.image + '" alt="" referrerpolicy="no-referrer" />'
            : '<div class="a-thumb-empty">—</div>';

        html += '<div class="a-item" onclick="showAnimeDetail(' + i + ')" role="button" tabindex="0">';
        html += '<div class="a-thumb">' + thumbHtml + '</div>';
        html += '<div class="a-info">';
        html += '<div class="a-title">' + escHtml(anime.title) + '</div>';
        html += '<div class="a-meta">' + escHtml(anime.type) + ' · ' + escHtml(anime.episodes) + ' eps · ' + escHtml(anime.year) + '</div>';
        html += '</div>';
        if (anime.score !== 'N/A') {
            html += '<div class="a-score"><span>★</span> ' + escHtml(anime.score) + '</div>';
        }
        html += '</div>';
    }

    container.innerHTML = html;

    var indicator = document.getElementById('pageIndicator');
    if (indicator) indicator.innerText = (currentPage + 1) + ' / ' + (totalPages || 1);

    var topBadge = document.querySelector('.ui-header .ui-badge');
    if (topBadge) topBadge.innerText = (currentPage + 1) + '/' + (totalPages || 1);

    var prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.disabled = (currentPage === 0);

    var nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.disabled = (currentPage >= totalPages - 1);
}

function changePage(delta) {
    var newPage = currentPage + delta;
    if (newPage >= 0 && newPage < totalPages) {
        renderPageItems(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showAnimeDetail(idx) {
    var a = animeData[idx];
    if (!a) return;

    document.getElementById('detailTitle').innerText = a.title;
    var subParts = [];
    if (a.titleEng) subParts.push(a.titleEng);
    subParts.push(a.type);
    document.getElementById('detailSubtitle').innerText = subParts.join(' · ');

    var scoreEl = document.getElementById('detailScore');
    if (a.score !== 'N/A') {
        scoreEl.innerHTML = a.score + '<small> / 10</small>';
    } else {
        scoreEl.innerHTML = '—';
    }

    var badge = document.querySelector('.ui-header .ui-badge');
    if (badge) badge.innerText = a.score !== 'N/A' ? '★ ' + a.score : a.type;

    var imgContainer = document.getElementById('detailImgContainer');
    var imgEl = document.getElementById('detailImg');
    if (a.image) {
        imgEl.src = a.image;
        imgContainer.style.display = 'flex';
    } else {
        imgContainer.style.display = 'none';
    }

    document.getElementById('rowType').innerText = a.type;
    document.getElementById('rowEpisodes').innerText = a.episodes + ' eps · ' + a.duration;
    document.getElementById('rowStatus').innerText = a.status;
    document.getElementById('rowSeason').innerText = a.seasonYear;
    document.getElementById('rowStudio').innerText = a.studios;
    document.getElementById('rowRank').innerText = '#' + a.rank + ' (Popularity #' + a.popularity + ')';
    document.getElementById('rowRating').innerText = a.rating;

    // Render genres as tags
    var genresContainer = document.getElementById('rowGenres');
    var genres = Array.isArray(a.genres) ? a.genres : (a.genres ? a.genres.split(', ') : []);
    genresContainer.innerHTML = genres.map(function(g) {
        return '<span class="a-tag">' + escHtml(g) + '</span>';
    }).join('');

    document.getElementById('rowSynopsis').innerText = a.synopsis;

    document.getElementById('screenList').classList.remove('active');
    document.getElementById('screenDetail').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToList() {
    var badge = document.querySelector('.ui-header .ui-badge');
    if (badge) badge.innerText = (currentPage + 1) + '/' + (totalPages || 1);
    document.getElementById('screenDetail').classList.remove('active');
    document.getElementById('screenList').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

renderPageItems(0);
</script>`;

    const bodyHtml = `
<div id="screenList" class="ui-screen active">
  <div class="a-search-label">Hasil pencarian "${query}" · ${results.length} ditemukan</div>
  <div class="a-list" id="listItemsContainer"></div>
  <div class="a-pager">
    <button type="button" class="a-pager-btn" id="prevPageBtn" onclick="changePage(-1)" disabled>← Prev</button>
    <span class="a-pager-info" id="pageIndicator">1 / ${totalPages || 1}</span>
    <button type="button" class="a-pager-btn" id="nextPageBtn" onclick="changePage(1)" ${totalPages <= 1 ? "disabled" : ""}>Next →</button>
  </div>
</div>
${detailScreenHtml}
${clientScript}`;

    return renderPage({
        title: "Anime Search",
        badge: `${results.length} results`,
        body: bodyHtml,
        styles: animeStyles
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
                const preloadCount = Math.min(results.length, 10);
                console.log(`[Anime UI] Pre-fetching poster images for top ${preloadCount} items...`);
                await Promise.all(results.slice(0, preloadCount).map(async (anime) => {
                    const imgUrl = anime.images?.jpg?.image_url || anime.images?.jpg?.large_image_url;
                    if (imgUrl && !anime.imageBase64) {
                        anime.imageBase64 = await fetchImageAsBase64(imgUrl);
                    }
                }));

                console.log(`[Anime UI] Dispatching interactive search list UI for "${query}"`);
                try {
                    const html = generateListUI(results, query);
                    const sent = await sendUI(sock, message.chat, {
                        title: `🎌 Anime Search: "${query}"`,
                        html
                    });
                    console.log(`[Anime UI] Search list UI successfully dispatched. Message ID: ${sent?.messageId}`);

                    // Auto-delete HTML webview payload after 2 minutes to prevent viewport lag spikes
                    if (sent?.key) {
                        setTimeout(() => {
                            sock.sendMessage(message.chat, { delete: sent.key }).catch(() => {});
                        }, 120000);
                    }
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

            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            console.log(`[Anime Reply] Pagination back -> Page ${state.page + 1}/${totalPages} (Mode: ${displayMode})`);

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
            console.log(`[Anime UI] Pre-fetching image as Base64 for "${title}"...`);
            const imageBase64 = anime.imageBase64 || await fetchImageAsBase64(imageUrl);
            const finalImageSrc = imageBase64 || imageUrl;

            // Same minimal CSS as generateListUI
            const animeStyles = `
.ui-page{background:#0d0f13;border:none;box-shadow:none;border-radius:0;padding:16px}
.ui-header{border-bottom:1px solid #1e2028;padding-bottom:12px;margin-bottom:16px}
.ui-header-title{font-size:15px;font-weight:700;letter-spacing:0;color:#e4e4e7}
.ui-badge{background:none;border:1px solid #2a2d37;border-radius:4px;font-size:10px;color:#71717a;font-weight:600;letter-spacing:0;text-transform:none;padding:3px 8px}
.a-poster{display:flex;justify-content:center;margin-bottom:16px}
.a-poster img{width:140px;height:200px;object-fit:cover;border-radius:4px;display:block}
.a-detail-title{font-size:16px;font-weight:700;color:#e4e4e7;line-height:1.3;text-align:center}
.a-detail-sub{font-size:11px;color:#71717a;text-align:center;margin-top:4px}
.a-detail-score{text-align:center;margin-top:10px;font-size:20px;font-weight:700;color:#e4e4e7}
.a-detail-score small{font-size:11px;color:#52525b;font-weight:500;margin-left:4px}
.a-table{width:100%;margin-top:16px;border-top:1px solid #1e2028}
.a-table-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2028;font-size:12px}
.a-table-label{color:#71717a;font-weight:500}
.a-table-value{color:#a1a1aa;font-weight:500;text-align:right;max-width:60%}
.a-section-label{font-size:10px;color:#52525b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:16px;margin-bottom:8px}
.a-tags{display:flex;flex-wrap:wrap;gap:4px}
.a-tag{font-size:10px;color:#a1a1aa;background:#18191f;border:1px solid #1e2028;border-radius:3px;padding:2px 8px;font-weight:500}
.a-synopsis{font-size:12px;color:#a1a1aa;line-height:1.6;margin-top:4px}
`;

            const genreList = anime.genres && anime.genres.length > 0
                ? anime.genres.map(g => g.name)
                : [];

            let bodyHtml = "";

            if (finalImageSrc) {
                bodyHtml += `<div class="a-poster"><img src="${finalImageSrc}" alt="${title}" referrerpolicy="no-referrer" /></div>`;
            }

            bodyHtml += `<div class="a-detail-title">${title}</div>`;
            bodyHtml += `<div class="a-detail-sub">${titleEng ? titleEng.replace(/[()]/g, '').trim() + ' · ' : ''}${type}</div>`;
            bodyHtml += `<div class="a-detail-score">${score !== "N/A" ? score + '<small> / 10</small>' : '—'}</div>`;

            bodyHtml += `<div class="a-table">`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Type</span><span class="a-table-value">${type}</span></div>`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Episodes</span><span class="a-table-value">${episodes} eps · ${duration}</span></div>`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Status</span><span class="a-table-value">${status}</span></div>`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Season</span><span class="a-table-value">${seasonYear}</span></div>`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Studio</span><span class="a-table-value">${studios}</span></div>`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Rank</span><span class="a-table-value">#${rank} (Popularity #${popularity})</span></div>`;
            bodyHtml += `<div class="a-table-row"><span class="a-table-label">Rating</span><span class="a-table-value">${rating}</span></div>`;
            bodyHtml += `</div>`;

            if (genreList.length > 0) {
                bodyHtml += `<div class="a-section-label">Genres</div>`;
                bodyHtml += `<div class="a-tags">${genreList.map(g => `<span class="a-tag">${g}</span>`).join('')}</div>`;
            }

            bodyHtml += `<div class="a-section-label">Synopsis</div>`;
            bodyHtml += `<div class="a-synopsis">${synopsis}</div>`;

            const pageHtml = renderPage({
                title: "Anime",
                badge: score !== "N/A" ? `★ ${score}` : "MAL",
                body: bodyHtml,
                styles: animeStyles
            });

            const sent = await sendUI(sock, message.chat, {
                title: `${title} (${score !== "N/A" ? "★ " + score : type})`,
                html: pageHtml
            });
            console.log(`[Anime UI] Detail card successfully sent to ${message.chat}. ID: ${sent?.messageId}`);

            // Auto-delete HTML webview payload after 2 minutes to prevent viewport lag spikes
            if (sent?.key) {
                setTimeout(() => {
                    sock.sendMessage(message.chat, { delete: sent.key }).catch(() => {});
                }, 120000);
            }
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
