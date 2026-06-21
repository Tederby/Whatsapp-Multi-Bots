export default {
    name: "delete",
    aliases: ["d", "del"],
    category: "admin",
    description: "Menghapus pesan pengguna di group",
    usage: "!delete (reply to a message)",

    async handler({ message, sock, isGroup, isGroupAdmins, isBotGroupAdmins }) {
        try {
            if (!isGroup) {
                return message.reply("Perintah ini hanya bisa digunakan dalam grup!");
            }

            const contextInfo = message.contextInfo;
            const quotedMessage = contextInfo?.quotedMessage;
            const quotedKey = contextInfo?.stanzaId;
            const quotedSender = contextInfo?.participant;

            if (!quotedMessage || !quotedKey || !quotedSender) {
                return message.reply("Harap kutip pesan yang ingin dihapus!");
            }

            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            // Pengecekan apakah pesan yang direply adalah dari bot itu sendiri
            const isQuotedFromBot = quotedSender === botId;

            // Jika bukan pesan bot dan pengirim perintah bukan admin, tolak
            if (!isQuotedFromBot && !isGroupAdmins) {
                return message.reply("Kamu bukan admin grup dan hanya bisa menghapus pesan dari bot.");
            }
            
            // Jika bukan pesan bot dan bot bukan admin, tolak
            if (!isQuotedFromBot && !isBotGroupAdmins) {
                return message.reply("Bot bukan admin grup, tidak bisa menghapus pesan pengguna lain.");
            }

            // Hapus pesan menggunakan context key dari pesan yang dikutip
            await sock.sendMessage(message.chat, {
                delete: {
                    remoteJid: message.chat,
                    fromMe: isQuotedFromBot,
                    id: quotedKey,
                    ...(isQuotedFromBot ? {} : { participant: quotedSender })
                }
            });

        } catch (error) {
            console.error('Delete command error:', error);
            message.reply("Gagal menghapus pesan.");
        }
    }
};