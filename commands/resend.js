import { downloadMediaMessage } from "baileys";
import Pino from "pino";

export default {
    name: "resend",
    aliases: [],
    description: "Resend a quoted image or video",
    async handler({ message, sock }) {
        const quotedMsg = message.quoted ? message.quoted : message;
        const isImage = message.mtype === "image/jpeg" || message.mtype === "image/png";
        const isVideo = message.mtype === "video/mp4" || message.mtype === "image/gif";
        const isQuotedImage = quotedMsg && (quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
        const isQuotedVideo = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif");

        if ((isImage || isQuotedImage) || (isVideo || isQuotedVideo)) {
            const verifquoted = !!message.quoted;
            const msg = verifquoted
                ? { message: message.quoted.message }
                : { message: message.message };
            const type = Object.keys(quotedMsg.message || quotedMsg)[0];
            try {
                const buffer = await downloadMediaMessage(
                    msg, "buffer", {},
                    { Pino, reuploadRequest: sock.updateMediaMessage }
                );
                await sock.sendMessage(
                    message.chat,
                    {
                        [type.includes("image") ? "image" : "video"]: buffer,
                        caption: "*Success Resend*"
                    },
                    { quoted: message, ephemeralExpiration: message.contextInfo.expiration }
                );
            } catch (err) {
                console.log(err);
                message.reply("ada yang error!");
            }
        } else {
            message.reply("Reply gambar atau video yang ingin diresend");
        }
    }
};
