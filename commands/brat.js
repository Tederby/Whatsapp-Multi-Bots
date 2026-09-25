/**
 * Brat Sticker — Generate text sticker in Brat aesthetic style.
 *
 * @module commands/brat
 */

import axios from "axios";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import setting from "../setting.js";

export default {
  name: "bratsticker",
  aliases: ["brat", "brt", "bart", "bratgenerator"],
  category: "media",
  description: "Membuat stiker teks bergaya Brat",
  usage: "!brat <teks>",

  handler: async ({ message, sock, rawArgs, prefix, pushname }) => {
    let text = Array.isArray(rawArgs) ? rawArgs.join(" ") : rawArgs;

    if (!text && message.quoted) {
      text = message.quoted.text;
      if (!text) {
        const type = Object.keys(message.quoted.message || {})[0];
        if (type === "imageMessage" && message.quoted.message.imageMessage.caption) {
          text = message.quoted.message.imageMessage.caption;
        } else if (type === "videoMessage" && message.quoted.message.videoMessage.caption) {
          text = message.quoted.message.videoMessage.caption;
        }
      }
    }

    if (!text || !text.trim()) {
      return message.reply(
        `╭━━━〔 🟩 BRAT STICKER 〕━━━\n` +
        `┃ Masukkan teks atau balas pesan teks.\n` +
        `┃\n` +
        `┃ ⋄ \`${prefix || "!"}brat <teks>\`\n` +
        `┃ ⋄ Balas pesan dengan \`${prefix || "!"}brat\`\n` +
        `╰━━━━━━━━━━━━━━━━━━━━`
      );
    }

    const apiUrl = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text.trim())}`;

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      if (!response.data) {
        return message.reply("❌ Gagal mendapatkan gambar dari API Brat.");
      }

      const sticker = new Sticker(response.data, {
        pack: setting.branding?.stickerPack || "WhatsApp Bot",
        author: `Ⓒ ${pushname || "User"}`,
        type: StickerTypes.FULL,
        quality: 100,
      });

      const stickerBuffer = await sticker.toBuffer();

      await sock.sendMessage(
        message.chat,
        { sticker: stickerBuffer },
        { quoted: message }
      );
    } catch (e) {
      console.error("[BRATSTICKER]", e);
      await message.reply("❌ Terjadi kesalahan saat memproses stiker Brat. Silakan coba lagi nanti.");
    }
  },
};
