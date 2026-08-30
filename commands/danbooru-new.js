import {
    fetchRandomRecentDanbooru,
    sendDanbooruMessage
} from "../lib/danbooru.js";
import { registerReplyHandler } from "./_registry.js";

/**
 * Render user help guide for !dnew
 */
function getHelpMessage(prefix = "!") {
    return [
        `╭━━━〔 📖 Panduan ${prefix}dnew 〕━━━`,
        `┃ 🆕 *Danbooru Recent Posts*`,
        `┃ Menampilkan art anime terbaru langsung`,
        `┃ dari feed Danbooru (Aman / SFW).`,
        `╰━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `╭───「 📋 Format Penggunaan 」`,
        `│ • \`${prefix}dnew\``,
        `│   Ambil 1 art acak dari 30 post terbaru.`,
        `│ • \`${prefix}dnew <1-30>\`  (Contoh: \`${prefix}dnew 1\`)`,
        `│   Ambil art urutan ke-N (1 = paling baru).`,
        `│ • \`${prefix}dnew safe\` atau \`${prefix}dnew gen\``,
        `│   Hanya tampilkan art rating General (100% SFW).`,
        `│ • \`${prefix}dnew page <angka>\`  (Contoh: \`${prefix}dnew page 2\`)`,
        `│   Jelajahi feed halaman berikutnya.`,
        `│ • \`${prefix}dnew safe page 2\``,
        `│   Kombinasi rating General pada halaman 2.`,
        `╰──────────────`,
        ``,
        `╭───「 ⚡ Fitur Interaktif (Reply) 」`,
        `│ • Balas (reply) gambar dari bot dengan teks:`,
        `│   *next* / *lagi* / *roll* untuk melihat art`,
        `│   terbaru lainnya secara instan tanpa ketik ulang!`,
        `│ • Balas dengan *!tag* untuk melihat daftar tag.`,
        `╰──────────────`,
        ``,
        `💡 *Aliases:* \`${prefix}dnew\`, \`${prefix}danbooru-new\`, \`${prefix}dlatest\`, \`${prefix}dn\``
    ].join("\n");
}

/**
 * Register recursive interactive reply handler for rapid rolling
 */
function attachRecentReplyHandler({ sentKeyId, sender, ratingFilter, page, postData, sock }) {
    if (!sentKeyId) return;

    registerReplyHandler(
        sentKeyId,
        async ({ message: replyMsg, sock: replySock, state }) => {
            const replyText = (replyMsg.text || "").trim().toLowerCase();

            // Next / Lagi / Roll handler
            if (["next", "lagi", "roll", "acak", "gacha", "n", "more"].includes(replyText)) {
                try {
                    const result = await fetchRandomRecentDanbooru({
                        ratingFilter: state.ratingFilter,
                        page: state.page,
                    });

                    const newSent = await sendDanbooruMessage({
                        postData: result.post,
                        sock: replySock,
                        message: replyMsg,
                        isRecent: true,
                        recentInfo: {
                            index: result.index,
                            totalSafe: result.totalSafe,
                            page: result.page,
                        }
                    });

                    if (newSent?.key?.id) {
                        attachRecentReplyHandler({
                            sentKeyId: newSent.key.id,
                            sender: state.userId,
                            ratingFilter: state.ratingFilter,
                            page: state.page,
                            postData: result.post,
                            sock: replySock,
                        });
                    }
                } catch (err) {
                    await replyMsg.reply(`❌ Gagal mengambil art selanjutnya: ${err.message}`);
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
            ratingFilter,
            page,
            postData,
            commandName: "danbooru-new"
        }
    );
}

export default {
    name: "danbooru-new",
    aliases: ["dnew", "danbooru-latest", "dlatest", "dn", "drec", "danboorunew"],
    category: "anime",
    description: "Mendapatkan gambar anime terbaru (recent posts) dari Danbooru dengan opsi filter & interaksi",
    usage: "!dnew [index 1-30 | safe | page <N> | help]",
    async handler({ message, sock, args, prefix, sender }) {
        args = (args || []).map(arg => arg.toLowerCase());

        // 1. Check for Help Flag
        if (args.includes("help") || args.includes("--help") || args.includes("-h") || args.includes("?")) {
            await message.reply(getHelpMessage(prefix || "!"));
            return;
        }

        let ratingFilter = null;
        let page = 1;
        let specificIndex = null;

        // 2. Parse Rating filter (safe / gen)
        if (args.includes("safe") || args.includes("gen") || args.includes("sfw") || args.includes("g")) {
            ratingFilter = "safe";
        } else if (args.includes("q") || args.includes("questionable")) {
            ratingFilter = "q";
        } else if (args.includes("s") || args.includes("sensitive")) {
            ratingFilter = "s";
        }

        // 3. Parse Page parameter
        const pageIdx = args.findIndex(a => a === "page" || a === "p");
        if (pageIdx !== -1 && args[pageIdx + 1] && /^\d+$/.test(args[pageIdx + 1])) {
            page = Math.max(1, parseInt(args[pageIdx + 1], 10));
        }

        // 4. Parse Specific Index (e.g. 1..30)
        for (const arg of args) {
            if (/^\d+$/.test(arg)) {
                const num = parseInt(arg, 10);
                // If it's not the number following "page"
                if (pageIdx !== -1 && args[pageIdx + 1] === arg) {
                    continue;
                }
                if (num >= 1 && num <= 100) {
                    specificIndex = num;
                    break;
                }
            }
        }

        try {
            const result = await fetchRandomRecentDanbooru({
                ratingFilter,
                page,
                specificIndex,
            });

            const sent = await sendDanbooruMessage({
                postData: result.post,
                sock,
                message,
                isRecent: true,
                recentInfo: {
                    index: result.index,
                    totalSafe: result.totalSafe,
                    page: result.page,
                }
            });

            if (sent?.key?.id) {
                attachRecentReplyHandler({
                    sentKeyId: sent.key.id,
                    sender,
                    ratingFilter,
                    page: result.page,
                    postData: result.post,
                    sock
                });
            }

        } catch (err) {
            console.error("[Danbooru-New] Command error:", err);
            await message.reply(`❌ Error: ${err.message}`);
        }
    }
};
