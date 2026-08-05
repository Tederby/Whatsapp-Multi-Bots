import { getGroupConfig, resolveUserId } from "../database.js";

/**
 * Handle group-participants.update events
 * Triggered when users join, leave, are promoted, or demoted.
 */
export async function handleGroupParticipantsUpdate(update, sock) {
  // Baileys terkadang membungkus event dalam array
  if (Array.isArray(update)) update = update[0];
  if (!update) return;

  const { id, participants, action } = update;
  if ((action !== "add" && action !== "remove") || !Array.isArray(participants)) {
    return;
  }

  try {
    const config = getGroupConfig(id);
    const isWelcome = action === "add";
    const isEnabled = isWelcome ? config.welcome : config.goodbye;

    if (!isEnabled) {
      return;
    }

    // Text template with fallback defaults
    const defaultWelcome = "Halo @user, selamat bergabung di grup *@group*!\n\n_Pesan ini dikirim otomatis_";
    const defaultGoodbye = "Selamat tinggal @user!\n\n_Pesan ini dikirim otomatis_";
    const textTemplate = isWelcome ? (config.welcomeText || defaultWelcome) : (config.goodbyeText || defaultGoodbye);

    // Gunakan timeout agar tidak hang jika socket sedang idle
    let groupName = "Grup";
    try {
      const groupMetadata = await Promise.race([
        sock.groupMetadata(id),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout metadata")), 3000))
      ]);
      groupName = groupMetadata.subject;
    } catch (e) {
      // Gagal mendapatkan metadata grup (timeout/error)
    }

    for (let participantObj of participants) {
      // Tangani kemungkinan participant berupa objek dan WhatsApp LID
      // Prioritaskan phoneNumber agar @tag selalu berupa nomor telepon, bukan LID base
      let actualJid;
      if (typeof participantObj === "object" && participantObj !== null) {
        // phoneNumber sudah dalam format PN (@s.whatsapp.net)
        actualJid = participantObj.phoneNumber || participantObj.id || participantObj.jid;
      } else {
        actualJid = participantObj;
      }

      if (typeof actualJid !== "string") continue;

      // Jika masih LID, coba resolve ke PN via identity_map
      if (actualJid.endsWith("@lid")) {
        const resolved = resolveUserId(actualJid);
        if (resolved !== actualJid) actualJid = resolved;
      }

      let text = textTemplate
        .replace(/@user/gi, `@${actualJid.split("@")[0]}`)
        .replace(/@group/gi, groupName);

      // Kirim pesan teks sederhana dengan tag
      await sock.sendMessage(id, {
        text: text,
        mentions: [actualJid]
      });
    }
  } catch (err) {
    console.error("Error in group-participants.update:", err);
  }
}
