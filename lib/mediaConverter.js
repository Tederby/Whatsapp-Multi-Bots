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

/**
 * Inspect a media file using FFmpeg stderr diagnostic banner.
 * Does not require ffprobe binary.
 *
 * @param {string} filePath - Absolute path to media file
 * @returns {Promise<{
 *   format: string,
 *   duration: number,
 *   bitrate: number,
 *   hasVideo: boolean,
 *   hasAudio: boolean,
 *   isImage: boolean,
 *   videoCodec: string|null,
 *   resolution: { width: number, height: number }|null,
 *   audioCodec: string|null,
 *   sampleRate: number|null,
 *   raw: string
 * }>}
 */
export async function probeMedia(filePath) {
    return new Promise((resolve) => {
        const proc = spawn('ffmpeg', ['-hide_banner', '-i', filePath]);
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', () => {
            const formatMatch = stderr.match(/Input #0, ([^,]+),/);
            const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
            const bitrateMatch = stderr.match(/bitrate: (\d+) kb\/s/);

            const videoLine = stderr.split('\n').find((l) => l.includes(': Video:'));
            const audioLine = stderr.split('\n').find((l) => l.includes(': Audio:'));

            let durationSeconds = 0;
            if (durationMatch) {
                const hours = parseFloat(durationMatch[1]);
                const minutes = parseFloat(durationMatch[2]);
                const seconds = parseFloat(durationMatch[3]);
                durationSeconds = hours * 3600 + minutes * 60 + seconds;
            }

            let videoCodec = null;
            let resolution = null;
            if (videoLine) {
                const afterVideo = videoLine.split(': Video:')[1]?.trim() || '';
                const parts = afterVideo.split(',').map((s) => s.trim());
                videoCodec = parts[0] || null;
                const resMatch = afterVideo.match(/(\d{2,5})x(\d{2,5})/);
                if (resMatch) {
                    resolution = {
                        width: parseInt(resMatch[1], 10),
                        height: parseInt(resMatch[2], 10),
                    };
                }
            }

            let audioCodec = null;
            let sampleRate = null;
            if (audioLine) {
                const afterAudio = audioLine.split(': Audio:')[1]?.trim() || '';
                const parts = afterAudio.split(',').map((s) => s.trim());
                audioCodec = parts[0] || null;
                const srMatch = afterAudio.match(/(\d+)\s*Hz/);
                if (srMatch) {
                    sampleRate = parseInt(srMatch[1], 10);
                }
            }

            const hasVideo = Boolean(videoLine);
            const hasAudio = Boolean(audioLine);
            const isImage = (hasVideo && !hasAudio && (durationSeconds === 0 || stderr.includes('Duration: N/A')));

            resolve({
                format: formatMatch ? formatMatch[1].trim() : 'unknown',
                duration: durationSeconds,
                bitrate: bitrateMatch ? parseInt(bitrateMatch[1], 10) : 0,
                hasVideo,
                hasAudio,
                isImage,
                videoCodec,
                resolution,
                audioCodec,
                sampleRate,
                raw: stderr,
            });
        });

        proc.on('error', (err) => {
            resolve({
                format: 'unknown',
                duration: 0,
                bitrate: 0,
                hasVideo: false,
                hasAudio: false,
                isImage: false,
                videoCodec: null,
                resolution: null,
                audioCodec: null,
                sampleRate: null,
                raw: err.message,
            });
        });
    });
}

