import { downloadMediaMessage } from "baileys";
import Pino from "pino";

/**
 * Map of mimetypes that can be converted from document → media.
 * Key = mimetype prefix, Value = { sendKey, gifPlayback? }
 */
const DOC_TO_MEDIA_MAP = {
    "image/": { sendKey: "image" },
    "video/": { sendKey: "video" },
};

/**
 * Detect if a document can be resent as viewable media based on its mimetype.
 * Returns { sendKey, mimetype, gifPlayback } or null if not convertible.
 */
function detectDocumentMediaType(docMessage) {
    const mime = (docMessage.mimetype || "").toLowerCase();
    const fileName = (docMessage.fileName || "").toLowerCase();

    for (const [prefix, config] of Object.entries(DOC_TO_MEDIA_MAP)) {
        if (mime.startsWith(prefix)) {
            const isGif = mime === "image/gif" || fileName.endsWith(".gif");
            return {
                sendKey: isGif ? "video" : config.sendKey,
                mimetype: mime,
                gifPlayback: isGif,
            };
        }
    }

    return null;
}

export default {
    name: "resend",
    aliases: [],
    category: "media",
    description: "Mengirim ulang media yang di-reply. Dokumen berupa gambar/video/GIF akan dikirim sebagai media full resolution.",
    usage: "!resend (reply to a media message)",
    async handler({ message, sock }) {
        const targetMsg = message.quoted ? message.quoted : message;
        
        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'];
        const messageObj = targetMsg.message || targetMsg;
        const msgKeys = Object.keys(messageObj || {});
        const type = msgKeys.find(key => mediaTypes.includes(key));

        if (!type) {
            await message.reply("❌ Reply pesan media (gambar, video, audio, dokumen, atau stiker) yang ingin diresend!");
            return;
        }

        const verifquoted = !!message.quoted;
        const msg = verifquoted
            ? { message: message.quoted.message }
            : { message: message.message };
        
        try {
            const buffer = await downloadMediaMessage(
                msg, "buffer", {},
                { Pino, reuploadRequest: sock.updateMediaMessage }
            );
            
            const originalMediaMessage = messageObj[type];
            let sendKey = "document";
            let extraOptions = {};

            if (type === "imageMessage") {
                sendKey = "image";
            } else if (type === "videoMessage" || type === "ptvMessage") {
                sendKey = "video";
            } else if (type === "audioMessage") {
                sendKey = "audio";
            } else if (type === "stickerMessage") {
                sendKey = "sticker";
            } else if (type === "documentMessage") {
                // ── Document → Media conversion ──────────────────────────
                // Detect if this document is actually an image/video/gif
                const mediaInfo = detectDocumentMediaType(originalMediaMessage);

                if (mediaInfo) {
                    // Convert: send as proper media instead of document
                    sendKey = mediaInfo.sendKey;
                    if (mediaInfo.gifPlayback) {
                        extraOptions.gifPlayback = true;
                    }
                } else {
                    // Not a convertible document — resend as-is
                    sendKey = "document";
                    extraOptions.mimetype = originalMediaMessage.mimetype || "application/octet-stream";
                    extraOptions.fileName = originalMediaMessage.fileName || "document";
                }
            }

            const sendOptions = { [sendKey]: buffer, ...extraOptions };

            // Type-specific options
            if (type === "ptvMessage") {
                sendOptions.mimetype = originalMediaMessage.mimetype || "video/mp4";
                sendOptions.ptv = true;
            } else if (type === "audioMessage") {
                sendOptions.mimetype = originalMediaMessage.mimetype || "audio/mp4";
                if (originalMediaMessage.ptt) sendOptions.ptt = true;
            }
            
            // Caption handling for visual media types
            const captionTypes = ["imageMessage", "videoMessage"];
            const isConvertedDoc = type === "documentMessage" && sendKey !== "document";
            
            if (captionTypes.includes(type) || type === "documentMessage") {
                let outCaption;

                if (isConvertedDoc) {
                    // For doc→media conversion, use filename as fallback caption
                    const fileName = originalMediaMessage.fileName || "";
                    outCaption = originalMediaMessage.caption || (fileName ? `📄 _${fileName}_` : "");
                } else {
                    outCaption = originalMediaMessage.caption || "*Success Resend*";
                }

                if (outCaption) {
                    let mentions = targetMsg.mentionedJid || [];

                    // Mencegah loop eksekusi jika caption mengandung command bot (ZWS)
                    const prefixes = ["!", ".", "#", "/", "-", "$"];
                    if (prefixes.includes(outCaption[0])) {
                        outCaption = "\u200B" + outCaption;
                    }

                    // Ambil ID (tanpa domain) dari mentions bawaan (bisa berupa PN atau LID)
                    const existingMentionIds = mentions.map(jid => jid.split('@')[0]);

                    // Parsing manual tag angka untuk caption
                    const manualMentions = [...outCaption.matchAll(/@(\d{10,16})/g)]
                        .map(v => v[1])
                        .filter(num => !existingMentionIds.includes(num))
                        .map(num => num + '@s.whatsapp.net');
                        
                    if (manualMentions.length > 0) {
                        mentions = [...mentions, ...manualMentions];
                    }

                    sendOptions.caption = outCaption;
                    if (mentions.length > 0) {
                        sendOptions.mentions = mentions;
                    }
                }
            }
            
            await sock.sendMessage(
                message.chat,
                sendOptions,
                { quoted: message, ephemeralExpiration: message.contextInfo?.expiration }
            );
        } catch (err) {
            console.log("[ERROR RESEND]", err);
            await message.reply("❌ Terjadi kesalahan saat mendownload atau mengirim ulang media.");
        }
    }
};
