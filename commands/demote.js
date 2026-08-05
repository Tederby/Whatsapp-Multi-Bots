import { extractTarget, findParticipant } from '../lib/jidHelper.js';

export default {
    name: "demote",
    aliases: ["unadmin"],
    category: "group",
    description: "Menurunkan jabatan Admin grup menjadi anggota biasa.",
    usage: "!demote @user",
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,

    async handler({ message, sock, args, prefix, groupMetadata }) {
        try {
            const target = extractTarget(message, args);

            if (!target) {
                return message.reply(`Tag, reply, atau masukkan nomor user yang ingin diturunkan jabatannya.\nContoh: \`${prefix}demote @user\``);
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

            if (!participantInfo.isAdmin) {
                return sock.sendMessage(
                    message.chat,
                    { text: `⚠️ @${target.baseId} bukan Admin Grup. Tidak ada yang perlu diturunkan.`, mentions: [target.jid] },
                    { quoted: message }
                );
            }

            // Use raw participant JID for API call (could be LID in LID-mode groups)
            await sock.groupParticipantsUpdate(message.chat, [participantInfo.participant], "demote");

            return sock.sendMessage(
                message.chat,
                {
                    text: `✅ Berhasil menurunkan jabatan @${target.baseId} menjadi anggota biasa.`,
                    mentions: [target.jid],
                },
                { quoted: message }
            );
        } catch (error) {
            console.error("[DEMOTE CMD]", error);
            message.reply("❌ Gagal menurunkan jabatan admin. Pastikan bot adalah admin dan nomor yang dituju valid.");
        }
    }
};
