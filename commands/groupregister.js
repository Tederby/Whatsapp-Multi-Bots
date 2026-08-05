/**
 * Group Register — Admin registers the group in the bot's database.
 *
 * Sub-commands routed via aliases:
 *   !gregister    — register group
 *   !gunregister  — unregister group
 */

import { registerGroup, unregisterGroup, getGroupConfig } from "../lib/database.js";
import { resolveTarget } from "../lib/jidHelper.js";

export default {
    name: "gregister",
    aliases: ["groupregister", "gregreg", "gdaftar", "gunregister", "groupunregister", "gunreg"],
    category: "group",
    description: "Mendaftarkan grup ke database bot.",
    usage: "!gregister | !gunregister",
    groupOnly: true,
    adminOnly: true,

    async handler({ message, sender, prefix, commandName }) {
        try {
            const chatId = message.chat;

            // ── Unregister ──────────────────────────────────────────
            const isUnreg = commandName === "gunregister" ||
                            commandName === "groupunregister" ||
                            commandName === "gunreg";

            if (isUnreg) {
                const config = getGroupConfig(chatId);
                if (!config.registered) {
                    return message.reply("❌ Grup ini belum terdaftar.");
                }

                unregisterGroup(chatId);
                return message.reply("✅ Registrasi grup telah dihapus dari database bot.");
            }

            // ── Register ────────────────────────────────────────────
            const config = getGroupConfig(chatId);
            if (config.registered) {
                const regDate = config.registeredAt
                    ? new Date(config.registeredAt).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric",
                    })
                    : "Tidak diketahui";

                // Resolve registeredBy untuk display (bisa LID di data lama)
                const { baseId: regByBaseId } = resolveTarget(config.registeredBy || "");

                return message.reply(
                    `⚠️ Grup ini sudah terdaftar!\n\n` +
                    `📅 Terdaftar sejak: ${regDate}\n` +
                    `📝 Didaftarkan oleh: @${regByBaseId || "unknown"}\n\n` +
                    `_Gunakan \`${prefix}gunregister\` untuk menghapus registrasi._`
                );
            }

            // Resolve sender ke PN agar registeredBy selalu konsisten
            const { jid: resolvedSender } = resolveTarget(sender);
            registerGroup(chatId, resolvedSender);

            return message.reply(
                `✅ *REGISTRASI GRUP BERHASIL*\n\n` +
                `Grup ini sekarang terdaftar di database bot.\n` +
                `Ketik \`${prefix}groupprofile\` untuk melihat info grup.`
            );

        } catch (error) {
            console.error("[GREGISTER CMD]", error);
            message.reply("Terjadi kesalahan saat memproses registrasi grup.");
        }
    },
};
