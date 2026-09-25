/**
 * Info — Display bot system information and statistics.
 */

import os from "os";
import { getAllCommands } from "./_registry.js";
import { getDBStats } from "../lib/database.js";
import { formatUptime } from "../lib/utils.js";
import setting from "../setting.js";

/** Format bytes to human-readable. */
function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

export default {
    name: "info",
    aliases: ["botinfo", "status", "stats"],
    category: "general",
    description: "Menampilkan informasi sistem dan statistik bot",
    usage: "!info",

    async handler({ message, sock, prefix }) {
        try {
            // ── Bot info ────────────────────────────────────────────
            const commands = getAllCommands();
            const categories = new Set(commands.map(c => c.category).filter(Boolean));

            // ── Database stats (efficient COUNT queries) ─────────────
            const stats = getDBStats();
            const { totalUsers, registeredUsers, bannedUsers, totalGroups, registeredGroups, bannedGroups } = stats;

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
            let text = `╭━━━〔 ℹ️ System Info 〕━━━\n`;
            text += `┃ 📛 Nama   : ${setting.name}\n`;
            text += `┃ ⏱️ Uptime : ${formatUptime(processUptime)}\n`;
            text += `┃ 📦 Node   : ${nodeVersion}\n`;
            text += `╰━━━━━━━━━━━━━━━━━━━━\n\n`;

            text += `╭───「 🤖 Bot Stats 」\n`;
            text += `│ ⋄ Commands : ${commands.length} (${categories.size} kategori)\n`;
            text += `│ ⋄ Prefix   : ${setting.prefixes.join(" ")}\n`;
            text += `│ ⋄ Owner    : ${setting.owner.length} orang\n`;
            text += `╰──────────────\n\n`;

            text += `╭───「 💾 Database 」\n`;
            text += `│ ⋄ Users  : ${totalUsers} total`;
            if (registeredUsers > 0) text += ` (${registeredUsers} terdaftar)`;
            text += `\n`;
            if (bannedUsers > 0) text += `│   └ 🚫 Banned : ${bannedUsers}\n`;
            text += `│ ⋄ Groups : ${totalGroups} total`;
            if (registeredGroups > 0) text += ` (${registeredGroups} terdaftar)`;
            text += `\n`;
            if (bannedGroups > 0) text += `│   └ 🚫 Banned : ${bannedGroups}\n`;
            text += `╰──────────────\n\n`;

            text += `╭───「 🖥️ Server & RAM 」\n`;
            text += `│ ⋄ Host   : ${hostname}\n`;
            text += `│ ⋄ OS     : ${platform} (${arch})\n`;
            text += `│ ⋄ CPU    : ${cpus[0]?.model || "Unknown"}\n`;
            text += `│ ⋄ System : ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${((usedMem / totalMem) * 100).toFixed(1)}%)\n`;
            text += `│ ⋄ Bot    : ${formatBytes(memUsage.rss)} (RSS) | ${formatBytes(memUsage.heapUsed)} (Heap)\n`;
            text += `╰──────────────\n\n`;

            text += `╭───「 📢 Update & Info 」\n`;
            if (setting.branding?.channelUrl) {
                text += `│ ⋄ Channel : ${setting.branding.channelUrl}\n`;
            }
            text += `│ ⋄ Error   : \`${prefix}saran\` / \`${prefix}report\`\n`;
            text += `╰──────────────`;

            await message.reply(text);

        } catch (error) {
            console.error("[INFO]", error);
            message.reply("❌ Terjadi kesalahan saat mengambil informasi bot.");
        }
    },
};
