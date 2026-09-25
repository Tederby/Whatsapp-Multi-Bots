/**
 * Welcome — Configure automated greeting messages when new members join the group.
 */

import { getGroupConfig, saveGroupConfig } from "../lib/database.js";

export default {
    name: 'welcome',
    aliases: [],
    category: 'group',
    description: 'Mengatur fitur welcome di grup',
    usage: '!welcome [on|off|set] [teks]',
    groupOnly: true,
    adminOnly: true,

    async handler({ message, args, rawArgs, prefix }) {
        try {
            const chatId = message.chat;
            const sub = args[0]?.toLowerCase();
            const config = getGroupConfig(chatId);

            if (sub === "on") {
                config.welcome = true;
                saveGroupConfig(chatId, config);
                return message.reply("✅ Fitur pesan sambutan (welcome) telah diaktifkan.");

            } else if (sub === "off") {
                config.welcome = false;
                saveGroupConfig(chatId, config);
                return message.reply("✅ Fitur pesan sambutan (welcome) telah dinonaktifkan.");

            } else if (sub === "set") {
                // rawArgs removes the prefix and command name
                const welcomeText = rawArgs.replace(/^set\s*/i, "").trim();

                if (!welcomeText) {
                    return message.reply(`❌ Masukkan teks selamat datang.\nContoh:\n\`${prefix}welcome set Selamat datang @user di grup @group!\``);
                }

                config.welcome = true;
                config.welcomeText = welcomeText;
                saveGroupConfig(chatId, config);

                return message.reply(`✅ Pesan selamat datang berhasil diperbarui dan fitur diaktifkan:\n\n${welcomeText}`);

            } else {
                return message.reply(
                    `╭━━━〔 👋 WELCOME 〕━━━\n` +
                    `┃\n` +
                    `┃ Penggunaan:\n` +
                    `┃ ⋄ \`${prefix}welcome on\` → Aktifkan\n` +
                    `┃ ⋄ \`${prefix}welcome off\` → Nonaktifkan\n` +
                    `┃ ⋄ \`${prefix}welcome set <teks>\` → Atur teks\n` +
                    `┃\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `╭───「 💡 Tips Admin 」\n` +
                    `│ Fitur ini *aktif secara default*.\n` +
                    `│\n` +
                    `│ Gunakan placeholder:\n` +
                    `│ ⋄ *@user* → mention member baru\n` +
                    `│ ⋄ *@group* → nama grup\n` +
                    `│\n` +
                    `│ Contoh set pesan custom:\n` +
                    `│ \`${prefix}welcome set Halo @user! 👋\n` +
                    `│ Selamat bergabung di *@group*.\n` +
                    `│ Baca rules dulu ya!\`\n` +
                    `╰──────────────`
                );
            }

        } catch (error) {
            console.error('[WELCOME]', error);
            return message.reply(`❌ Terjadi kesalahan: ${error.message || error}`);
        }
    }
};