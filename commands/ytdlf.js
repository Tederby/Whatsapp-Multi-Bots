/**
 * ytdlf — Format Selection Download
 *
 * Step 1: User sends `!ytdlf <url>` → bot fetches info and shows available formats.
 * Step 2: User replies with format IDs (e.g. "137+140") → bot downloads and sends as document.
 */

import fs from "fs";
import axios from "axios";
import { getCachedInfo } from "../services/infoCache.js";
import {
    download,
    parseFormats,
    formatDuration,
    formatSize,
    getPlatformName,
    estimateSize,
    detectStreams,
} from "../services/ytdlp.js";
import { downloadQueue } from "../services/downloadQueue.js";
import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { tryDelete } from "../services/cleanup.js";
import { isUrl } from "../lib/utils.js";
import setting from "../setting.js";

export default {
    name: "ytdlf",
    aliases: [],
    description: "Download with manual format selection",

    async handler({ message, sock, args, prefix, sender }) {
        const url = args[0];
        if (!url || !isUrl(url)) {
            return message.reply(
                "❌ Masukkan URL yang valid.\nContoh: `!ytdlf https://youtube.com/watch?v=xxx`"
            );
        }

        // ── 1. Fetch info ───────────────────────────────────────────
        const update = await message.replyUpdate("⏳ Mengambil info video...");
        let info;
        try {
            info = await getCachedInfo(url);
        } catch (err) {
            return update("❌ Gagal mengambil info. URL mungkin tidak valid atau tidak didukung.");
        }

        const title = info.title || "Untitled";
        const duration = formatDuration(info.duration);
        const platform = getPlatformName(info.extractor_key);
        const formats = parseFormats(info.formats);

        if (!formats.length) {
            return update("❌ Tidak ada format yang tersedia untuk URL ini.");
        }

        // ── 2. Build format table ───────────────────────────────────
        const table = buildFormatTable(formats);

        // ── 3. Send overview with thumbnail ─────────────────────────
        const caption = [
            `📋 *${title}*`,
            `🕐 ${duration} | 🌐 ${platform}`,
            ``,
            `📦 *Format yang tersedia:*`,
            "```",
            table,
            "```",
            ``,
            `💡 Reply pesan ini dengan ID format`,
            `Contoh: *137+140* (video+audio)`,
        ].join("\n");

        let sentMsg;
        try {
            // Try to send with thumbnail
            if (info.thumbnail) {
                const thumbResp = await axios.get(info.thumbnail, {
                    responseType: "arraybuffer",
                    timeout: 10000,
                }).catch(() => null);

                if (thumbResp) {
                    sentMsg = await sock.sendMessage(message.chat, {
                        image: Buffer.from(thumbResp.data),
                        caption,
                    }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
                }
            }

            // Fallback: text only
            if (!sentMsg) {
                sentMsg = await sock.sendMessage(message.chat, {
                    text: caption,
                }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
            }
        } catch (err) {
            // Last resort: send text
            sentMsg = await sock.sendMessage(message.chat, {
                text: caption,
            }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
        }

        // Edit the "loading" message to show completion
        await update("✅ Info berhasil diambil. Lihat detail di bawah ⬇️");

        // ── 4. Register reply handler ───────────────────────────────
        registerReplyHandler(sentMsg.key.id, handleFormatReply, {
            commandName: "ytdlf",
            url,
            formats: info.formats, // Raw formats for download
            parsedFormats: formats, // Parsed for validation
            metadata: { title, duration, platform },
            userId: sender,
            chatId: message.chat,
        });
    },
};

// ── Reply Handler ───────────────────────────────────────────────────────────

/**
 * Called when the user replies to the format-list message with format IDs.
 */
async function handleFormatReply({ message, sock, state }) {
    const text = (message.text || "").trim();
    if (!text) return;

    // Parse format IDs (e.g. "137+140" or just "140")
    const formatIds = text.split("+").map((s) => s.trim()).filter(Boolean);
    if (!formatIds.length) {
        return message.reply("❌ Format tidak valid. Contoh: `137+140` atau `140`");
    }

    // Validate all format IDs exist
    const validIds = new Set(state.formats.map((f) => f.format_id));
    const invalid = formatIds.filter((id) => !validIds.has(id));
    if (invalid.length) {
        return message.reply(`❌ Format \`${invalid.join(", ")}\` tidak ditemukan. Cek kembali daftar format.`);
    }

    const formatStr = formatIds.join("+");
    const { title, duration, platform } = state.metadata;

    // ── Stream detection ────────────────────────────────────────
    const { hasVideo, hasAudio } = detectStreams(formatStr, state.formats);

    // ── Size estimation ─────────────────────────────────────────
    const estSize = estimateSize(formatStr, state.formats);
    const maxDoc = setting.ytdlp.maxFileSizeDoc;
    if (estSize && estSize > maxDoc) {
        return message.reply(
            `❌ Estimasi ukuran file (${formatSize(estSize)}) melebihi limit WhatsApp (${formatSize(maxDoc)}).`
        );
    }

    // Notify if no audio
    if (hasVideo && !hasAudio) {
        await message.reply("ℹ️ Format yang dipilih tidak mengandung audio.");
    }

    // ── Queue ───────────────────────────────────────────────────
    const queuePos = downloadQueue.pending;
    let statusMsg;
    if (queuePos > 0) {
        statusMsg = await message.replyUpdate(`📋 Antrian ke-${queuePos + 1}. Mohon tunggu...`);
    } else {
        statusMsg = await message.replyUpdate(`⏳ Mengunduh format ${formatStr}...`);
    }
    await downloadQueue.acquire();

    let filePath;
    try {
        await statusMsg(`⏳ Mengunduh format ${formatStr}...`);

        // Determine label for filename
        const resLabel = resolveLabel(formatIds, state.formats);
        filePath = await download(state.url, formatStr, title, resLabel);

        const stat = fs.statSync(filePath);
        const fileName = buildFileName(title, resLabel, filePath);

        await statusMsg("✅ Berhasil! Mengirim file...");

        // ── Send as document ────────────────────────────────────
        const caption = [
            `🎬 *${title}*`,
            `📦 Format: ${formatStr}`,
            `📏 Durasi: ${duration}`,
            `🌐 Platform: ${platform}`,
            `📊 Ukuran: ${formatSize(stat.size)}`,
        ].join("\n");

        if (!hasVideo && hasAudio) {
            // Audio-only → send as audio document
            await sock.sendMessage(message.chat, {
                document: fs.readFileSync(filePath),
                mimetype: "audio/mp4",
                fileName,
                caption,
            }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
        } else {
            // Video (or video+audio) → send as video document
            await sock.sendMessage(message.chat, {
                document: fs.readFileSync(filePath),
                mimetype: "video/mp4",
                fileName,
                caption,
            }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
        }

        await statusMsg("✅ Selesai!");
    } catch (err) {
        console.error("[ytdlf]", err);
        await statusMsg("❌ Gagal mengunduh. " + (err.message || "Coba lagi nanti."));
    } finally {
        tryDelete(filePath);
        downloadQueue.release();
        // Clean up the reply handler so it can't be used again
        if (message.contextInfo?.stanzaId) {
            deleteReplyHandler(message.contextInfo.stanzaId);
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a readable format table string.
 * @param {object[]} formats - From parseFormats()
 * @returns {string}
 */
function buildFormatTable(formats) {
    // Header
    const rows = [
        ["ID", "Res", "Size"],
    ];

    for (const f of formats) {
        rows.push([
            f.id,
            f.resolution,
            formatSize(f.size),
        ]);
    }

    // Calculate column widths
    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] || "").length)));

    // Build formatted table
    const pad = (s, w) => (s || "").padEnd(w);
    const sep = widths.map((w) => "─".repeat(w)).join("─┼─");
    const lines = [
        rows[0].map((h, i) => pad(h, widths[i])).join(" │ "),
        sep,
        ...rows.slice(1).map((r) => r.map((c, i) => pad(c, widths[i])).join(" │ ")),
    ];

    return lines.join("\n");
}

/**
 * Resolve a human-readable label from selected format IDs.
 * e.g. "1080p" or "audio" or "720p+audio"
 */
function resolveLabel(ids, rawFormats) {
    const parts = [];
    for (const id of ids) {
        const fmt = rawFormats.find((f) => f.format_id === id);
        if (!fmt) continue;
        if (fmt.vcodec && fmt.vcodec !== "none" && fmt.height) {
            parts.push(`${fmt.height}p`);
        } else if (fmt.acodec && fmt.acodec !== "none") {
            parts.push("audio");
        }
    }
    return parts.join("+") || "custom";
}

/**
 * Build a safe, informative filename from the title + label.
 * @param {string} title
 * @param {string} label
 * @param {string} filePath - Used to extract the actual extension
 * @returns {string}
 */
function buildFileName(title, label, filePath) {
    const ext = filePath.split(".").pop() || "mp4";
    const safe = title
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 80)
        .trim() || "download";
    return `${safe}_${label}.${ext}`;
}
