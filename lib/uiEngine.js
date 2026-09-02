/**
 * UI Engine — Reusable interactive HTML UI for WhatsApp.
 *
 * Sends rich HTML content rendered inside WhatsApp's webview via the
 * undocumented `richResponseMessage` / `GenAIaeacdsnwHtmlPrimitive` API.
 *
 * Usage pattern (similar to jidHelper.js — pure functions, no side effects):
 *
 *   import { sendUI, renderPage, renderCard } from "../lib/uiEngine.js";
 *
 *   await sendUI(sock, chatId, {
 *       title: "Profile",
 *       html: renderPage({
 *           title: "👤 Profile",
 *           body: renderCard({ icon: "👤", title: "User", rows: [...] })
 *       })
 *   });
 *
 * Or bypass the builders entirely for custom HTML:
 *
 *   await sendUI(sock, chatId, { title: "Game", html: rawHtmlString });
 */

import { randomUUID } from "crypto";

// ── Constants ───────────────────────────────────────────────────────────────

/** Default bot JID used in forwardedAiBotMessageInfo. Universal across instances. */
const BOT_JID = "867051314767696@bot";

// ── Base Design System ──────────────────────────────────────────────────────

/**
 * Built-in dark-mode CSS design system.
 *
 * Provides:
 * - CSS custom properties for colors, spacing, typography, radii
 * - Layout primitives: .ui-page, .ui-header, .ui-badge
 * - Card components: .ui-card, .ui-card-header, .ui-row
 * - List components: .ui-list, .ui-list-item
 * - Section separators: .ui-section, .ui-divider
 * - Micro-animations: fadeIn, pulse
 *
 * Commands can extend this via the `styles` parameter in renderPage().
 */
const BASE_CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;margin:0;padding:0}
html,body{width:100%;overflow-x:hidden;background:transparent;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;touch-action:manipulation;-webkit-font-smoothing:antialiased}

:root{
  --bg-page:linear-gradient(145deg,#090b12,#151925);
  --bg-card:#111522;
  --bg-card-alt:rgba(255,255,255,.04);
  --bg-section:linear-gradient(145deg,rgba(99,102,241,.12),rgba(168,85,247,.06));
  --bg-badge:rgba(255,255,255,.07);

  --border:rgba(255,255,255,.08);
  --border-accent:rgba(99,102,241,.25);

  --text-primary:#f1f3f8;
  --text-secondary:#9ca3af;
  --text-muted:#6b7280;
  --text-accent:#a5b4fc;
  --text-value:#e0e7ff;

  --radius-sm:10px;
  --radius-md:16px;
  --radius-lg:22px;
  --radius-pill:100px;

  --shadow-card:0 8px 32px rgba(0,0,0,.3);
  --shadow-inset:inset 0 1px 0 rgba(255,255,255,.04);

  --spacing-xs:6px;
  --spacing-sm:10px;
  --spacing-md:14px;
  --spacing-lg:20px;
}

/* ── Page Shell ─────────────────────────────────── */
.ui-page{
  width:100%;max-width:420px;margin:0 auto;padding:var(--spacing-md);
  border-radius:var(--radius-lg);background:var(--bg-page);color:var(--text-primary);
  border:1px solid var(--border);box-shadow:var(--shadow-card);
  animation:uiFadeIn .3s ease-out;
}

/* ── Header ─────────────────────────────────────── */
.ui-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:var(--spacing-md);padding-bottom:var(--spacing-sm);
  border-bottom:1px solid var(--border);
}
.ui-header-title{font-size:20px;font-weight:900;letter-spacing:-.5px}
.ui-badge{
  padding:5px 10px;border-radius:var(--radius-pill);
  background:var(--bg-badge);border:1px solid var(--border);
  font-size:9px;font-weight:900;color:var(--text-accent);
  letter-spacing:.5px;text-transform:uppercase;
}

/* ── Card ───────────────────────────────────────── */
.ui-card{
  border-radius:var(--radius-md);background:var(--bg-card);
  border:1px solid var(--border);overflow:hidden;
  box-shadow:var(--shadow-card);
}
.ui-card+.ui-card{margin-top:var(--spacing-sm)}

