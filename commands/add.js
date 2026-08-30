import { registerReplyHandler, deleteReplyHandler } from './_registry.js';
import { resolveTarget, findParticipant } from '../lib/jidHelper.js';
import { isBanned, isUserGroupBanned } from '../lib/database.js';

export default {
    name: "add",
    aliases: ["tambah"],
    category: "group",
    description: "Menambahkan member ke dalam grup berdasarkan nomor WA.",
    usage: "!add 628xxx",
    groupOnly: true,
    adminOnly: true,
    botAdminRequired: true,

    async handler({ message, sock, groupMetadata, sender, args }) {
        try {
            let number = "";
            let targetJid = "";
            let displayBaseId = "";

            if (message.mentionedJid && message.mentionedJid.length > 0) {
                const { jid, baseId } = resolveTarget(message.mentionedJid[0]);
                displayBaseId = baseId;
                // Untuk add, targetJid harus PN (nomor telepon) karena WhatsApp add API butuh nomor
                targetJid = jid;
                number = baseId;
            } else if (message.quoted) {
                const rawQuoted = message.quoted.sender || message.quoted.participant;
                const { jid, baseId } = resolveTarget(rawQuoted);
                displayBaseId = baseId;
                targetJid = jid;
                number = baseId;
            } else if (args.length > 0) {
                let rawNumber = args.join("");
                number = rawNumber.replace(/[^0-9]/g, '');
                if (number.startsWith('0')) number = '62' + number.slice(1);
                else if (number.startsWith('8')) number = '62' + number;
                targetJid = number + "@s.whatsapp.net";
                displayBaseId = number;
            } else {
                return message.reply("Harap masukkan nomor WhatsApp, tag, atau reply pesan yang ingin ditambahkan!\nContoh: *!add 6281234567890*");
            }

            if (number.length < 10) {
                return message.reply("Nomor WhatsApp tidak valid. Pastikan nomor dimasukkan dengan benar.");
            }

            // Memeriksa apakah target sudah ada di grup (LID-aware via findParticipant)
            const existing = findParticipant(groupMetadata, displayBaseId);
            if (existing) {
                return message.reply("Nomor tersebut sudah ada di dalam grup ini.");
            }

            // Pengecekan status ban target
            if (isBanned(targetJid)) {
                return message.reply(`❌ Nomor *@${displayBaseId}* sedang di-ban secara *global* oleh Owner bot.`);
            }

            if (isUserGroupBanned(message.chat, targetJid)) {
                return message.reply(`⚠️ Nomor *@${displayBaseId}* saat ini di-ban dari menggunakan bot di grup ini.\nGunakan *!unban @${displayBaseId}* terlebih dahulu jika ingin mengizinkannya.`);
            }

            // Mengirim pesan konfirmasi
            const sentMsg = await sock.sendMessage(
                message.chat,
                { 
                    text: `Apakah Anda yakin ingin menambahkan *@${displayBaseId}* ke dalam grup?\n\nBalas pesan ini dengan mengetik *confirm* untuk melanjutkan.\nAtau ketik *cancel* untuk membatalkan.`,
                    mentions: [targetJid] 
                },
                { quoted: message }
            );

            // Mendaftarkan reply handler
            registerReplyHandler(sentMsg.key.id, async ({ message: replyMessage, sock: replySock, state }) => {
                const replyText = replyMessage.text?.toLowerCase()?.trim();
                
                if (replyText === 'confirm') {
                    try {
                        const response = await replySock.groupParticipantsUpdate(replyMessage.chat, [state.targetJid], 'add');
                        
                        const resInfo = response[0] || {};
                        const status = resInfo.status || '200';
                        
                        if (status == 200) {
                            await replySock.sendMessage(
                                replyMessage.chat, 
                                { 
                                    text: `Berhasil menambahkan *@${state.displayBaseId}* ke grup.`,
                                    mentions: [state.targetJid]
                                }, 
                                { quoted: replyMessage }
                            );
                        } else if (status == 403 || status == 408) {
                            await replySock.sendMessage(
                                replyMessage.chat, 
                                { 
                                    text: `Gagal menambahkan secara langsung karena privasi. Namun WhatsApp secara otomatis mengirimkan tautan undangan grup ke *@${state.displayBaseId}*.`,
                                    mentions: [state.targetJid]
                                }, 
                                { quoted: replyMessage }
                            );
                        } else if (status == 409) {
                            await replySock.sendMessage(
                                replyMessage.chat, 
                                { 
                                    text: `Gagal, *@${state.displayBaseId}* ternyata sudah ada di dalam grup.`,
                                    mentions: [state.targetJid]
                                }, 
                                { quoted: replyMessage }
                            );
                        } else {
                            await replySock.sendMessage(
                                replyMessage.chat, 
                                { 
                                    text: `Tidak dapat menambahkan *@${state.displayBaseId}*. (Kode status WA: ${status})`,
                                    mentions: [state.targetJid]
                                }, 
                                { quoted: replyMessage }
                            );
                        }
                    } catch (error) {
                        console.error('Add execution error:', error);
                        await replyMessage.reply("Terjadi kesalahan fatal saat menambahkan member. Pastikan nomor terdaftar di WhatsApp.");
                    }
                    deleteReplyHandler(sentMsg.key.id);
                } else if (replyText === 'cancel') {
                    await replyMessage.reply("Proses penambahan member dibatalkan.");
                    deleteReplyHandler(sentMsg.key.id);
                } else {
                    await replyMessage.reply("Instruksi tidak dikenali. Ketik *confirm* untuk melanjutkan, atau *cancel* untuk membatalkan.");
                }
            }, { targetJid, displayBaseId, commandName: "add", userId: sender });

        } catch (error) {
            console.error('Add command error:', error);
            message.reply("Terjadi kesalahan saat memproses perintah add.");
        }
    }
};
