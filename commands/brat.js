import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import { writeExifImg } from "../../toolkit/exif.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  name: "bratsticker",
  command: ["brat", "bart","brt", "bratgenerator"],
  tags: ["maker"],
  desc: "Membuat sticker text gaya brat",

  handler: async ({ message, sock, rawArgs }) => {
    
    const text = Array.isArray(rawArgs) ? rawArgs.join(" ") : rawArgs;

    if (!text || !text.trim()) {
      return sock.sendMessage(
        message.key.remoteJid,
        { text: "Contoh penggunaan: .brat cihuy" },
        { quoted: message }
      );
    }

    const apiUrl = `https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(text.trim())}`;
    const tempDir = path.resolve(__dirname, "../../temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timeStamp = Date.now();
    const inputPath = path.join(tempDir, `brat_${timeStamp}.png`);
    const outputPath = path.join(tempDir, `brat_${timeStamp}.webp`);

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      if (!response.data) {
        return sock.sendMessage(
          message.key.remoteJid,
          { text: "Gagal mengambil gambar brat dari API." },
          { quoted: message }
        );
      }

      fs.writeFileSync(inputPath, response.data);

      const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease" -c:v libwebp -lossless 1 "${outputPath}"`;

      exec(ffmpegCmd, async (err) => {
        if (err) {
          console.error("FFmpeg error:", err);
          cleanupFiles([inputPath, outputPath]);
          return sock.sendMessage(
            message.key.remoteJid,
            { text: "Gagal mengkonversi gambar ke format sticker." },
            { quoted: message }
          );
        }

        try {
          const stickerBuffer = fs.readFileSync(outputPath);
          const pushName = message.pushName || "User";
          
          const finalStickerPath = await writeExifImg(stickerBuffer, {
            packname: "MyMineLiza",
            author: `Ⓒ hehe`
          });

          await sock.sendMessage(
            message.key.remoteJid,
            { sticker: fs.readFileSync(finalStickerPath) },
            { quoted: message }
          );

          cleanupFiles([inputPath, outputPath, finalStickerPath]);
        } catch (exifError) {
          console.error("Exif error:", exifError);
          cleanupFiles([inputPath, outputPath]);
          sock.sendMessage(
            message.key.remoteJid,
            { text: "Gagal menambahkan metadata exif pada sticker." },
            { quoted: message }
          );
        }
      });
    } catch (e) {
      console.error("Brat plugin error:", e);
      cleanupFiles([inputPath, outputPath]);
      sock.sendMessage(
        message.key.remoteJid,
        { text: "Terjadi kesalahan saat menghubungi API brat. Coba lagi nanti." },
        { quoted: message }
      );
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
