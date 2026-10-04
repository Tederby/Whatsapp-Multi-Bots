/**
 * Convert — Comprehensive media converter supporting audio, video, images, stickers, and documents.
 *
 * @module commands/convert
 */

import fs from "fs";
import path from "path";
import { downloadContentFromMessage } from "baileys";
import { probeMedia, convertMedia } from "../lib/mediaConverter.js";
import mediaQueue from "../services/mediaQueue.js";
import setting from "../setting.js";

/** Max input file size allowed for conversion (50 MB) to protect VPS CPU/RAM. */
const MAX_INPUT_SIZE = 50 * 1024 * 1024;

/** Max output file size allowed before reject (100 MB). */
const MAX_OUTPUT_SIZE = 100 * 1024 * 1024;

/** Video streaming size threshold in WA; files above this are sent as document. */
const WA_VIDEO_STREAM_LIMIT = 64 * 1024 * 1024;

const MEDIA_KEYS = [
    "videoMessage",
    "imageMessage",
    "audioMessage",
    "stickerMessage",
    "ptvMessage",
    "documentMessage",
];

const FORMAT_ALIASES = {
    mp3: "mp3",
    mp4: "mp4",
    webm: "webm",
    gif: "gif",
    ptv: "ptv",
    circle: "ptv",
    vn: "ptt",
    ptt: "ptt",
    ogg: "ogg",
    opus: "ogg",
    wav: "wav",
    m4a: "m4a",
    aac: "m4a",
    flac: "flac",
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    audio: "mp3",
    video: "mp4",
    image: "jpg",
    img: "jpg",
};

/**
 * Extract media payload and type from a message object, unwrapping nested envelopes.
 *
 * @param {Object} msgObj
 * @returns {{ type: string, media: Object } | null}
 */
function findMedia(msgObj) {
    if (!msgObj) return null;
    let target = msgObj.message || msgObj;

    // Unwrap nested ephemeral or view-once envelopes
    if (target.ephemeralMessage?.message) target = target.ephemeralMessage.message;
    if (target.viewOnceMessage?.message) target = target.viewOnceMessage.message;
    if (target.viewOnceMessageV2?.message) target = target.viewOnceMessageV2.message;
    if (target.viewOnceMessageV2Extension?.message) target = target.viewOnceMessageV2Extension.message;
    if (target.documentWithCaptionMessage?.message) target = target.documentWithCaptionMessage.message;

    for (const key of MEDIA_KEYS) {
        if (target[key]) {
            return {
                type: key,
                media: target[key],
            };
        }
    }
    return null;
}

/**
 * Determine intermediate input file extension based on media message type or mimetype.
 *
 * @param {string} type
 * @param {Object} media
 * @returns {string}
 */
function getInputExtension(type, media) {
    const mime = (media.mimetype || "").toLowerCase();
    const fileName = (media.fileName || "").toLowerCase();

    if (fileName && fileName.includes(".")) {
        const ext = path.extname(fileName);
        if (ext && ext.length <= 5) return ext;
    }

    if (type === "videoMessage" || type === "ptvMessage") return ".mp4";
    if (type === "audioMessage") return mime.includes("ogg") || mime.includes("opus") ? ".ogg" : ".mp3";
    if (type === "stickerMessage") return ".webp";
    if (type === "imageMessage") {
        if (mime.includes("png")) return ".png";
        if (mime.includes("webp")) return ".webp";
        return ".jpg";
    }

    if (mime.includes("mp4")) return ".mp4";
    if (mime.includes("mkv")) return ".mkv";
    if (mime.includes("webm")) return ".webm";
    if (mime.includes("ogg") || mime.includes("opus")) return ".ogg";
    if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
    if (mime.includes("wav")) return ".wav";
    if (mime.includes("flac")) return ".flac";
    if (mime.includes("png")) return ".png";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("gif")) return ".gif";

    return ".bin";
}

/**
 * Map Baileys download type based on message type.
 *
 * @param {string} type
 * @returns {string}
 */
function getBaileysDownloadType(type) {
    if (type === "imageMessage") return "image";
    if (type === "videoMessage" || type === "ptvMessage") return "video";
    if (type === "audioMessage") return "audio";
    if (type === "stickerMessage") return "sticker";
    return "document";
}

