/**
 * @fileoverview Quick video/audio downloader with auto-resolution cascading.
 * @module commands/ytdl
 */

import fs from "fs";
import { getCachedInfo } from "../services/infoCache.js";
import { download, formatDuration, getPlatformName, formatSize } from "../services/ytdlp.js";
import { downloadQueue } from "../services/downloadQueue.js";
import { tryDelete } from "../services/cleanup.js";
import { isUrl, sanitizeFilename } from "../lib/utils.js";
import setting from "../setting.js";

export default {
    name: "ytdl",
    aliases: ["video", "ytv", "mp4"],
    category: "downloader",
    description: "Quick video/audio download (auto format)",
    usage: "!ytdl <url>",

    async handler({ message, sock, args, prefix }) {
        const p = prefix || "!";
        const url = args[0];
        if (!url || !isUrl(url)) {
            return message.reply(
                `╭━━━〔 🎬 YTDL 〕━━━\n` +
                `┃ ❌ Masukkan URL yang valid.\n` +
                `┃ ⋄ Format: *${p}ytdl <url>*\n` +
                `┃ ⋄ Contoh: *${p}ytdl https://youtube.com/watch?v=xxx*\n` +
                `╰━━━━━━━━━━━━━━━━━━━━`
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

        // ── 2. Format (Simple yt-dlp execution) ─────────────────────
        const maxSize = setting.ytdlp.maxFileSize;
        // Use universal default format selector (capping resolution up to 720p)
        const chosenFormat = setting.ytdlp.defaultFormats ? setting.ytdlp.defaultFormats[0] : "bv*[height<=720]+ba/b";

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
                        `╭━━━〔 🎬 VIDEO DOWNLOAD 〕━━━`,
                        `┃ ⋄ Judul : *${title}*`,
                        `┃ ⋄ Durasi : ${duration}`,
                        `┃ ⋄ Platform : ${platform}`,
                        `┃ ⋄ Ukuran : ${formatSize(stat.size)}`,
                        `╰━━━━━━━━━━━━━━━━━━━━`,
                        `💡 Gunakan *${p}ytdlf* untuk opsi format & resolusi manual.`,
                    ].join("\n"),
                }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
            } else {
                // ── 6. Send as inline video ─────────────────────────
                await update("✅ Berhasil!");
                await sock.sendMessage(message.chat, {
                    video: fs.readFileSync(filePath),
                    caption: [
                        `╭━━━〔 🎬 VIDEO DOWNLOAD 〕━━━`,
                        `┃ ⋄ Judul : *${title}*`,
                        `┃ ⋄ Durasi : ${duration}`,
                        `┃ ⋄ Platform : ${platform}`,
                        `╰━━━━━━━━━━━━━━━━━━━━`,
                        `💡 Gunakan *${p}ytdlf* untuk opsi format & resolusi manual.`,
                    ].join("\n"),
                }, { quoted: message, ephemeralExpiration: message.contextInfo?.expiration });
            }
        } catch (err) {
            console.error("[YTDL]", err);
            await update("❌ Gagal mengunduh. " + (err.message || "Coba lagi nanti."));
        } finally {
            tryDelete(filePath);
            downloadQueue.release();
        }
    }
};

// ── Helpers ─────────────────────────────────────────────────────────────────


