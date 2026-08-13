import axios from "axios";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export default {
  aliases: ["brat", "brt", "bart", "bratgenerator"],
  category: "maker",
  description: "Bikin stiker tekxs brat",

  handler: async ({ message, sock, rawArgs, prefix }) => {
    const text = Array.isArray(rawArgs) ? rawArgs.join(" ") : rawArgs;

    if (!text || !text.trim()) {
      return message.reply(`Formatnya kurang pas nih, contoh: ${prefix}brat halo sayang`);
    }

    const apiUrl = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text.trim())}`;

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      if (!response.data) {
        return message.reply("Aduh, gagal dapet gambarnya dari API nih...");
      }

     
      const sticker = new Sticker(response.data, {
        pack: "MyLiza",
        author: `Ⓒ ${message.pushName || "User"}`,
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
