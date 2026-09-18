import { sendAnilistProfileDetail, extractAnilistUsername } from "../services/anilist.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { jidNormalizedUser } from "baileys";

export default {
    name: "anilist",
    aliases: ["al", "alprofile", "alp", "anilistprofile"],
    category: "search",
    description: "Mencari informasi profil user AniList",
    usage: "!anilist [@user/-s/--self/username/link]",

    flags: {
        self: { type: "boolean", char: "s", aliases: ["self"] },
    },

    async handler({ message, args, cleanArgs, flags, sock, sender, prefix }) {
        if (args.length === 0 && (!flags || !flags.self)) {
            await message.reply(
                "╭━━━〔 🌸 ANILIST PROFILE 〕━━━\n" +
                "┃ Mencari informasi profil user AniList.\n" +
                "╰━━━━━━━━━━━━━━━━━━━━\n\n" +
                "╭───「 📖 Penggunaan 」\n" +
                `│ ⋄ \`${prefix || "!"}anilist <username>\`\n` +
                `│ ⋄ \`${prefix || "!"}anilist -s\` (profil sendiri)\n` +
                `│ ⋄ \`${prefix || "!"}anilist @user\` (tag user)\n` +
                "╰──────────────\n\n" +
                `💡 _Tautkan akun via \`${prefix || "!"}register anilist <username>\`_`
            );
            return;
        }

        const input = (args[0] || "").toLowerCase();

        // 1. Diri Sendiri (-s / --self)
        if (flags?.self || input === "-s" || input === "--self") {
            const userData = getUser(resolveUserId(sender));
            if (userData.meta?.anilistUsername) {
                await sendAnilistProfileDetail(userData.meta.anilistUsername, message, sock, false);
            } else {
                await message.reply(`❌ Kamu belum menautkan akun AniList.\n\n💡 _Gunakan perintah \`${prefix || "!"}register anilist <username>\` untuk menautkan._`);
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

            if (userData.meta?.anilistUsername) {
                await sendAnilistProfileDetail(userData.meta.anilistUsername, message, sock, false);
            } else {
                await message.reply(`❌ Pengguna tersebut belum menautkan akun AniList mereka.`);
            }
            return;
        }

        // 3. Check if input is an AniList profile link or raw username
        const fullInput = args.join(" ").trim();
        const extracted = extractAnilistUsername(fullInput);

        // 4. Default: Search by username
        await sendAnilistProfileDetail(extracted || fullInput, message, sock, false);
    }
};
