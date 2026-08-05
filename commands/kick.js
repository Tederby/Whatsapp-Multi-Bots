import { registerReplyHandler, deleteReplyHandler } from './_registry.js';
import { resolveTarget, findParticipant } from '../lib/jidHelper.js';

export default {
    name: "kick",
    aliases: ["k", "tendang"],
    category: "group",
    description: "Mengeluarkan member dari grup.",
    usage: "!kick @user (atau reply pesan)",
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,

    async handler({ message, sock, groupMetadata, sender }) {
        try {
            let rawTarget = null;
            if (message.mentionedJid && message.mentionedJid.length > 0) {
                rawTarget = message.mentionedJid[0];
            } else if (message.quoted) {
                rawTarget = message.quoted.sender || message.quoted.participant;
            } else if (message.contextInfo?.participant) {
                rawTarget = message.contextInfo.participant;
            }

            if (!rawTarget) {
                return message.reply("Harap tag member atau reply pesan member yang ingin di-kick!");
            }

            // Resolve ke PN untuk display & mentions
            const { jid: targetJid, baseId: targetBaseId } = resolveTarget(rawTarget);
            const { baseId: botBaseId } = resolveTarget(sock.user.id);

            if (botBaseId === targetBaseId) {
                return message.reply("Bot tidak bisa kick diri sendiri.");
            }

            // Find actual participant JID (bisa LID) untuk API call
            const participantInfo = findParticipant(groupMetadata, targetBaseId);
            if (!participantInfo) {
                return message.reply("Member tersebut tidak ada di grup ini.");
            }

            if (participantInfo.isAdmin) {
                return message.reply("Tidak bisa mengeluarkan sesama admin grup.");
            }

            // Mengirim pesan konfirmasi
            const sentMsg = await sock.sendMessage(
                message.chat,
                {
                    text: `Apakah Anda yakin ingin kick @${targetBaseId}?\n\nBalas pesan ini dengan mengetik *confirm* untuk melanjutkan.\nAtau ketik *cancel* untuk membatalkan.`,
                    mentions: [targetJid]
                },
                { quoted: message }
            );

            // Mendaftarkan reply handler
            registerReplyHandler(sentMsg.key.id, async ({ message: replyMessage, sock: replySock, state }) => {
                const replyText = replyMessage.text?.toLowerCase()?.trim();

                if (replyText === 'confirm') {
                    try {
                        // Gunakan actualTargetJid (dari participant, bisa LID) untuk API call
                        await replySock.groupParticipantsUpdate(replyMessage.chat, [state.actualTargetJid], 'remove');
                        await replySock.sendMessage(
                            replyMessage.chat,
                            {
                                text: `Berhasil mengeluarkan @${state.targetBaseId} dari grup.`,
                                mentions: [state.targetJid]
                            },
                            { quoted: replyMessage }
                        );
                    } catch (error) {
                        console.error('Kick execution error:', error);
                        await replyMessage.reply("Gagal mengeluarkan member.");
                    }
                    deleteReplyHandler(sentMsg.key.id);
                } else if (replyText === 'cancel') {
                    await replyMessage.reply("Proses kick dibatalkan.");
                    deleteReplyHandler(sentMsg.key.id);
                } else {
                    await replyMessage.reply("Instruksi tidak dikenali. Ketik *confirm* untuk melanjutkan, atau *cancel* untuk membatalkan.");
                }
            }, {
                actualTargetJid: participantInfo.participant, // Raw JID untuk API
                targetJid,       // PN JID untuk mentions
                targetBaseId,    // Phone number untuk text display
                commandName: "kick",
                userId: sender
            });

        } catch (error) {
            console.error('Kick command error:', error);
            message.reply("Terjadi kesalahan saat memproses perintah kick.");
        }
    }
};
