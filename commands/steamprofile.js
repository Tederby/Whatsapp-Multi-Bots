/**
 * Steam Profile — Search and display Steam user profiles.
 *
 * @module commands/steamprofile
 */

import { sendSteamProfileDetail } from "../services/steam.js";
import { getUser, resolveUserId } from "../lib/database.js";
import { jidNormalizedUser } from "baileys";

export default {
    name: "steamprofile",
    aliases: ["steamuser", "sp"],
    category: "search",
    description: "Mencari informasi profil user Steam",
    usage: "!steamprofile [@user/-s/--self/username/steamid]",

    flags: {
        self: { type: "boolean", char: "s", aliases: ["self"] },
    },

    async handler({ message, args, cleanArgs, flags, sock, sender, prefix }) {
        try {
            if (args.length === 0 && (!flags || !flags.self)) {
                await message.reply(
                    "╭━━━〔 🎮 STEAM PROFILE 〕━━━\n" +
                    "┃ Mencari informasi profil user Steam.\n" +
                    "╰━━━━━━━━━━━━━━━━━━━━\n\n" +
                    "╭───「 📖 Penggunaan 」\n" +
                    `│ ⋄ \`${prefix || "!"}sp <customURL/SteamID64>\`\n` +
                    `│ ⋄ \`${prefix || "!"}sp -s\` (profil sendiri)\n` +
                    `│ ⋄ \`${prefix || "!"}sp @user\` (tag user)\n` +
                    "╰──────────────\n\n" +
                    "⚠️ *Pencarian bersifat exact match* — harus sama persis dengan custom URL atau SteamID64.\n" +
                    `💡 _Tautkan akun Steam via \`${prefix || "!"}register steam <id>\`_`
                );
                return;
            }

            const input = (args[0] || "").toLowerCase();

            // 1. Diri Sendiri (-s / --self)
            if (flags?.self || input === "-s" || input === "--self") {
                const userData = getUser(resolveUserId(sender));
                if (userData.meta?.steamId) {
                    await sendSteamProfileDetail(userData.meta.steamId, message, sock, false);
                } else {
                    await message.reply(`❌ Kamu belum menautkan akun Steam.\n\n💡 _Gunakan perintah \`${prefix || "!"}register steam <customurl/steamid>\` untuk menautkan._`);
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
        } catch (err) {
            console.error("[STEAMPROFILE]", err);
            await message.reply(`❌ Terjadi kesalahan saat mencari profil Steam: ${err.message}`);
        }
    }
};