.ui-card-header{
  padding:var(--spacing-md);
  background:var(--bg-section);border-bottom:1px solid var(--border);
  text-align:center;
}
.ui-card-icon{font-size:36px;line-height:1;margin-bottom:4px}
.ui-card-title{font-size:18px;font-weight:900;margin-top:2px}
.ui-card-subtitle{font-size:10px;color:var(--text-secondary);margin-top:4px}

/* ── Rows (key-value) ───────────────────────────── */
.ui-row{
  display:flex;align-items:center;gap:var(--spacing-sm);
  padding:var(--spacing-sm) var(--spacing-md);
  border-bottom:1px solid rgba(255,255,255,.04);
  font-size:12px;
}
.ui-row:last-child{border-bottom:none}
.ui-row-icon{font-size:14px;flex-shrink:0;width:20px;text-align:center}
.ui-row-label{color:var(--text-muted);font-weight:700;min-width:70px;flex-shrink:0;font-size:10px;text-transform:uppercase;letter-spacing:.3px}
.ui-row-value{color:var(--text-value);font-weight:600;flex:1;text-align:right;word-break:break-word}

/* ── Sections (within cards) ────────────────────── */
.ui-section{margin-top:0}
.ui-section-title{
  padding:var(--spacing-sm) var(--spacing-md);
  font-size:10px;font-weight:900;color:var(--text-accent);
  text-transform:uppercase;letter-spacing:.5px;
  background:rgba(99,102,241,.06);border-bottom:1px solid var(--border);
  border-top:1px solid var(--border);
}

/* ── List ───────────────────────────────────────── */
.ui-list{display:grid;gap:var(--spacing-xs)}
.ui-list-item{
  display:flex;align-items:center;gap:var(--spacing-sm);
  padding:var(--spacing-sm) var(--spacing-md);
  border-radius:var(--radius-md);background:var(--bg-card);
  border:1px solid var(--border);
  transition:background .15s ease, transform .1s ease;
  cursor:pointer;
}
.ui-list-item:active{
  transform:scale(0.98);
  background:var(--bg-card-alt);
}
.ui-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  width:100%;padding:10px 14px;border-radius:var(--radius-sm);
  background:var(--bg-card);color:var(--text-primary);
  border:1px solid var(--border);font-size:12px;font-weight:700;
  text-decoration:none;cursor:pointer;transition:background .15s ease, transform .1s ease;
}
.ui-btn:active{transform:scale(0.98);background:var(--bg-card-alt)}
.ui-screen{display:none}
.ui-screen.active{display:block}
.ui-list-icon{
  width:36px;height:36px;border-radius:var(--radius-sm);
  background:var(--bg-section);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  font-size:18px;flex-shrink:0;
}
.ui-list-content{flex:1;min-width:0}
.ui-list-title{font-size:13px;font-weight:800}
.ui-list-desc{font-size:10px;color:var(--text-secondary);margin-top:2px}
.ui-list-arrow{color:var(--text-muted);font-size:16px;font-weight:700;flex-shrink:0}

/* ── Divider ────────────────────────────────────── */
.ui-divider{
  height:1px;background:var(--border);margin:var(--spacing-sm) 0;
}

/* ── Utilities ──────────────────────────────────── */
.ui-text-center{text-align:center}
.ui-text-muted{color:var(--text-secondary);font-size:10px}
.ui-mt-sm{margin-top:var(--spacing-sm)}
.ui-mt-md{margin-top:var(--spacing-md)}
.ui-p-md{padding:var(--spacing-md)}

