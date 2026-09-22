import { downloadContentFromMessage } from "baileys";
import sharp from "sharp";

export default {
    name: "setbotpfp",
    aliases: ["setbotpp", "botpfp", "botpp"],
    category: "owner",
    description: "Mengatur foto profil WhatsApp bot secara langsung (bukan di database). Gambar di-upload apa adanya tanpa di-crop (full aspect ratio).",
    usage: "!setbotpfp [caption gambar / reply ke gambar]",
    ownerOnly: true,

    async handler({ message, sock, prefix }) {
        try {
            let buffer = null;

            // ── Detect media: direct image or quoted image ──────────────
            const isMedia = message.type === "imageMessage";
            const isQuotedMedia = !!(
                message.quoted?.message?.imageMessage ||
                (message.quoted?.mtype && (
                    message.quoted.mtype === "image/jpeg" ||
                    message.quoted.mtype === "image/png"  ||
                    message.quoted.mtype === "image/webp" ||
                    message.quoted.mtype === "imageMessage"
                ))
            );

            if (isQuotedMedia && message.quoted?.message) {
                await message.reply("⏳ Mengunduh gambar...");

                const quotedMsg = message.quoted.message;
                const imgMsg = quotedMsg.imageMessage
                    || quotedMsg.viewOnceMessageV2?.message?.imageMessage
                    || quotedMsg.ephemeralMessage?.message?.imageMessage;

                if (imgMsg) {
                    // Fix for a.whatsapp.net DNS error (same workaround as setpfp.js)
                    if (imgMsg?.url && imgMsg.url.includes("a.whatsapp.net")) {
                        imgMsg.url = imgMsg.url.replace("a.whatsapp.net", "mmg.whatsapp.net");
                    }
                    const stream = await downloadContentFromMessage(imgMsg, "image");
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    buffer = Buffer.concat(chunks);
                }

            } else if (isMedia && message.message?.imageMessage) {
                await message.reply("⏳ Mengunduh gambar...");

                const imgMsg = message.message.imageMessage;
                if (imgMsg?.url && imgMsg.url.includes("a.whatsapp.net")) {
                    imgMsg.url = imgMsg.url.replace("a.whatsapp.net", "mmg.whatsapp.net");
                }
                const stream = await downloadContentFromMessage(imgMsg, "image");
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                buffer = Buffer.concat(chunks);

            } else {
                return message.reply(
                    `❌ Kirim gambar dengan caption \`${prefix}setbotpfp\`\natau reply ke gambar dengan \`${prefix}setbotpfp\``
                );
            }

            if (!buffer) {
                return message.reply("❌ Gagal memproses media. Coba lagi.");
            }

            // ── Convert to JPEG without cropping ───────────────────────
            // We resize the longest side to max 640px (WhatsApp's recommended
            // profile picture size) while preserving aspect ratio (fit: "inside").
            // The image retains its original proportions — when viewed as a PFP,
            // only the center square portion will be visible in the circular frame,
            // but the full image is stored on WhatsApp servers without crop.
            const { data: jpegBuffer, info } = await sharp(buffer)
                .resize(640, 640, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer({ resolveWithObject: true });

            const imgWidth  = info.width;
            const imgHeight = info.height;

            // ── Get bot's own JID ───────────────────────────────────────
            // Strips device-ID segment if present (e.g. "6281234:5@s.whatsapp.net" → "6281234@s.whatsapp.net")
            const botJid = sock.user.id.includes(":")
                ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
                : sock.user.id;

            // ── Upload profile picture ──────────────────────────────────
            // Pass exact pixel dimensions so Baileys' internal resize is a no-op,
            // preserving the aspect ratio we prepared above.
            await sock.updateProfilePicture(botJid, jpegBuffer, {
                width:  imgWidth,
                height: imgHeight,
            });

            return message.reply(
                `✅ Foto profil bot berhasil diperbarui!\n` +
                `┃ Ukuran : ${imgWidth}×${imgHeight}px\n` +
                `┃ Info   : Gambar di-upload tanpa di-crop. Frame PFP menampilkan bagian tengah.`
            );

        } catch (error) {
            console.error("[SETBOTPFP CMD]", error);
            message.reply("❌ Gagal mengatur foto profil bot. Mungkin terkena rate-limit WhatsApp atau gambar tidak valid.");
        }
    }
};

