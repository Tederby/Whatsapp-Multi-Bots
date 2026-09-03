import axios from "axios";
import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { formatRupiah, sendSteamGameDetail, fetchImageAsBase64 } from "../services/steam.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, esc } from "../lib/uiEngine.js";

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

    let text = `╭━━━〔 🎮 STEAM SEARCH 〕━━━\n`;
    text += `┃ 🔍 Query : ${query}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((game, index) => {
        let priceText = "Gratis / Tidak Tersedia";
        if (game.price) {
            if (game.price.initial > game.price.final) {
                priceText = `~${formatRupiah(game.price.initial)}~ ➡️ *${formatRupiah(game.price.final)}*`;
            } else {
                priceText = `*${formatRupiah(game.price.final)}*`;
            }
        }

        let platforms = [];
        if (game.platforms) {
            if (game.platforms.windows) platforms.push("Win");
            if (game.platforms.mac) platforms.push("Mac");
            if (game.platforms.linux) platforms.push("Linux");
        }
        let platText = platforms.length > 0 ? platforms.join(", ") : "N/A";
        let metaText = game.metascore ? game.metascore : "N/A";

        text += `╭───「 ${start + index + 1}. ${game.name} 」\n`;
        text += `│ 💰 ${priceText} | 💻 ${platText} | 🌟 ${metaText}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk memilih. Ketik "n" next, "b" back._`;

    return text.trim();
}

function generateListUI(items, query) {
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    const safeGameData = JSON.stringify(items).replace(/</g, '\\u003c');

    // Minimal, flat CSS scoped to Steam UI (landscape artwork)
    const steamStyles = `
