/**
 * Watermark — Change sticker pack and author metadata on quoted sticker.
 *
 * @module commands/watermark
 */

import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { downloadContentFromMessage } from 'baileys';
import setting from '../setting.js';

export default {
    name: 'watermark',
    aliases: ['wm'],
    category: 'media',
    description: 'Mengganti watermark (nama pack & author) pada stiker yang di-quote',
    usage: '!wm NamaPack|NamaAuthor (reply to a sticker)',
    async handler({ message, sock, rawArgs, prefix, pushname }) {
        try {
            // Check for sticker in quoted message or direct message
            const isQuotedSticker = message.quoted?.message?.stickerMessage;
            const isSticker = message.message?.stickerMessage;
            const targetMsg = isQuotedSticker ? message.quoted : (isSticker ? message : null);

            if (!targetMsg) {
                return await message.reply(
                    `╭━━━〔 🏷️ WATERMARK STIKER 〕━━━\n` +
                    `┃ Balas (reply) stiker yang ingin diganti watermarknya.\n` +
                    `┃\n` +
                    `┃ ⋄ \`${prefix || "!"}wm NamaPack|NamaAuthor\`\n` +
                    `┃ Contoh: \`${prefix || "!"}wm Anime|Tederby\`\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━`
                );
            }

            const stickerMsg = targetMsg.message.stickerMessage;
            
            // Fix for a.whatsapp.net DNS error
            if (stickerMsg?.url && stickerMsg.url.includes('a.whatsapp.net')) {
                stickerMsg.url = stickerMsg.url.replace('a.whatsapp.net', 'mmg.whatsapp.net');
            }

            const textArgs = (rawArgs || '').trim();

            // Format: !wm NamaPack|NamaAuthor
            // Di WhatsApp, Author ditampilkan di atas (kiri), Pack di bawah (kanan).
            let packName = pushname || 'WhatsApp User';
            let authorName = setting.name || 'Bot Stiker';

            if (textArgs) {
                const splitArgs = textArgs.split('|');
                packName = splitArgs[0].trim();
                if (splitArgs.length > 1) {
                    authorName = splitArgs[1].trim();
                } else {
                    authorName = setting.name || 'Bot Stiker';
                }
            } else {
                return await message.reply(
                    `╭━━━〔 🏷️ WATERMARK STIKER 〕━━━\n` +
                    `┃ Masukkan nama pack & author watermark baru.\n` +
                    `┃\n` +
                    `┃ ⋄ \`${prefix || "!"}wm NamaPack|NamaAuthor\`\n` +
                    `┃ Contoh: \`${prefix || "!"}wm Anime|Tederby\`\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━`
                );
            }

            await message.reply('⏳ Sedang mengganti watermark stiker...');

            // Download the sticker
            const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Rebuild the sticker with new metadata
            const sticker = new Sticker(buffer, {
                pack: packName,
                author: authorName,
                type: StickerTypes.FULL,
                quality: 70
            });

            const stickerBuffer = await sticker.toBuffer();

            // Send the new sticker
            await sock.sendMessage(message.chat, { sticker: stickerBuffer }, { quoted: message });

        } catch (error) {
            console.error('[WATERMARK]', error);
            await message.reply('❌ Terjadi kesalahan saat mengganti watermark stiker. Silakan coba lagi nanti.');
        }
    }
};
