/**
 * Group-Level Ban — Ban a user from using the bot in a specific group.
 *
 * Admin and Owner can ban/unban. The banned user can still use the
 * bot in other groups or DMs.
 *
 * Sub-commands routed via aliases:
 *   !ban @user   — ban user in this group
 *   !unban @user — unban user
 *   !banlist     — show banned users
 */

import { banUserInGroup, unbanUserInGroup, getGroupBannedUsers } from "../lib/database.js";
import { resolveTarget, extractTarget, findParticipant } from "../lib/jidHelper.js";

export default {
    name: "ban",
    aliases: ["gban-user", "unban", "banlist"],
    category: "group",
    description: "Ban/unban user dari menggunakan bot di grup ini.",
    usage: "!ban @user [alasan] | !unban @user | !banlist",
    groupOnly: true,
    adminOnly: true,

    async handler({ message, sock, args, sender, isGroup, groupMetadata, commandName }) {
        try {
            const chatId = message.chat;

            // ── !banlist ────────────────────────────────────────────
            if (commandName === "banlist") {
                const banned = getGroupBannedUsers(chatId);
                if (banned.length === 0) {
                    return message.reply("✅ Tidak ada user yang di-ban di grup ini.");
                }

                let text = `🚫 *DAFTAR BAN GRUP* 🚫\n\nTotal: ${banned.length} user\n\n`;
                const mentions = [];

                banned.forEach((userId, i) => {
                    const { baseId } = resolveTarget(userId);
                    text += `${i + 1}. @${baseId}\n`;
                    mentions.push(userId);
                });

                text += `\n_Gunakan !unban @user untuk membatalkan ban._`;

                return sock.sendMessage(chatId, { text, mentions }, { quoted: message });
            }

            // ── !unban @user ────────────────────────────────────────
            if (commandName === "unban") {
                const target = extractTarget(message, args);

                if (!target) {
                    return message.reply("Tag atau reply pesan user yang ingin di-unban.\n\nContoh: *!unban @user*");
                }

                unbanUserInGroup(chatId, target.jid);

                return sock.sendMessage(
                    chatId,
                    {
                        text: `✅ @${target.baseId} telah di-unban di grup ini. Mereka bisa menggunakan bot kembali.`,
                        mentions: [target.jid],
                    },
                    { quoted: message }
                );
            }

            // ── !ban @user [alasan] ─────────────────────────────────
            const target = extractTarget(message, args);

            if (!target) {
                return message.reply(
                    "Tag atau reply pesan user yang ingin di-ban.\n\n" +
                    "Contoh:\n" +
                    "• *!ban @user* — Ban user di grup ini\n" +
                    "• *!unban @user* — Unban user\n" +
                    "• *!banlist* — Lihat daftar ban"
                );
            }

            // Prevent banning self
            const { baseId: senderBaseId } = resolveTarget(sender);
            if (target.baseId === senderBaseId) {
                return message.reply("❌ Kamu tidak bisa mem-ban diri sendiri.");
            }

            // Prevent banning bot
            const { baseId: botBaseId } = resolveTarget(sock.user.id);
            if (target.baseId === botBaseId) {
                return message.reply("❌ Tidak bisa mem-ban bot.");
            }

            // Prevent banning admins (LID-aware via findParticipant)
            const participantInfo = findParticipant(groupMetadata, target.baseId);
            if (participantInfo?.isAdmin) {
                return message.reply("❌ Tidak bisa mem-ban admin grup.");
            }

            banUserInGroup(chatId, target.jid);

            return sock.sendMessage(
                chatId,
                {
                    text: `🚫 @${target.baseId} telah di-ban dari menggunakan bot di grup ini.\n\n_Gunakan !unban @user untuk membatalkan._`,
                    mentions: [target.jid],
                },
                { quoted: message }
            );

        } catch (error) {
            console.error("[BAN CMD]", error);
            message.reply("Terjadi kesalahan saat memproses perintah ban.");
        }
    },
};
