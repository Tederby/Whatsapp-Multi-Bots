import { getAiringSchedule, formatAiringTime } from "../services/anilist.js";

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MIN_POPULARITY = 5000;

/**
 * Convert a Unix timestamp (seconds) to a WIB (UTC+7) Date.
 */
function toWIB(unixSeconds) {
    // Create date, then shift to WIB manually for formatting
    const d = new Date(unixSeconds * 1000);
    // Use Intl to format in Asia/Jakarta timezone
    return d;
}

/**
 * Format time as HH:MM in WIB timezone.
 */
function formatTimeWIB(unixSeconds) {
    const d = new Date(unixSeconds * 1000);
    return d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta"
    });
}

/**
 * Get the day name (WIB) from a unix timestamp.
 */
function getDayInfoWIB(unixSeconds) {
    const d = new Date(unixSeconds * 1000);
    // Get day/month in WIB
    const formatter = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "short",
        timeZone: "Asia/Jakarta"
    });
    return formatter.format(d);
}

/**
 * Get YYYY-MM-DD key in WIB for grouping.
 */
function getDateKeyWIB(unixSeconds) {
    const d = new Date(unixSeconds * 1000);
    const formatter = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Jakarta"
    });
    return formatter.format(d); // Returns YYYY-MM-DD format
}

export default {
    name: "airing",
    aliases: ["jadwal", "schedule"],
    category: "anime",
    description: "Melihat jadwal tayang anime minggu ini",
    usage: "!airing [all/today/tomorrow]",
    async handler({ message, args, sock, prefix }) {
        const now = Math.floor(Date.now() / 1000);
        let showAll = false;
        let rangeLabel = "";
        let startTime, endTime;

        const subCmd = args[0]?.toLowerCase();
        if (subCmd === "all") {
            showAll = true;
        }

        if (subCmd === "today" || subCmd === "hari") {
            // Today only — from now until end of today WIB
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            startTime = now;
            endTime = Math.floor(todayEnd.getTime() / 1000) + (7 * 3600); // approximate WIB end
            // Simpler: just use next 24h
            startTime = now;
            endTime = now + 86400;
            rangeLabel = "Hari Ini";
        } else if (subCmd === "tomorrow" || subCmd === "besok") {
            startTime = now + 86400;
            endTime = now + (2 * 86400);
            rangeLabel = "Besok";
        } else {
            // Default: 7 days
            startTime = now;
            endTime = now + (7 * 86400);
            rangeLabel = "Minggu Ini";
        }

        try {
            let results = await getAiringSchedule(startTime, endTime);

            if (!results || results.length === 0) {
                await message.reply(`❌ Tidak ada jadwal airing ditemukan.`);
                return;
            }

            // Filter: non-adult, has media, popularity threshold
            results = results.filter(entry => {
                if (!entry.media) return false;
                if (entry.media.isAdult) return false;
                if (!showAll && entry.media.popularity < MIN_POPULARITY) return false;
                return true;
            });

            // Deduplicate by entry.id (in case page overlap)
            const seen = new Set();
            results = results.filter(entry => {
                if (seen.has(entry.id)) return false;
                seen.add(entry.id);
                return true;
            });

            if (results.length === 0) {
                await message.reply(
                    `❌ Tidak ada jadwal airing yang memenuhi filter (popularity ≥ ${MIN_POPULARITY.toLocaleString()}).\n\n` +
                    `💡 _Gunakan \`${prefix || "!"}airing all\` untuk menampilkan semua._`
                );
                return;
            }

            // Group by day (WIB)
            const grouped = {};
            const dayOrder = [];
            for (const entry of results) {
                const dateKey = getDateKeyWIB(entry.airingAt);
                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                    dayOrder.push(dateKey);
                }
                grouped[dateKey].push(entry);
            }

            // Sort each day's entries by time
            for (const key of dayOrder) {
                grouped[key].sort((a, b) => a.airingAt - b.airingAt);
            }

            // Format date range header
            const startDate = new Date(startTime * 1000);
            const endDate = new Date(endTime * 1000);
            const fmtStart = startDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
            const fmtEnd = endDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

            let text = `╭━━━〔 📅 JADWAL AIRING 〕━━━\n`;
            text += `┃ 📆 *${rangeLabel}* (${fmtStart} — ${fmtEnd})\n`;
            text += `┃ 📊 *Total* : ${results.length} episode\n`;
            if (!showAll) text += `┃ 🔍 *Filter* : Popularity ≥ ${MIN_POPULARITY.toLocaleString()}\n`;
            text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n`;

            for (const dateKey of dayOrder) {
                const entries = grouped[dateKey];
                const dayLabel = getDayInfoWIB(entries[0].airingAt);

                text += `\n╭───「 📅 ${dayLabel} 」\n`;
                for (const entry of entries) {
                    const time = formatTimeWIB(entry.airingAt);
                    const title = entry.media.title?.romaji || entry.media.title?.userPreferred || entry.media.title?.english || "N/A";
                    const ep = entry.episode ? `Ep ${entry.episode}` : "";
                    text += `│ 🕐 ${time} — ${title} ${ep}\n`;
                }
                text += `╰──────────────\n`;
            }

            text += `\n⏰ _Waktu ditampilkan dalam WIB (UTC+7)_`;
            if (!showAll) {
                text += `\n💡 _Gunakan \`${prefix || "!"}airing all\` untuk semua anime_`;
            }

            await sock.sendMessage(message.chat, { text: text.trim() }, { quoted: message });

        } catch (err) {
            console.error("[Airing Command Error]:", err);
            if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
                await message.reply("❌ Server AniList sedang sibuk atau timeout. Silakan coba beberapa saat lagi.");
            } else if (err.response?.status === 429) {
                await message.reply("❌ Terlalu banyak request ke AniList API (429 Rate Limit). Mohon tunggu beberapa saat.");
            } else {
                await message.reply(`❌ Terjadi kesalahan: ${err.message || "Unknown error"}`);
            }
        }
    }
};