.ui-page{background:#0d0f13;border:none;box-shadow:none;border-radius:0;padding:16px}
.ui-header{border-bottom:1px solid #1e2028;padding-bottom:12px;margin-bottom:16px}
.ui-header-title{font-size:15px;font-weight:700;letter-spacing:0;color:#e4e4e7}
.ui-badge{background:none;border:1px solid #2a2d37;border-radius:4px;font-size:10px;color:#71717a;font-weight:600;letter-spacing:0;text-transform:none;padding:3px 8px}

/* Search list */
.s-search-label{font-size:11px;color:#71717a;margin-bottom:12px;font-weight:500}
.s-list{display:flex;flex-direction:column;gap:1px;background:#18191f;border-radius:6px;overflow:hidden}
.s-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0d0f13;cursor:pointer;transition:background .1s}
.s-item:active{background:#18191f}
.s-thumb{width:72px;height:32px;border-radius:3px;overflow:hidden;flex-shrink:0;background:#18191f}
.s-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.s-thumb-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#3f3f46}
.s-info{flex:1;min-width:0}
.s-title{font-size:13px;font-weight:600;color:#e4e4e7;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.s-meta{font-size:10px;color:#71717a;margin-top:2px;display:flex;align-items:center;gap:6px}
.s-plat-badge{color:#71717a;font-weight:500}
.s-right{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0}
.s-price{font-size:11px;color:#e4e4e7;font-weight:600;text-align:right}
.s-price.green{color:#a4d007}
.s-discount{font-size:9px;color:#a4d007;background:#4c6b22;padding:1px 4px;border-radius:2px;font-weight:700;margin-left:4px}

/* Pagination */
.s-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
.s-pager-btn{background:none;border:1px solid #2a2d37;border-radius:4px;color:#a1a1aa;font-size:11px;font-weight:600;padding:6px 14px;cursor:pointer;transition:border-color .1s}
.s-pager-btn:active{border-color:#52525b}
.s-pager-btn[disabled]{opacity:.25;pointer-events:none}
.s-pager-info{font-size:10px;color:#52525b;font-weight:500}

/* Detail screen */
.s-back{background:none;border:none;color:#71717a;font-size:12px;font-weight:500;cursor:pointer;padding:0;margin-bottom:14px;display:inline-flex;align-items:center;gap:4px}
.s-back:active{color:#a1a1aa}
.s-banner{width:100%;margin-bottom:14px;display:flex;justify-content:center}
.s-banner img{width:100%;max-width:380px;height:auto;aspect-ratio:460/215;border-radius:4px;display:block;object-fit:cover}
.s-detail-title{font-size:16px;font-weight:700;color:#e4e4e7;line-height:1.3;text-align:center}
.s-detail-sub{font-size:11px;color:#71717a;text-align:center;margin-top:4px}

.s-price-box{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px}
.s-discount-badge{background:#4c6b22;color:#a4d007;font-size:11px;font-weight:700;padding:2px 6px;border-radius:3px}
.s-price-strike{font-size:12px;color:#71717a;text-decoration:line-through}
.s-price-final{font-size:18px;font-weight:700;color:#e4e4e7}
.s-price-final.green{color:#a4d007}

.s-table{width:100%;margin-top:16px;border-top:1px solid #1e2028}
.s-table-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2028;font-size:12px}
.s-table-label{color:#71717a;font-weight:500}
.s-table-value{color:#a1a1aa;font-weight:500;text-align:right;max-width:60%}

.s-section-label{font-size:10px;color:#52525b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:16px;margin-bottom:8px}
.s-tags{display:flex;flex-wrap:wrap;gap:4px}
.s-tag{font-size:10px;color:#a1a1aa;background:#18191f;border:1px solid #1e2028;border-radius:3px;padding:2px 8px;font-weight:500}
.s-desc{font-size:12px;color:#a1a1aa;line-height:1.6;margin-top:4px}
`;

    const detailScreenHtml = `
<div id="screenDetail" class="ui-screen">
  <button type="button" class="s-back" onclick="backToList()">← Kembali</button>
  <div id="detailImgContainer" class="s-banner" style="display:none;">
    <img id="detailImg" alt="Banner" referrerpolicy="no-referrer" />
  </div>
  <div class="s-detail-title" id="detailTitle"></div>
  <div class="s-detail-sub" id="detailSubtitle"></div>
  <div class="s-price-box" id="detailPriceBox"></div>

  <div class="s-table">
    <div class="s-table-row"><span class="s-table-label">Developer</span><span class="s-table-value" id="rowDeveloper"></span></div>
    <div class="s-table-row"><span class="s-table-label">Publisher</span><span class="s-table-value" id="rowPublisher"></span></div>
    <div class="s-table-row"><span class="s-table-label">Rilis</span><span class="s-table-value" id="rowRelease"></span></div>
    <div class="s-table-row"><span class="s-table-label">Platform</span><span class="s-table-value" id="rowPlatforms"></span></div>
    <div class="s-table-row"><span class="s-table-label">Controller</span><span class="s-table-value" id="rowController"></span></div>
    <div class="s-table-row"><span class="s-table-label">Metascore</span><span class="s-table-value" id="rowMetascore"></span></div>
  </div>

  <div class="s-section-label">Genres</div>
  <div class="s-tags" id="rowGenres"></div>

  <div class="s-section-label">Deskripsi</div>
  <div class="s-desc" id="rowDesc"></div>
</div>`;

    const clientScript = `
<script>
var gameData = ${safeGameData};
var currentPage = 0;
var itemsPerPage = 5;
var totalPages = Math.ceil(gameData.length / itemsPerPage);

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
    var end = Math.min(start + itemsPerPage, gameData.length);
    var container = document.getElementById('listItemsContainer');
    if (!container) return;

    var html = '';
    for (var i = start; i < end; i++) {
        var game = gameData[i];
        var thumbHtml = game.image
            ? '<img src="' + game.image + '" alt="" referrerpolicy="no-referrer" />'
            : '<div class="s-thumb-empty">—</div>';

        html += '<div class="s-item" onclick="showGameDetail(' + i + ')" role="button" tabindex="0">';
        html += '<div class="s-thumb">' + thumbHtml + '</div>';
        html += '<div class="s-info">';
        html += '<div class="s-title">' + escHtml(game.name) + '</div>';
        html += '<div class="s-meta">';
        if (game.platformsText) {
            html += '<span class="s-plat-badge">' + escHtml(game.platformsText) + '</span>';
        }
        if (game.metascore && game.metascore !== 'N/A') {
            html += '<span>· Meta ' + escHtml(game.metascore) + '</span>';
        }
        html += '</div>';
        html += '</div>';

        html += '<div class="s-right">';
        if (game.discountPercent > 0) {
            html += '<div class="s-price green">' + escHtml(game.finalPrice) + '<span class="s-discount">-' + game.discountPercent + '%</span></div>';
        } else if (game.isFree) {
            html += '<div class="s-price green">Free</div>';
        } else {
            html += '<div class="s-price">' + escHtml(game.finalPrice || 'N/A') + '</div>';
        }
        html += '</div>';
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

function showGameDetail(idx) {
    var g = gameData[idx];
    if (!g) return;

    document.getElementById('detailTitle').innerText = g.name;
    var subParts = [];
    if (g.developers && g.developers !== 'N/A') subParts.push(g.developers);
    if (g.releaseDate && g.releaseDate !== 'N/A') subParts.push(g.releaseDate);
    document.getElementById('detailSubtitle').innerText = subParts.join(' · ');

    var priceBox = document.getElementById('detailPriceBox');
    if (g.discountPercent > 0) {
        priceBox.innerHTML = '<span class="s-discount-badge">-' + g.discountPercent + '%</span>' +
            '<span class="s-price-strike">' + escHtml(g.initialPrice) + '</span>' +
            '<span class="s-price-final green">' + escHtml(g.finalPrice) + '</span>';
        priceBox.style.display = 'flex';
    } else if (g.isFree) {
        priceBox.innerHTML = '<span class="s-price-final green">Free to Play</span>';
        priceBox.style.display = 'flex';
    } else if (g.finalPrice && g.finalPrice !== 'N/A') {
        priceBox.innerHTML = '<span class="s-price-final">' + escHtml(g.finalPrice) + '</span>';
        priceBox.style.display = 'flex';
    } else {
        priceBox.style.display = 'none';
    }

    var badge = document.querySelector('.ui-header .ui-badge');
    if (badge) badge.innerText = (g.metascore && g.metascore !== 'N/A') ? 'Meta ' + g.metascore : 'Steam';

    var imgContainer = document.getElementById('detailImgContainer');
    var imgEl = document.getElementById('detailImg');
    var detailImgSrc = g.headerImage || g.image;
    if (detailImgSrc) {
        imgEl.src = detailImgSrc;
        imgContainer.style.display = 'flex';
    } else {
        imgContainer.style.display = 'none';
    }

    document.getElementById('rowDeveloper').innerText = g.developers || 'N/A';
    document.getElementById('rowPublisher').innerText = g.publishers || 'N/A';
    document.getElementById('rowRelease').innerText = g.releaseDate || 'N/A';
    document.getElementById('rowPlatforms').innerText = g.platformsText || 'N/A';
    document.getElementById('rowController').innerText = g.controllerSupport || 'N/A';
    document.getElementById('rowMetascore').innerText = (g.metascore && g.metascore !== 'N/A') ? g.metascore : 'N/A';

    var genresContainer = document.getElementById('rowGenres');
    var genres = Array.isArray(g.genres) ? g.genres : [];
    genresContainer.innerHTML = genres.map(function(gen) {
        return '<span class="s-tag">' + escHtml(gen) + '</span>';
    }).join('');

    document.getElementById('rowDesc').innerText = g.shortDesc || 'Tidak ada deskripsi.';

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
  <div class="s-search-label">Hasil pencarian "${esc(query)}" · ${items.length} ditemukan</div>
  <div class="s-list" id="listItemsContainer"></div>
  <div class="s-pager">
    <button type="button" class="s-pager-btn" id="prevPageBtn" onclick="changePage(-1)" disabled>← Prev</button>
    <span class="s-pager-info" id="pageIndicator">1 / ${totalPages || 1}</span>
    <button type="button" class="s-pager-btn" id="nextPageBtn" onclick="changePage(1)" ${totalPages <= 1 ? "disabled" : ""}>Next →</button>
  </div>
</div>
${detailScreenHtml}
${clientScript}`;

    return renderPage({
        title: "Steam Search",
        badge: `${items.length} results`,
        body: bodyHtml,
        styles: steamStyles
    });
}

export default {
    name: "steam",
    aliases: ["steamsearch", "game"],
    category: "search",
    description: "Mencari game di Steam beserta informasi harganya",
    usage: "!steam <judul game> [--top/-1] [--ui/--text]",
    async handler({ message, args, sock, sender }) {
        if (args.length === 0) {
            await message.reply(
                "❌ Berikan judul game yang ingin dicari.\nContoh: `!steam stardew valley`\n\n" +
                "💡 *Tip:* Tambahkan `-1` atau `--top` untuk langsung mendapatkan hasil paling relevan tanpa memilih list. Contoh: `!steam stardew valley -1`\n" +
                "💡 *Mode:* Tambahkan `--ui` untuk paksa UI interaktif atau `--text` untuk teks biasa.\n" +
                "💡 _Cari profil user? Gunakan `!steamprofile <username>`_"
            );
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
            await message.reply("❌ Berikan judul game yang ingin dicari.\nContoh: `!steam stardew valley -1`");
            return;
        }

        const normalizedSender = resolveUserId(sender);
        const userData = getUser(normalizedSender);
        const userPref = userData?.meta?.displayMode ?? "ui";
        const displayMode = forcedMode || userPref;

        console.log(`[Steam] Query: "${query}" | Sender: ${normalizedSender} | Flag: ${forcedMode || "none"} | UserDB: ${userPref} | Mode: ${displayMode} | Direct: ${isDirect}`);

        try {
            const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=indonesian&cc=ID`;
            const response = await axios.get(searchUrl, { timeout: 15000 });

            if (!response.data || !response.data.items || response.data.items.length === 0) {
                console.log(`[Steam] No results found for query: "${query}"`);
                await message.reply(`❌ Game dengan kata kunci *${query}* tidak ditemukan di Steam.`);
                return;
            }

            const results = response.data.items.filter(item => item.type === "app");

            if (results.length === 0) {
                console.log(`[Steam] No app results found for query: "${query}"`);
                await message.reply(`❌ Game dengan kata kunci *${query}* tidak ditemukan di Steam.`);
                return;
            }

            console.log(`[Steam] Found ${results.length} results for "${query}"`);

            if (isDirect || results.length === 1) {
                console.log(`[Steam] Directly rendering detail for app #${results[0].id} (Mode: ${displayMode})`);
                await sendSteamGameDetail(results[0].id, message, sock, false, sender, forcedMode);
                return;
            }

            if (displayMode === "ui") {
                const preloadCount = Math.min(results.length, 10);
                console.log(`[Steam UI] Enriching top ${preloadCount} items with details & Base64 images...`);

                const enrichedItems = await Promise.all(results.map(async (item, index) => {
                    let detailData = null;
                    if (index < preloadCount) {
                        try {
                            const dRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${item.id}&cc=ID&l=indonesian`, { timeout: 6000 });
                            if (dRes.data?.[item.id]?.success) {
                                detailData = dRes.data[item.id].data;
                            }
                        } catch (e) {
                            // Fallback to storesearch data if appdetails fails
                        }
                    }

                    // Price calculations
                    let isFree = detailData ? detailData.is_free : false;
                    let initialPrice = "";
                    let finalPrice = "";
                    let discountPercent = 0;

                    if (detailData?.price_overview) {
                        const p = detailData.price_overview;
                        discountPercent = p.discount_percent || 0;
                        initialPrice = p.initial_formatted || formatRupiah(p.initial);
                        finalPrice = p.final_formatted || formatRupiah(p.final);
                    } else if (item.price) {
                        initialPrice = formatRupiah(item.price.initial);
                        finalPrice = formatRupiah(item.price.final);
                        if (item.price.initial > item.price.final) {
                            discountPercent = Math.round(((item.price.initial - item.price.final) / item.price.initial) * 100);
                        }
                    } else if (isFree) {
                        finalPrice = "Free to Play";
                    }

                    // Platforms
                    const platforms = [];
                    const platSource = detailData?.platforms || item.platforms;
                    if (platSource?.windows) platforms.push("Win");
                    if (platSource?.mac) platforms.push("Mac");
                    if (platSource?.linux) platforms.push("Linux");
                    const platformsText = platforms.length > 0 ? platforms.join(", ") : "N/A";

                    // Controller
                    let controller = "Keyboard & Mouse";
                    const ctrlVal = detailData?.controller_support || item.controller_support;
                    if (ctrlVal === "full") controller = "Full Controller";
                    else if (ctrlVal) controller = "Partial Controller";

                    // Images
                    const tinyImgUrl = item.tiny_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/capsule_231x87.jpg`;
                    const headerImgUrl = detailData?.header_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`;

                    let imageBase64 = null;
                    if (index < preloadCount) {
                        imageBase64 = await fetchImageAsBase64(tinyImgUrl);
                    }

                    return {
                        id: item.id,
                        name: detailData?.name || item.name || "N/A",
                        image: imageBase64 || tinyImgUrl,
                        headerImage: headerImgUrl,
                        isFree,
                        discountPercent,
                        initialPrice,
                        finalPrice: finalPrice || (isFree ? "Free to Play" : "N/A"),
                        platformsText,
                        metascore: detailData?.metacritic ? String(detailData.metacritic.score) : (item.metascore ? String(item.metascore) : "N/A"),
                        controllerSupport: controller,
                        developers: detailData?.developers ? detailData.developers.join(", ") : "N/A",
                        publishers: detailData?.publishers ? detailData.publishers.join(", ") : "N/A",
                        releaseDate: detailData?.release_date?.date || "N/A",
                        genres: detailData?.genres ? detailData.genres.map(g => g.description) : [],
                        shortDesc: detailData?.short_description ? detailData.short_description.replace(/<[^>]*>?/gm, '').trim() : "Tidak ada deskripsi.",
                        url: `https://store.steampowered.com/app/${item.id}`
                    };
                }));

                console.log(`[Steam UI] Dispatching interactive search list UI for "${query}"`);
                try {
                    const html = generateListUI(enrichedItems, query);
                    const sent = await sendUI(sock, message.chat, {
                        title: `🎮 Steam Search: "${query}"`,
                        html
                    });
                    console.log(`[Steam UI] Search list UI successfully dispatched. Message ID: ${sent?.messageId}`);

                    // Auto-delete HTML webview payload after 2 minutes to prevent viewport lag spikes
                    if (sent?.key) {
                        setTimeout(() => {
                            sock.sendMessage(message.chat, { delete: sent.key }).catch(() => {});
                        }, 120000);
                    }
                    return;
                } catch (uiErr) {
                    console.error("[Steam UI Error] Failed to send search list UI, falling back to text:", uiErr);
                    // Fallback to text below
                }
            }

            console.log(`[Steam Text] Dispatching search list as text for "${query}" (Page 1)`);
            const text = generateListText(results, 0, query);
            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                query,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "steam",
                forcedMode,
                displayMode: "text"
            });

        } catch (err) {
            console.error("Steam Command Error:", err.message);
            await message.reply(`❌ Terjadi kesalahan saat mencari game di Steam. Coba lagi nanti.`);
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
            console.log(`[Steam Reply] Pagination next -> Page ${state.page + 1}/${totalPages} (Mode: ${displayMode})`);

            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            console.log(`[Steam Reply] Pagination back -> Page ${state.page + 1}/${totalPages} (Mode: ${displayMode})`);

            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= results.length) {
        const app = results[num - 1];

        deleteReplyHandler(messageKey.id);
        console.log(`[Steam Reply] User selected #${num} "${app.name}" (ForcedMode: ${forcedMode || "none"})`);

        if (displayMode !== "ui") {
            await sock.sendMessage(message.chat, { text: `>> *${app.name}*`, edit: messageKey });
        }

        await sendSteamGameDetail(app.id, message, sock, false, state.userId, state.forcedMode);
        return;
    }
}