/* ── Animations ─────────────────────────────────── */
@keyframes uiFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes uiPulse{from{transform:scale(.92)}to{transform:scale(1)}}
.ui-animate-pulse{animation:uiPulse .6s infinite alternate}
`;

// ── HTML Helpers ─────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent injection.
 * @param {string} str - Raw string
 * @returns {string} Escaped string safe for HTML insertion
 */
export function esc(str) {
    if (typeof str !== "string") str = String(str ?? "");
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Render Functions ────────────────────────────────────────────────────────

/**
 * Render a full HTML page with the built-in design system.
 *
 * @param {object} options
 * @param {string}  options.title   - Header text (can include emoji)
 * @param {string}  options.body    - Inner HTML content (from renderCard/renderList or custom)
 * @param {string}  [options.badge] - Optional badge text shown in header (e.g. "MEMBER", "VIP")
 * @param {string}  [options.styles] - Optional additional CSS to inject after the base stylesheet
 * @returns {string} Complete HTML document string
 *
 * @example
 * renderPage({
 *     title: "👤 Profile",
 *     badge: "MEMBER",
 *     body: renderCard({ ... }),
 *     styles: ".custom { color: red; }"
 * })
 */
export function renderPage({ title, body, badge, styles }) {
    const badgeHtml = badge
        ? `<div class="ui-badge">${esc(badge)}</div>`
        : "";

    const customStyles = styles
        ? `<style>${styles}</style>`
        : "";

    return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${BASE_CSS}</style>
${customStyles}
</head>
<body>
<div class="ui-page">
<div class="ui-header">
<div class="ui-header-title">${esc(title)}</div>
${badgeHtml}
</div>
${body}
</div>
</body>
</html>`;
}

/**
 * Render an info card with optional rows and sub-sections.
 *
 * @param {object} options
 * @param {string}  [options.icon]      - Emoji displayed large in the card header
 * @param {string}  [options.title]     - Card title text
 * @param {string}  [options.subtitle]  - Small text below the title
 * @param {Array<{label: string, value: string, icon?: string}>} [options.rows]
 *   Main rows displayed as key-value pairs.
 * @param {Array<{title: string, rows: Array<{label: string, value: string, icon?: string}>}>} [options.sections]
 *   Additional sub-sections, each with its own title and rows.
 * @returns {string} HTML fragment (not a full page — pass to renderPage's body)
 *
 * @example
 * renderCard({
 *     icon: "👤",
 *     title: "Tederby",
 *     subtitle: "Member since 2024",
 *     rows: [
 *         { label: "Role", value: "Owner", icon: "🎖️" },
 *         { label: "Status", value: "Registered" },
 *     ],
 *     sections: [
 *         { title: "🔗 Linked", rows: [{ label: "Steam", value: "gaben" }] }
 *     ]
 * })
 */
export function renderCard({ icon, title, subtitle, rows, sections }) {
    let html = `<div class="ui-card">`;

    // ── Card header
    if (icon || title || subtitle) {
        html += `<div class="ui-card-header">`;
        if (icon) html += `<div class="ui-card-icon">${icon}</div>`;
        if (title) html += `<div class="ui-card-title">${esc(title)}</div>`;
        if (subtitle) html += `<div class="ui-card-subtitle">${esc(subtitle)}</div>`;
        html += `</div>`;
    }

    // ── Main rows
    if (rows?.length) {
        html += renderRows(rows);
    }

    // ── Sub-sections
    if (sections?.length) {
        for (const section of sections) {
            html += `<div class="ui-section">`;
            if (section.title) {
                html += `<div class="ui-section-title">${esc(section.title)}</div>`;
            }
            if (section.rows?.length) {
                html += renderRows(section.rows);
            }
            html += `</div>`;
        }
    }

    html += `</div>`;
    return html;
}

/**
 * Render a list of items — suitable for menus, search results, category lists.
 *
 * @param {object} options
 * @param {string}  [options.icon]     - Emoji for the header area
 * @param {string}  [options.title]    - List title
 * @param {string}  [options.subtitle] - Small text below the title
 * @param {Array<{icon: string, title: string, desc?: string}>} options.items
 *   Array of list items to render.
 * @returns {string} HTML fragment (not a full page — pass to renderPage's body)
 *
 * @example
 * renderList({
 *     icon: "📋",
 *     title: "Kategori",
 *     subtitle: "Pilih salah satu",
 *     items: [
 *         { icon: "🌸", title: "Anime", desc: "12 commands" },
 *         { icon: "🎮", title: "Game",  desc: "3 commands"  },
 *     ]
 * })
 */
