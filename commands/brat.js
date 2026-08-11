import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { writeExifImg } from "../../toolkit/exif.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "bratsticker",
  command: ["brat", "bart", "brt", "bratgenerator"],
  tags: ["maker"],
  desc: "Membuat sticker text gaya brat",
  customPrefix: "",
  example: "Akan saya cium",
  limit: true,
  consumeLimit: 1,

  run: async (m, { conn, text, usedPrefix, command }) => {
    if (!text) {
      return m.reply(`Contoh penggunaan: ${usedPrefix}${command} halo aku dabi`);
    }

    const apiUrl = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text)}`;
    const tempDir = path.resolve(__dirname, "../../temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const inputPath = path.join(tempDir, `brat_${Date.now()}.png`);
    const outputPath = path.join(tempDir, `brat_${Date.now()}.webp`);

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      if (!response.data) return m.reply("Gagal mengambil gambar brat dari API.");

      fs.writeFileSync(inputPath, response.data);

      const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -c:v libwebp -lossless 1 "${outputPath}"`;

      exec(ffmpegCmd, async (err) => {
        if (err) {
          console.error("FFmpeg error:", err);
          cleanupFiles([inputPath, outputPath]);
          return m.reply("Gagal mengkonversi gambar ke format sticker.");
        }

        try {
          const stickerBuffer = fs.readFileSync(outputPath);
          const finalStickerPath = await writeExifImg(stickerBuffer, {
            packname: "MyLiza",
            author: `Ⓒ ${m.pushName || "User"}`
          });

          await conn.sendMessage(
            m.chat,
            { sticker: fs.readFileSync(finalStickerPath) },
            { quoted: m }
          );

          cleanupFiles([inputPath, outputPath, finalStickerPath]);
        } catch (exifError) {
          console.error("Exif error:", exifError);
          cleanupFiles([inputPath, outputPath]);
          m.reply("Gagal menambahkan metadata exif pada sticker.");
        }
      });
    } catch (e) {
      console.error("Brat plugin error:", e);
      cleanupFiles([inputPath, outputPath]);
      m.reply("Terjadi kesalahan saat menghubungi API brat. Coba lagi nanti.");
    }
  }
};

function cleanupFiles(files) {
  files.forEach((filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
}
