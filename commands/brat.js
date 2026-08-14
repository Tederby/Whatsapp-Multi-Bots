import axios from "axios";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

export default {
  aliases: ["brat", "brt", "bart", "bratgenerator"],
  category: "maker",
  description: "Bikin stiker teks gaya brat",

  handler: async ({ message, sock, rawArgs, prefix }) => {
    
    const argsText = Array.isArray(rawArgs) ? rawArgs.join(" ") : (rawArgs || "");

    
    const quoted = message.quoted;
    const quotedText =
      quoted?.text ||
      quoted?.body ||
      quoted?.caption ||
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption ||
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.caption ||
      "";

    
    const text = argsText.trim() || quotedText.trim();

    if (!text) {
      return message.reply(
        `Ketik teksnya atau reply pesan teks yang mau dibikin brat ya!\nContoh: ${prefix}brat halo dabi`
      );
    }

    const apiUrl = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text)}`;

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      if (!response.data) {
        return message.reply("Aduh, gagal dapet gambarnya dari API nih...");
      }

     
      const sticker = new Sticker(response.data, {
        pack: "Tederby",
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
