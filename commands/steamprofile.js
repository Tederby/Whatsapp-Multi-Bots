import { sendSteamProfileDetail } from "../services/steam.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { jidNormalizedUser } from "baileys";

export default {
    name: "steamprofile",
    aliases: ["steamuser", "sp"],
    category: "search",
    description: "Mencari informasi profil user Steam",
    usage: "!steamprofile [@user/-s/username/steamid]",
    async handler({ message, args, sock, sender, prefix }) {
        if (args.length === 0) {
            await message.reply(
                "❌ Berikan *custom URL* atau *SteamID64* yang ingin dicari, atau tag user, atau gunakan `-s`.\n\n" +
                "Contoh Penggunaan:\n" +
                "• `!sp gabelogannewell`\n" +
                "• `!sp 76561197960287930`\n" +
                "• `!sp -s` (Melihat profil Steam milikmu sendiri jika sudah tertaut)\n" +
                "• `!sp @User` (Melihat profil Steam orang yang di-tag)\n\n" +
                "⚠️ *Pencarian bersifat exact match* — harus sama persis dengan custom URL profil Steam, bukan display name.\n\n" +
                "📌 *Cara menemukan custom URL:*\n" +
                "Buka profil Steam → lihat URL-nya:\n" +
                "• `steamcommunity.com/id/`*gabelogannewell* ← ini custom URL\n" +
                "• `steamcommunity.com/profiles/`*76561197960287930* ← ini SteamID64\n\n" +
                `💡 _Tautkan akun Steam kamu via \`${prefix}register steam <customurl/steamid>\`_`
            );
            return;
        }

        const input = args[0].toLowerCase();

        // 1. Diri Sendiri (-s)
        if (input === "-s") {
            const userData = getUser(resolveUserId(sender));
            if (userData.meta?.steamId) {
                await sendSteamProfileDetail(userData.meta.steamId, message, sock, false);
            } else {
                await message.reply(`❌ Kamu belum menautkan akun Steam.\n\n💡 _Gunakan perintah \`${prefix}register steam <customurl/steamid>\` untuk menautkan._`);
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
            
            if (userData.meta?.steamId) {
                await sendSteamProfileDetail(userData.meta.steamId, message, sock, false);
            } else {
                await message.reply(`❌ Pengguna tersebut belum menautkan akun Steam mereka.`);
            }
            return;
        }

        // 3. Ignore if it's a full link (auto-detect will handle it)
        const fullInput = args.join("").trim();
        if (/^https?:\/\//i.test(fullInput)) {
            return; // Ignore and let auto-detect handle if exist
        }

        // 4. Default: Search by username/ID
        await sendSteamProfileDetail(fullInput, message, sock, false);
    }
};
