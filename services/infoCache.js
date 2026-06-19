/**
 * URL Info Cache
 *
 * Caches yt-dlp --dump-json results per URL to avoid redundant fetches
 * when the same link is used by multiple users (e.g. in a group chat).
 */

import setting from "../setting.js";
import { getInfo as fetchInfo } from "./ytdlp.js";

/** @type {Map<string, { data: object, timestamp: number }>} */
const cache = new Map();

/**
 * Get video info, using the cache when possible.
 *
 * @param {string} url
 * @returns {Promise<object>} yt-dlp JSON metadata
 */
export async function getCachedInfo(url) {
    const expiry = setting.ytdlp?.cacheExpiry || 10 * 60 * 1000;
    const entry = cache.get(url);

    if (entry && Date.now() - entry.timestamp < expiry) {
        return entry.data;
    }

    const data = await fetchInfo(url);
    cache.set(url, { data, timestamp: Date.now() });
    return data;
}

/**
 * Purge expired entries. Called by the cleanup service.
 * @returns {number} Number of entries purged
 */
export function purgeExpired() {
    const expiry = setting.ytdlp?.cacheExpiry || 10 * 60 * 1000;
    const now = Date.now();
    let purged = 0;
    for (const [url, entry] of cache) {
        if (now - entry.timestamp > expiry) {
            cache.delete(url);
            purged++;
        }
    }
    return purged;
}
