import { getAllCommands, registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { sendUI, renderPage, esc } from "../lib/uiEngine.js";
import setting from "../setting.js";

/** Display name for each category. */
const CATEGORY_LABELS = {
    general: "🌟 General",
    group: "🛡️ Group",
    download: "📥 Downloader",
    media: "🎨 Media",
    anime: "🌸 Anime",
    search: "🔍 Search",
    tools: "🛠️ Tools",
    game: "🎮 Game",
    botadmin: "🛡️ Bot Admin",
    system: "💻 System",
    owner: "👑 Owner"
};

/** Fallback label for commands without a category. */
const DEFAULT_CATEGORY = "📦 Lainnya";

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(" ");
}

function getGroupedCommands() {
    const commands = getAllCommands();
    const groups = new Map();
    for (const cmd of commands) {
        const cat = cmd.category || "other";
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(cmd);
    }
    return groups;
}

function getOrderedCategories(groups) {
    const orderedKeys = [...Object.keys(CATEGORY_LABELS)];
    return [...groups.keys()].sort((a, b) => {
        const ai = orderedKeys.indexOf(a);
        const bi = orderedKeys.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}

function getHeader(timeoutSec) {
    let text = `╭━━━〔 👾 ${setting.name || "Bot Menu"} 👾 〕━━━\n`;
    text += `┃ 💻 Prefix : [ ${setting.prefixes.join(" / ")} ]\n`;
    text += `┃ ⏱️ Uptime : ${formatUptime(process.uptime())}\n`;
    if (timeoutSec > 0) {
        text += `┃ ⚠️ Menu akan timeout dalam ${timeoutSec} detik\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;
    return text;
}

function generateCategoryList(timeoutSec = 90) {
    const groups = getGroupedCommands();
    const allKeys = getOrderedCategories(groups);

    let text = getHeader(timeoutSec);
    text += `╭───「 📂 Kategori Menu 」\n`;
    
    for (const cat of allKeys) {
        const label = CATEGORY_LABELS[cat] || DEFAULT_CATEGORY;
        const total = groups.get(cat).length;
        text += `│ ⋄ *${cat}* (${total} cmd)\n`;
    }
    text += `╰──────────────\n\n`;
    text += `💡 _Balas pesan ini dengan nama kategori (misal: 'anime' atau 'tools') untuk melihat daftar perintahnya._\n`;
    text += `_Atau ketik \`!menu all\` untuk melihat semua command._`;

    return text.trim();
}

function generateCategoryCommands(category, timeoutSec = 60) {
    const groups = getGroupedCommands();
    let actualCategory = null;
    for (const key of groups.keys()) {
        if (key.toLowerCase() === category.toLowerCase()) {
            actualCategory = key;
            break;
        }
    }

    if (!actualCategory) return null;

    let text = getHeader(timeoutSec);
    const label = CATEGORY_LABELS[actualCategory] || DEFAULT_CATEGORY;
    const cmds = groups.get(actualCategory);

    text += `╭───「 ${label} 」\n`;
    for (const cmd of cmds) {
        let cmdNames = [`*${cmd.name}*`];
        if (cmd.aliases && cmd.aliases.length > 0) {
            cmdNames.push(...cmd.aliases.map(a => `*${a}*`));
        }
        text += `│ ⋄ ${cmdNames.join(" / ")}\n`;
        if (cmd.description) {
            text += `│   └ ${cmd.description}\n`;
        } else {
            text += `│   └ (No description)\n`;
        }
    }
    text += `╰──────────────\n\n`;
    text += `⚙️ _Powered by Baileys & Node.js_`;

    return text.trim();
}

function generateAllCommands(timeoutSec = 60) {
    const groups = getGroupedCommands();
    const allKeys = getOrderedCategories(groups);

    let text = getHeader(timeoutSec);
    for (const cat of allKeys) {
        const label = CATEGORY_LABELS[cat] || DEFAULT_CATEGORY;
        const cmds = groups.get(cat);
        text += `╭───「 ${label} 」\n`;

        for (const cmd of cmds) {
            let cmdNames = [`*${cmd.name}*`];
            if (cmd.aliases && cmd.aliases.length > 0) {
                cmdNames.push(...cmd.aliases.map(a => `*${a}*`));
            }
            text += `│ ⋄ ${cmdNames.join(" / ")}\n`;
            if (cmd.description) {
                text += `│   └ ${cmd.description}\n`;
            } else {
                text += `│   └ (No description)\n`;
            }
        }
        text += `╰──────────────\n\n`;
    }
    text += `⚙️ _Powered by Baileys & Node.js_`;

    return text.trim();
}

function generateMenuUI({ initialCategory = null, isAll = false, prefix = "!" } = {}) {
    const commands = getAllCommands();
    const groups = getGroupedCommands();
    const orderedKeys = getOrderedCategories(groups);

    const categoriesData = orderedKeys.map(cat => ({
        key: cat,
        label: CATEGORY_LABELS[cat] || DEFAULT_CATEGORY,
        count: groups.get(cat)?.length || 0
    }));

    const commandsData = commands.map(cmd => ({
        name: cmd.name,
        aliases: cmd.aliases || [],
        category: cmd.category || "other",
        description: cmd.description || "Tidak ada deskripsi",
        usage: cmd.usage || `${prefix}${cmd.name}`,
        groupOnly: !!cmd.groupOnly,
        adminOnly: !!cmd.adminOnly,
        ownerOnly: !!cmd.ownerOnly,
        privateOnly: !!cmd.privateOnly
    }));

    const safeCategories = JSON.stringify(categoriesData).replace(/</g, '\\u003c');
    const safeCommands = JSON.stringify(commandsData).replace(/</g, '\\u003c');
    const uptimeStr = formatUptime(process.uptime());
    const prefixesStr = setting.prefixes?.join(" ") || prefix;

    const menuStyles = `
.ui-page{background:#0d0f13;border:none;box-shadow:none;border-radius:0;padding:16px}
.ui-header{border-bottom:1px solid #1e2028;padding-bottom:12px;margin-bottom:14px}
.ui-header-title{font-size:15px;font-weight:700;letter-spacing:0;color:#e4e4e7}
.ui-badge{background:none;border:1px solid #2a2d37;border-radius:4px;font-size:10px;color:#71717a;font-weight:600;padding:3px 8px}

.m-info-bar{display:flex;align-items:center;justify-content:space-between;background:#141619;border:1px solid #1e2028;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:#71717a}
.m-info-val{color:#d4d4d8;font-weight:600}

.m-search-wrap{margin-bottom:12px}
.m-search-input{width:100%;box-sizing:border-box;background:#141619;border:1px solid #1e2028;border-radius:6px;padding:8px 12px;font-size:12px;color:#e4e4e7;outline:none;transition:border-color .15s}
.m-search-input:focus{border-color:#3b82f6}
.m-search-input::placeholder{color:#71717a}

.m-cat-list{display:flex;flex-direction:column;gap:1px;background:#1e2028;border-radius:6px;overflow:hidden}
.m-cat-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0d0f13;cursor:pointer;transition:background .1s}
.m-cat-item:active{background:#18191f}
.m-cat-name{font-size:13px;font-weight:600;color:#e4e4e7}
.m-cat-badge{font-size:10px;color:#71717a;background:#18191f;border:1px solid #1e2028;padding:2px 6px;border-radius:3px}
.m-cat-arrow{color:#71717a;font-size:14px}

.m-nav-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.m-back-btn{background:none;border:none;color:#71717a;font-size:12px;font-weight:600;cursor:pointer;padding:4px 0;display:inline-flex;align-items:center;gap:4px}
.m-back-btn:active{color:#e4e4e7}
.m-cat-title{font-size:14px;font-weight:700;color:#e4e4e7;margin-bottom:10px}

.m-cmd-card{background:#141619;border:1px solid #1e2028;border-radius:6px;padding:10px 12px;margin-bottom:8px}
.m-cmd-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;gap:8px}
.m-cmd-title-wrap{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.m-cmd-name{font-size:13px;font-weight:700;color:#e4e4e7}
.m-cmd-alias{font-size:10px;color:#71717a}

.m-tags{display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0}
.m-tag{font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;text-transform:uppercase}
.m-tag-admin{background:#451a1a;color:#f87171;border:1px solid #7f1d1d}
.m-tag-group{background:#1e293b;color:#94a3b8;border:1px solid #334155}
.m-tag-owner{background:#422006;color:#fde047;border:1px solid #713f12}
.m-tag-private{background:#2e1065;color:#c084fc;border:1px solid #581c87}

.m-cmd-desc{font-size:11px;color:#a1a1aa;line-height:1.4;margin-bottom:6px}
.m-cmd-usage{font-size:10px;font-family:monospace;color:#71717a;background:#0d0f13;padding:4px 8px;border-radius:3px;margin-bottom:8px;word-break:break-all}
.m-btn-wrap{display:flex;justify-content:flex-end}
.m-cmd-btn{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#a1a1aa;background:#18191f;border:1px solid #2a2d37;padding:3px 10px;border-radius:4px;text-decoration:none}
.m-cmd-btn:active{border-color:#52525b;color:#e4e4e7}

.m-all-btn{width:100%;margin-top:10px;padding:9px 12px;background:#141619;border:1px solid #1e2028;border-radius:6px;color:#a1a1aa;font-size:11px;font-weight:600;text-align:center;cursor:pointer;transition:border-color .1s}
.m-all-btn:active{border-color:#2a2d37;color:#e4e4e7}
.m-section-header{font-size:12px;font-weight:700;color:#a1a1aa;padding:8px 0 6px;margin-top:8px;border-bottom:1px solid #1e2028;margin-bottom:8px}
.m-empty{text-align:center;padding:24px 0;font-size:12px;color:#71717a}
.m-mode-tip{text-align:center;font-size:10px;color:#71717a;margin-top:14px;padding:8px 10px;background:#141619;border:1px solid #1e2028;border-radius:6px;line-height:1.5}
.m-mode-tip b{color:#d4d4d8}
`;

    const clientScript = `
<script>
var categories = ${safeCategories};
var commands = ${safeCommands};
var activeCategory = ${JSON.stringify(initialCategory || "")};
var showAllDirect = ${isAll ? "true" : "false"};
var botPrefix = ${JSON.stringify(prefix)};

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderCategoryList() {
    var container = document.getElementById('catListContainer');
    if (!container) return;
    var html = '';
    for (var i = 0; i < categories.length; i++) {
        var c = categories[i];
        html += '<div class="m-cat-item" onclick="showCategory(\\'' + c.key + '\\')" role="button" tabindex="0">';
        html += '<div class="m-cat-info">';
        html += '<span class="m-cat-name">' + escHtml(c.label) + '</span>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<span class="m-cat-badge">' + c.count + ' cmd</span>';
        html += '<span class="m-cat-arrow">›</span>';
        html += '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function renderCommandCard(cmd) {
    var aliasesText = cmd.aliases && cmd.aliases.length > 0
        ? ' · <span class="m-cmd-alias">alias: ' + escHtml(cmd.aliases.map(function(a){ return botPrefix + a; }).join(', ')) + '</span>'
        : '';

    var tags = [];
    if (cmd.ownerOnly) tags.push('<span class="m-tag m-tag-owner">Owner</span>');
    if (cmd.adminOnly) tags.push('<span class="m-tag m-tag-admin">Admin</span>');
    if (cmd.groupOnly) tags.push('<span class="m-tag m-tag-group">Group</span>');
    if (cmd.privateOnly) tags.push('<span class="m-tag m-tag-private">Private</span>');
    var tagsHtml = tags.length > 0 ? '<div class="m-tags">' + tags.join(' ') + '</div>' : '';

    var html = '<div class="m-cmd-card">';
    html += '<div class="m-cmd-header">';
    html += '<div class="m-cmd-title-wrap">';
    html += '<span class="m-cmd-name">' + escHtml(botPrefix + cmd.name) + '</span>' + aliasesText;
    html += '</div>';
    html += tagsHtml;
    html += '</div>';

    if (cmd.description) {
        html += '<div class="m-cmd-desc">' + escHtml(cmd.description) + '</div>';
    }

    if (cmd.usage) {
        html += '<div class="m-cmd-usage">' + escHtml(cmd.usage) + '</div>';
    }

    var cmdTrigger = botPrefix + cmd.name;
    html += '<div class="m-btn-wrap">';
    html += '<a href="#" class="m-cmd-btn" title="Long-press untuk salin">' + escHtml(cmdTrigger) + '</a>';
    html += '</div>';
    html += '</div>';
    return html;
}

function showCategory(catKey) {
    var cat = null;
    for (var i = 0; i < categories.length; i++) {
        if (categories[i].key.toLowerCase() === catKey.toLowerCase()) {
            cat = categories[i];
            break;
        }
    }
    var catLabel = cat ? cat.label : catKey;
    var catCmds = commands.filter(function(c) {
        return c.category.toLowerCase() === catKey.toLowerCase();
    });

    document.getElementById('cmdCatTitle').innerText = catLabel;
    document.getElementById('cmdCatBadge').innerText = catCmds.length + ' cmd';

    var container = document.getElementById('cmdListContainer');
    if (catCmds.length === 0) {
        container.innerHTML = '<div class="m-empty">Tidak ada command di kategori ini.</div>';
    } else {
        var html = '';
        for (var j = 0; j < catCmds.length; j++) {
            html += renderCommandCard(catCmds[j]);
        }
        container.innerHTML = html;
    }

    switchScreen('screenCommands');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAll() {
    document.getElementById('cmdCatTitle').innerText = 'Semua Command';
    document.getElementById('cmdCatBadge').innerText = commands.length + ' cmd';

    var container = document.getElementById('cmdListContainer');
    var html = '';
    for (var i = 0; i < categories.length; i++) {
        var cat = categories[i];
        var catCmds = commands.filter(function(c) {
            return c.category.toLowerCase() === cat.key.toLowerCase();
        });
        if (catCmds.length === 0) continue;

        html += '<div class="m-section-header">' + escHtml(cat.label) + ' (' + catCmds.length + ')</div>';
        for (var j = 0; j < catCmds.length; j++) {
            html += renderCommandCard(catCmds[j]);
        }
    }
    container.innerHTML = html;

    switchScreen('screenCommands');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToCategories() {
    switchScreen('screenCategories');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onSearchInput(val) {
    var query = (val || '').trim().toLowerCase();
    if (!query) {
        switchScreen('screenCategories');
        return;
    }

    var filtered = commands.filter(function(c) {
        if (c.name.toLowerCase().indexOf(query) !== -1) return true;
        if (c.description && c.description.toLowerCase().indexOf(query) !== -1) return true;
        if (c.aliases && c.aliases.some(function(a){ return a.toLowerCase().indexOf(query) !== -1; })) return true;
        return false;
    });

    document.getElementById('searchResultBadge').innerText = filtered.length + ' hasil';
    var container = document.getElementById('searchListContainer');
    if (filtered.length === 0) {
        container.innerHTML = '<div class="m-empty">Tidak ditemukan command untuk "' + escHtml(query) + '"</div>';
    } else {
        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            html += renderCommandCard(filtered[i]);
        }
        container.innerHTML = html;
    }

    switchScreen('screenSearch');
}

function clearSearch() {
    var input = document.getElementById('menuSearchInput');
    if (input) input.value = '';
    switchScreen('screenCategories');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchScreen(screenId) {
    var screens = ['screenCategories', 'screenCommands', 'screenSearch'];
    for (var i = 0; i < screens.length; i++) {
        var el = document.getElementById(screens[i]);
        if (el) {
            if (screens[i] === screenId) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    }
}

// Initial view
renderCategoryList();
if (showAllDirect) {
    showAll();
} else if (activeCategory) {
    showCategory(activeCategory);
}
</script>`;

    const bodyHtml = `
<div class="m-info-bar">
  <span>Prefix: <span class="m-info-val">[ ${esc(prefixesStr)} ]</span></span>
  <span>Uptime: <span class="m-info-val">${esc(uptimeStr)}</span></span>
</div>
<div class="m-search-wrap">
  <input type="text" id="menuSearchInput" class="m-search-input" placeholder="🔍 Cari command atau deskripsi..." oninput="onSearchInput(this.value)" />
</div>

<div id="screenCategories" class="ui-screen active">
  <div class="m-cat-list" id="catListContainer"></div>
  <button type="button" class="m-all-btn" onclick="showAll()">📦 Tampilkan Semua Command (${commands.length})</button>
</div>

<div id="screenCommands" class="ui-screen">
  <div class="m-nav-bar">
    <button type="button" class="m-back-btn" onclick="backToCategories()">← Kembali ke Kategori</button>
    <span class="ui-badge" id="cmdCatBadge">0 cmd</span>
  </div>
  <div class="m-cat-title" id="cmdCatTitle"></div>
  <div id="cmdListContainer"></div>
</div>

<div id="screenSearch" class="ui-screen">
  <div class="m-nav-bar">
    <button type="button" class="m-back-btn" onclick="clearSearch()">← Hapus Pencarian</button>
    <span class="ui-badge" id="searchResultBadge">0 hasil</span>
  </div>
  <div id="searchListContainer"></div>
</div>
<div class="m-mode-tip">
  💡 <b>Mode UI Aktif</b> · Ketik <b>${esc(prefix)}register mode text</b> untuk ganti ke teks biasa, atau gunakan flag <b>--text</b>
</div>
${clientScript}`;

    return renderPage({
        title: `👾 ${setting.name || "Bot"} Menu`,
        badge: `${commands.length} Commands`,
        body: bodyHtml,
        styles: menuStyles
    });
}

export default {
    name: "menu",
    aliases: ["help", "list"],
    category: "general",
    description: "Menampilkan daftar perintah bot secara interaktif",
    usage: "!menu [all/nama kategori] [--ui/--text]",
    async handler({ message, args, sock, sender, isGroup, prefix = "!" }) {
        let forcedMode = null;
        const cleanArgs = [];

        for (const arg of args) {
            const lower = arg.toLowerCase();
            if (lower === "--ui") {
                forcedMode = "ui";
            } else if (lower === "--text" || lower === "--txt") {
                forcedMode = "text";
            } else {
                cleanArgs.push(arg);
            }
        }

        const normalizedSender = resolveUserId(sender);
        const userData = getUser(normalizedSender);
        const userPref = userData.meta?.displayMode ?? "ui";
        const displayMode = forcedMode || userPref;

        let input = cleanArgs.length > 0 ? cleanArgs.join(" ").toLowerCase().trim() : "";
        let isAll = false;
        let targetCategory = null;

        if (input === "all") {
            isAll = true;
        } else if (input) {
            const groups = getGroupedCommands();
            for (const key of groups.keys()) {
                if (key.toLowerCase() === input) {
                    targetCategory = key;
                    break;
                }
            }
            if (!targetCategory) {
                await message.reply(`❌ Kategori *${input}* tidak ditemukan.\nKetik \`${prefix}menu\` untuk melihat daftar kategori.`);
                return;
            }
        }

        // ── 1. Interactive Webview UI Mode ───────────────────────────────────
        if (displayMode === "ui") {
            try {
                // Selalu beritahu pengguna bahwa mereka sedang dalam mode UI dan cara beralih ke mode teks
                const uiNotice = `💡 *Info Mode UI*\nKamu sedang menggunakan tampilan *UI Interaktif*.\n• Ganti permanen ke teks: \`${prefix}register mode text\`\n• Mode teks sementara: tambahkan flag \`--text\` (contoh: \`${prefix}menu --text\`)`;
                await sock.sendMessage(message.chat, { text: uiNotice }, { quoted: message });

                const html = generateMenuUI({
                    initialCategory: targetCategory,
                    isAll,
                    prefix
                });

                const sent = await sendUI(sock, message.chat, {
                    title: `👾 ${setting.name || "Bot"} Menu`,
                    html
                });

                // Auto-delete HTML webview payload after 2 minutes to prevent viewport lag spikes
                if (sent?.key) {
                    setTimeout(() => {
                        sock.sendMessage(message.chat, { delete: { ...sent.key, fromMe: true } }).catch(() => {});
                    }, 120000);
                }
                return;
            } catch (uiErr) {
                console.error("[Menu UI Error] Failed to send UI, falling back to text:", uiErr);
                // Fallback to text below
            }
        }

        // ── 2. Fallback / Text Mode ──────────────────────────────────────────
        if (!isGroup) {
            const menuText = generateAllCommands(0);
            await sock.sendMessage(message.chat, { text: menuText }, { quoted: message });
            return;
        }

        let menuText = "";
        let isSpecific = !!targetCategory;
        let timeoutSec = 60;

        if (isAll) {
            menuText = generateAllCommands(timeoutSec);
        } else if (targetCategory) {
            menuText = generateCategoryCommands(targetCategory, timeoutSec);
        } else {
            timeoutSec = 90;
            menuText = generateCategoryList(timeoutSec);
        }

        const sentMsg = await sock.sendMessage(message.chat, { text: menuText }, { quoted: message });

        const timeoutId = setTimeout(async () => {
            try {
                await sock.sendMessage(message.chat, { text: "❌ *Command timeout*", edit: sentMsg.key });
                deleteReplyHandler(sentMsg.key.id);
            } catch (err) {
                console.error("[MENU] Gagal edit timeout:", err.message);
            }
        }, timeoutSec * 1000);

        if (!isAll && !isSpecific) {
            registerReplyHandler(sentMsg.key.id, replyHandler, {
                userId: sender,
                messageKey: sentMsg.key,
                timeoutId,
                commandName: "menu"
            });
        }
    }
};

async function replyHandler({ message, sock, state }) {
    const text = (message.text || "").toLowerCase().trim();
    const { userId, messageKey, timeoutId } = state;

    const newMenuText = generateCategoryCommands(text);
    
    if (!newMenuText) {
        await message.reply(`❌ Kategori *${text}* tidak valid.\nSilakan balas dengan nama kategori yang benar (contoh: 'anime').`);
        return;
    }

    if (timeoutId) clearTimeout(timeoutId);
    
    deleteReplyHandler(messageKey.id);

    await sock.sendMessage(message.chat, { text: newMenuText, edit: messageKey });
}
