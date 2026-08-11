import { jidNormalizedUser, downloadContentFromMessage } from "baileys";
import { getUser, resolveUserId } from "../lib/database.js";
import { generateQuote } from "../lib/quoteGenerator.js";
import fs from "fs";
import path from "path";

export default {
    name: "quote",
    aliases: ["q"],
    category: "tools",
    description: "Membuat gambar quote dari pesan yang di-reply",
    usage: "!quote <teks> atau !quote [reply pesan]",
    async handler({ message, sock, prefix, rawArgs, sender, pushname }) {
        try {
            let text = "";
            let targetJid = "";
            let targetName = "";
            let contentImageBase64 = null;

            if (rawArgs) {
                // Self-quote priority
                text = rawArgs;
                targetJid = sender;
                targetName = pushname;
            } else if (message.quoted) {
                // 1. Validasi reply
                const type = Object.keys(message.quoted.message || {})[0];
                if (type === "stickerMessage") {
                    return message.reply("Bot tidak bisa membuat quote dari stiker!");
                }

                text = message.quoted.text;
                if (!text) {
                    if (type === "imageMessage" && message.quoted.message.imageMessage.caption) {
                        text = message.quoted.message.imageMessage.caption;
                    } else if (type === "videoMessage" && message.quoted.message.videoMessage.caption) {
                        text = message.quoted.message.videoMessage.caption;
                    } else {
                        return message.reply("Pesan yang di-reply tidak mengandung teks yang bisa di-quote.");
                    }
                }

                targetJid = message.quoted.sender || message.quoted.participant;

                // Download content image if the quoted message contains an image
                if (type === "imageMessage" && message.quoted.message.imageMessage) {
                    try {
                        const imgMsg = message.quoted.message.imageMessage;
                        // Fix for a.whatsapp.net DNS error
                        if (imgMsg?.url && imgMsg.url.includes('a.whatsapp.net')) {
                            imgMsg.url = imgMsg.url.replace('a.whatsapp.net', 'mmg.whatsapp.net');
                        }
                        const stream = await downloadContentFromMessage(imgMsg, 'image');
                        const chunks = [];
                        for await (const chunk of stream) {
                            chunks.push(chunk);
                        }
                        const imgBuffer = Buffer.concat(chunks);
                        contentImageBase64 = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
                    } catch (imgErr) {
                        console.log("[QUOTE CMD] Gagal download gambar konten:", imgErr.message);
                        // Lanjut tanpa gambar konten
                    }
                }
            } else {
                return message.reply(`Gunakan perintah ini dengan mengetik teks atau me-reply pesan teks.\nContoh: \`${prefix}quote Halo\` atau \`${prefix}quote\` sambil me-reply pesan`);
            }

            if (!targetJid) {
                return message.reply("Gagal mendapatkan ID pengirim pesan.");
            }

            const normalizedTarget = resolveUserId(jidNormalizedUser(targetJid));

            // Perbaiki tampilan mentions di dalam teks (ubah @62812... atau @lid menjadi nama)
            if (message.quoted?.mentionedJid && message.quoted.mentionedJid.length > 0) {
                for (const jid of message.quoted.mentionedJid) {
                    const id = jid.split('@')[0];
                    const mentionNormal = resolveUserId(jidNormalizedUser(jid));
                    const mentionUser = getUser(mentionNormal);

                    let mentionName = mentionUser.name;
                    if (!mentionName) {
                        if (/^\d+$/.test(id)) {
                            // Format nomor cantik: +62 812-xxx
                            mentionName = `+${id.slice(0, 2)} ${id.slice(2, 5)}-${id.slice(5, 9)}`;
                        } else {
                            mentionName = "User";
                        }
                    }
                    const regex = new RegExp(`@${id}(?:@lid)?`, 'g');
                    text = text.replace(regex, `@${mentionName}`);
                }
            }

            message.replyUpdate("⏳ Merender gambar...");

            // 4. Cari tahu nama pengguna (dari database, karena auto-register di handler)
            const userData = getUser(normalizedTarget);
            let usedPhoneNumber = false;

            if (!targetName) {
                targetName = userData.name;
                if (!targetName) {
                    usedPhoneNumber = true;
                    const num = normalizedTarget.split("@")[0];
                    if (/^\d+$/.test(num)) {
                        // Format nomor WA menjadi +62 812-3456-7890
                        if (num.length >= 10 && num.length <= 15) {
                            targetName = `+${num.slice(0, 2)} ${num.slice(2, 5)}-${num.slice(5, 9)}-${num.slice(9)}`;
                        } else {
                            targetName = "+" + num;
                        }
                    } else {
                        targetName = "Seseorang"; // Fallback aman untuk LID tanpa nama
                    }
                }
            }

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
            const imageBuffer = await generateQuote(text, targetName, pfpUrl, contentImageBase64);

            // 7. Kirim hasil
            let caption = "✨ *Quote by " + targetName + "*";
            if (usedPhoneNumber) {
                caption += `\n\n💡 _Nama muncul sebagai nomor karena user belum pernah menggunakan bot. Ketik \`${prefix}register\` untuk mendaftar agar namamu tampil di quote._`;
            }

            await sock.sendMessage(
                message.chat,
                { image: imageBuffer, caption },
                { quoted: message }
            );

        } catch (error) {
            console.error("[QUOTE CMD]", error);
            message.reply("Terjadi kesalahan saat memproses quote gambar.");
        }
    }
};
