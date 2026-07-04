import { downloadContentFromMessage, jidNormalizedUser } from "baileys";
import { Jimp } from "jimp";
import path from "path";
import fs from "fs";
import axios from "axios";
import { getUser, setPfp } from "../lib/database.js";

export default {
    name: "setpfp",
    aliases: ["setprofil", "setpp"],
    category: "general",
    description: "Mengatur foto profil kustom mandiri di database bot.",
    usage: "!setpfp [reply/image] | !setpfp [link] | !setpfp delete",
    
    async handler({ message, sock, args, sender, prefix }) {
        try {
            const normalizedSender = jidNormalizedUser(sender);
            const senderBaseId = normalizedSender.split("@")[0];
            const userData = getUser(normalizedSender);

            if (!userData.registered) {
                return message.reply(`❌ Kamu harus terdaftar terlebih dahulu untuk menggunakan fitur ini. Ketik \`${prefix}register\` untuk mendaftar.`);
            }

            if (args[0] && (args[0].toLowerCase() === "delete" || args[0].toLowerCase() === "remove")) {
                if (!userData.meta?.pfp) {
                    return message.reply("⚠️ Kamu belum memiliki foto profil kustom.");
                }

                setPfp(normalizedSender, null);
                
                const pfpDir = path.resolve(process.cwd(), "database", "pfp");
                const filepath = path.join(pfpDir, `${senderBaseId}.jpg`);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
                
                return message.reply("✅ Foto profil kustom berhasil dihapus. Bot akan kembali menggunakan foto profil WhatsApp aslimu.");
            }

            let buffer = null;

            // Check if user replied to an image or sent an image with caption
            let isMedia = false;
            let isQuotedMedia = false;
            
            if (message.message?.imageMessage) {
                isMedia = true;
            }
            if (message.quoted?.message?.imageMessage) {
                isQuotedMedia = true;
            }

            const targetMsg = isQuotedMedia ? message.quoted : (isMedia ? message : null);

            if (targetMsg && targetMsg.message?.imageMessage) {
                await message.reply("⏳ Sedang mengunduh dan memproses gambar...");
                const stream = await downloadContentFromMessage(targetMsg.message.imageMessage, 'image');
                buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
            } else if (args[0] && args[0].startsWith("http")) {
                await message.reply("⏳ Sedang mengambil dan memproses gambar dari link...");
                try {
                    const response = await axios.get(args[0], { responseType: 'arraybuffer', timeout: 10000 });
                    buffer = Buffer.from(response.data);
                } catch (err) {
                    return message.reply("❌ Gagal mengambil gambar dari link. Pastikan link valid dan langsung menuju ke file gambar.");
                }
            } else {
                return message.reply(`❌ Kirim atau reply gambar dengan caption \`${prefix}setpfp\`\nAtau gunakan link: \`${prefix}setpfp https://...\`\nUntuk menghapus: \`${prefix}setpfp delete\``);
            }

            if (!buffer) {
                return message.reply("❌ Gagal memproses media.");
            }

            // Process image with Jimp
            const image = await Jimp.read(buffer);
            
            // Crop 1:1 and Resize to 500x500
            const w = image.bitmap.width;
            const h = image.bitmap.height;
            const size = Math.min(w, h);
            
            const x = (w - size) / 2;
            const y = (h - size) / 2;
            
            image.crop({ x, y, w: size, h: size });
            image.resize({ w: 500, h: 500 });

            // Ensure directory exists
            const pfpDir = path.resolve(process.cwd(), "database", "pfp");
            if (!fs.existsSync(pfpDir)) {
                fs.mkdirSync(pfpDir, { recursive: true });
            }

            const filename = `${senderBaseId}.jpg`;
            const filepath = path.join(pfpDir, filename);

            await image.write(filepath);

            // Update database
            setPfp(normalizedSender, filename);

            return message.reply("✅ Foto profil custom berhasil diperbarui! Cek dengan perintah `!profile`.");

        } catch (error) {
            console.error("[SETPFP CMD]", error);
            message.reply("❌ Terjadi kesalahan saat memproses gambar. Pastikan file/link yang diberikan adalah gambar yang valid.");
        }
    }
};
