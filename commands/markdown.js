import { sendUI } from "../lib/uiEngine.js";

/**
 * Escape HTML entities to prevent injection when embedding user text
 * into the webview HTML document.
 *
 * @param {string} str - Raw user text
 * @returns {string} HTML-safe string
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Lightweight server-side markdown-to-HTML converter.
 *
 * Handles the most common markdown constructs without external dependencies:
 * - Headings (# through ######)
 * - Bold (**text**), italic (*text*), strikethrough (~~text~~), inline code (`code`)
 * - Fenced code blocks (```lang ... ```)
 * - Blockquotes (> text)
 * - Unordered lists (- item / * item)
 * - Ordered lists (1. item)
 * - Tables (| col | col |)
 * - Horizontal rules (---, ***, ___)
 * - Links [text](url) and images ![alt](src)
 *
 * @param {string} md - Raw markdown text
 * @returns {string} HTML string
 */
function markdownToHtml(md) {
    const lines = md.split("\n");
    const output = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // ── Fenced code blocks ──────────────────────────────────────────
        const fenceMatch = line.match(/^```(\w*)\s*$/);
        if (fenceMatch) {
            const lang = escapeHtml(fenceMatch[1] || "");
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].match(/^```\s*$/)) {
                codeLines.push(escapeHtml(lines[i]));
                i++;
            }
            i++; // skip closing ```
            const langAttr = lang ? ` data-lang="${lang}"` : "";
            const langLabel = lang ? `<span class="md-code-lang">${lang}</span>` : "";
            output.push(`<div class="md-code-block"${langAttr}>${langLabel}<pre><code>${codeLines.join("\n")}</code></pre></div>`);
            continue;
        }

        // ── Horizontal rules ────────────────────────────────────────────
        if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
            output.push("<hr class=\"md-hr\">");
            i++;
            continue;
        }

        // ── Headings ────────────────────────────────────────────────────
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            output.push(`<h${level} class="md-h${level}">${inlineFormat(headingMatch[2])}</h${level}>`);
            i++;
            continue;
        }

        // ── Tables ──────────────────────────────────────────────────────
        if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+[-|:\s]+$/.test(lines[i + 1])) {
            const tableLines = [];
            while (i < lines.length && lines[i].includes("|")) {
                tableLines.push(lines[i]);
                i++;
            }
            output.push(parseTable(tableLines));
            continue;
        }

        // ── Blockquotes ─────────────────────────────────────────────────
        if (/^>\s?/.test(line)) {
            const quoteLines = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                quoteLines.push(lines[i].replace(/^>\s?/, ""));
                i++;
            }
            output.push(`<blockquote class="md-blockquote">${markdownToHtml(quoteLines.join("\n"))}</blockquote>`);
            continue;
        }

        // ── Unordered lists ─────────────────────────────────────────────
        if (/^(\s*)[-*+]\s+/.test(line)) {
            const listItems = [];
            while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i])) {
                listItems.push(lines[i].replace(/^(\s*)[-*+]\s+/, ""));
                i++;
            }
            output.push(`<ul class="md-ul">${listItems.map(li => `<li>${inlineFormat(li)}</li>`).join("")}</ul>`);
            continue;
        }

        // ── Ordered lists ───────────────────────────────────────────────
        if (/^\d+\.\s+/.test(line)) {
            const listItems = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                listItems.push(lines[i].replace(/^\d+\.\s+/, ""));
                i++;
            }
            output.push(`<ol class="md-ol">${listItems.map(li => `<li>${inlineFormat(li)}</li>`).join("")}</ol>`);
            continue;
        }

        // ── Empty lines → spacing ───────────────────────────────────────
        if (line.trim() === "") {
            output.push("");
            i++;
            continue;
        }

        // ── Default paragraph ───────────────────────────────────────────
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^(#{1,6}\s|```|>\s?|(\s*)[-*+]\s+|\d+\.\s+|(\s*[-*_]\s*){3,}$)/)) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            output.push(`<p class="md-p">${inlineFormat(paraLines.join("\n"))}</p>`);
        }
    }

    return output.join("\n");
}

/**
 * Apply inline markdown formatting to a line of text.
 *
 * @param {string} text - Single line or joined lines of text
 * @returns {string} HTML with inline formatting applied
 */