export function renderList({ icon, title, subtitle, items }) {
    let html = "";

    // ── Optional header card
    if (icon || title || subtitle) {
        html += `<div class="ui-card">`;
        html += `<div class="ui-card-header">`;
        if (icon) html += `<div class="ui-card-icon">${icon}</div>`;
        if (title) html += `<div class="ui-card-title">${esc(title)}</div>`;
        if (subtitle) html += `<div class="ui-card-subtitle">${esc(subtitle)}</div>`;
        html += `</div></div>`;
    }

    // ── List items
    if (items?.length) {
        html += `<div class="ui-list ui-mt-sm">`;
        for (const item of items) {
            const clickAttr = item.onClick ? ` onclick="${esc(item.onClick)}" role="button" tabindex="0"` : "";
            html += `<div class="ui-list-item"${clickAttr}>`;
            if (item.icon) html += `<div class="ui-list-icon">${item.icon}</div>`;
            html += `<div class="ui-list-content">`;
            html += `<div class="ui-list-title">${esc(item.title)}</div>`;
            if (item.desc) html += `<div class="ui-list-desc">${esc(item.desc)}</div>`;
            html += `</div>`;
            html += `<div class="ui-list-arrow">›</div>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    return html;
}

/**
 * Send an interactive HTML UI message to a WhatsApp chat.
 *
 * This wraps the HTML payload in the `richResponseMessage` protobuf structure
 * and sends it via `sock.relayMessage()`. The WhatsApp client renders the HTML
 * in a webview.
 *
 * @param {import("baileys").WASocket} sock - Baileys socket instance
 * @param {string} chatId - Chat JID to send to
 * @param {object} options
 * @param {string}  options.title - Text shown in the message preview / submessage
 * @param {string}  options.html  - Complete HTML string to render (from renderPage or raw)
 * @returns {Promise<void>}
 *
 * @example
 * // Using render helpers
 * await sendUI(sock, message.chat, {
 *     title: "Profile",
 *     html: renderPage({ title: "👤 Profile", body: renderCard({ ... }) })
 * });
 *
 * // Using raw HTML
 * await sendUI(sock, message.chat, {
 *     title: "Game Center",
 *     html: "<html>...</html>"
 * });
 */
export async function sendUI(sock, chatId, { title, html }) {
    const responseId = randomUUID();

    const payload = Buffer.from(
        JSON.stringify({
            response_id: responseId,
            sections: [
                {
                    view_model: {
                        primitive: {
                            __typename: "GenAIaeacdsnwHtmlPrimitive",
                            payload: html,
                            trusted_sources: [],
                        },
                        __typename: "GenAISingleLayoutViewModel",
                    },
                },
            ],
        })
    ).toString("base64");

    console.log(`[uiEngine] Relaying UI message to ${chatId} | Title: "${title}" | ID: ${responseId} | Size: ${payload.length}B`);

    try {
        await sock.relayMessage(
            chatId,
            {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                    botMetadata: {
                        botResponseId: responseId,
                    },
                },
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            submessages: [
                                {
                                    messageType: 2,
                                    messageText: title || "Interactive UI",
                                },
                            ],
                            unifiedResponse: {
                                data: payload,
                            },
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedAiBotMessageInfo: {
                                    botJid: BOT_JID,
                                },
                                forwardOrigin: 4,
                            },
                        },
                    },
                },
            },
            {
                messageId: responseId,
            }
        );

        console.log(`[uiEngine] Successfully relayed UI message ID: ${responseId}`);
        return { key: { remoteJid: chatId, id: responseId }, messageId: responseId };
    } catch (relayErr) {
        console.error(`[uiEngine Error] Failed to relay UI message ID: ${responseId} to ${chatId}:`, relayErr);
        throw relayErr;
    }
}

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Render an array of row objects to HTML.
 * @param {Array<{label: string, value: string, icon?: string}>} rows
 * @returns {string} HTML string of .ui-row elements
 */
function renderRows(rows) {
    let html = "";
    for (const row of rows) {
        html += `<div class="ui-row">`;
        if (row.icon) html += `<div class="ui-row-icon">${row.icon}</div>`;
        html += `<div class="ui-row-label">${esc(row.label)}</div>`;
        html += `<div class="ui-row-value">${esc(row.value)}</div>`;
        html += `</div>`;
    }
    return html;
}
