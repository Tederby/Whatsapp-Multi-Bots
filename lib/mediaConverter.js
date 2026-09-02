import { spawn } from 'child_process';
import { Exif } from 'wa-sticker-formatter';

/**
 * Menyisipkan metadata EXIF (Pack & Author) ke dalam buffer WebP dan memperbaiki
 * disposal flag pada animasi WebP agar tidak glitch di WhatsApp Web & Desktop.
 * 
 * @param {Buffer} webpBuffer - Buffer WebP murni hasil encode
 * @param {Object|Buffer} metadata - Objek { pack, author } atau raw Exif Buffer
 * @returns {Buffer} - Buffer WebP lengkap dengan EXIF dan perbaikan frame disposal
 */
export function injectWebpExif(webpBuffer, metadata = {}) {
    if (!Buffer.isBuffer(webpBuffer)) {
        throw new Error('Input must be a Buffer');
    }

    // 1. Validasi header RIFF WEBP
    if (webpBuffer.subarray(0, 4).toString('ascii') !== 'RIFF' || webpBuffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
        throw new Error('Invalid WebP buffer: Missing RIFF WEBP header');
    }

    const vp8xHeader = webpBuffer.subarray(12, 16).toString('ascii');
    if (vp8xHeader !== 'VP8X') {
        throw new Error('WebP buffer must have VP8X chunk for extended metadata');
    }

    // Siapkan raw EXIF buffer
    let exifBuffer;
    if (Buffer.isBuffer(metadata)) {
        exifBuffer = metadata;
    } else {
        const exifObj = new Exif({
            pack: metadata.pack || 'WhatsApp User',
            author: metadata.author || 'Bot Stiker'
        });
        exifBuffer = exifObj.build();
    }

    const cloned = Buffer.from(webpBuffer);

    // 2. Set bit flag EXIF (0x08) pada VP8X chunk (offset 20) tanpa menghapus flag Alpha (0x10) atau Anim (0x02)
    const flags = cloned.readUInt8(20);
    cloned.writeUInt8(flags | 0x08, 20);

    // 3. Iterasi chunk WebP: perbaiki flag ANMF (frame disposal) dan hapus EXIF lama jika ada
    const chunks = [];
    let offset = 12; // Mulai setelah RIFF (4) + Size (4) + WEBP (4)

    while (offset < cloned.length) {
        const chunkFourCC = cloned.subarray(offset, offset + 4).toString('ascii');
        const chunkSize = cloned.readUInt32LE(offset + 4);
        const chunkTotalLength = 8 + chunkSize + (chunkSize % 2);

        if (chunkFourCC === 'EXIF') {
            // Lewati EXIF lama
        } else if (chunkFourCC === 'ANMF') {
            // Perbaiki disposal method & blending method pada setiap frame animasi:
            // Bit 0 = 1 (dispose to background), Bit 1 = 1 (do not blend / overwrite canvas) -> 0x03
            // Byte flag ANMF berada di offset lokal 23 (8 bytes header chunk + 15 bytes data frame)
            const anmfChunk = cloned.subarray(offset, offset + chunkTotalLength);
            anmfChunk.writeUInt8(0x03, 23);
            chunks.push(anmfChunk);
        } else {
            chunks.push(cloned.subarray(offset, offset + chunkTotalLength));
        }

        offset += chunkTotalLength;
    }

    // 4. Tambahkan EXIF chunk baru
    const exifHeader = Buffer.alloc(8);
    exifHeader.write('EXIF', 0, 'ascii');
    exifHeader.writeUInt32LE(exifBuffer.length, 4);
    const pad = (exifBuffer.length % 2 !== 0) ? Buffer.from([0x00]) : Buffer.alloc(0);
    chunks.push(Buffer.concat([exifHeader, exifBuffer, pad]));

    // 5. Rakit kembali keseluruhan container RIFF
    const payload = Buffer.concat(chunks);
    const riffHeader = Buffer.alloc(12);
    riffHeader.write('RIFF', 0, 'ascii');
    riffHeader.writeUInt32LE(payload.length + 4, 4); // RIFF Size = payload.length + 'WEBP' (4)
    riffHeader.write('WEBP', 8, 'ascii');

    return Buffer.concat([riffHeader, payload]);
}

/**
 * Mengonversi buffer video (MP4/GIF/WEBM) menjadi WebP animasi transparan 512x512
 * menggunakan pipeline FFmpeg direct streaming tanpa perantara GIF.
 * 
 * @param {Buffer} videoBuffer - Buffer data video/animasi
 * @param {Object} [options]
 * @param {number} [options.fps=10] - Frame rate stiker animasi
 * @param {number} [options.maxDuration=15] - Maksimal durasi dalam detik
 * @param {number} [options.quality=70] - Kualitas kompresi WebP
 * @returns {Promise<Buffer>} - Buffer file WebP animasi
 */
export async function convertVideoToWebp(videoBuffer, options = {}) {
    const fps = options.fps || 10;
    const maxDuration = options.maxDuration || 15;
    const quality = options.quality || 70;

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-hide_banner',
            '-loglevel', 'error',
            '-i', 'pipe:0',
            '-ss', '00:00:00',
            '-t', String(maxDuration),
            '-vcodec', 'libwebp',
            '-vf', `fps=${fps},scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1`,
            '-pix_fmt', 'yuva420p',
            '-quality', String(quality),
            '-loop', '0',
            '-preset', 'default',
            '-an',
            '-f', 'webp',
            'pipe:1'
        ]);

        const stdoutChunks = [];
        const stderrChunks = [];

        ffmpeg.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        ffmpeg.stderr.on('data', (chunk) => stderrChunks.push(chunk));

        ffmpeg.on('error', (err) => {
            reject(new Error(`Gagal menjalankan ffmpeg: ${err.message}`));
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                const stderr = Buffer.concat(stderrChunks).toString('utf-8');
                return reject(new Error(`Konversi video ke webp gagal (code ${code}): ${stderr}`));
            }
            resolve(Buffer.concat(stdoutChunks));
        });

        // Tulis buffer video ke stdin ffmpeg
        ffmpeg.stdin.on('error', (err) => {
            if (err.code !== 'EPIPE') {
                console.error('[MEDIA CONVERTER] stdin error:', err);
            }
        });

        ffmpeg.stdin.end(videoBuffer);
    });
}
