import { fetchDanbooruPost, sendDanbooruMessage, validateDanbooruTags, fetchDanbooruByTags } from "../lib/danbooru.js";

export default {
    name: "danbooru",
    aliases: ["dan", "dnbooru", "d"],
    category: "anime",
    description: "Gacha gambar random dari Danbooru, atau cari spesifik menggunakan Tag/ID/Link",
    usage: "!d [tag1] [tag2] atau !d [post_id/URL]",
    async handler({ message, args, sock }) {
        let isGacha = false;

        try {
            // 1. Gacha (No args)
            if (args.length === 0) {
                isGacha = true;
                let postData = null;
                let attempts = 0;
                const maxAttempts = 3;

                await message.reply("🎲 Mengambil post random (Gacha)...");

                while (attempts < maxAttempts) {
                    attempts++;
                    const randomId = Math.floor(Math.random() * 12000000) + 1;
                    try {
                        const tempPost = await fetchDanbooruPost(randomId);
                        if (tempPost.rating === 'e') continue;
                        postData = tempPost;
                        break;
                    } catch (err) {
                        // Ignore error and try again
                    }
                }

                if (!postData) {
                    await message.reply("Ampas banget gacha lu hari ini ngab, udah 3 kali ngeroll dapet ID zonk semua wkwkwk. Coba lagi ntar yak!");
                    return;
                }

                await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha });
                return;
            }

            const firstArg = args[0];

            // 2. URLs (if they paste a link directly)
            if (firstArg.includes("danbooru.donmai.us/posts/")) {
                const postData = await fetchDanbooruPost(firstArg);
                await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false });
                return;
            }

            // 3. Arg is a number (ID or numeric tag check)
            if (/^\d+$/.test(firstArg) && args.length === 1) {
                // It's a number. Let's check if it's a valid tag.
                const validTags = await validateDanbooruTags([firstArg]);
                if (validTags.length > 0) {
                    // It's a valid numeric tag (e.g. '100', '1999').
                    const postData = await fetchDanbooruByTags(validTags);
                    await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false, usedTags: validTags });
                } else {
                    // Not a tag, treat as ID
                    const postData = await fetchDanbooruPost(firstArg);
                    await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false });
                }
                return;
            }

            // 4. Tags Search
            const inputTags = args.slice(0, 2); // Max 2 tags for free API
            const validTags = await validateDanbooruTags(inputTags);

            if (validTags.length === 0) {
                await message.reply("❌ Tag tidak ditemukan atau tidak valid. Pastikan penulisan tag benar (contoh: `hatsune_miku`).");
                return;
            }

            const postData = await fetchDanbooruByTags(validTags);
            await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false, usedTags: validTags });

        } catch (err) {
            if (err.message === "EXPLICIT_ONLY") {
                await message.reply("❌ Tidak ditemukan gambar yang aman pada post terbaru untuk tag ini. Gambar NSFW/Explicit otomatis diblokir oleh sistem.");
            } else {
                await message.reply(`❌ Error: ${err.message}`);
            }
        }
    }
};
