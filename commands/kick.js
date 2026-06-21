import { registerReplyHandler, deleteReplyHandler } from './_registry.js';

export default {
    name: "kick",
    aliases: ["k", "tendang"],
    category: "admin",
    description: "Mengeluarkan member dari grup.",
    usage: "!kick @user (atau reply pesan)",

    async handler({ message, sock, isGroup, isGroupAdmins, isBotGroupAdmins, groupMetadata, sender }) {
        try {
            if (!isGroup) {
                return message.reply("Perintah ini hanya bisa digunakan dalam grup!");
            }

            if (!isGroupAdmins) {
                return message.reply("Kamu bukan admin grup.");
            }

            if (!isBotGroupAdmins) {
                return message.reply("Bot bukan admin grup, tidak bisa mengeluarkan member.");
            }

            let target = null;
            if (message.mentionedJid && message.mentionedJid.length > 0) {
                target = message.mentionedJid[0];
            } else if (message.contextInfo?.participant) {
                target = message.contextInfo.participant;
            }

            if (!target) {
                return message.reply("Harap tag member atau reply pesan member yang ingin di-kick!");
            }

            const botBaseId = sock.user.id.split(':')[0].split('@')[0];
            const targetBaseId = target.split(':')[0].split('@')[0];
            
            // Reconstruct canonical jid
            const targetJid = targetBaseId + "@s.whatsapp.net";

            if (botBaseId === targetBaseId) {
                return message.reply("Bot tidak bisa kick diri sendiri.");
            }

            // Memeriksa apakah target masih ada di grup
            const isTargetInGroup = groupMetadata.participants.some(p => {
                const participantBaseId = p.id.split(':')[0].split('@')[0];
                return participantBaseId === targetBaseId;
            });

            if (!isTargetInGroup) {
                return message.reply("Member tersebut tidak ada di grup ini.");
            }

            // Memeriksa apakah target adalah admin grup
            const isTargetAdmin = groupMetadata.participants.some(p => {
                const participantBaseId = p.id.split(':')[0].split('@')[0];
                return participantBaseId === targetBaseId && p.admin;
            });

            if (isTargetAdmin) {
                return message.reply("Tidak bisa mengeluarkan sesama admin grup.");
            }

            // Mengirim pesan konfirmasi
            const sentMsg = await sock.sendMessage(
                message.chat,
                { 
                    text: `Apakah Anda yakin ingin kick @${targetBaseId}?\n\nBalas pesan ini dengan mengetik *confirm* untuk melanjutkan.`,
                    mentions: [targetJid] 
                },
                { quoted: message }
            );

            // Mendaftarkan reply handler
            registerReplyHandler(sentMsg.key.id, async ({ message: replyMessage, sock: replySock, state }) => {
                const replyText = replyMessage.text?.toLowerCase()?.trim();
                
                if (replyText === 'confirm') {
                    try {
                        await replySock.groupParticipantsUpdate(replyMessage.chat, [state.targetJid], 'remove');
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
            }, { targetJid, targetBaseId, commandName: "kick", userId: sender });

        } catch (error) {
            console.error('Kick command error:', error);
            message.reply("Terjadi kesalahan saat memproses perintah kick.");
        }
    }
};
