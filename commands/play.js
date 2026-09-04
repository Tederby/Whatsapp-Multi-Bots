/**
 * play — YouTube Audio & Interactive Spotify Mobile HTML Player
 *
 * Downloads YouTube audio with the highest compatible format,
 * compresses it for WhatsApp in-app Webview delivery, and renders an
 * authentic Spotify Mobile music player via WhatsApp's native HTML Webview.
 *
 * Includes built-in diagnostic and probe commands:
 * - `!play test`        : Sends a lightweight Spotify Player (~25KB) with synthetic audio
 * - `!play test probe`  : Sends size probe payloads (25KB to 2MB) to measure WhatsApp's stanza cutoff
 * - `!play <url> --doc` : Forces sending as an offline .html document (uncompressed audio)
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import { getCachedInfo } from "../services/infoCache.js";
import {
    downloadAudio,
    compressAudio,
    generateSyntheticAudio,
    formatDuration,
    formatSize
} from "../services/ytdlp.js";
import { downloadQueue } from "../services/downloadQueue.js";
import { tryDelete } from "../services/cleanup.js";
import { sendUI, esc } from "../lib/uiEngine.js";
import { isUrl, sanitizeFilename } from "../lib/utils.js";

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

/**
 * Generate a dummy HTML string that expands to roughly targetBase64Kb after JSON and Base64 encoding.
 */
