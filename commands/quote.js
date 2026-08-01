import { jidNormalizedUser } from "baileys";
import { getUser, resolveUserId } from "../lib/database.js";
import { generateQuote } from "../lib/quoteGenerator.js";
import fs from "fs";
import path from "path";

export default {
    name: "quote",
    aliases: ["q"],
    category: "tools",
    description: "Membuat gambar quote dari pesan yang di-reply",
    usage: "!quote [reply pesan]",
    async handler({ message, sock, prefix }) {
        try {
            // 1. Validasi reply
            if (!message.quoted) {
                return message.reply(`Gunakan perintah ini dengan me-reply sebuah pesan teks.\nContoh: \`${prefix}quote\``);
            }

            // 2. Cegah stiker dan media tanpa caption
            const type = Object.keys(message.quoted.message || {})[0];
            if (type === "stickerMessage") {
                return message.reply("Bot tidak bisa membuat quote dari stiker!");
            }

            let text = message.quoted.text;
            if (!text) {
                // Ekstrak caption jika ada
                if (type === "imageMessage" && message.quoted.message.imageMessage.caption) {
                    text = message.quoted.message.imageMessage.caption;
                } else if (type === "videoMessage" && message.quoted.message.videoMessage.caption) {
                    text = message.quoted.message.videoMessage.caption;
                } else {
                    return message.reply("Pesan yang di-reply tidak mengandung teks yang bisa di-quote.");
                }
            }

            // 3. Tarik ID pengirim pesan yang di-reply
            const targetJid = message.quoted.sender || message.quoted.participant;
            if (!targetJid) {
                return message.reply("Gagal mendapatkan ID pengirim pesan.");
            }

            const normalizedTarget = resolveUserId(jidNormalizedUser(targetJid));

            message.replyUpdate("⏳ Merender gambar quote estetik...");

            // 4. Cari tahu nama pengguna (pushname dari cache bot atau fallback ke database)
            const userData = getUser(normalizedTarget);
            let targetName = message.quoted.pushName || userData.name || normalizedTarget.split("@")[0];

            // 5. Cari tahu foto profil pengguna
            const placeholderImageUrl = "https://i.imgur.com/ckO9GJN.png";
            let pfpUrl = placeholderImageUrl;
            let isDefault = true;

            // Cek kustom PFP dari database dulu
            if (userData.meta?.pfp) {
                const pfpPath = path.resolve(process.cwd(), "database", "pfp", userData.meta.pfp);
                if (fs.existsSync(pfpPath)) {
                    const fileData = fs.readFileSync(pfpPath);
                    const mime = pfpPath.endsWith(".png") ? "image/png" : "image/jpeg";
                    pfpUrl = `data:${mime};base64,${fileData.toString("base64")}`;
                    isDefault = false;
                }
            }

            // Cek dari WhatsApp server jika belum punya custom PFP
            if (isDefault) {
                try {
                    const waPfpPromise = sock.profilePictureUrl(normalizedTarget, 'image');
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
                    let waPfp = await Promise.race([waPfpPromise, timeoutPromise]);
                    if (waPfp) {
                        if (waPfp.includes('a.whatsapp.net')) {
                            waPfp = waPfp.replace('a.whatsapp.net', 'mmg.whatsapp.net');
                        }
                        pfpUrl = waPfp;
                        isDefault = false;
                    }
                } catch (err) {
                    // Fallback to placeholder if timeout or error
                }
            }

            // 6. Generate Quote Image
            const imageBuffer = await generateQuote(text, targetName, pfpUrl);

            // 7. Kirim hasil
            await sock.sendMessage(
                message.chat,
                { image: imageBuffer, caption: "✨ *Quote by " + targetName + "*" },
                { quoted: message }
            );

        } catch (error) {
            console.error("[QUOTE CMD]", error);
            message.reply("Terjadi kesalahan saat memproses quote gambar.");
        }
    }
};
