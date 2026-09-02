import { spawn } from 'child_process';

/**
 * Mengonversi buffer video (MP4/GIF/WEBM) menjadi WebP animasi transparan 512x512
 * menggunakan pipeline FFmpeg direct streaming tanpa perantara GIF.
 * 
 * @param {Buffer} videoBuffer - Buffer data video/animasi
 * @param {Object} [options]
 * @param {number} [options.fps=10] - Frame rate stiker animasi
 * @param {number} [options.maxDuration=15] - Maksimal durasi dalam detik
 * @returns {Promise<Buffer>} - Buffer file WebP animasi
 */
export async function convertVideoToWebp(videoBuffer, options = {}) {
    const fps = options.fps || 10;
    const maxDuration = options.maxDuration || 15;

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-hide_banner',
            '-loglevel', 'error',
            '-i', 'pipe:0',
            '-ss', '00:00:00',
            '-t', String(maxDuration),
            '-vcodec', 'libwebp',
            '-vf', `fps=${fps},scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1`,
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
            // Tangani error EPIPE jika ffmpeg keluar lebih cepat
            if (err.code !== 'EPIPE') {
                console.error('[MEDIA CONVERTER] stdin error:', err);
            }
        });

        ffmpeg.stdin.end(videoBuffer);
    });
}
