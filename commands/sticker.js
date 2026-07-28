import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadContentFromMessage } from 'baileys';
import setting from '../setting.js';

export default {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    category: 'media',
    description: 'Membuat stiker dari gambar atau video pendek',
    usage: '!s (send/reply to an image or short video) atau !s NamaPack|NamaAuthor',
    async handler({ message, sock, rawArgs, prefix, pushname }) {
        try {
            // Check original message media
            const isValidMedia = (msg) => {
                if (msg?.imageMessage || msg?.videoMessage) return true;
                if (msg?.documentMessage) {
                    const mime = msg.documentMessage.mimetype || '';
                    if (mime.startsWith('image/') || mime.startsWith('video/')) return true;
                }
                return false;
            };

            // If user quotes a sticker, redirect them to use !wm
            const isQuotedSticker = !!message.quoted?.message?.stickerMessage;
            if (isQuotedSticker) {
                return await message.reply(`💡 Untuk mengganti watermark stiker, gunakan command *${prefix}wm*\n\nContoh: *${prefix}wm NamaPack|NamaAuthor*\n\nBalas (reply/quote) stiker yang ingin diganti watermarknya.`);
            }

            const isMedia = isValidMedia(message.message);
            const isQuotedMedia = isValidMedia(message.quoted?.message);

            const targetMsg = isQuotedMedia ? message.quoted : (isMedia ? message : null);

            if (!targetMsg) {
                return await message.reply(`❌ Kirim gambar/video/dokumen dengan caption *${prefix}s* atau balas (reply) media yang sudah ada.`);
            }

            const msgContent = targetMsg.message;
            const isVideo = !!msgContent?.videoMessage || (msgContent?.documentMessage?.mimetype?.startsWith('video/'));
            const isDocument = !!msgContent?.documentMessage;
            const mediaMessage = msgContent?.imageMessage || msgContent?.videoMessage || msgContent?.documentMessage;

            if (!mediaMessage) {
                return await message.reply('❌ Format media tidak didukung. Harap kirim gambar, video pendek, atau dokumen media.');
            }

            // Verify video duration
            if (isVideo && mediaMessage.seconds && mediaMessage.seconds > 10) {
                return await message.reply('❌ Video terlalu panjang. Maksimal 10 detik.');
            }

            const textArgs = (rawArgs || '').trim();

            // Format: !s NamaPack|NamaAuthor
            // Di WhatsApp, Author ditampilkan di atas (kiri), Pack di bawah (kanan).
            let packName = pushname || 'WhatsApp User';
            let authorName = setting.name || 'Bot Stiker';

            let replyMsg = '⏳ Sedang membuat stiker...';

            if (textArgs) {
                const splitArgs = textArgs.split('|');
                // User input: Anime|Tederby (Anime sebagai Pack, Tederby sebagai Author)
                packName = splitArgs[0].trim();
                if (splitArgs.length > 1) {
                    authorName = splitArgs[1].trim();
                } else {
                    authorName = setting.name || 'Bot Stiker';
                }
            } else {
                replyMsg += `\n\n💡 *Tips*: Kamu bisa menambahkan watermark dengan perintah \`${prefix}s NamaPack|NamaAuthor\` (contoh: \`${prefix}s Anime|Tederby\`)`;
            }

            await message.reply(replyMsg);

            // Download media natively using baileys
            const downloadType = isDocument ? 'document' : (isVideo ? 'video' : 'image');
            const stream = await downloadContentFromMessage(mediaMessage, downloadType);
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Build sticker
            const sticker = new Sticker(buffer, {
                pack: packName,
                author: authorName,
                type: StickerTypes.FULL,
                quality: 70
            });

            const stickerBuffer = await sticker.toBuffer();

            // Send sticker message
            await sock.sendMessage(message.chat, { sticker: stickerBuffer }, { quoted: message });

        } catch (error) {
            console.error('[ERROR STICKER]', error);
            await message.reply('❌ Terjadi kesalahan saat membuat stiker. Silakan coba lagi nanti.');
        }
    }
};