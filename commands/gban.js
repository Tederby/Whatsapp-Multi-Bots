/**
 * Global Ban — Owner-only commands for global user bans and group bans.
 *
 * Global user ban: user cannot use bot anywhere.
 * Global group ban: bot stops responding in the group entirely.
 * Owner can ban a group without being in it (by JID).
 */

import {
    banUser, unbanUser, getAllBannedUsers,
    banGroup, unbanGroup, getAllBannedGroups,
    isBotAdmin,
} from "../lib/database.js";
import { resolveTarget, extractTarget } from "../lib/jidHelper.js";
import setting from "../setting.js";

export default {
    name: "gban",
    aliases: ["gunban", "gbanlist", "bangrup", "unbangrup", "bangruplist"],
    category: "botadmin",
    description: "Ban/unban user secara global atau ban grup. (Bot Admin only)",
    usage: "!gban @user | !gunban @user | !gbanlist | !bangrup <groupId> | !unbangrup <groupId> | !bangruplist",
    botAdminOnly: true,

    async handler({ message, sock, args, sender, prefix, isOwner }) {
        try {
            const text = message.text || "";

            // Detect which sub-command was invoked based on the command used
            const cmdMatch = text.match(/^[!.#/\-](\w+)/i);
            const invokedCmd = cmdMatch ? cmdMatch[1].toLowerCase() : "gban";

            // ═══════════════════════════════════════════════════════════
            // GLOBAL USER BAN
            // ═══════════════════════════════════════════════════════════

            if (invokedCmd === "gbanlist") {
                const banned = getAllBannedUsers();
                if (banned.length === 0) {
                    return message.reply("✅ Tidak ada user yang di-global-ban.");
                }

                let reply = `🚫 *GLOBAL BAN LIST* 🚫\n\nTotal: ${banned.length} user\n\n`;
                const mentions = [];

                banned.forEach(({ userId, data }, i) => {
                    const baseId = userId.split("@")[0];
                    reply += `${i + 1}. @${baseId}`;
                    if (data.banReason) reply += ` — _${data.banReason}_`;
                    reply += `\n`;
                    mentions.push(userId);
                });

                reply += `\n_Gunakan \`${prefix}gunban\` @user untuk unban._`;

                return sock.sendMessage(message.chat, { text: reply, mentions }, { quoted: message });
            }

            if (invokedCmd === "gunban") {
                const target = extractTarget(message, args);

                if (!target) {
                    return message.reply("Tag, reply, atau masukkan nomor user yang ingin di-unban.\n\nContoh: *!gunban @user* atau *!gunban 6281234567890*");
                }

                unbanUser(target.jid);

                return sock.sendMessage(
                    message.chat,
                    {
                        text: `✅ @${target.baseId} telah di-unban secara global. Mereka bisa menggunakan bot kembali di mana pun.`,
                        mentions: [target.jid],
                    },
                    { quoted: message }
                );
            }

            if (invokedCmd === "gban") {
                // extractTarget skips args that contain @g.us (handled by extractTarget's number validation)
                const target = extractTarget(message, args?.length > 0 && !args[0].includes("@g.us") ? args : []);

                if (!target) {
                    return message.reply(
                        "Tag, reply, atau masukkan nomor user yang ingin di-global-ban.\n\n" +
                        "Contoh:\n" +
                        `• \`${prefix}gban @user\` — Ban user global\n` +
                        `• \`${prefix}gunban @user\` — Unban user global\n` +
                        `• \`${prefix}gbanlist\` — Lihat daftar global ban`
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

                // Prevent banning owner
                const normalizeNum = (n) => n.startsWith("0") ? "62" + n.slice(1) : n;
                if (setting.owner.some(num => normalizeNum(num) === target.baseId)) {
                    return message.reply("❌ Tidak bisa mem-ban Owner bot secara global.");
                }

                // Prevent non-owner from banning BotAdmin
                if (!isOwner && isBotAdmin(target.jid)) {
                    return message.reply("❌ Hanya Owner yang bisa mem-ban Bot Admin secara global.");
                }

                // Get reason (remaining args after target)
                const reason = args.slice(1).join(" ") || null;

                banUser(target.jid, sender, reason);

                let reply = `🚫 @${target.baseId} telah di-ban secara *global*.\nUser ini tidak bisa menggunakan bot di mana pun.`;
                if (reason) reply += `\n\n📝 Alasan: _${reason}_`;
                reply += `\n\n_Gunakan \`${prefix}gunban @user\` untuk membatalkan._`;

                return sock.sendMessage(
                    message.chat,
                    { text: reply, mentions: [target.jid] },
                    { quoted: message }
                );
            }

            // ═══════════════════════════════════════════════════════════
            // GLOBAL GROUP BAN (Owner Only)
            // ═══════════════════════════════════════════════════════════

            if (invokedCmd === "bangruplist") {
                if (!isOwner) {
                    return message.reply("❌ Perintah ini khusus untuk System Owner.");
                }

                const banned = getAllBannedGroups();
                if (banned.length === 0) {
                    return message.reply("✅ Tidak ada grup yang di-ban.");
                }

                let reply = `🚫 *BANNED GROUPS* 🚫\n\nTotal: ${banned.length} grup\n\n`;

                banned.forEach(({ chatId, data }, i) => {
                    reply += `${i + 1}. \`${chatId}\``;
                    if (data.banReason) reply += ` — _${data.banReason}_`;
                    reply += `\n`;
                });

                reply += `\n_Gunakan \`${prefix}unbangrup <groupId>\` untuk unban._`;

                return message.reply(reply);
            }

            if (invokedCmd === "unbangrup") {
                if (!isOwner) {
                    return message.reply("❌ Perintah ini khusus untuk System Owner.");
                }

                const groupId = args[0];
                if (!groupId) {
                    return message.reply(`Masukkan Group ID yang ingin di-unban.\n\nContoh: \`${prefix}unbangrup 628xxx-xxx@g.us\``);
                }

                // Validate format
                const targetGroup = groupId.includes("@g.us") ? groupId : groupId + "@g.us";

                unbanGroup(targetGroup);

                return message.reply(`✅ Grup \`${targetGroup}\` telah di-unban. Bot akan kembali merespon di grup tersebut.`);
            }

            if (invokedCmd === "bangrup") {
                if (!isOwner) {
                    return message.reply("❌ Perintah ini khusus untuk System Owner.");
                }

                // Can ban the current group or a remote group by JID
                let targetGroup = null;

                if (args[0]) {
                    // Remote group ban by JID
                    targetGroup = args[0].includes("@g.us") ? args[0] : args[0] + "@g.us";
                } else if (message.chat.endsWith("@g.us")) {
                    // Ban current group
                    targetGroup = message.chat;
                }

                if (!targetGroup) {
                    return message.reply(
                        "Masukkan Group ID atau gunakan di dalam grup.\n\n" +
                        "Contoh:\n" +
                        `• \`${prefix}bangrup\` — Ban grup saat ini\n` +
                        `• \`${prefix}bangrup 628xxx-xxx@g.us\` — Ban grup remote\n` +
                        `• \`${prefix}unbangrup 628xxx-xxx@g.us\` — Unban grup\n` +
                        `• \`${prefix}bangruplist\` — Lihat semua grup yang di-ban`
                    );
                }

                const reason = args.length > 1 ? args.slice(1).join(" ") : (args[0] ? null : (args.join(" ") || null));

                banGroup(targetGroup, sender, reason);

                let reply = `🚫 Grup \`${targetGroup}\` telah di-ban.\nBot tidak akan merespon pesan apapun di grup tersebut.`;
                if (reason) reply += `\n\n📝 Alasan: _${reason}_`;
                reply += `\n\n_Gunakan \`${prefix}unbangrup ${targetGroup}\` untuk membatalkan._`;

                return message.reply(reply);
            }

            // Fallback usage
            return message.reply(
                `*Global Ban Commands:*\n\n` +
                `━━ User ━━\n` +
                `• \`${prefix}gban @user [alasan]\` — Ban user global\n` +
                `• \`${prefix}gunban @user\` — Unban user global\n` +
                `• \`${prefix}gbanlist\` — Lihat daftar\n\n` +
                `━━ Grup ━━\n` +
                `• \`${prefix}bangrup [groupId]\` — Ban grup\n` +
                `• \`${prefix}unbangrup <groupId>\` — Unban grup\n` +
                `• \`${prefix}bangruplist\` — Lihat daftar`
            );

        } catch (error) {
            console.error("[GBAN CMD]", error);
            message.reply("Terjadi kesalahan saat memproses perintah global ban.");
        }
    },
};
