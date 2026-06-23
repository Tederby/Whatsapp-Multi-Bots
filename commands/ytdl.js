/**
 * ytdl — Quick Download
 *
 * Downloads with the best auto-selected format (≤720p by default).
 * If the estimated size exceeds the WhatsApp video limit (64 MB),
 * the bot cascades down to lower resolutions automatically.
 * Sends the result as an inline-playable video.
 */

import fs from "fs";
import { getCachedInfo } from "../services/infoCache.js";
import { download, formatDuration, getPlatformName, formatSize, estimateSize } from "../services/ytdlp.js";
import { downloadQueue } from "../services/downloadQueue.js";
import { tryDelete } from "../services/cleanup.js";
import { isUrl, sanitizeFilename } from "../lib/utils.js";
import setting from "../setting.js";

export default {
    name: "ytdl",
    aliases: ["yt", "video", "ytv"],
    category: "download",
    description: "Quick video/audio download (auto format)",
    usage: "!ytdl <url>",

    async handler({ message, sock, args, prefix }) {
        const url = args[0];
        if (!url || !isUrl(url)) {
            return message.reply("❌ Masukkan URL yang valid.\nContoh: `!ytdl https://youtube.com/watch?v=xxx`");
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

        // ── 2. Find best format that fits under the video size limit ─
        const maxSize = setting.ytdlp.maxFileSize;
        const cascadeFormats = setting.ytdlp.defaultFormats;
        let chosenFormat = null;
        let chosenLabel = "";

        for (const fmt of cascadeFormats) {
            // Try to estimate size for this format selector
            // We can't easily estimate for yt-dlp selectors like "bv*[height<=720]+ba/b"
            // so we pick the best matching formats from the info and sum their sizes
            const est = estimateFromSelector(fmt, info.formats);
            if (est !== null && est <= maxSize) {
                chosenFormat = fmt;
                chosenLabel = est.label || "";
                break;
            }
            // If we can't estimate, try it anyway (last resort)
            if (est === null) {
                chosenFormat = fmt;
                break;
            }
        }

        if (!chosenFormat) chosenFormat = cascadeFormats[cascadeFormats.length - 1];

        // ── 3. Acquire queue slot ───────────────────────────────────
        const queuePos = downloadQueue.pending;
        if (queuePos > 0) {
            await update(`📋 Antrian ke-${queuePos + 1}. Mohon tunggu...`);
        }
        await downloadQueue.acquire();

        let filePath;
        try {
            // ── 4. Download ─────────────────────────────────────────
            await update(`⏳ Mengunduh *${title}*...`);

            filePath = await download(url, chosenFormat, title, "auto");

            // ── 5. Check actual file size ───────────────────────────
            const stat = fs.statSync(filePath);
            if (stat.size > maxSize) {
                // File too large even after cascade → send as document instead
                await update(`⏳ Mengirim sebagai dokumen (${formatSize(stat.size)})...`);
                await sock.sendMessage(message.chat, {
                    document: fs.readFileSync(filePath),
                    mimetype: "video/mp4",
                    fileName: `${sanitizeFilename(title)}.mp4`,
                    caption: [
                        `🎬 *${title}*`,
                        `📏 Durasi: ${duration}`,
                        `🌐 Platform: ${platform}`,
                        `📦 Ukuran: ${formatSize(stat.size)}`,
                        ``,
                        `💡 Gunakan \`${prefix}ytdlf\` untuk format kustom`,
                    ].join("\n"),
                }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
            } else {
                // ── 6. Send as inline video ─────────────────────────
                await update("✅ Berhasil!");
                await sock.sendMessage(message.chat, {
                    video: fs.readFileSync(filePath),
                    caption: [
                        `🎬 *${title}*`,
                        `📏 Durasi: ${duration}`,
                        `🌐 Platform: ${platform}`,
                        ``,
                        `💡 Gunakan \`${prefix}ytdlf\` untuk format kustom`,
                    ].join("\n"),
                }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
            }
        } catch (err) {
            console.error("[ytdl]", err);
            await update("❌ Gagal mengunduh. " + (err.message || "Coba lagi nanti."));
        } finally {
            tryDelete(filePath);
            downloadQueue.release();
        }
    }
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Try to estimate the total download size for a yt-dlp format selector
 * by picking the best-matching format IDs from the available formats list.
 *
 * @param {string} selector - e.g. "bv*[height<=720]+ba/b"
 * @param {object[]} formats
 * @returns {{ bytes: number|null, label: string } | null}
 */
function estimateFromSelector(selector, formats) {
    if (!formats || !formats.length) return null;

    // Parse height constraint from selector (e.g. "bv*[height<=720]+ba/b")
    const heightMatch = selector.match(/height<=(\d+)/);

    if (heightMatch) {
        const maxH = parseInt(heightMatch[1]);
        // Find best video at or below this height
        const videos = formats
            .filter((f) => f.vcodec && f.vcodec !== "none" && f.height && f.height <= maxH)
            .sort((a, b) => (b.height || 0) - (a.height || 0));
        // Find best audio
        const audios = formats
            .filter((f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
            .sort((a, b) => (b.abr || 0) - (a.abr || 0));

        const vid = videos[0];
        const aud = audios[0];
        if (!vid) return null;

        const vSize = vid.filesize || vid.filesize_approx || 0;
        const aSize = aud ? (aud.filesize || aud.filesize_approx || 0) : 0;
        const total = vSize + aSize;
        return total > 0 ? { bytes: total, label: `${vid.height}p` } : null;
    }

    // Fallback selector like "b" — just pick the best single format
    if (selector === "b") {
        const best = formats
            .filter((f) => f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none")
            .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
        if (!best) return null;
        const size = best.filesize || best.filesize_approx;
        return size ? { bytes: size, label: `${best.height || "?"}p` } : null;
    }

    return null;
}


