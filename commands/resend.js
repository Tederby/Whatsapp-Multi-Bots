import { downloadMediaMessage } from "baileys";
import Pino from "pino";

export default {
    name: "resend",
    aliases: [],
    category: "media",
    description: "Mengirim ulang media yang di-reply",
    usage: "!resend (reply to a media message)",
    async handler({ message, sock }) {
        const targetMsg = message.quoted ? message.quoted : message;
        
        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'];
        const messageObj = targetMsg.message || targetMsg;
        const msgKeys = Object.keys(messageObj || {});
        const type = msgKeys.find(key => mediaTypes.includes(key));

        if (type) {
            const verifquoted = !!message.quoted;
            const msg = verifquoted
                ? { message: message.quoted.message }
                : { message: message.message };
            
            try {
                const buffer = await downloadMediaMessage(
                    msg, "buffer", {},
                    { Pino, reuploadRequest: sock.updateMediaMessage }
                );
                
                let sendKey = "document";
                if (type === "imageMessage") sendKey = "image";
                else if (type === "videoMessage" || type === "ptvMessage") sendKey = "video";
                else if (type === "audioMessage") sendKey = "audio";
                else if (type === "stickerMessage") sendKey = "sticker";
                
                const sendOptions = { [sendKey]: buffer };
                const originalMediaMessage = messageObj[type];

                if (type === "ptvMessage") {
                    sendOptions.mimetype = originalMediaMessage.mimetype || "video/mp4";
                    sendOptions.ptv = true;
                } else if (type === "audioMessage") {
                    sendOptions.mimetype = originalMediaMessage.mimetype || "audio/mp4";
                    if (originalMediaMessage.ptt) sendOptions.ptt = true;
                } else if (type === "documentMessage") {
                    sendOptions.mimetype = originalMediaMessage.mimetype || "application/octet-stream";
                    sendOptions.fileName = originalMediaMessage.fileName || "document";
                }
                
                if (type === "imageMessage" || type === "videoMessage" || type === "documentMessage") {
                    let outCaption = originalMediaMessage.caption || "*Success Resend*";
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
                
                await sock.sendMessage(
                    message.chat,
                    sendOptions,
                    { quoted: message, ephemeralExpiration: message.contextInfo?.expiration }
                );
            } catch (err) {
                console.log("[ERROR RESEND]", err);
                await message.reply("❌ Terjadi kesalahan saat mendownload atau mengirim ulang media.");
            }
        } else {
            await message.reply("❌ Reply pesan media (gambar, video, audio, dokumen, atau stiker) yang ingin diresend!");
        }
    }
};
