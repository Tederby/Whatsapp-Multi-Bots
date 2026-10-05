/**
 * Unremind — Cancel active reminder for the current chat.
 *
 * @module commands/unremind
 */

import { removeReminder } from "../services/reminder.js";
import { resolveTarget } from "../lib/jidHelper.js";
import { logger } from "../lib/logger.js";

export default {
    name: "unremind",
    aliases: ["cancelremind", "batalremind"],
    category: "tools",
    description: "Membatalkan pengingat yang sedang aktif di obrolan ini.",
    usage: "!unremind",

    async handler({ message, sender }) {
        try {
            const { jid: canonicalSender } = resolveTarget(sender);
            const resolvedSender = canonicalSender || sender;
            const chatId = message.chat;
            const isRemoved = removeReminder(resolvedSender, chatId);

            if (isRemoved) {
                const lines = [
                    "╭━━━〔 ✅ PENGINGAT DIBATALKAN 〕━━━",
                    "┃ Pengingat aktifmu di obrolan ini telah berhasil dihapus.",
                    "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                ];
                await message.reply(lines.join("\n"));
            } else {
                await message.reply("⚠️ Kamu tidak memiliki pengingat yang aktif di obrolan ini.");
            }
        } catch (err) {
            logger.error("UNREMIND", err);
            await message.reply("❌ Gagal membatalkan pengingat.");
        }
    }
};

