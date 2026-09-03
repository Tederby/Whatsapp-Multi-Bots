import axios from "axios";
import setting from "../setting.js";
import { sendUI, renderPage, esc } from "../lib/uiEngine.js";
import { getUser, resolveUserId } from "../lib/database.js";

const STEAM_API = "https://api.steampowered.com";

// ── Steam Game ──────────────────────────────────────────

export function formatRupiah(cents) {
    if (!cents) return "Rp 0";
    const price = Math.floor(cents / 100);
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

/**
 * Fetch remote image and convert it to a self-contained Base64 Data URI.
 * This guarantees the image displays inside WhatsApp's sandboxed webview
 * without being blocked by CSP or cross-origin network policies.
 */
export async function fetchImageAsBase64(url) {
    if (!url) return null;
    try {
        const res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 5000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const contentType = res.headers["content-type"] || "image/jpeg";
        return `data:${contentType};base64,${Buffer.from(res.data).toString("base64")}`;
    } catch (err) {
        console.warn(`[Steam Image] Failed to convert image to Base64 for ${url}:`, err.message);
        return null;
    }
}

export async function sendSteamGameDetail(appId, message, sock, isAutoDetect = false, sender = null, forcedMode = null) {
    try {
        const detailUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=ID&l=indonesian`;
        const response = await axios.get(detailUrl, { timeout: 15000 });

        const data = response.data[appId];
        if (!data || !data.success) {
            if (!isAutoDetect) await message.reply(`❌ Gagal mengambil detail untuk game tersebut.`);
            return;
        }

        const game = data.data;
        const name = game.name || "N/A";
        const shortDesc = game.short_description ? game.short_description.replace(/<[^>]*>?/gm, '').trim() : "Tidak ada deskripsi.";
        const releaseDate = game.release_date ? game.release_date.date : "N/A";
        const developers = game.developers ? game.developers.join(", ") : "N/A";
        const publishers = game.publishers ? game.publishers.join(", ") : "N/A";
        const metacritic = game.metacritic ? game.metacritic.score : "N/A";
        let supportedLanguages = "N/A";
        if (game.supported_languages) {
            let rawLangs = game.supported_languages.replace(/<br[^>]*>[\s\S]*$/i, '');
            rawLangs = rawLangs.replace(/<strong>\*<\/strong>\s*bahasa dengan dukungan audio penuh/gi, '');
            rawLangs = rawLangs.replace(/\*bahasa dengan dukungan audio penuh/gi, '');
            rawLangs = rawLangs.replace(/\*languages with full audio support/gi, '');

            const audioLangs = [];
            const textLangs = [];

            rawLangs.split(',').forEach(l => {
                let text = l.trim();
                let hasAudio = text.includes('<strong>*</strong>') || text.includes('*');
                text = text.replace(/<[^>]*>?/gm, '').replace(/\*/g, '').trim();

                if (text) {
                    if (hasAudio) audioLangs.push(text);
                    else textLangs.push(text);
                }
            });

            let formatArr = [];
            if (audioLangs.length > 0) {
                formatArr.push(`🔊 *UI, Audio & Subtitle:*\n${audioLangs.join(', ')}`);
            }
            if (textLangs.length > 0) {
                formatArr.push(`💬 *UI & Subtitle:*\n${textLangs.join(', ')}`);
            }

            supportedLanguages = formatArr.join('\n\n');
        }

        let priceText = "Gratis";
        let discountPercent = 0;
        let initialPrice = "";
        let finalPrice = "";
        const isFree = game.is_free;

        if (isFree) {
            priceText = "Gratis (Free to Play)";
            finalPrice = "Free to Play";
        } else if (game.price_overview) {
            const p = game.price_overview;
            discountPercent = p.discount_percent || 0;
            initialPrice = p.initial_formatted || formatRupiah(p.initial);
            finalPrice = p.final_formatted || formatRupiah(p.final);
            if (discountPercent > 0) {
                priceText = `~${initialPrice}~\n💸 *Harga Diskon:* ${finalPrice}\n📉 *Diskon:* ${discountPercent}%`;
            } else {
                priceText = finalPrice;
            }
        } else {
            priceText = "Tidak tersedia untuk dibeli";
            finalPrice = "N/A";
        }

        const genreList = game.genres ? game.genres.map(g => g.description) : [];
        const genres = genreList.length > 0 ? genreList.join(", ") : "N/A";
        const headerImage = game.header_image || game.capsule_image;
        const storeUrl = `https://store.steampowered.com/app/${appId}`;

        // Platforms
        const platforms = [];
        if (game.platforms?.windows) platforms.push("Windows");
        if (game.platforms?.mac) platforms.push("macOS");
        if (game.platforms?.linux) platforms.push("Linux");
        const platformText = platforms.length > 0 ? platforms.join(", ") : "N/A";

        const controllerSupport = game.controller_support ? (game.controller_support === "full" ? "Full Controller" : "Partial Controller") : "Keyboard & Mouse";

        // Display Mode:
        // ATURAN MUTLAK: Auto-Detect SELALU dalam bentuk teks (tidak pernah Webview UI)
        const rawSender = sender || message.sender || message.key?.participantAlt || message.key?.participant || message.key?.remoteJid;
        const normalizedSender = resolveUserId(rawSender);
        const userData = getUser(normalizedSender);
        const userPref = userData?.meta?.displayMode ?? "ui";
        const displayMode = isAutoDetect ? "text" : (forcedMode || userPref);

        console.log(`[Steam Detail] Game: "${name}" (${appId}) | Sender: ${normalizedSender} | isAutoDetect: ${isAutoDetect} | Mode: ${displayMode}`);

        if (displayMode === "ui") {
            try {
                const imageBase64 = await fetchImageAsBase64(headerImage);
                const finalImgSrc = imageBase64 || headerImage;

                // Minimal flat CSS with Steam landscape banner styling
                const steamStyles = `
.ui-page{background:#0d0f13;border:none;box-shadow:none;border-radius:0;padding:16px}
.ui-header{border-bottom:1px solid #1e2028;padding-bottom:12px;margin-bottom:16px}
.ui-header-title{font-size:15px;font-weight:700;letter-spacing:0;color:#e4e4e7}
.ui-badge{background:none;border:1px solid #2a2d37;border-radius:4px;font-size:10px;color:#71717a;font-weight:600;letter-spacing:0;text-transform:none;padding:3px 8px}

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

                let bodyHtml = "";
                if (finalImgSrc) {
                    bodyHtml += `<div class="s-banner"><img src="${finalImgSrc}" alt="${esc(name)}" referrerpolicy="no-referrer" /></div>`;
                }
                bodyHtml += `<div class="s-detail-title">${esc(name)}</div>`;
                bodyHtml += `<div class="s-detail-sub">${developers !== "N/A" ? esc(developers) + " · " : ""}${esc(releaseDate)}</div>`;

                // Price display
                if (discountPercent > 0) {
                    bodyHtml += `<div class="s-price-box">`;
                    bodyHtml += `<span class="s-discount-badge">-${discountPercent}%</span>`;
                    bodyHtml += `<span class="s-price-strike">${esc(initialPrice)}</span>`;
                    bodyHtml += `<span class="s-price-final green">${esc(finalPrice)}</span>`;
                    bodyHtml += `</div>`;
                } else if (isFree) {
                    bodyHtml += `<div class="s-price-box"><span class="s-price-final green">Free to Play</span></div>`;
                } else if (finalPrice !== "N/A") {
                    bodyHtml += `<div class="s-price-box"><span class="s-price-final">${esc(finalPrice)}</span></div>`;
                }

                // Table metadata
                bodyHtml += `<div class="s-table">`;
                bodyHtml += `<div class="s-table-row"><span class="s-table-label">Developer</span><span class="s-table-value">${esc(developers)}</span></div>`;
                bodyHtml += `<div class="s-table-row"><span class="s-table-label">Publisher</span><span class="s-table-value">${esc(publishers)}</span></div>`;
                bodyHtml += `<div class="s-table-row"><span class="s-table-label">Rilis</span><span class="s-table-value">${esc(releaseDate)}</span></div>`;
                bodyHtml += `<div class="s-table-row"><span class="s-table-label">Platform</span><span class="s-table-value">${esc(platformText)}</span></div>`;
                bodyHtml += `<div class="s-table-row"><span class="s-table-label">Controller</span><span class="s-table-value">${esc(controllerSupport)}</span></div>`;
                if (metacritic !== "N/A") {
                    bodyHtml += `<div class="s-table-row"><span class="s-table-label">Metascore</span><span class="s-table-value">${esc(String(metacritic))}</span></div>`;
                }
                bodyHtml += `</div>`;

                if (genreList.length > 0) {
                    bodyHtml += `<div class="s-section-label">Genres</div>`;
                    bodyHtml += `<div class="s-tags">${genreList.map(g => `<span class="s-tag">${esc(g)}</span>`).join("")}</div>`;
                }

                bodyHtml += `<div class="s-section-label">Deskripsi</div>`;
                bodyHtml += `<div class="s-desc">${esc(shortDesc)}</div>`;

                const pageHtml = renderPage({
                    title: "Steam Game",
                    badge: metacritic !== "N/A" ? `Meta ${metacritic}` : "Steam",
                    body: bodyHtml,
                    styles: steamStyles
                });

                const sent = await sendUI(sock, message.chat, {
                    title: `${name} (${finalPrice})`,
                    html: pageHtml
                });

                console.log(`[Steam UI] Game detail sent to ${message.chat}. ID: ${sent?.messageId}`);

                // Auto-delete HTML webview payload after 2 minutes to prevent viewport lag spikes
                if (sent?.key) {
                    setTimeout(() => {
                        sock.sendMessage(message.chat, { delete: { ...sent.key, fromMe: true } }).catch(() => {});
                    }, 120000);
                }
                return;
            } catch (uiErr) {
                console.error("[Steam UI Error] Failed to send detail card, falling back to text. Error:", uiErr);
                // Fallback to text below
            }
        }

        let captionText = `🎮 *${name}*\n\n`;
        captionText += `🔗 *Link Steam:* https://store.steampowered.com/app/${appId}\n\n`;
        captionText += `🏷️ *Genre:* ${genres}\n`;
        captionText += `📅 *Rilis:* ${releaseDate}\n`;
        captionText += `🛠️ *Developer:* ${developers}\n`;
        captionText += `🏢 *Publisher:* ${publishers}\n`;
        captionText += `🌟 *Metacritic:* ${metacritic}\n\n`;
        captionText += `💰 *Harga:* ${priceText}\n\n`;
        captionText += `📝 *Deskripsi:*\n${shortDesc}\n\n`;
        captionText += `🌐 *Bahasa didukung:*\n${supportedLanguages}`;

        if (headerImage) {
            await sock.sendMessage(
                message.chat,
                {
                    image: { url: headerImage },
                    caption: captionText
                },
                { quoted: message }
            );
        } else {
            await message.reply(captionText);
        }
    } catch (err) {
        console.error("Steam Game Detail Error:", err.message);
        if (!isAutoDetect) await message.reply(`❌ Terjadi kesalahan saat mengambil detail game.`);
    }
}

// ── Steam Profile ──────────────────────────────────────────

export function extractSteamInput(input) {
    if (!input) return null;
    let val = input.trim();
    // Check if it's a steam profile link
    let match = val.match(/steamcommunity\.com\/id\/([^/?]+)/i);
    if (match) return match[1];
    match = val.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
    if (match) return match[1];
    
    // Clean up if the user passed trailing slashes
    val = val.replace(/\/+$/, "");
    return val;
}

function detectInputType(input) {
    return /^\d{17}$/.test(input) ? "steamid" : "vanity";
}

async function resolveVanityURL(apiKey, vanityUrl) {
    const url = `${STEAM_API}/ISteamUser/ResolveVanityURL/v1/?key=${apiKey}&vanityurl=${encodeURIComponent(vanityUrl)}`;
    const { data } = await axios.get(url, { timeout: 15000 });

    if (data.response.success === 1) {
        return data.response.steamid;
    }
    return null;
}

async function fetchProfileData(apiKey, steamId) {
    const [summaryRes, gamesRes, recentRes, levelRes] = await Promise.allSettled([
        axios.get(`${STEAM_API}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`, { timeout: 15000 }),
        axios.get(`${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`, { timeout: 15000 }),
        axios.get(`${STEAM_API}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamId}`, { timeout: 15000 }),
        axios.get(`${STEAM_API}/IPlayerService/GetSteamLevel/v1/?key=${apiKey}&steamid=${steamId}`, { timeout: 15000 }),
    ]);

    return {
        summary: summaryRes.status === "fulfilled" ? summaryRes.value.data : null,
        games: gamesRes.status === "fulfilled" ? gamesRes.value.data : null,
        recent: recentRes.status === "fulfilled" ? recentRes.value.data : null,
        level: levelRes.status === "fulfilled" ? levelRes.value.data : null,
    };
}

function formatPlaytime(minutes) {
    if (!minutes || minutes <= 0) return "0 jam";
    const hours = (minutes / 60).toFixed(1);
    return `${hours.replace(/\.0$/, "")} jam`;
}

function getStatusText(player) {
    const statusMap = {
        0: "🔴 Offline",
        1: "🟢 Online",
        2: "🟡 Busy",
        3: "🟡 Away",
        4: "🟡 Snooze",
        5: "🔵 Looking to Trade",
        6: "🔵 Looking to Play",
    };

    let statusText = statusMap[player.personastate] || "❓ Unknown";

    if (player.gameextrainfo) {
        statusText = `🟣 In-Game: *${player.gameextrainfo}*`;
    }

    if (player.personastate === 0 && player.lastlogoff) {
        const lastSeen = new Date(player.lastlogoff * 1000);
        const diff = Date.now() - lastSeen.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);

        let agoText;
        if (days > 0) agoText = `${days} hari lalu`;
        else if (hours > 0) agoText = `${hours} jam lalu`;
        else agoText = `${mins} menit lalu`;

        statusText += ` _(terakhir: ${agoText})_`;
    }

    return statusText;
}

function getCountryFlag(code) {
    if (!code || code.length !== 2) return "";
    const offset = 0x1F1E6;
    const chars = [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + offset));
    return chars.join("");
}

function extractCustomUrl(profileUrl) {
    if (!profileUrl) return null;
    const match = profileUrl.match(/steamcommunity\.com\/id\/([^/]+)/i);
    return match ? match[1] : null;
}

function buildProfileText(steamId, player, games, recent, level) {
    const isPublic = player.communityvisibilitystate === 3;
    const name = player.personaname || "N/A";
    const realName = player.realname || null;
    const country = player.loccountrycode || null;
    const created = player.timecreated ? new Date(player.timecreated * 1000) : null;
    const customUrl = extractCustomUrl(player.profileurl);

    let text = `╭━━━〔 🎮 STEAM PROFILE 〕━━━\n`;
    text += `┃ 👤 *Nama*     : ${name}\n`;
    if (realName) text += `┃ 📛 *Nama Asli* : ${realName}\n`;
    text += `┃ 🆔 *SteamID*  : \`${steamId}\`\n`;
    if (customUrl) {
        text += `┃ 🏷️ *Custom ID* : ${customUrl}\n`;
    } else {
        text += `┃ 🏷️ *Custom ID* : _Belum diatur_\n`;
    }
    text += `┃ 🌐 *Status*   : ${getStatusText(player)}\n`;
    if (country) text += `┃ 🏳️ *Negara*   : ${getCountryFlag(country)} ${country}\n`;
    if (created) {
        const dateStr = created.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        text += `┃ 📅 *Dibuat*   : ${dateStr}\n`;
    }
    if (level !== null) text += `┃ ⭐ *Level*    : ${level}\n`;

    if (!isPublic) {
        text += `┃ 🔒 *Visibilitas* : Private\n`;
    }

    text += `╰━━━━━━━━━━━━━━━━━━━━━\n`;

    // ── Games section ──
    if (!isPublic) {
        text += `\n🔒 _Profil ini bersifat Private — data game tidak tersedia._\n`;
    } else if (games && games.response && games.response.game_count > 0) {
        const totalGames = games.response.game_count;
        const totalPlaytime = games.response.games.reduce((sum, g) => sum + (g.playtime_forever || 0), 0);
        text += `\n┃ 🎮 *Total Game* : ${totalGames.toLocaleString("id-ID")} game (${formatPlaytime(totalPlaytime)} total)\n\n`;

        const top5 = [...games.response.games]
            .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
            .slice(0, 5);

        if (top5.length > 0 && top5[0].playtime_forever > 0) {
            text += `╭───「 🏆 Top Games (by Playtime) 」\n`;
            top5.forEach((g, i) => {
                text += `│ ${i + 1}. ${g.name} — *${formatPlaytime(g.playtime_forever)}*\n`;
            });
            text += `╰──────────────\n`;
        }
    } else if (games && games.response) {
        if (typeof games.response.game_count === "number") {
            text += `\n_User ini belum memiliki game._\n`;
        } else {
            text += `\n🔒 _Daftar game di-private oleh user._\n`;
        }
    } else {
        text += `\n🔒 _Daftar game di-private oleh user._\n`;
    }

    // ── Recent activity section ──
    if (!isPublic) {
        // Already shown the private notice above
    } else if (recent && recent.response && recent.response.total_count > 0) {
        text += `\n╭───「 📅 Aktivitas 2 Minggu Terakhir 」\n`;
        recent.response.games.forEach(g => {
            text += `│ • ${g.name} — *${formatPlaytime(g.playtime_2weeks)}*\n`;
        });
        text += `╰──────────────\n`;
    } else if (isPublic) {
        text += `\n_Tidak ada aktivitas dalam 2 minggu terakhir._\n`;
    }

    // ── Custom URL tip ──
    if (!customUrl) {
        text += `\n💡 _Ini profil kamu? Setup custom URL di:_\n_Steam > Edit Profile > Custom URL_\n`;
    }

    text += `\n🔗 *Profil:* https://steamcommunity.com/profiles/${steamId}`;

    return text.trim();
}

/**
 * Verify if a Steam account exists and return its SteamID and custom URL.
 * Returns null if not found or invalid.
 */
export async function verifySteamAccount(input) {
    const apiKey = setting.steam?.apiKey;
    if (!apiKey) return null;

    const extracted = extractSteamInput(input);
    if (!extracted) return null;

    try {
        let steamId;
        const inputType = detectInputType(extracted);

        if (inputType === "steamid") {
            steamId = extracted;
        } else {
            steamId = await resolveVanityURL(apiKey, extracted);
            if (!steamId) return null;
        }

        const profileData = await fetchProfileData(apiKey, steamId);
        const players = profileData.summary?.response?.players;
        if (!players || players.length === 0) return null;

        const player = players[0];
        const customUrl = extractCustomUrl(player.profileurl);

        return {
            steamId,
            name: player.personaname,
            customUrl,
            url: `https://steamcommunity.com/profiles/${steamId}`
        };
    } catch (err) {
        return null;
    }
}

export async function sendSteamProfileDetail(input, message, sock, isAutoDetect = false) {
    const apiKey = setting.steam?.apiKey;
    if (!apiKey) {
        if (!isAutoDetect) await message.reply("❌ Steam API Key belum dikonfigurasi. Hubungi owner bot.");
        return;
    }

    let sentMsg;
    if (!isAutoDetect) {
        sentMsg = await sock.sendMessage(
            message.chat,
            { text: `🔍 Mengambil profil *${input}*...` },
            { quoted: message }
        );
    }

    try {
        let steamId;
        const inputType = detectInputType(input);

        if (inputType === "steamid") {
            steamId = input;
        } else {
            steamId = await resolveVanityURL(apiKey, input);

            if (!steamId) {
                if (!isAutoDetect) {
                    await sock.sendMessage(message.chat, {
                        text: `❌ User Steam dengan custom URL *${input}* tidak ditemukan.\n\n` +
                            `⚠️ Pencarian harus *exact match* — pastikan:\n` +
                            `• Bukan display name, tapi *custom URL* dari profil\n` +
                            `• Cek di: \`steamcommunity.com/id/\`*username_disini*\n` +
                            `• Atau gunakan *SteamID64* (angka 17 digit)\n\n` +
                            `💡 _Jika user tidak punya custom URL, gunakan SteamID64 dari profil mereka._`,
                        edit: sentMsg.key
                    });
                }
                return;
            }
        }

        const profileData = await fetchProfileData(apiKey, steamId);

        const players = profileData.summary?.response?.players;
        if (!players || players.length === 0) {
            if (!isAutoDetect) {
                await sock.sendMessage(message.chat, {
                    text: `❌ Profil Steam dengan ID *${steamId}* tidak ditemukan.`,
                    edit: sentMsg.key
                });
            }
            return;
        }

        const player = players[0];
        const steamLevel = profileData.level?.response?.player_level ?? null;

        const profileText = buildProfileText(
            steamId,
            player,
            profileData.games,
            profileData.recent,
            steamLevel
        );

        if (!isAutoDetect) {
            await sock.sendMessage(message.chat, {
                text: `>> *${player.personaname}*`,
                edit: sentMsg.key
            });
        }

        await sock.sendMessage(
            message.chat,
            { text: profileText },
            { quoted: message }
        );

    } catch (err) {
        console.error("SteamProfile Error:", err.message);

        if (!isAutoDetect) {
            const errText = err.response?.status === 403
                ? "❌ Steam API Key tidak valid atau expired. Hubungi owner bot."
                : "❌ Terjadi kesalahan saat mengambil profil Steam. Coba lagi nanti.";

            await sock.sendMessage(message.chat, {
                text: errText,
                edit: sentMsg.key
            }).catch(() => {});
        }
    }
}
