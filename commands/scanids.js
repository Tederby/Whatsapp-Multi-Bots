/**
 * ScanIDs — Manually scan group participants to populate LID↔PN identity map.
 *
 * Owner/BotAdmin only. Scans all participants in the current group
 * and saves any LID→PN mappings found. Useful for pre-populating
 * the identity_map so !profile works immediately for all members.
 *
 * @module commands/scanids
 */

import { scanGroupIdentities, getIdentityCount } from "../lib/database.js";

export default {
    name: "scanids",
    aliases: ["idscan", "mapids"],
    category: "owner",
    description: "Scan grup untuk menyimpan mapping LID↔Nomor semua member.",
    usage: "!scanids",
    ownerOnly: false,
    botAdminOnly: true,
    groupOnly: true,

    async handler({ message, sock, groupMetadata }) {
        try {
            if (!groupMetadata?.participants || groupMetadata.participants.length === 0) {
                return message.reply("❌ Gagal mendapatkan data peserta grup.");
            }

            const update = await message.replyUpdate("⏳ Scanning group participants...");

            const { saved, total } = scanGroupIdentities(groupMetadata.participants);
            const totalMappings = getIdentityCount();

            await update(
                `╭━━━〔 🆔 SCAN IDENTITAS 〕━━━\n` +
                `┃ Status : ✅ Selesai\n` +
                `╰━━━━━━━━━━━━━━━━━━━━\n\n` +
                `╭───「 📊 Hasil 」\n` +
                `│ ⋄ Peserta di-scan        : ${total}\n` +
                `│ ⋄ Mapping baru tersimpan  : ${saved}\n` +
                `│ ⋄ Total mapping database : ${totalMappings}\n` +
                `╰──────────────\n\n` +
                `_Mapping ini membantu bot mengenali profil member yang menggunakan LID di grup._`
            );
        } catch (error) {
            console.error("[SCANIDS]", error);
            message.reply("❌ Terjadi kesalahan saat scanning identitas grup.");
        }
    },
};
