import axios from "axios";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export default {
  name: "bratsticker",
  aliases: ["brat", "brt", "bart", "bratgenerator"],
  category: "maker",
  description: "Bikin stiker tekxs brat",

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
      return message.reply(`Formatnya kurang pas nih, contoh: ${prefix}brat halo sayang atau balas pesan dengan ${prefix}brat`);
    }

    const apiUrl = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text.trim())}`;

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      if (!response.data) {
        return message.reply("Aduh, gagal dapet gambarnya dari API nih...");
      }


      const sticker = new Sticker(response.data, {
        pack: "Tederby",
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
      console.error("Brat plugin error:", e);
      await message.reply("Lagi error pas panggil API brat-nya. Coba lagi ntar ya!");
    }
  },
};