function makeProbeHtml(targetKb) {
    const targetChars = targetKb * 1024 * 0.74; // account for Base64 expansion
    const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Probe ${targetKb}KB</title></head><body style="background:#121212;color:#fff;font-family:sans-serif;padding:24px;text-align:center"><h2 style="color:#1db954">🔬 Webview Size Probe</h2><p style="margin-top:10px">Payload Target: <b>${targetKb} KB</b></p><p style="color:#888;font-size:12px;margin-top:8px">Jika card ini muncul, berarti stansa ${targetKb}KB berhasil diterima.</p><!-- `;
    const foot = ` --></body></html>`;
    const fillerLength = Math.max(0, Math.floor(targetChars - head.length - foot.length));
    const filler = "Z".repeat(fillerLength);
    return head + filler + foot;
}

// ── Command Definition ───────────────────────────────────────────────────────

export default {
    name: "play",
    aliases: ["ytplay", "spotify", "music"],
    category: "download",
    description: "Unduh audio YouTube dan putar di Spotify Mobile HTML Player",
    usage: "!play <url> | !play test | !play test probe",

    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    ownerOnly: false,
    privateOnly: false,
    registerRequired: false,

    async handler({ message, sock, args, prefix }) {
        const subCmd = args[0]?.toLowerCase();

        // ── DIAGNOSTIC MODE: !play test probe ────────────────────────────────
        if (subCmd === "test" && args[1]?.toLowerCase() === "probe") {
            const probeSizesKb = [25, 50, 100, 250, 500, 1000, 2000];
            await message.reply(
                `🔬 *[PROBE DIAGNOSTIC]* Memulai pengujian batas ukuran stansa Webview...\n` +
                `Mengirim 7 ukuran: ${probeSizesKb.map(k => k + "KB").join(", ")}.\n` +
                `_Tiap probe dikirim bertahap selang 1.5 detik._`
            );

            for (const sizeKb of probeSizesKb) {
                try {
                    const probeHtml = makeProbeHtml(sizeKb);
                    await sendUI(sock, message.chat, {
                        title: `🔬 Probe ${sizeKb}KB`,
                        html: probeHtml,
                    });
                    console.log(`[play probe] Dispatched ${sizeKb}KB probe`);
                } catch (probeErr) {
                    console.error(`[play probe] Failed on ${sizeKb}KB:`, probeErr.message);
                }
                await new Promise((r) => setTimeout(r, 1500));
            }

            return await message.reply(
                `╭━━━〔 🔬 PROBE SELESAI 〕━━━\n` +
                `┃ 7 payload probe telah di-relay:\n` +
                `┃ 1. 🟢 25 KB\n` +
                `┃ 2. 🟢 50 KB\n` +
                `┃ 3. 🟢 100 KB\n` +
                `┃ 4. 🟡 250 KB\n` +
                `┃ 5. 🟡 500 KB\n` +
                `┃ 6. 🔴 1000 KB (1 MB)\n` +
                `┃ 7. 🔴 2000 KB (2 MB)\n` +
                `┃\n` +
                `┃ 💡 *Periksa di WhatsApp:* Nomor probe\n` +
                `┃ terbesar yang muncul adalah batas\n` +
                `┃ maksimal ukuran stansa yang diterima HP.\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
            );
        }

        // ── DIAGNOSTIC MODE: !play test (Lightweight Spotify Test Player) ─────
        if (subCmd === "test") {
            let synthPath = null;
            try {
                const update = await message.replyUpdate("⏳ *[Test]* Meracik Spotify Test Player dengan audio sintetis...");

                // Generate 4-second synthetic audio (~17 KB)
                synthPath = await generateSyntheticAudio(4);
                const audioBuffer = fs.readFileSync(synthPath);
                const audioBase64 = `data:audio/mp4;base64,${audioBuffer.toString("base64")}`;

                const testHtml = renderSpotifyPlayerHtml({
                    title: "Test Tone (C5 523Hz)",
                    artist: "Antigravity Sound Lab",
                    durationSec: 4,
                    thumbnailBase64: "",
                    audioBase64,
                });

                await sendUI(sock, message.chat, {
                    title: "Spotify • Test Player (~25KB)",
                    html: testHtml,
                });

                await update(
                    `✅ *[Test Mode Selesai]*\n\n` +
                    `🎵 Spotify Test Player (~25 KB) telah dikirim via Webview.\n` +
                    `👉 *Periksa apakah card muncul di WhatsApp dan tombol Play dapat memutar suara tone 4 detik.*`
                );
            } catch (err) {
                console.error("[play test error]", err);
                await message.reply(`❌ *Gagal Test Player:* ${err.message}`);
            } finally {
                tryDelete(synthPath);
            }
            return;
        }

        // ── REGULAR MODE: !play <url> [--doc] ────────────────────────────────
        const url = args[0];
        if (!url || !isUrl(url)) {
            return message.reply(
                `╭━━━〔 🎵 *SPOTIFY PLAYER* 〕━━━\n` +
                `┃ *Penggunaan:* \`${prefix}play <link_youtube>\`\n` +
                `┃ *Contoh:* \`${prefix}play https://youtu.be/dQw4w9WgXcQ\`\n` +
                `┃\n` +
                `┃ *Mode Diagnostik:* \n` +
                `┃ • \`${prefix}play test\` (Kirim player uji coba 25KB)\n` +
                `┃ • \`${prefix}play test probe\` (Uji batas ukuran stansa)\n` +
                `┃ • \`${prefix}play <url> --doc\` (Kirim sebagai dokumen file .html)\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━`
            );
        }

        const forceDoc = args.includes("--doc");

        // ── 1. Update Tahap a: Memulai Fetch ────────────────────────────────
        const update = await message.replyUpdate("⏳ *[1/4]* Menghubungkan ke YouTube & memverifikasi link...");

        // ── 2. Periksa Antrian Download ─────────────────────────────────────
        const queuePos = downloadQueue.pending;
        if (queuePos > 0) {
            await update(`📋 *[1/4]* Antrian ke-${queuePos + 1}. Mohon tunggu slot tersedia...`);
        }
        await downloadQueue.acquire();

        let rawAudioPath = null;
        let compressedAudioPath = null;

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

            if (durationSec > 600) {
                throw new Error(`Durasi audio terlalu panjang (${durationFormatted}). Batas maksimal adalah 10 menit.`);
            }

            // ── 4. Update Tahap b: Mengunduh Audio ───────────────────────────
            await update(
                `⏳ *[2/4]* Mengunduh audio & metadata...\n\n` +
                `🎵 *Judul:* ${title}\n` +
                `👤 *Channel:* ${artist}\n` +
                `⏱️ *Durasi:* ${durationFormatted}\n\n` +
                `_Sedang memproses ekstraksi audio..._`
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

            // Download raw audio
            rawAudioPath = await downloadAudio(url, title);
            const rawStat = fs.statSync(rawAudioPath);

            // ── 5. Kompresi / Penentuan Mode Pengiriman ───────────────────────
            let finalAudioPath = rawAudioPath;
            let deliveryMode = forceDoc ? "doc" : "webview";

            // Jika mode webview, kompres audio via FFmpeg ke 32kbps mono untuk merampingkan stansa
            if (!forceDoc) {
                try {
                    await update(`⏳ *[2/4]* Mengoptimalkan ukuran audio untuk WhatsApp Webview...`);
                    compressedAudioPath = await compressAudio(rawAudioPath, "32k");
                    finalAudioPath = compressedAudioPath;
                } catch (compErr) {
                    console.warn("[play] Gagal kompresi FFmpeg, menggunakan audio mentah:", compErr.message);
                    finalAudioPath = rawAudioPath;
                }
            }

            const finalStat = fs.statSync(finalAudioPath);
            const ext = path.extname(finalAudioPath).toLowerCase().replace(".", "");
            const mimeType = ext === "m4a" || ext === "aac" ? "audio/mp4" : ext === "mp3" ? "audio/mpeg" : `audio/${ext}`;
            const audioBuffer = fs.readFileSync(finalAudioPath);
            const audioBase64 = `data:${mimeType};base64,${audioBuffer.toString("base64")}`;

            // ── 6. Update Tahap c: Selesai Download & Menyiapkan Player ──────
            await update(`📦 *[3/4]* Download selesai! Mengirim Spotify Mobile Player ke chat...`);

            const playerHtml = renderSpotifyPlayerHtml({
                title,
                artist,
                durationSec,
                thumbnailBase64,
                audioBase64,
            });

            // Threshold: Jika ukuran file audio kompresi melebihi 700 KB (Base64 payload ~1MB),
            // secara otomatis alihkan ke pengiriman Dokumen HTML agar tidak di-drop oleh WhatsApp.
            const MAX_WEBVIEW_AUDIO_BYTES = 750 * 1024;
            if (!forceDoc && finalStat.size > MAX_WEBVIEW_AUDIO_BYTES) {
                deliveryMode = "doc";
                console.log(`[play] Audio size (${formatSize(finalStat.size)}) exceeds webview safe limit, falling back to document mode.`);
            }

            if (deliveryMode === "webview") {
                // Kirim via Webview in-app
                await sendUI(sock, message.chat, {
                    title: `Spotify • ${title.substring(0, 30)}`,
                    html: playerHtml,
                });
            } else {
                // Kirim via Dokumen HTML
                const htmlBuffer = Buffer.from(playerHtml, "utf-8");
                await sock.sendMessage(message.chat, {
                    document: htmlBuffer,
                    mimetype: "text/html",
                    fileName: `${sanitizeFilename(title)}_spotify_player.html`,
                    caption: [
                        `🎵 *${title}*`,
                        `👤 *Artist/Channel:* ${artist}`,
                        `⏱️ *Durasi:* ${durationFormatted}`,
                        `📦 *Ukuran Player:* ${formatSize(htmlBuffer.length)}`,
                        ``,
                        `💡 _Download file HTML di atas dan buka di browser HP Anda untuk memutar dengan tampilan Spotify Player lengkap._`
                    ].join("\n"),
                }, { quoted: message });
            }

            // ── 7. Update Tahap d: Selesai & Peringatan Penghapusan Lokal ────
            await update(
                `✅ *Done!*\n\n` +
                (deliveryMode === "webview"
                    ? `⚠️ *Peringatan:* Tampilan HTML Player ini tidak akan dihapus otomatis (timeout 2 menit dinonaktifkan). ` +
                      `Jika Anda atau anggota lain mengalami lag saat memuat pesan player ini di WhatsApp, ` +
                      `silakan hapus pesan ini secara lokal (*Delete for me*).`
                    : `📄 File Spotify HTML Player interaktif telah dikirim sebagai dokumen (karena durasi/ukuran audio melampaui batas stansa Webview).`)
            );

        } catch (err) {
            // ── 8. Tahap e: Penanganan Error Transparan ─────────────────────
            console.error("[play command error]", err);
            await update(`❌ *Gagal:* ${err.message || "Terjadi kesalahan saat memproses permintaan."}`);
        } finally {
            tryDelete(rawAudioPath);
            tryDelete(compressedAudioPath);
            downloadQueue.release();
        }
    }
};
