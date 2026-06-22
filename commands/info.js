/**
 * Info — Display bot system information and statistics.
 */

import os from "os";
import { getAllCommands } from "./_registry.js";
import { getDB } from "../lib/database.js";
import setting from "../setting.js";

/** Format bytes to human-readable. */
function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

/** Format seconds to human-readable uptime. */
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d} hari`);
    if (h > 0) parts.push(`${h} jam`);
    if (m > 0) parts.push(`${m} menit`);
    if (s > 0 || parts.length === 0) parts.push(`${s} detik`);
    return parts.join(" ");
}

export default {
    name: "info",
    aliases: ["botinfo", "status", "stats"],
    category: "utility",
    description: "Menampilkan informasi sistem dan statistik bot",
    usage: "!info",

    async handler({ message, sock }) {
        try {
            // ── Bot info ────────────────────────────────────────────
            const commands = getAllCommands();
            const categories = new Set(commands.map(c => c.category).filter(Boolean));

            // ── Database stats ───────────────────────────────────────
            const db = getDB();
            const totalUsers = Object.keys(db.users || {}).length;
            const registeredUsers = Object.values(db.users || {}).filter(u => u.registered).length;
            const bannedUsers = Object.values(db.users || {}).filter(u => u.banned).length;
            const totalGroups = Object.keys(db.groups || {}).length;
            const registeredGroups = Object.values(db.groups || {}).filter(g => g.registered).length;
            const bannedGroups = Object.values(db.groups || {}).filter(g => g.banned).length;

            // ── System info ──────────────────────────────────────────
            const memUsage = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const cpus = os.cpus();
            const platform = os.platform();
            const arch = os.arch();
            const hostname = os.hostname();
            const nodeVersion = process.version;
            const processUptime = process.uptime();
            const systemUptime = os.uptime();

            // ── Build display ────────────────────────────────────────
            let text = `╔══ *${setting.name} — INFO* ══╗\n\n`;

            // Bot section
            text += `━━ 🤖 Bot ━━\n`;
            text += `📛 *Nama:* ${setting.name}\n`;
            text += `📊 *Commands:* ${commands.length} (${categories.size} kategori)\n`;
            text += `🔧 *Prefix:* ${setting.prefixes.join(" ")}\n`;
            text += `⏱️ *Bot Uptime:* ${formatUptime(processUptime)}\n`;
            text += `👑 *Owner:* ${setting.owner.length} orang\n\n`;

            // Database section
            text += `━━ 💾 Database ━━\n`;
            text += `👤 *Users:* ${totalUsers} total`;
            if (registeredUsers > 0) text += ` (${registeredUsers} terdaftar)`;
            text += `\n`;
            if (bannedUsers > 0) text += `🚫 *Banned Users:* ${bannedUsers}\n`;
            text += `👥 *Groups:* ${totalGroups} total`;
            if (registeredGroups > 0) text += ` (${registeredGroups} terdaftar)`;
            text += `\n`;
            if (bannedGroups > 0) text += `🚫 *Banned Groups:* ${bannedGroups}\n`;
            text += `\n`;

            // System section
            text += `━━ 🖥️ Server ━━\n`;
            text += `🏷️ *Hostname:* ${hostname}\n`;
            text += `💻 *Platform:* ${platform} (${arch})\n`;
            text += `🧮 *CPU:* ${cpus[0]?.model || "Unknown"} (${cpus.length} core)\n`;
            text += `📦 *Node.js:* ${nodeVersion}\n`;
            text += `⏱️ *System Uptime:* ${formatUptime(systemUptime)}\n\n`;

            // Memory section
            text += `━━ 📊 Memory ━━\n`;
            text += `🖥️ *System:* ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${((usedMem / totalMem) * 100).toFixed(1)}%)\n`;
            text += `🤖 *Bot RSS:* ${formatBytes(memUsage.rss)}\n`;
            text += `📦 *Heap:* ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}\n`;

            text += `\n╚══════════════════════╝`;

            await message.reply(text);

        } catch (error) {
            console.error("[INFO CMD]", error);
            message.reply("Terjadi kesalahan saat mengambil informasi bot.");
        }
    },
};
