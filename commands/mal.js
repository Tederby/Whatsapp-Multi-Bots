import { sendMalProfileDetail } from "../services/mal.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { jidNormalizedUser } from "baileys";

export default {
    name: "mal",
    aliases: ["malprofile", "mp"],
    category: "search",
    description: "Mencari informasi profil user MyAnimeList",
    usage: "!mal [@user/-s/username/link]",
    async handler({ message, args, sock, sender, prefix }) {
        if (args.length === 0) {
            await message.reply(
                "❌ Berikan *username MAL* yang ingin dicari, atau tag user, atau gunakan `-s`.\n\n" +
                "Contoh Penggunaan:\n" +
                "• `!mal Tederby`\n" +
                "• `!mal -s` (Melihat profil MAL milikmu sendiri jika sudah tertaut)\n" +
                "• `!mal @User` (Melihat profil MAL orang yang di-tag)\n\n" +
                `💡 _Tautkan akun MAL kamu via \`${prefix}register mal <username>\`_`
            );
            return;
        }

        const input = args[0].toLowerCase();

        // 1. Diri Sendiri (-s)
        if (input === "-s") {
            const userData = getUser(resolveUserId(sender));
            if (userData.meta?.malUsername) {
                await sendMalProfileDetail(userData.meta.malUsername, message, sock, false);
            } else {
                await message.reply(`❌ Kamu belum menautkan akun MAL.\n\n💡 _Gunakan perintah \`${prefix}register mal <username>\` untuk menautkan._`);
            }
            return;
        }

        // 2. Tag User / Reply (@user)
        let target = null;
        if (message.mentionedJid && message.mentionedJid.length > 0) {
            target = message.mentionedJid[0];
        } else if (message.quoted) {
            target = message.quoted.sender || message.quoted.participant;
        }

        if (target) {
            const normalizedTarget = resolveUserId(jidNormalizedUser(target));
            const userData = getUser(normalizedTarget);
            
            if (userData.meta?.malUsername) {
                await sendMalProfileDetail(userData.meta.malUsername, message, sock, false);
            } else {
                await message.reply(`❌ Pengguna tersebut belum menautkan akun MAL mereka.`);
            }
            return;
        }

        // 3. Ignore if it's a full link (auto-detect will handle it)
        const fullInput = args.join("").trim();
        if (/^https?:\/\//i.test(fullInput)) {
            return; // Ignore and let auto-detect handle if exist
        }

        // 4. Default: Search by username
        await sendMalProfileDetail(fullInput, message, sock, false);
    }
};