function inlineFormat(text) {
    let result = escapeHtml(text);

    // Images ![alt](src) — before links to prevent collision
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="md-img" src="$2" alt="$1">');

    // Links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="md-link" title="$2">$1</span>');

    // Bold **text** or __text__
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

    // Italic *text* or _text_ (but not inside words with underscores)
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");

    // Strikethrough ~~text~~
    result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Inline code `code`
    result = result.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Line breaks
    result = result.replace(/\n/g, "<br>");

    return result;
}

/**
 * Parse a markdown table block into an HTML table.
 *
 * @param {string[]} tableLines - Array of raw table lines including header, separator, and body rows
 * @returns {string} HTML table string
 */
function parseTable(tableLines) {
    if (tableLines.length < 2) return "";

    const parseCells = (line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

    const headers = parseCells(tableLines[0]);
    // Parse alignment from separator row
    const separators = parseCells(tableLines[1]);
    const aligns = separators.map(s => {
        if (/^:-+:$/.test(s)) return "center";
        if (/^-+:$/.test(s)) return "right";
        return "left";
    });

    let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
    headers.forEach((h, idx) => {
        html += `<th style="text-align:${aligns[idx] || "left"}">${inlineFormat(h)}</th>`;
    });
    html += "</tr></thead><tbody>";

    for (let r = 2; r < tableLines.length; r++) {
        const cells = parseCells(tableLines[r]);
        html += "<tr>";
        cells.forEach((c, idx) => {
            html += `<td style="text-align:${aligns[idx] || "left"}">${inlineFormat(c)}</td>`;
        });
        html += "</tr>";
    }

    html += "</tbody></table></div>";
    return html;
}

/**
 * Build a complete HTML document with embedded markdown CSS for the webview.
 *
 * @param {string} renderedHtml - Markdown converted to HTML
 * @returns {string} Full HTML5 document
 */
function buildDocument(renderedHtml) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:#0d0f13;color:#e4e4e7;
  font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
  line-height:1.7;padding:16px 14px;
  word-wrap:break-word;overflow-wrap:break-word;
  -webkit-text-size-adjust:100%;
}

