/**
 * @fileoverview Download a file from direct URL and send it to WhatsApp.
 * @module commands/download
 */

import axios from 'axios';
import path from 'path';

export default {
    name: 'download',
    aliases: ['dl', 'fetch'],
    category: 'downloader',
    description: 'Download file dari URL dan mengirimkannya ke WhatsApp',
    usage: '!download <url>',
    async handler({ message, sock, args, prefix }) {
        if (!args.length) {
            const p = prefix || "!";
            return await message.reply(
                `╭━━━〔 📥 DOWNLOAD 〕━━━\n` +
                `┃ ❌ Harap berikan URL yang ingin didownload.\n` +
                `┃ ⋄ Format: *${p}download <url>*\n` +
                `┃ ⋄ Contoh: *${p}download https://example.com/file.pdf*\n` +
                `╰━━━━━━━━━━━━━━━━━━━━`
            );
        }

        const url = args[0];

        try {
            new URL(url); // Validate URL
        } catch (e) {
            return await message.reply('❌ URL tidak valid. Pastikan menyertakan http:// atau https://');
        }

        const update = await message.replyUpdate('⏳ Sedang memproses URL...');

        let contentType = 'application/octet-stream';
        let contentLength = 0;
        let fileName = 'downloaded_file';

        try {
            // Get file metadata using HEAD request to avoid downloading the whole file just to check size
            const headResponse = await axios.head(url, {
                maxRedirects: 5,
                validateStatus: status => status < 400
            });

            contentType = headResponse.headers['content-type'] || 'application/octet-stream';
            contentLength = parseInt(headResponse.headers['content-length'] || '0', 10);
            
            // Limit to ~100MB (WhatsApp document limit)
            const MAX_SIZE_MB = 100;
            if (contentLength > MAX_SIZE_MB * 1024 * 1024) {
                return await update(`❌ File terlalu besar (${(contentLength / 1024 / 1024).toFixed(2)} MB). Batas maksimal adalah ${MAX_SIZE_MB} MB.`);
            }

            // Try getting from Content-Disposition
            const contentDisposition = headResponse.headers['content-disposition'];
            if (contentDisposition && contentDisposition.includes('filename=')) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) {
                    fileName = match[1];
                }
            } else {
                // Try getting from URL path
                const parsedUrl = new URL(url);
                const pathName = parsedUrl.pathname;
                const basename = path.basename(pathName);
                if (basename) {
                    fileName = basename;
                }
            }
        } catch (metadataError) {
            console.log('[DOWNLOAD] Failed to fetch metadata, using fallback:', metadataError.message);
            // Fallback to extract filename from URL if HEAD fails
            const parsedUrl = new URL(url);
            const basename = path.basename(parsedUrl.pathname);
            if (basename) {
                fileName = basename;
            }
        }

        await update(
            `╭━━━〔 📥 DOWNLOAD 〕━━━\n` +
            `┃ ⋄ Nama : *${fileName}*\n` +
            `┃ ⋄ Ukuran : *${contentLength ? (contentLength / 1024 / 1024).toFixed(2) + ' MB' : 'Tidak diketahui'}*\n` +
            `┃ ⋄ Status : Mengunduh & mengirim...\n` +
            `╰━━━━━━━━━━━━━━━━━━━━`
        );

        try {
            // Send the document directly using the URL (Baileys handles the streaming download)
            await sock.sendMessage(message.chat, {
                document: { url: url },
                mimetype: contentType,
                fileName: fileName
            }, { quoted: message });
            
            await update(`✅ Berhasil mengirim file *${fileName}*`);

        } catch (error) {
            console.error('[DOWNLOAD]', error);
            await update('❌ Terjadi kesalahan saat mengunduh atau mengirim file. Pastikan URL dapat diakses secara publik.');
        }
    }
};
