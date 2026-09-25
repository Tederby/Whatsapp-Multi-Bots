/**
 * Set Name — Change bot profile display name on WhatsApp.
 *
 * @module commands/setname
 */

export default {
    name: "setname",
    aliases: ["botname", "setbotname"],
    category: "botadmin",
    description: "Mengganti nama profil (username) bot.",
    usage: "!setname <nama baru>",
    botAdminOnly: true,

    async handler({ message, sock, args, prefix }) {
        try {
            const newName = args.join(" ");
            if (!newName) {
                return message.reply(
                    `╭━━━〔 🏷️ SET BOT NAME 〕━━━\n` +
                    `┃ Harap masukkan nama baru bot.\n` +
                    `┃\n` +
                    `┃ ⋄ \`${prefix || "!"}setname <nama baru>\`\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━`
                );
            }

            // Batas maksimal nama profil di WhatsApp adalah 25 karakter
            if (newName.length > 25) {
                return message.reply("❌ Nama bot tidak boleh lebih dari 25 karakter.");
            }

            await sock.updateProfileName(newName);
            await message.reply(`✅ Berhasil mengubah nama bot menjadi *${newName}*.`);
            
        } catch (error) {
            console.error("[SETNAME]", error);
            message.reply("❌ Gagal mengubah nama bot. Mungkin terkena limit dari WhatsApp (rate-limit) atau terjadi kesalahan.");
        }
    }
};