/* ── Headings ──────────────────────────────────── */
.md-h1{font-size:1.65em;font-weight:700;color:#f4f4f5;margin:20px 0 10px;padding-bottom:8px;border-bottom:1px solid #27272a}
.md-h2{font-size:1.4em;font-weight:700;color:#f4f4f5;margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid #1e1e22}
.md-h3{font-size:1.2em;font-weight:600;color:#e4e4e7;margin:16px 0 6px}
.md-h4{font-size:1.05em;font-weight:600;color:#d4d4d8;margin:14px 0 4px}
.md-h5{font-size:0.95em;font-weight:600;color:#a1a1aa;margin:12px 0 4px}
.md-h6{font-size:0.85em;font-weight:600;color:#71717a;margin:10px 0 4px;text-transform:uppercase;letter-spacing:0.05em}

/* ── Paragraph ─────────────────────────────────── */
.md-p{margin:8px 0;color:#d4d4d8}

/* ── Bold / Italic / Strikethrough ─────────────── */
strong{color:#f4f4f5;font-weight:600}
em{color:#a1a1aa;font-style:italic}
del{color:#71717a;text-decoration:line-through}

/* ── Inline Code ───────────────────────────────── */
.md-inline-code{
  background:#1e1e22;color:#a78bfa;
  padding:2px 6px;border-radius:4px;
  font-family:'SF Mono','Fira Code','Cascadia Code',monospace;
  font-size:0.88em;
}

/* ── Code Blocks ───────────────────────────────── */
.md-code-block{
  position:relative;margin:12px 0;
  background:#141619;border:1px solid #1e2028;
  border-radius:8px;overflow:hidden;
}
.md-code-lang{
  position:absolute;top:0;right:0;
  padding:2px 10px;font-size:0.7em;
  color:#71717a;background:#1a1c20;
  border-bottom-left-radius:6px;
  text-transform:uppercase;letter-spacing:0.08em;
}
.md-code-block pre{
  margin:0;padding:14px;overflow-x:auto;
  -webkit-overflow-scrolling:touch;
}
.md-code-block code{
  font-family:'SF Mono','Fira Code','Cascadia Code',monospace;
  font-size:0.82em;color:#c4b5fd;
  line-height:1.6;white-space:pre;
}

/* ── Blockquotes ───────────────────────────────── */
.md-blockquote{
  margin:12px 0;padding:10px 14px;
  border-left:3px solid #3f3f46;
  background:#14161a;border-radius:0 6px 6px 0;
  color:#a1a1aa;
}
.md-blockquote p{margin:4px 0}

/* ── Lists ─────────────────────────────────────── */
.md-ul,.md-ol{margin:8px 0;padding-left:24px;color:#d4d4d8}
.md-ul li,.md-ol li{margin:4px 0;padding-left:4px}
.md-ul{list-style-type:disc}
.md-ol{list-style-type:decimal}

/* ── Tables ────────────────────────────────────── */
.md-table-wrap{margin:12px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:8px;border:1px solid #1e2028}
.md-table{width:100%;border-collapse:collapse;font-size:0.9em}
.md-table th{
  background:#18191e;color:#a1a1aa;
  padding:8px 12px;text-align:left;
  font-weight:600;font-size:0.85em;
  text-transform:uppercase;letter-spacing:0.04em;
  border-bottom:1px solid #27272a;
}
.md-table td{
  padding:8px 12px;color:#d4d4d8;
  border-bottom:1px solid #1a1c20;
}
.md-table tbody tr:last-child td{border-bottom:none}
.md-table tbody tr:hover{background:#1a1c22}

/* ── Horizontal Rule ───────────────────────────── */
.md-hr{border:none;border-top:1px solid #27272a;margin:16px 0}

/* ── Links (not navigable in sandbox) ──────────── */
.md-link{color:#818cf8;text-decoration:underline;text-decoration-color:#818cf850}

/* ── Images ────────────────────────────────────── */
.md-img{max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block}

/* ── Scrollbar ─────────────────────────────────── */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#27272a;border-radius:4px}
</style>
</head>
<body>
<div class="md-root">
${renderedHtml}
</div>
</body>
</html>`;
}

export default {
    name: "markdown",
    aliases: ["md", "rendermd"],
    category: "tools",
    description: "Render raw text as styled markdown in an interactive WhatsApp webview",
    usage: "!md <text> (atau balas pesan berisi teks markdown dengan !md)",
    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    ownerOnly: false,
    privateOnly: false,
    registerRequired: false,

    async handler({ message, sock, rawArgs, text, prefix }) {
        // Resolve input from direct arguments or quoted message text
        const rawInput = rawArgs || text;
        let content = rawInput ? rawInput.trim() : (message.quoted?.text ? message.quoted.text.trim() : "");

        if (!content) {
            return message.reply(
                `╭━━━〔 📝 *MARKDOWN RENDERER* 〕━━━\n` +
                `┃ *Format:* \`${prefix}md <teks_markdown>\`\n` +
                `┃ *Atau:* Balas pesan berisi teks dengan \`${prefix}md\`\n` +
                `┃\n` +
                `┃ *Contoh:*\n` +
                `┃ \`${prefix}md # Judul\\n**tebal** dan *miring*\`\n` +
                `┃\n` +
                `┃ Teks yang diberikan akan dirender\n` +
                `┃ sebagai markdown dalam webview.\n` +
                `┃ _Tampilan otomatis dihapus dalam 2 menit._\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━`
            );
        }

        // Strip code fences if wrapped by user (```md ... ``` or ``` ... ```)
        const fenceMatch = content.match(/^```(?:md|markdown)?\s*\n?([\s\S]*?)\n?```$/i);
        if (fenceMatch) {
            content = fenceMatch[1].trim();
        }

        // Convert markdown to HTML on the server side
        const renderedHtml = markdownToHtml(content);
        const fullHtml = buildDocument(renderedHtml);

        // Extract title from first heading if present, otherwise default
        const titleMatch = content.match(/^#{1,3}\s+(.+)$/m);
        const previewTitle = titleMatch
            ? `📝 ${titleMatch[1].substring(0, 40)}`
            : "📝 Markdown Preview";

        try {
            const sent = await sendUI(sock, message.chat, {
                title: previewTitle,
                html: fullHtml
            });

            await message.reply(
                `📝 *Markdown Berhasil Dirender!*\n` +
                `⏱️ _Tampilan interaktif ini akan otomatis dihapus dalam 2 menit._`
            );

            // Auto-delete webview payload after 2 minutes to prevent viewport lag
            if (sent?.key) {
                setTimeout(() => {
                    sock.sendMessage(message.chat, {
                        delete: { ...sent.key, fromMe: true }
                    }).catch(() => {});
                }, 120000);
            }
        } catch (error) {
            console.error("[Markdown Command Error] Failed to render markdown:", error);
            await message.reply("❌ Gagal merender markdown. Pastikan aplikasi WhatsApp Anda mendukung pesan interaktif.");
        }
    }
};
