/**
 * play — YouTube Audio & Interactive Spotify Mobile HTML Player
 *
 * Downloads YouTube audio with the highest compatible AAC/m4a format,
 * fetches the cover thumbnail, and renders an authentic Spotify Mobile
 * music player via WhatsApp's native HTML Webview engine.
 *
 * Features:
 * - 4-stage sequential status update via message.replyUpdate
 * - Interactive play/pause, seeking timebar, loop toggle, and like button
 * - Zero auto-deletion (120s timeout disabled as requested)
 * - Self-contained Base64 assets bypassing WhatsApp sandbox network blocks
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import { getCachedInfo } from "../services/infoCache.js";
import { downloadAudio, formatDuration } from "../services/ytdlp.js";
import { downloadQueue } from "../services/downloadQueue.js";
import { tryDelete } from "../services/cleanup.js";
import { sendUI, esc } from "../lib/uiEngine.js";
import { isUrl } from "../lib/utils.js";

// ── Spotify Mobile HTML Player Template ──────────────────────────────────────

function renderSpotifyPlayerHtml({ title, artist, durationSec, thumbnailBase64, audioBase64 }) {
    const safeTitle = esc(title);
    const safeArtist = esc(artist);
    const totalSec = Math.max(1, parseInt(durationSec, 10) || 0);
    const formattedDuration = formatDuration(totalSec);

    // Fallback album art SVG if thumbnail is unavailable
    const coverArtSrc = thumbnailBase64 || `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23282828"/><circle cx="150" cy="150" r="60" fill="%23121212"/><path d="M135 120 L180 150 L135 180 Z" fill="%231db954"/></svg>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Spotify - ${safeTitle}</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;margin:0;padding:0}
html,body{width:100%;height:100%;overflow-x:hidden;background:#121212;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#ffffff;touch-action:manipulation}

.sp-player{
  width:100%;
  max-width:380px;
  min-height:100vh;
  margin:0 auto;
  padding:18px 20px 24px;
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  background:linear-gradient(180deg, #1e3325 0%, #151e18 35%, #121212 70%);
}

/* ── Top Header ─────────────────────────────────── */
.sp-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  height:40px;
  margin-bottom:14px;
}
.sp-header-btn{
  background:transparent;
  border:none;
  color:#ffffff;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:6px;
}
.sp-header-btn svg{width:22px;height:22px;fill:currentColor}
.sp-header-center{text-align:center;line-height:1.2}
.sp-header-sub{font-size:10px;font-weight:700;letter-spacing:1px;color:#b3b3b3;text-transform:uppercase}
.sp-header-title{font-size:11px;font-weight:700;color:#ffffff}

/* ── Album Artwork ──────────────────────────────── */
.sp-artwork-container{
  width:100%;
  aspect-ratio:1/1;
  margin:10px 0 20px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.sp-artwork{
  width:100%;
  height:100%;
  border-radius:10px;
  object-fit:cover;
  box-shadow:0 16px 36px rgba(0,0,0,0.7);
}

/* ── Track Details ──────────────────────────────── */
.sp-details{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:18px;
}
.sp-track-info{flex:1;overflow:hidden;padding-right:12px}
.sp-track-title{
  font-size:18px;
  font-weight:700;
  color:#ffffff;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  margin-bottom:4px;
}
.sp-track-artist{
  font-size:13px;
  font-weight:500;
  color:#b3b3b3;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.sp-heart-btn{
  background:transparent;
  border:none;
  color:#b3b3b3;
  cursor:pointer;
  padding:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  transition:transform 0.15s ease, color 0.15s ease;
}
.sp-heart-btn:active{transform:scale(0.85)}
.sp-heart-btn.liked{color:#1db954}
.sp-heart-btn svg{width:22px;height:22px;fill:currentColor}

/* ── Progress Bar ───────────────────────────────── */
.sp-progress-container{margin-bottom:12px}
.sp-progress-track{
  position:relative;
  width:100%;
  height:4px;
  background:#4d4d4d;
  border-radius:2px;
  cursor:pointer;
  margin-bottom:6px;
}
.sp-progress-fill{
  position:absolute;
  left:0;
  top:0;
  height:100%;
  width:0%;
  background:#ffffff;
  border-radius:2px;
  pointer-events:none;
}
.sp-slider{
  position:absolute;
  left:0;
  top:-8px;
  width:100%;
  height:20px;
  opacity:0;
  cursor:pointer;
  margin:0;
  z-index:3;
}
.sp-timestamps{
  display:flex;
  justify-content:space-between;
  font-size:11px;
  font-weight:500;
  color:#b3b3b3;
}

/* ── Controls ───────────────────────────────────── */
.sp-controls{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:20px;
}
.sp-ctrl-btn{
  background:transparent;
  border:none;
  color:#b3b3b3;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  padding:8px;
  position:relative;
  transition:transform 0.1s ease, color 0.1s ease;
}
.sp-ctrl-btn:active{transform:scale(0.9)}
.sp-ctrl-btn.active{color:#1db954}
.sp-ctrl-btn.active::after{
  content:"";
  position:absolute;
  bottom:2px;
  width:4px;
  height:4px;
  border-radius:50%;
  background:#1db954;
}
.sp-ctrl-btn svg{width:22px;height:22px;fill:currentColor}

.sp-ctrl-btn.main-play{
  width:56px;
  height:56px;
  border-radius:50%;
  background:#ffffff;
  color:#000000;
  padding:0;
  box-shadow:0 8px 16px rgba(0,0,0,0.3);
  transition:transform 0.15s ease, background-color 0.15s ease;
}
.sp-ctrl-btn.main-play:active{transform:scale(0.92);background:#e0e0e0}
.sp-ctrl-btn.main-play svg{width:24px;height:24px;fill:#000000}

/* ── Bottom Bar ─────────────────────────────────── */
.sp-bottom-bar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding-top:10px;
  font-size:11px;
  color:#b3b3b3;
}
.sp-device-info{
  display:flex;
  align-items:center;
  gap:6px;
  color:#1db954;
  font-weight:600;
}
.sp-device-info svg{width:16px;height:16px;fill:currentColor}
.sp-bottom-actions{display:flex;gap:14px}
.sp-bottom-btn{
  background:transparent;
  border:none;
  color:#b3b3b3;
  cursor:pointer;
  display:flex;
  align-items:center;
  padding:4px;
}
.sp-bottom-btn:active{color:#ffffff}
.sp-bottom-btn svg{width:18px;height:18px;fill:currentColor}
</style>
</head>
<body>

<div class="sp-player">
  <!-- Top Navigation -->
  <div class="sp-header">
    <button class="sp-header-btn" title="Close" onclick="haptic()">
      <svg viewBox="0 0 24 24"><path d="M19.5 8.5L12 16L4.5 8.5"/></svg>
    </button>
    <div class="sp-header-center">
      <div class="sp-header-sub">Playing From YouTube</div>
      <div class="sp-header-title">Spotify Music Player</div>
    </div>
    <button class="sp-header-btn" title="More" onclick="haptic()">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
  </div>

  <!-- Cover Artwork -->
  <div class="sp-artwork-container">
    <img class="sp-artwork" src="${coverArtSrc}" alt="Album Artwork" onerror="this.src='${coverArtSrc}'">
  </div>

  <!-- Track Info -->
  <div class="sp-details">
    <div class="sp-track-info">
      <div class="sp-track-title">${safeTitle}</div>
      <div class="sp-track-artist">${safeArtist}</div>
    </div>
    <button class="sp-heart-btn" id="btn-heart" onclick="toggleHeart()" title="Save to Favorites">
      <svg id="heart-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </button>
  </div>

  <!-- Scrub / Time Bar -->
  <div class="sp-progress-container">
    <div class="sp-progress-track">
      <div class="sp-progress-fill" id="progress-fill"></div>
      <input type="range" class="sp-slider" id="scrubber" min="0" max="${totalSec}" value="0" step="0.5" oninput="onSeek(this.value)">
    </div>
    <div class="sp-timestamps">
      <span id="cur-time">0:00</span>
      <span id="dur-time">${formattedDuration}</span>
    </div>
  </div>

  <!-- Controls -->
  <div class="sp-controls">
    <button class="sp-ctrl-btn" id="btn-shuffle" onclick="toggleShuffle()" title="Shuffle">
      <svg viewBox="0 0 24 24"><path d="M14.83 13.41l-1.8-1.8 1.42-1.42 1.41 1.41-1.03 1.81zm4.76-4.99l-3.42-3.42v2.58h-2.17l2.42 2.42 3.17-1.58zm-13.59 11.58h3.17l8.42-8.42v2.58l3.41-3.42-3.41-3.41v2.58l-9.17 9.17h-2.42v-1.66zm0-12h2.42l4.17 4.17-1.42 1.42-3.42-3.42h-1.75v-2.17z"/></svg>
    </button>

    <button class="sp-ctrl-btn" onclick="seekRelative(-5)" title="Previous">
      <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
    </button>

    <button class="sp-ctrl-btn main-play" id="btn-play" onclick="togglePlay()" title="Play / Pause">
      <svg id="play-icon" viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19"/></svg>
    </button>

    <button class="sp-ctrl-btn" onclick="seekRelative(5)" title="Next">
      <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
    </button>

    <button class="sp-ctrl-btn" id="btn-repeat" onclick="toggleRepeat()" title="Repeat">
      <svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
    </button>
  </div>

  <!-- Bottom Device Connected Bar -->
  <div class="sp-bottom-bar">
    <div class="sp-device-info">
      <svg viewBox="0 0 24 24"><path d="M18 10.5V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4.5l4 4v-11l-4 4z"/></svg>
      <span>WhatsApp Mobile Player</span>
    </div>
    <div class="sp-bottom-actions">
      <button class="sp-bottom-btn" onclick="haptic()" title="Share">
        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
      </button>
      <button class="sp-bottom-btn" onclick="haptic()" title="Queue">
        <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
      </button>
    </div>
  </div>
</div>

<!-- Embedded Audio Source -->
<audio id="sp-audio" preload="auto" src="${audioBase64}"></audio>

<script>
const audio = document.getElementById("sp-audio");
const playBtn = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");
const fill = document.getElementById("progress-fill");
const scrubber = document.getElementById("scrubber");
const curTime = document.getElementById("cur-time");
const durTime = document.getElementById("dur-time");

function haptic() {
  try { if (navigator.vibrate) navigator.vibrate([15]); } catch(e) {}
}

function formatSec(sec) {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function updatePlayIcon(isPlaying) {
  if (isPlaying) {
    playIcon.innerHTML = '<rect x="6" y="5" width="4" height="14" fill="#000000"/><rect x="14" y="5" width="4" height="14" fill="#000000"/>';
  } else {
    playIcon.innerHTML = '<polygon points="8,5 19,12 8,19" fill="#000000"/>';
  }
}

function togglePlay() {
  haptic();
  if (audio.paused) {
    audio.play().then(() => {
      updatePlayIcon(true);
    }).catch(err => {
      console.warn("Play blocked:", err);
    });
  } else {
    audio.pause();
    updatePlayIcon(false);
  }
}

function seekRelative(offset) {
  haptic();
  audio.currentTime = Math.max(0, Math.min(audio.duration || ${totalSec}, audio.currentTime + offset));
}

function onSeek(val) {
  haptic();
  audio.currentTime = parseFloat(val);
}

audio.addEventListener("timeupdate", () => {
  const cur = audio.currentTime;
  const dur = audio.duration || ${totalSec};
  curTime.textContent = formatSec(cur);
  const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
  fill.style.width = pct + "%";
  scrubber.value = cur;
});

audio.addEventListener("loadedmetadata", () => {
  if (audio.duration && !isNaN(audio.duration)) {
    durTime.textContent = formatSec(audio.duration);
    scrubber.max = audio.duration;
  }
});

audio.addEventListener("ended", () => {
  updatePlayIcon(false);
  fill.style.width = "0%";
  curTime.textContent = "0:00";
  scrubber.value = 0;
});

function toggleRepeat() {
  haptic();
  audio.loop = !audio.loop;
  document.getElementById("btn-repeat").classList.toggle("active", audio.loop);
}

function toggleShuffle() {
  haptic();
  const btn = document.getElementById("btn-shuffle");
  btn.classList.toggle("active");
}

function toggleHeart() {
  haptic();
  const btn = document.getElementById("btn-heart");
  btn.classList.toggle("liked");
}
</script>
</body>
</html>`;
}

// ── Command Definition ───────────────────────────────────────────────────────

export default {
    name: "play",
    aliases: ["ytplay", "spotify", "music"],
    category: "download",
    description: "Unduh audio YouTube dan putar di Spotify Mobile HTML Player",
    usage: "!play <url>",

    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    ownerOnly: false,
    privateOnly: false,
    registerRequired: false,

    async handler({ message, sock, args, prefix }) {
        const url = args[0];
        if (!url || !isUrl(url)) {
            return message.reply(
                `╭━━━〔 🎵 *SPOTIFY PLAYER* 〕━━━\n` +
                `┃ *Penggunaan:* \`${prefix}play <link_youtube>\`\n` +
                `┃ *Contoh:* \`${prefix}play https://youtu.be/dQw4w9WgXcQ\`\n` +
                `┃\n` +
                `┃ _Audio akan diunduh dan diputar di dalam Spotify HTML Player._\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━`
            );
        }

        // ── 1. Update Tahap a: Memulai Fetch ────────────────────────────────
        const update = await message.replyUpdate("⏳ *[1/4]* Menghubungkan ke YouTube & memverifikasi link...");

        // ── 2. Periksa Antrian Download ─────────────────────────────────────
        const queuePos = downloadQueue.pending;
        if (queuePos > 0) {
            await update(`📋 *[1/4]* Antrian ke-${queuePos + 1}. Mohon tunggu slot tersedia...`);
        }
        await downloadQueue.acquire();

        let filePath = null;
        try {
            // ── 3. Ambil Metadata & Thumbnail ───────────────────────────────
            let info;
            try {
                info = await getCachedInfo(url);
            } catch (fetchErr) {
                throw new Error("Gagal mengambil info YouTube. Pastikan link valid dan video bersifat publik.");
            }

            const title = info.title || "Unknown Track";
            const artist = info.uploader || info.channel || info.artist || info.creator || "YouTube Artist";
            const durationSec = info.duration || 0;
            const durationFormatted = formatDuration(durationSec);

            // Batasi durasi maksimal 10 menit (600 detik) untuk menjaga stabilitas payload Webview
            if (durationSec > 600) {
                throw new Error(`Durasi audio terlalu panjang (${durationFormatted}). Batas maksimal untuk Spotify HTML Player adalah 10 menit.`);
            }

            // ── 4. Update Tahap b: Sedang Mengunduh ──────────────────────────
            await update(
                `⏳ *[2/4]* Mengunduh audio & metadata...\n\n` +
                `🎵 *Judul:* ${title}\n` +
                `👤 *Channel:* ${artist}\n` +
                `⏱️ *Durasi:* ${durationFormatted}\n\n` +
                `_Sedang memproses audio kompatibel tertinggi..._`
            );

            // Fetch cover thumbnail as Base64 Data URI
            let thumbnailBase64 = "";
            if (info.thumbnail) {
                try {
                    const thumbRes = await axios.get(info.thumbnail, {
                        responseType: "arraybuffer",
                        timeout: 10000,
                    });
                    const contentType = thumbRes.headers["content-type"] || "image/jpeg";
                    thumbnailBase64 = `data:${contentType};base64,${Buffer.from(thumbRes.data).toString("base64")}`;
                } catch (thumbErr) {
                    console.warn("[play] Gagal mengambil thumbnail:", thumbErr.message);
                }
            }

            // ── 5. Download Audio via yt-dlp ─────────────────────────────────
            filePath = await downloadAudio(url, title);

            // Validasi file dan ukurannya
            const stat = fs.statSync(filePath);
            const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB safe ceiling for WhatsApp WebSocket frame
            if (stat.size > MAX_AUDIO_BYTES) {
                throw new Error(`Ukuran file audio melebihi batas aman Webview (${(stat.size / (1024 * 1024)).toFixed(1)} MB > 5 MB).`);
            }

            // Encode audio ke Base64 Data URI
            const ext = path.extname(filePath).toLowerCase().replace(".", "");
            const mimeType = ext === "m4a" || ext === "aac" ? "audio/mp4" : ext === "mp3" ? "audio/mpeg" : `audio/${ext}`;
            const audioBuffer = fs.readFileSync(filePath);
            const audioBase64 = `data:${mimeType};base64,${audioBuffer.toString("base64")}`;

            // ── 6. Update Tahap c: Selesai Download & Mengirim HTML ──────────
            await update(`📦 *[3/4]* Download selesai! Mengirim Spotify Mobile Player ke chat...`);

            const playerHtml = renderSpotifyPlayerHtml({
                title,
                artist,
                durationSec,
                thumbnailBase64,
                audioBase64
            });

            // Kirim pesan Webview interaktif via uiEngine (sendUI)
            await sendUI(sock, message.chat, {
                title: `Spotify • ${title.substring(0, 30)}`,
                html: playerHtml
            });

            // ── 7. Update Tahap d: Selesai & Peringatan Penghapusan Lokal ────
            // Catatan: Timeout 2 menit dinonaktifkan sesuai permintaan pengguna
            await update(
                `✅ *Done!*\n\n` +
                `⚠️ *Peringatan:* Tampilan HTML Player ini tidak akan dihapus otomatis (timeout 2 menit dinonaktifkan). ` +
                `Jika Anda atau anggota lain mengalami lag saat memuat pesan player ini di WhatsApp, ` +
                `silakan hapus pesan ini secara lokal (*Delete for me*).`
            );

        } catch (err) {
            // ── 8. Tahap e: Penanganan Error Transparan ─────────────────────
            console.error("[play command error]", err);
            await update(`❌ *Gagal:* ${err.message || "Terjadi kesalahan saat memproses permintaan."}`);
        } finally {
            // Bersihkan file temporary dan bebaskan slot antrian
            tryDelete(filePath);
            downloadQueue.release();
        }
    }
};
