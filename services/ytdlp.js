/**
 * yt-dlp CLI Wrapper
 *
 * Provides async functions to fetch video metadata and download media
 * by spawning yt-dlp as a child process.
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import setting from "../setting.js";

/**
 * Run a yt-dlp command and return stdout as a string.
 * Rejects on non-zero exit or timeout.
 *
 * @param {string[]} args - CLI arguments
 * @param {number} [timeout] - ms before the process is killed
 * @returns {Promise<string>}
 */
function exec(args, timeout) {
    const timeoutMs = timeout || setting.ytdlp.processTimeout;
    return new Promise((resolve, reject) => {
        const proc = spawn("yt-dlp", args, { windowsHide: true });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (d) => (stdout += d.toString()));
        proc.stderr.on("data", (d) => (stderr += d.toString()));

        const timer = setTimeout(() => {
            proc.kill("SIGKILL");
            reject(new Error("yt-dlp process timed out"));
        }, timeoutMs);

        proc.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        });

        proc.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Fetch video/audio metadata via `yt-dlp --dump-json`.
 *
 * @param {string} url
 * @returns {Promise<object>} Parsed JSON metadata
 */
export async function getInfo(url) {
    const raw = await exec([
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        url,
    ]);
    return JSON.parse(raw);
}

/**
 * Download media with a given format string.
 * Returns the absolute path to the downloaded file.
 *
 * @param {string} url
 * @param {string} formatStr  - yt-dlp format selector (e.g. "137+140")
 * @param {string} title      - Used to build a human-readable filename
 * @param {string} [formatLabel] - Optional label appended to filename (e.g. "1080p")
 * @returns {Promise<string>} Absolute path of the downloaded file
 */
export async function download(url, formatStr, title, formatLabel) {
    const tempDir = path.resolve(setting.ytdlp.tempDir);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Build a safe filename: sanitized title + label + random suffix
    const safe = sanitize(title).substring(0, 80);
    const label = formatLabel ? `_${formatLabel}` : "";
    const rand = crypto.randomBytes(4).toString("hex");
    const template = path.join(tempDir, `${safe}${label}_${rand}.%(ext)s`);

    await exec([
        "-f", formatStr,
        "--no-playlist",
        "--no-warnings",
        "--merge-output-format", "mp4",
        "-o", template,
        url,
    ]);

    // yt-dlp replaces %(ext)s — find the actual file
    const prefix = `${safe}${label}_${rand}.`;
    const files = fs.readdirSync(tempDir).filter((f) => f.startsWith(`${safe}${label}_${rand}.`));
    if (files.length === 0) throw new Error("Download completed but output file not found");

    return path.join(tempDir, files[0]);
}

/**
 * Parse the formats array from metadata into a readable table.
 *
 * @param {object[]} formats - The `formats` array from yt-dlp JSON
 * @returns {object[]} Filtered & sorted format list
 */
export function parseFormats(formats) {
    if (!formats || !formats.length) return [];

    return formats
        .filter((f) => f.format_id && f.ext && (f.vcodec !== "none" || f.acodec !== "none"))
        .map((f) => ({
            id: f.format_id,
            ext: f.ext,
            resolution: f.vcodec !== "none"
                ? (f.height ? `${f.height}p` : f.format_note || "video")
                : "audio",
            size: f.filesize || f.filesize_approx || null,
            vcodec: f.vcodec !== "none" ? f.vcodec : null,
            acodec: f.acodec !== "none" ? f.acodec : null,
            fps: f.fps || null,
            abr: f.abr || null,
            note: f.format_note || "",
        }))
        .sort((a, b) => {
            // Videos first (sorted by resolution desc), then audio
            const aIsVideo = a.vcodec !== null;
            const bIsVideo = b.vcodec !== null;
            if (aIsVideo && !bIsVideo) return -1;
            if (!aIsVideo && bIsVideo) return 1;
            // Higher resolution first
            const aH = parseInt(a.resolution) || 0;
            const bH = parseInt(b.resolution) || 0;
            return bH - aH;
        });
}

/**
 * Format a size in bytes to a human-readable string.
 * @param {number|null} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
    if (!bytes) return "~";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss.
 * @param {number|null} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
    if (!seconds) return "N/A";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/** Platform display name lookup. */
const PLATFORM_NAMES = {
    Youtube: "YouTube",
    Twitter: "Twitter/X",
    Instagram: "Instagram",
    TikTok: "TikTok",
    Facebook: "Facebook",
    Twitch: "Twitch",
    SoundCloud: "SoundCloud",
    Reddit: "Reddit",
    Vimeo: "Vimeo",
    Dailymotion: "Dailymotion",
    BiliBili: "BiliBili",
};

/**
 * Resolve a human-friendly platform name from the extractor key.
 * @param {string|undefined} extractorKey
 * @returns {string}
 */
export function getPlatformName(extractorKey) {
    if (!extractorKey) return "Unknown";
    return PLATFORM_NAMES[extractorKey] || extractorKey;
}

/**
 * Estimate total file size for a combined format string like "137+140"
 * using the format metadata.
 *
 * @param {string} formatStr - e.g. "137+140" or "140"
 * @param {object[]} formats - Raw formats array from yt-dlp JSON
 * @returns {number|null} Estimated bytes, or null if unknown
 */
export function estimateSize(formatStr, formats) {
    const ids = formatStr.split("+");
    let total = 0;
    let hasUnknown = false;

    for (const id of ids) {
        const fmt = formats.find((f) => f.format_id === id);
        if (!fmt) return null;
        const size = fmt.filesize || fmt.filesize_approx;
        if (size) total += size;
        else hasUnknown = true;
    }

    return hasUnknown && total === 0 ? null : total;
}

/**
 * Check whether a combined format string contains any video stream.
 * @param {string} formatStr
 * @param {object[]} formats - Raw formats array from yt-dlp JSON
 * @returns {{ hasVideo: boolean, hasAudio: boolean }}
 */
export function detectStreams(formatStr, formats) {
    const ids = formatStr.split("+");
    let hasVideo = false;
    let hasAudio = false;

    for (const id of ids) {
        const fmt = formats.find((f) => f.format_id === id);
        if (!fmt) continue;
        if (fmt.vcodec && fmt.vcodec !== "none") hasVideo = true;
        if (fmt.acodec && fmt.acodec !== "none") hasAudio = true;
    }

    return { hasVideo, hasAudio };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Remove characters unsafe for filenames. */
function sanitize(str) {
    return str
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
        .replace(/\s+/g, "_")
        .trim() || "download";
}
