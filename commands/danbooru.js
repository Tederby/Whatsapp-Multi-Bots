/**
 * Danbooru — Gacha random anime art or search posts by tags/ID/URL.
 *
 * @module commands/danbooru
 */

import {
    fetchDanbooruPost,
    sendDanbooruMessage,
    validateDanbooruTags,
    fetchDanbooruByTags,
    getFuzzyTagSuggestions,
    getSeenPosts
} from "../lib/danbooru.js";
import { registerReplyHandler } from "./_registry.js";

/**
 * Attach interactive reply handler to roll art or inspect tags
 */
function attachDanbooruReplyHandler({ sentKeyId, sender, isGroup, tags = [], corrections = {}, isGacha = false, postData = null, sock, prefix = "!" }) {
    if (!sentKeyId) return;

    registerReplyHandler(
        sentKeyId,
        async ({ message: replyMsg, sock: replySock, state }) => {
            const replyText = (replyMsg.text || "").trim().toLowerCase();

            // Next / Lagi / Roll handler
            if (["next", "lagi", "roll", "acak", "gacha", "n", "more"].includes(replyText)) {
                try {
                    const excludeIds = getSeenPosts(replyMsg.chat);

                    if (state.isGacha) {
                        let nextPost = null;
                        let attempts = 0;
                        const maxAttempts = 10;

                        while (attempts < maxAttempts) {
                            attempts++;
                            const randomId = Math.floor(Math.random() * 12000000) + 1;
                            if (excludeIds.has(randomId)) continue;
                            try {
                                const tempPost = await fetchDanbooruPost(randomId);
                                if (tempPost.rating === 'e') continue;
                                if (excludeIds.has(tempPost.id)) continue;
                                nextPost = tempPost;
                                break;
                            } catch {
                                // Ignore and retry
                            }
                        }

                        if (!nextPost) {
                            await replyMsg.reply(`⚠️ Gacha belum berhasil menemukan gambar baru setelah beberapa percobaan. Coba lagi beberapa saat lagi.`);
                            return;
                        }

                        const newSent = await sendDanbooruMessage({
                            postData: nextPost,
                            sock: replySock,
                            message: replyMsg,
                            isAutoDetect: false,
                            isGacha: true
                        });

                        if (newSent?.key?.id) {
                            attachDanbooruReplyHandler({
                                sentKeyId: newSent.key.id,
                                sender: state.userId,
                                isGroup: state.isGroup,
                                tags: [],
                                corrections: {},
                                isGacha: true,
                                postData: nextPost,
                                sock: replySock,
                                prefix: state.prefix
                            });
                        }
                        return;
                    }

                    // Tags search mode
                    if (state.tags && state.tags.length > 0) {
                        const nextPost = await fetchDanbooruByTags(state.tags, { excludeIds });
                        const newSent = await sendDanbooruMessage({
                            postData: nextPost,
                            sock: replySock,
                            message: replyMsg,
                            isAutoDetect: false,
                            isGacha: false,
                            usedTags: state.tags,
                            corrections: state.corrections
                        });

                        if (newSent?.key?.id) {
                            attachDanbooruReplyHandler({
                                sentKeyId: newSent.key.id,
                                sender: state.userId,
                                isGroup: state.isGroup,
                                tags: state.tags,
                                corrections: state.corrections,
                                isGacha: false,
                                postData: nextPost,
                                sock: replySock,
                                prefix: state.prefix
                            });
                        }
                        return;
                    }
                } catch (err) {
                    if (err.message === "EXPLICIT_ONLY") {
                        await replyMsg.reply("❌ Tidak ditemukan gambar aman selanjutnya untuk tag ini. Gambar NSFW/Explicit otomatis diblokir.");
                    } else if (err.message === "ALL_SEEN") {
                        await replyMsg.reply("⚠️ Semua gambar aman untuk tag ini sudah pernah ditampilkan di chat ini! Riwayat akan di-reset pada fase cleanup berkala.");
                    } else {
                        await replyMsg.reply(`❌ Gagal mengambil art selanjutnya: ${err.message}`);
                    }
                }
                return;
            }

            // Tag shortcut
            if (["tag", "!tag", "tags", "!tags"].includes(replyText)) {
                const currentPost = state.postData;
                if (!currentPost) return;

                const tagsText = [
                    `🏷️ *Tags untuk Post ${currentPost.id}*`,
                    "",
                    `👤 *Character:* ${currentPost.tag_string_character || 'Original'}`,
                    `©️ *Copyright:* ${currentPost.tag_string_copyright || 'Original'}`,
                    `🎨 *Artist:* ${currentPost.tag_string_artist || 'Unknown'}`,
                    `📝 *General:* ${currentPost.tag_string_general ? currentPost.tag_string_general.split(' ').slice(0, 20).join(', ') : 'N/A'}`
                ].join("\n");

                await replyMsg.reply(tagsText);
            }
        },
        {
            userId: sender,
            allowAnyUser: isGroup, // Allows any participant in groups to reply next!
            isGroup,
            tags,
            corrections,
            isGacha,
            postData,
            commandName: "danbooru",
            prefix
        }
    );
}

