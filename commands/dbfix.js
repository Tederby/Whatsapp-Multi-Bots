/**
 * Database Fix — Owner-only database repair and maintenance command.
 *
 * Runs comprehensive checks:
 *  - SQLite integrity check
 *  - Orphan record cleanup (group_banned_users, message_claims, bot_registry)
 *  - Empty user record cleanup
 *  - PFP directory ↔ database sync
 *
 * Reports all actions taken with statistics.
 *
 * @module commands/dbfix
 */

import { repairDatabase } from "../lib/database.js";

export default {
    name: "dbfix",
    aliases: ["dbrepair", "fixdb", "dbclean"],
    category: "owner",
    description: "Memperbaiki dan membersihkan database bot (System Owner Only)",
    usage: "!dbfix",
    ownerOnly: true,

    async handler({ message }) {
        const update = await message.replyUpdate("⏳ Menjalankan perbaikan database...");

        try {
            const startTime = Date.now();
            const report = repairDatabase();
            const elapsed = Date.now() - startTime;

            let text = `🔧 *DATABASE REPAIR*\n`;
            text += `────────────────────────\n`;
            text += `⋄ Waktu : ${elapsed}ms\n\n`;

            // Integrity
            text += `*🛡️ Integrity Check*\n`;
            text += `⋄ Status : ${report.integrityOk ? "✅ OK" : "❌ CORRUPT"}\n\n`;

            // Cleanup stats
            const totalCleaned = report.orphanGroupBans + report.staleClaims + report.staleRegistry + report.emptyUsers + report.pfpOrphans + report.pfpMissing;

            text += `*🧹 Pembersihan*\n`;
            text += `⋄ Orphan group bans : ${report.orphanGroupBans}\n`;
            text += `⋄ Stale claims : ${report.staleClaims}\n`;
            text += `⋄ Stale bot registry : ${report.staleRegistry}\n`;
            text += `⋄ Empty user records : ${report.emptyUsers}\n`;
            text += `⋄ PFP file orphans : ${report.pfpOrphans}\n`;
            text += `⋄ PFP missing refs : ${report.pfpMissing}\n\n`;

            if (totalCleaned > 0) {
                text += `✅ Total ${totalCleaned} record berhasil dibersihkan.\n`;
            } else {
                text += `✅ Database bersih, tidak ada yang perlu diperbaiki.\n`;
            }

            if (!report.integrityOk) {
                text += `\n⚠️ *WARNING*: Database memiliki masalah integritas!\nDisarankan untuk backup file \`database.db\` segera.\n`;
            }

            text += `────────────────────────`;

            await update(text);
        } catch (error) {
            console.error("[DBFIX]", error);
            await update("❌ Terjadi kesalahan saat memperbaiki database: " + error.message);
        }
    }
};
