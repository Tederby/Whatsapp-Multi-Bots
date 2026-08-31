/**
 * Startup Environment & Dependency Diagnostics
 *
 * Checks system binaries (FFmpeg, yt-dlp) and API keys on boot,
 * printing an informative summary to help operators quickly identify
 * missing requirements without guessing why a command fails.
 */

import { execSync } from "child_process";
import setting from "../setting.js";
import { color } from "./utils.js";

/**
 * Check if a command/binary exists in system PATH.
 * @param {string} cmd
 * @returns {boolean}
 */
function isBinaryAvailable(cmd) {
    try {
        const checkCmd = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
        execSync(checkCmd, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/**
 * Run environment diagnostics and log summary.
 * @returns {object} Status report
 */
export function runDiagnostics() {
    const ffmpegOk = isBinaryAvailable("ffmpeg");
    const ytdlpOk = isBinaryAvailable("yt-dlp");
    const geminiOk = Boolean(setting.gemini?.apiKey);
    const youtubeOk = Boolean(setting.youtube?.apiKey);
    const steamOk = Boolean(setting.steam?.apiKey);

    console.log(color("╭━━━〔 ⚙️ Environment Diagnostics 〕━━━", "cyan"));
    console.log(color("┃", "cyan") + ` 🤖 Bot ID     : ${setting.botId} (${setting.name})`);
    console.log(color("┃", "cyan") + ` 👑 Owner(s)   : ${setting.owner.join(", ")}`);
    console.log(color("┃", "cyan") + ` 🎥 FFmpeg     : ${ffmpegOk ? color("✅ Detected", "green") : color("⚠️ Not found (Sticker/Audio limited)", "yellow")}`);
    console.log(color("┃", "cyan") + ` 📥 yt-dlp     : ${ytdlpOk ? color("✅ Detected", "green") : color("⚠️ Not found (Downloader disabled)", "yellow")}`);
    console.log(color("┃", "cyan") + ` 🤖 Gemini AI  : ${geminiOk ? color("✅ Configured", "green") : color("ℹ️ Not set (!translate requires key)", "gray")}`);
    console.log(color("┃", "cyan") + ` 🔍 YouTube API: ${youtubeOk ? color("✅ Configured", "green") : color("ℹ️ Not set (!yts requires key)", "gray")}`);
    console.log(color("┃", "cyan") + ` 🎮 Steam API  : ${steamOk ? color("✅ Configured", "green") : color("ℹ️ Not set (!steamprofile requires key)", "gray")}`);
    console.log(color("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan"));

    return {
        ffmpeg: ffmpegOk,
        ytdlp: ytdlpOk,
        gemini: geminiOk,
        youtube: youtubeOk,
        steam: steamOk,
    };
}

export default { runDiagnostics };