export default {
    name: "danbooru",
    aliases: ["dan", "dnbooru", "d"],
    category: "anime",
    description: "Gacha gambar random dari Danbooru, atau cari spesifik menggunakan Tag/ID/Link",
    usage: "!d [tag1] [tag2] atau !d [post_id/URL]",
    async handler({ message, args, sock, prefix, sender, isGroup }) {
        args = args.map(arg => arg.toLowerCase());
        let isGacha = false;

        try {
            // 1. Gacha (No args)
            if (args.length === 0) {
                isGacha = true;
                let postData = null;
                let attempts = 0;
                const maxAttempts = 10;
                const excludeIds = getSeenPosts(message.chat);

                await message.reply("🎲 Mengambil post random (Gacha)...");

                while (attempts < maxAttempts) {
                    attempts++;
                    const randomId = Math.floor(Math.random() * 12000000) + 1;
                    if (excludeIds.has(randomId)) continue;
                    try {
                        const tempPost = await fetchDanbooruPost(randomId);
                        if (tempPost.rating === 'e') continue;
                        if (excludeIds.has(tempPost.id)) continue;
                        postData = tempPost;
                        break;
                    } catch {
                        // Ignore error and try again
                    }
                }

                if (!postData) {
                    await message.reply(`⚠️ Gacha belum berhasil setelah beberapa kali percobaan. Coba lagi beberapa saat lagi atau gunakan \`${prefix || "!"}dnew\` untuk melihat art terbaru!`);
                    return;
                }

                const sent = await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha });
                if (sent?.key?.id) {
                    attachDanbooruReplyHandler({
                        sentKeyId: sent.key.id,
                        sender,
                        isGroup,
                        tags: [],
                        corrections: {},
                        isGacha: true,
                        postData,
                        sock,
                        prefix
                    });
                }
                return;
            }

            const firstArg = args[0];

            // 2. URLs (if they paste a link directly)
            if (firstArg.includes("danbooru.donmai.us/posts/")) {
                const postData = await fetchDanbooruPost(firstArg);
                const sent = await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false });
                if (sent?.key?.id) {
                    attachDanbooruReplyHandler({
                        sentKeyId: sent.key.id,
                        sender,
                        isGroup,
                        tags: [],
                        corrections: {},
                        isGacha: false,
                        postData,
                        sock,
                        prefix
                    });
                }
                return;
            }

            // 3. Arg is a number (ID or numeric tag check)
            if (/^\d+$/.test(firstArg) && args.length === 1) {
                // It's a number. Let's check if it's a valid tag.
                const { validTags, corrections } = await validateDanbooruTags([firstArg]);
                if (validTags.length > 0) {
                    // It's a valid numeric tag (e.g. '100', '1999').
                    const postData = await fetchDanbooruByTags(validTags, { excludeIds: getSeenPosts(message.chat) });
                    const sent = await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false, usedTags: validTags, corrections });
                    if (sent?.key?.id) {
                        attachDanbooruReplyHandler({
                            sentKeyId: sent.key.id,
                            sender,
                            isGroup,
                            tags: validTags,
                            corrections,
                            isGacha: false,
                            postData,
                            sock,
                            prefix
                        });
                    }
                } else {
                    // Not a tag, treat as ID
                    const postData = await fetchDanbooruPost(firstArg);
                    const sent = await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false });
                    if (sent?.key?.id) {
                        attachDanbooruReplyHandler({
                            sentKeyId: sent.key.id,
                            sender,
                            isGroup,
                            tags: [],
                            corrections: {},
                            isGacha: false,
                            postData,
                            sock,
                            prefix
                        });
                    }
                }
                return;
            }

            // 4. Tags Search
            const inputTags = args.slice(0, 2); // Max 2 tags for free API
            const { validTags, invalidTags, corrections } = await validateDanbooruTags(inputTags);

            if (validTags.length === 0) {
                let errorMsg = "❌ Tag tidak ditemukan atau tidak valid.";
                
                // Fuzzy search fallback
                const suggestions = [];
                for (const invalidTag of invalidTags) {
                    const fuzzy = await getFuzzyTagSuggestions(invalidTag);
                    if (fuzzy.length > 0) {
                        suggestions.push(...fuzzy);
                    }
                }

                // Space check
                if (args.length > 1) {
                    const joinedTag = args.join('_');
                    const fuzzyJoined = await getFuzzyTagSuggestions(joinedTag);
                    if (fuzzyJoined.length > 0) {
                        errorMsg += `\n\n💡 *Tip:* Di Danbooru karakter spasi menggunakan garis bawah (underscore). Mungkin maksud kamu 1 karakter: \`${fuzzyJoined[0]}\`?`;
                    } else if (suggestions.length > 0) {
                        errorMsg += `\n\nMungkin maksud kamu: \`${suggestions.slice(0, 5).join('`, `')}\`?`;
                    }
                } else if (suggestions.length > 0) {
                    errorMsg += `\n\nMungkin maksud kamu: \`${suggestions.slice(0, 5).join('`, `')}\`?`;
                }

                errorMsg += `\n\n💡 *Tip:* Gunakan command \`${prefix || "!"}tag <kata kunci>\` untuk mencari kamus tag Danbooru jika kamu bingung.`;

                await message.reply(errorMsg);
                return;
            }

            const postData = await fetchDanbooruByTags(validTags, { excludeIds: getSeenPosts(message.chat) });
            const sent = await sendDanbooruMessage({ postData, sock, message, isAutoDetect: false, isGacha: false, usedTags: validTags, corrections });
            if (sent?.key?.id) {
                attachDanbooruReplyHandler({
                    sentKeyId: sent.key.id,
                    sender,
                    isGroup,
                    tags: validTags,
                    corrections,
                    isGacha: false,
                    postData,
                    sock,
                    prefix
                });
            }

        } catch (err) {
            if (err.message === "EXPLICIT_ONLY") {
                await message.reply("❌ Tidak ditemukan gambar yang aman pada post terbaru untuk tag ini. Gambar NSFW/Explicit otomatis diblokir oleh sistem.");
            } else if (err.message === "ALL_SEEN") {
                await message.reply("⚠️ Semua gambar aman untuk tag ini sudah pernah ditampilkan di chat ini! Riwayat akan di-reset pada fase cleanup berkala.");
            } else {
                console.error("[DANBOORU]", err);
                await message.reply(`❌ Error: ${err.message}`);
            }
        }
    }
};