export default {
    name: "convert",
    aliases: ["cvt", "conv"],
    category: "media",
    description: "Mengonversi media (video, audio, gambar, stiker, dokumen) ke berbagai format",
    usage: "!convert [format] [flags] (kirim atau balas pesan media)",
    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    botAdminOnly: false,
    ownerOnly: false,
    privateOnly: false,
    registerRequired: false,
    multiBot: false,

    flags: {
        doc: { type: "boolean", char: "d", aliases: ["document"] },
        ptt: { type: "boolean", char: "p", aliases: ["vn"] },
        ptv: { type: "boolean", char: "v", aliases: ["circle"] },
        compress: { type: "boolean", char: "c", aliases: ["comp"] },
    },

    async handler({ message, sock, cleanArgs, flags, prefix }) {
        const p = prefix || "!";

        // 1. Locate media in quoted message or current message
        const quotedMedia = findMedia(message.quoted);
        const directMedia = findMedia(message);
        const found = quotedMedia || directMedia;

        // 2. If no media is found, show full usage guide card
        if (!found) {
            return await message.reply(
                `╭━━━〔 🔄 MEDIA CONVERTER 〕━━━\n` +
                `┃ Konversi berbagai format media dengan mudah.\n` +
                `┃\n` +
                `┃ 📌 *Cara Penggunaan:*\n` +
                `┃ ⋄ Kirim media dengan caption \`${p}convert [format]\`\n` +
                `┃ ⋄ Atau balas (reply) media/stiker/dokumen dengan \`${p}convert [format]\`\n` +
                `┃\n` +
                `┃ 🎯 *Format yang Didukung:*\n` +
                `┃ ⋄ *Video*  : \`mp4\`, \`webm\`, \`gif\`, \`ptv\`\n` +
                `┃ ⋄ *Audio*  : \`mp3\`, \`ogg\`, \`wav\`, \`m4a\`, \`flac\`, \`ptt\` (VN)\n` +
                `┃ ⋄ *Gambar* : \`jpg\`, \`png\`, \`webp\`\n` +
                `┃\n` +
                `┃ ⚙️ *Pilihan Flag:*\n` +
                `┃ ⋄ \`-d\`, \`--doc\` : Kirim hasil sebagai Dokumen\n` +
                `┃ ⋄ \`-c\`, \`--compress\` : Kompresi video/audio lebih hemat\n` +
                `┃ ⋄ \`-p\`, \`--ptt\` : Kirim audio sebagai Voice Note\n` +
                `┃ ⋄ \`-v\`, \`--ptv\` : Kirim video sebagai Video Note\n` +
                `┃\n` +
                `┃ 💡 *Alur Default (Tanpa Format):*\n` +
                `┃ ⋄ Video ➔ MP4 (Re-encode & kompres)\n` +
                `┃ ⋄ Audio / VN ➔ MP3\n` +
                `┃ ⋄ Stiker Statis ➔ Gambar JPG\n` +
                `┃ ⋄ Stiker Animasi ➔ Video MP4\n` +
                `┃ ⋄ Gambar WebP ➔ Gambar JPG\n` +
                `╰━━━━━━━━━━━━━━━━━━━━`
            );
        }

        const { type: mediaType, media } = found;

        // Early file size limit validation if fileLength metadata is available
        if (media.fileLength && Number(media.fileLength) > MAX_INPUT_SIZE) {
            const sizeMB = (Number(media.fileLength) / (1024 * 1024)).toFixed(1);
            return await message.reply(
                `⚠️ *Ukuran Media Terlalu Besar*\n` +
                `File ini berukuran *${sizeMB} MB*. Maksimal ukuran file untuk konversi adalah *50 MB* demi menjaga kestabilan server.`
            );
        }

        // Prepare temporary directory isolated per bot instance
        const tempDir = path.resolve(`./temp/${setting.botId || "default"}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const inputExt = getInputExtension(mediaType, media);
        const inputPath = path.join(tempDir, `in_${timestamp}_${rand}${inputExt}`);
        let outputPath = "";

        try {
            // DNS workaround for mmg.whatsapp.net DNS issues
            if (media.url && media.url.includes("a.whatsapp.net")) {
                media.url = media.url.replace("a.whatsapp.net", "mmg.whatsapp.net");
            }

            // Download media stream
            const downloadType = getBaileysDownloadType(mediaType);
            const stream = await downloadContentFromMessage(media, downloadType);

            const chunks = [];
            let totalDownloaded = 0;
            for await (const chunk of stream) {
                totalDownloaded += chunk.length;
                if (totalDownloaded > MAX_INPUT_SIZE) {
                    throw new Error("EXCEEDED_MAX_INPUT_SIZE");
                }
                chunks.push(chunk);
            }

            const inputBuffer = Buffer.concat(chunks);
            fs.writeFileSync(inputPath, inputBuffer);

            // Probe input media metadata with FFmpeg
            const probeInfo = await probeMedia(inputPath);

            // Check if sticker is animated
            const isAnimatedSticker =
                mediaType === "stickerMessage" &&
                (Boolean(media.isAnimated) || inputBuffer.includes(Buffer.from("ANIM")));

            // Parse and determine target format
            let requestedFmt = (cleanArgs[0] || "").toLowerCase().replace(/^\./, "").trim();

            // Override format from flags if specified and no positional format given
            if (!requestedFmt) {
                if (flags?.ptt) requestedFmt = "ptt";
                else if (flags?.ptv) requestedFmt = "ptv";
            }

            let targetFormat = "";

            if (requestedFmt) {
                targetFormat = FORMAT_ALIASES[requestedFmt] || null;
                if (!targetFormat) {
                    return await message.reply(
                        `❌ Format *${requestedFmt}* tidak didukung.\n` +
                        `Format yang didukung:\n` +
                        `⋄ Video  : \`mp4\`, \`webm\`, \`gif\`, \`ptv\`\n` +
                        `⋄ Audio  : \`mp3\`, \`ogg\`, \`wav\`, \`m4a\`, \`flac\`, \`ptt\`\n` +
                        `⋄ Gambar : \`jpg\`, \`png\`, \`webp\``
                    );
                }
            } else {
                // Apply sensible default conversion matrix
                if (mediaType === "stickerMessage") {
                    targetFormat = isAnimatedSticker ? "mp4" : "jpg";
                } else if (probeInfo.hasVideo && !probeInfo.isImage) {
                    targetFormat = "mp4";
                } else if (probeInfo.hasAudio) {
                    targetFormat = "mp3";
                } else if (probeInfo.isImage || mediaType === "imageMessage") {
                    targetFormat = "jpg";
                } else {
                    targetFormat = "mp4";
                }
            }

            // Cross-format compatibility validations
            const isAudioTarget = ["mp3", "ogg", "wav", "m4a", "flac", "ptt"].includes(targetFormat);
            const isVideoTarget = ["mp4", "webm", "gif", "ptv"].includes(targetFormat);
            const isImageTarget = ["jpg", "png", "webp"].includes(targetFormat);

            if (isAudioTarget) {
                if (probeInfo.isImage) {
                    return await message.reply("❌ Gambar tidak memiliki trek audio untuk dikonversi.");
                }
                if (probeInfo.hasVideo && !probeInfo.hasAudio) {
                    return await message.reply("❌ Video ini tidak memiliki trek audio (silent video).");
                }
            }

            if (isVideoTarget) {
                if (probeInfo.hasAudio && !probeInfo.hasVideo) {
                    return await message.reply("❌ Tidak dapat mengonversi file audio menjadi video tanpa trek visual.");
                }
                if (probeInfo.isImage && targetFormat !== "gif") {
                    return await message.reply("❌ Tidak dapat mengonversi gambar statis menjadi video.");
                }
            }

            if (targetFormat === "ptv") {
                if (!probeInfo.hasVideo || probeInfo.isImage) {
                    return await message.reply("❌ Video Note (PTV) membutuhkan input berupa video.");
                }
            }

            if (targetFormat === "ptt") {
                if (!probeInfo.hasAudio) {
                    return await message.reply("❌ Media ini tidak memiliki audio untuk dijadikan Voice Note (PTT).");
                }
            }

            // Determine output extension and delivery configuration
            let outExt = targetFormat;
            let mimetype = "application/octet-stream";
            let defaultSendKey = "document";
            const extraOptions = {};

            switch (targetFormat) {
                case "mp4":
                    outExt = "mp4";
                    mimetype = "video/mp4";
                    defaultSendKey = "video";
                    break;
                case "webm":
                    outExt = "webm";
                    mimetype = "video/webm";
                    defaultSendKey = "video";
                    break;
                case "ptv":
                    outExt = "mp4";
                    mimetype = "video/mp4";
                    defaultSendKey = "video";
                    extraOptions.ptv = true;
                    break;
                case "gif":
                    outExt = "gif";
                    mimetype = "image/gif";
                    if (flags?.doc) {
                        defaultSendKey = "document";
                    } else {
                        defaultSendKey = "video";
                        extraOptions.gifPlayback = true;
                    }
                    break;
                case "mp3":
                    outExt = "mp3";
                    mimetype = "audio/mpeg";
                    defaultSendKey = "audio";
                    break;
                case "ptt":
                    outExt = "ogg";
                    mimetype = "audio/ogg; codecs=opus";
                    defaultSendKey = "audio";
                    extraOptions.ptt = true;
                    break;
                case "ogg":
                    outExt = "ogg";
                    mimetype = "audio/ogg";
                    defaultSendKey = "audio";
                    break;
                case "wav":
                    outExt = "wav";
                    mimetype = "audio/wav";
                    defaultSendKey = "document";
                    break;
                case "m4a":
                    outExt = "m4a";
                    mimetype = "audio/mp4";
                    defaultSendKey = "audio";
                    break;
                case "flac":
                    outExt = "flac";
                    mimetype = "audio/flac";
                    defaultSendKey = "document";
                    break;
                case "jpg":
                    outExt = "jpg";
                    mimetype = "image/jpeg";
                    defaultSendKey = "image";
                    break;
                case "png":
                    outExt = "png";
                    mimetype = "image/png";
                    defaultSendKey = "image";
                    break;
                case "webp":
                    outExt = "webp";
                    mimetype = "image/webp";
                    defaultSendKey = flags?.doc ? "document" : "image";
                    break;
            }

            outputPath = path.join(tempDir, `out_${timestamp}_${rand}.${outExt}`);

            // Queue notification if bot is currently processing other conversions
            if (mediaQueue.running >= mediaQueue.maxConcurrent) {
                await message.reply(`⏳ Menunggu giliran antrean konversi media (Antrean #${mediaQueue.pending + 1})...`);
            }

            // Execute FFmpeg conversion inside concurrency queue
            await mediaQueue.run(async () => {
                await convertMedia({
                    inputPath,
                    outputPath,
                    targetFormat,
                    flags,
                    probeInfo,
                    timeoutMs: 180000,
                });
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error("OUTPUT_FILE_MISSING");
            }

            const outStats = fs.statSync(outputPath);
            if (outStats.size > MAX_OUTPUT_SIZE) {
                const outMB = (outStats.size / (1024 * 1024)).toFixed(1);
                return await message.reply(
                    `❌ Hasil konversi terlalu besar (*${outMB} MB*). WhatsApp membatasi pengiriman dokumen maksimal 100 MB.`
                );
            }

            // Decide delivery mode: document vs media
            let sendKey = flags?.doc ? "document" : defaultSendKey;

            // WhatsApp direct video playback limit is 64 MB; fallback to document if larger
            if (sendKey === "video" && outStats.size > WA_VIDEO_STREAM_LIMIT) {
                sendKey = "document";
            }

            const outputBuffer = fs.readFileSync(outputPath);
            const sizeStr = (outStats.size / (1024 * 1024)).toFixed(2) + " MB";
            const caption = `✅ Konversi berhasil: *${targetFormat.toUpperCase()}* (${sizeStr})`;

            const sendPayload = {};
            if (sendKey === "image") {
                sendPayload.image = outputBuffer;
                sendPayload.caption = caption;
                sendPayload.mimetype = mimetype;
            } else if (sendKey === "video") {
                sendPayload.video = outputBuffer;
                sendPayload.caption = caption;
                sendPayload.mimetype = mimetype;
                if (extraOptions.gifPlayback) sendPayload.gifPlayback = true;
                if (extraOptions.ptv) sendPayload.ptv = true;
            } else if (sendKey === "audio") {
                sendPayload.audio = outputBuffer;
                sendPayload.mimetype = mimetype;
                if (extraOptions.ptt) sendPayload.ptt = true;
            } else {
                // Document
                sendPayload.document = outputBuffer;
                sendPayload.mimetype = mimetype;
                sendPayload.fileName = `converted_${timestamp}.${outExt}`;
                sendPayload.caption = caption;
            }

            await sock.sendMessage(message.chat, sendPayload, { quoted: message });

        } catch (error) {
            console.error("[CONVERT]", error);

            if (error.message === "EXCEEDED_MAX_INPUT_SIZE") {
                return await message.reply("⚠️ Ukuran file media melebihi batas 50 MB. Konversi dibatalkan.");
            }

            await message.reply(
                "❌ Gagal mengonversi media. Pastikan format file valid, tidak corrupt, dan dapat dibaca oleh FFmpeg."
            );
        } finally {
            // Guarantee cleanup of all temporary files
            if (fs.existsSync(inputPath)) {
                try { fs.unlinkSync(inputPath); } catch {}
            }
            if (outputPath && fs.existsSync(outputPath)) {
                try { fs.unlinkSync(outputPath); } catch {}
            }
        }
    },
};
