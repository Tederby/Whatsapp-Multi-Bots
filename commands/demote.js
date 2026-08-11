import { registerReplyHandler, deleteReplyHandler } from './_registry.js';
import { extractTarget, findParticipant, resolveTarget } from '../lib/jidHelper.js';

export default {
    name: "demote",
    aliases: ["unadmin"],
    category: "group",
    description: "Menurunkan jabatan Admin grup menjadi anggota biasa.",
    usage: "!demote @user",
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,

    async handler({ message, sock, args, prefix, groupMetadata, sender }) {
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

            // Prevent demoting bot (would break all admin-dependent features)
            const { baseId: botBaseId } = resolveTarget(sock.user.id);
            if (target.baseId === botBaseId) {
                return sock.sendMessage(
                    message.chat,
                    { text: `❌ Bot tidak bisa di-demote melalui command. Gunakan fitur grup WhatsApp secara langsung jika diperlukan.` },
                    { quoted: message }
                );
            }

            // Self-demote: require confirmation to prevent accidental self-lockout
            const { baseId: senderBaseId } = resolveTarget(sender);
            if (target.baseId === senderBaseId) {
                const sentMsg = await sock.sendMessage(
                    message.chat,
                    {
                        text: `⚠️ Kamu akan menurunkan jabatanmu sendiri dari Admin Grup.\nSetelah di-demote, kamu tidak bisa lagi menggunakan command admin.\n\nBalas pesan ini dengan mengetik *confirm* untuk melanjutkan.\nAtau ketik *cancel* untuk membatalkan.`,
                    },
                    { quoted: message }
                );

                registerReplyHandler(sentMsg.key.id, async ({ message: replyMessage, sock: replySock, state }) => {
                    const replyText = replyMessage.text?.toLowerCase()?.trim();

                    if (replyText === 'confirm') {
                        try {
                            await replySock.groupParticipantsUpdate(replyMessage.chat, [state.actualTargetJid], "demote");
                            await replySock.sendMessage(
                                replyMessage.chat,
                                {
                                    text: `✅ Kamu telah menurunkan jabatanmu sendiri menjadi anggota biasa.`,
                                },
                                { quoted: replyMessage }
                            );
                        } catch (error) {
                            console.error("[DEMOTE CMD]", error);
                            await replyMessage.reply("❌ Gagal menurunkan jabatan admin.");
                        }
                        deleteReplyHandler(sentMsg.key.id);
                    } else if (replyText === 'cancel') {
                        await replyMessage.reply("Proses demote dibatalkan.");
                        deleteReplyHandler(sentMsg.key.id);
                    } else {
                        await replyMessage.reply("Instruksi tidak dikenali. Ketik *confirm* untuk melanjutkan, atau *cancel* untuk membatalkan.");
                    }
                }, {
                    actualTargetJid: participantInfo.participant,
                    targetJid: target.jid,
                    targetBaseId: target.baseId,
                    commandName: "demote",
                    userId: sender
                });
                return;
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
