import { extractTarget, findParticipant } from '../lib/jidHelper.js';

export default {
    name: "promote",
    aliases: ["admin"],
    category: "group",
    description: "Menaikkan jabatan anggota biasa menjadi Admin grup.",
    usage: "!promote @user",
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,

    async handler({ message, sock, args, prefix, groupMetadata }) {
        try {
            const target = extractTarget(message, args);

            if (!target) {
                return message.reply(`Tag, reply, atau masukkan nomor user yang ingin dijadikan Admin.\nContoh: \`${prefix}promote @user\``);
            }

            // Find participant in group (returns raw JID for API call)
            const participantInfo = findParticipant(groupMetadata, target.baseId);
            if (!participantInfo) {
                return sock.sendMessage(
                    message.chat,
                    { text: `❌ @${target.baseId} tidak ditemukan di grup ini.`, mentions: [target.jid] },
                    { quoted: message }
                );
            }

            if (participantInfo.isAdmin) {
                return sock.sendMessage(
                    message.chat,
                    { text: `⚠️ @${target.baseId} sudah menjadi Admin Grup.`, mentions: [target.jid] },
                    { quoted: message }
                );
            }

            // Use raw participant JID for API call (could be LID in LID-mode groups)
            await sock.groupParticipantsUpdate(message.chat, [participantInfo.participant], "promote");

            return sock.sendMessage(
                message.chat,
                {
                    text: `✅ Berhasil menaikkan @${target.baseId} menjadi Admin Grup!`,
                    mentions: [target.jid],
                },
                { quoted: message }
            );
        } catch (error) {
            console.error("[PROMOTE CMD]", error);
            message.reply("❌ Gagal menaikkan jabatan admin. Pastikan bot adalah admin dan nomor yang dituju valid.");
        }
    }
};