/**
 * Convert a media file to a target format using FFmpeg.
 *
 * @param {Object} params
 * @param {string} params.inputPath - Path to input media file
 * @param {string} params.outputPath - Path to destination output file
 * @param {string} params.targetFormat - Normalized target format (e.g. 'mp4', 'mp3', 'gif', 'ptv', 'ptt', 'jpg', 'png', 'webp', 'wav', 'ogg', 'm4a', 'flac')
 * @param {Object} [params.flags] - CLI flags (--doc, --ptt, --ptv, --compress)
 * @param {Object} [params.probeInfo] - Media metadata from probeMedia()
 * @param {number} [params.timeoutMs=180000] - Process timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function convertMedia({ inputPath, outputPath, targetFormat, flags = {}, probeInfo = {}, timeoutMs = 180000 }) {
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', inputPath];
    const fmt = targetFormat.toLowerCase();

    if (fmt === 'mp4') {
        const vf = flags.compress
            ? "scale='min(1280,trunc(iw/2)*2)':-2"
            : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
        const crf = flags.compress ? '30' : '26';

        args.push(
            '-c:v', 'libx264',
            '-preset', 'faster',
            '-crf', crf,
            '-pix_fmt', 'yuv420p',
            '-vf', vf,
            '-movflags', '+faststart'
        );

        if (!probeInfo.hasAudio) {
            args.push('-an');
        } else {
            args.push('-c:a', 'aac', '-b:a', flags.compress ? '96k' : '128k');
        }
    } else if (fmt === 'webm') {
        args.push('-c:v', 'libvpx', '-b:v', '1M');
        if (!probeInfo.hasAudio) {
            args.push('-an');
        } else {
            args.push('-c:a', 'libvorbis');
        }
    } else if (fmt === 'ptv') {
        // Video Note: Square 1:1 crop
        args.push(
            '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=480:480",
            '-c:v', 'libx264',
            '-preset', 'faster',
            '-crf', '26',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart'
        );
        if (!probeInfo.hasAudio) {
            args.push('-an');
        } else {
            args.push('-c:a', 'aac', '-b:a', '96k');
        }
    } else if (fmt === 'gif') {
        // High-quality palette 2-pass filter
        args.push(
            '-vf', "fps=12,scale='min(480,iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
            '-f', 'gif'
        );
    } else if (fmt === 'mp3') {
        args.push('-vn', '-c:a', 'libmp3lame');
        if (flags.compress) {
            args.push('-b:a', '96k');
        } else {
            args.push('-q:a', '2');
        }
    } else if (fmt === 'ptt' || fmt === 'vn' || flags.ptt) {
        // WhatsApp Voice Note: OGG Opus, 48kHz, mono
        args.push('-vn', '-c:a', 'libopus', '-b:a', '64k', '-ac', '1', '-ar', '48000', '-f', 'ogg');
    } else if (fmt === 'ogg' || fmt === 'opus') {
        args.push('-vn', '-c:a', 'libopus', '-b:a', '128k', '-f', 'ogg');
    } else if (fmt === 'wav') {
        args.push('-vn', '-c:a', 'pcm_s16le');
    } else if (fmt === 'm4a' || fmt === 'aac') {
        args.push('-vn', '-c:a', 'aac', '-b:a', '192k');
    } else if (fmt === 'flac') {
        args.push('-vn', '-c:a', 'flac');
    } else if (fmt === 'jpg' || fmt === 'jpeg') {
        if (probeInfo.hasVideo || !probeInfo.isImage) {
            args.push('-vframes', '1');
        }
        args.push('-q:v', '2');
    } else if (fmt === 'png') {
        if (probeInfo.hasVideo || !probeInfo.isImage) {
            args.push('-vframes', '1');
        }
    } else if (fmt === 'webp') {
        if (probeInfo.hasVideo && !probeInfo.isImage) {
            args.push('-vframes', '1');
        }
        args.push('-vcodec', 'libwebp', '-quality', '80');
    } else {
        // Fallback default
        if (!probeInfo.hasAudio && probeInfo.hasVideo) {
            args.push('-an');
        }
    }

    args.push(outputPath);

    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args);
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        const timer = setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error(`FFmpeg process timed out after ${Math.round(timeoutMs / 1000)} seconds`));
        }, timeoutMs);

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                return reject(new Error(`FFmpeg conversion failed (code ${code}): ${stderr.slice(-600)}`));
            }
            resolve(true);
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

