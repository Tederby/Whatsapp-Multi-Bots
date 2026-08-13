import { getGroupConfig, saveGroupConfig } from "../lib/database.js";

export default {
    name: 'goodbye',
    aliases: ['bye', 'leavemsg'],
    category: 'group',
    description: 'Mengatur fitur pesan perpisahan di grup',
    usage: '!goodbye [on|off|set] [teks]',
    groupOnly: true,
    adminOnly: true,

    async handler({ message, args, rawArgs, prefix }) {
        try {
            const chatId = message.chat;
            const sub = args[0]?.toLowerCase();
            const config = getGroupConfig(chatId);

            if (sub === "on") {
                config.goodbye = true;
                saveGroupConfig(chatId, config);
                return message.reply("Fitur goodbye diaktifkan!");

            } else if (sub === "off") {
                config.goodbye = false;
                saveGroupConfig(chatId, config);
                return message.reply("Fitur goodbye dinonaktifkan!");

            } else if (sub === "set") {
                // rawArgs removes the prefix and command name
                const goodbyeText = rawArgs.replace(/^set\s*/i, "").trim();

                if (!goodbyeText) {
                    return message.reply(`Gunakan perintah:\n\`${prefix}goodbye set <teks perpisahan>\`\n\nContoh:\n${prefix}goodbye set Selamat tinggal @user dari grup @group!`);
                }

                config.goodbye = true;
                config.goodbyeText = goodbyeText;
                saveGroupConfig(chatId, config);

                return message.reply(`Pesan perpisahan diperbarui dan fitur diaktifkan:\n\n${goodbyeText}`);

            } else {
                return message.reply(
                    `╭━━━〔 👋 GOODBYE 〕━━━\n` +
                    `┃\n` +
                    `┃ Penggunaan:\n` +
                    `┃ • \`${prefix}goodbye on\` → Aktifkan\n` +
                    `┃ • \`${prefix}goodbye off\` → Nonaktifkan\n` +
                    `┃ • \`${prefix}goodbye set <teks>\` → Atur teks\n` +
                    `┃\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `╭───「 💡 Tips Admin 」\n` +
                    `│ Fitur ini *aktif secara default*.\n` +
                    `│\n` +
                    `│ Gunakan placeholder:\n` +
                    `│ • *@user* → mention member yg keluar\n` +
                    `│ • *@group* → nama grup\n` +
                    `│\n` +
                    `│ Contoh set pesan custom:\n` +
                    `│ \`${prefix}goodbye set Bye @user! 😢\n` +
                    `│ Semoga bisa kembali lagi ke *@group*.\`\n` +
                    `╰──────────────`
                );
            }

        } catch (error) {
            console.error('Goodbye command error:', error);
            return message.reply(`Error: ${error.message || error}`);
        }
    }
};
