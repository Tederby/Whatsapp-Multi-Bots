import { downloadContentFromMessage } from 'baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export default {
    name: 'toimg',
    aliases: ['toimage', 'tovideo'],
    category: 'media',
    description: '[UNSTABLE] Mengubah stiker menjadi gambar atau video',
    usage: '!toimg (reply to a sticker)',
    async handler({ message, sock }) {
        try {
            // Check for sticker message
            const isQuotedSticker = message.quoted?.message?.stickerMessage;
            const isSticker = message.message?.stickerMessage;
            const targetMsg = isQuotedSticker ? message.quoted : (isSticker ? message : null);

            if (!targetMsg) {
                return await message.reply('❌ Balas (reply) stiker yang ingin diubah menjadi gambar/video dengan caption *!toimg*.');
            }

            const stickerMsg = targetMsg.message.stickerMessage;

            // Fix for a.whatsapp.net DNS error
            if (stickerMsg?.url && stickerMsg.url.includes('a.whatsapp.net')) {
                stickerMsg.url = stickerMsg.url.replace('a.whatsapp.net', 'mmg.whatsapp.net');
            }

            // Download sticker
            const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // Deteksi isAnimated secara lebih akurat dari metadata buffer jika properti bawaan tidak ada
            const isAnimated = stickerMsg.isAnimated || buffer.includes(Buffer.from('ANIM'));

            const warningText = '\n\n_⚠️ Info: Fitur ini mungkin sedang tidak stabil karena kendala server/jaringan._';
            await message.reply(isAnimated 
                ? '⏳ Sedang mengonversi stiker animasi ke video...' + warningText 
                : '⏳ Sedang mengonversi stiker ke gambar...' + warningText);

            // Write to temp file
            const tempDir = path.resolve('./temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const timestamp = Date.now();
            const inputPath = path.join(tempDir, `${timestamp}_sticker.webp`);
            const outputPath = path.join(tempDir, `${timestamp}_output.${isAnimated ? 'mp4' : 'jpg'}`);

            fs.writeFileSync(inputPath, buffer);

            // Convert using ffmpeg
            try {
                if (isAnimated) {
                    // Convert animated webp to mp4. Menambahkan analyzeduration/probesize untuk menghindari error "unspecified size"
                    await execPromise(`ffmpeg -analyzeduration 100M -probesize 100M -i "${inputPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`);
                } else {
                    // Convert static webp to jpg. Menambahkan -vframes 1 untuk menghindari crash jika ternyata ada file animasi yang lolos
                    await execPromise(`ffmpeg -i "${inputPath}" -vframes 1 "${outputPath}"`);
                }

                const outputBuffer = fs.readFileSync(outputPath);

                if (isAnimated) {
                    await sock.sendMessage(message.chat, { video: outputBuffer, caption: '✅ Stiker animasi berhasil diubah ke video.' }, { quoted: message });
                } else {
                    await sock.sendMessage(message.chat, { image: outputBuffer, caption: '✅ Stiker berhasil diubah ke gambar.' }, { quoted: message });
                }

            } catch (ffmpegErr) {
                console.error('[FFMPEG ERROR]', ffmpegErr);
                await message.reply('❌ Gagal mengonversi stiker. Pastikan server memiliki ffmpeg yang terinstal.');
            } finally {
                // Cleanup
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }

        } catch (error) {
            console.error('[ERROR TOIMG]', error);
            await message.reply('❌ Terjadi kesalahan internal saat memproses stiker.');
        }
    }
};
