import { registerReplyHandler, deleteReplyHandler } from "./_registry.js";
import { searchCharacter, cleanDescription } from "../services/anilist.js";

const ITEMS_PER_PAGE = 5;

function generatePaginator(page, totalPages) {
    if (totalPages <= 1) return `[ 📄 Page 1/1 ] ─── ━━━━━━━━━━━━━━━━`;
    let items = [];
    let startP = Math.max(0, page - 2);
    let endP = Math.min(totalPages - 1, page + 2);
    for (let i = startP; i <= endP; i++) {
        let pNum = i + 1;
        if (i === page) items.push(`*${pNum}*`);
        else items.push(`${pNum}`);
    }
    let bar = items.join(" ─ ");
    return `[ 📄 Page ${page + 1}/${totalPages} ] ─── « ─ ${bar} ─ »`;
}

function generateListText(results, page, query) {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const currentItems = results.slice(start, end);

    let text = `╭━━━〔 🎭 CHARACTER SEARCH 〕━━━\n`;
    text += `┃ 🔍 *Query* : ${query}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    currentItems.forEach((char, index) => {
        const name = char.name?.full || "N/A";
        const native = char.name?.native || "";
        const favourites = char.favourites ? char.favourites.toLocaleString() : "0";

        // Get primary media appearance
        const primaryMedia = char.media?.edges?.[0]?.node;
        const mediaTitle = primaryMedia?.title?.romaji || "N/A";

        text += `╭───「 ${start + index + 1}. ${name} 」\n`;
        if (native) text += `│ 🔤 *Native* : ${native}\n`;
        text += `│ 🌟 *Favs*   : ${favourites}\n`;
        text += `│ 📺 *From*   : ${mediaTitle}\n`;
        text += `╰──────────────\n\n`;
    });

    text += generatePaginator(page, totalPages) + "\n\n";
    text += `💡 _Reply angka (1-${currentItems.length}) untuk detail. Ketik "n" next, "b" back._`;

    return text.trim();
}

export default {
    name: "character",
    aliases: ["char", "chara", "waifu"],
    category: "anime",
    description: "Mencari informasi karakter anime/manga dari AniList",
    usage: "!character <nama karakter> [-t/--top/-1]",

    flags: {
        top: { type: "boolean", char: "t", aliases: ["top", "direct", "1"] },
    },

    async handler({ message, args, cleanArgs, flags, sock, sender, prefix }) {
        const effectiveArgs = cleanArgs || args;
        if (args.length === 0 && effectiveArgs.length === 0) {
            await message.reply(
                "╭━━━〔 🎭 CHARACTER SEARCH 〕━━━\n" +
                "┃ Mencari karakter anime/manga dari AniList.\n" +
                "╰━━━━━━━━━━━━━━━━━━━━\n\n" +
                "╭───「 📖 Penggunaan 」\n" +
                `│ ⋄ \`${prefix || "!"}character <nama>\`\n` +
                `│ ⋄ \`${prefix || "!"}char <nama> -t\` (hasil teratas)\n` +
                "╰──────────────"
            );
            return;
        }

        const isDirect = Boolean(flags?.top);
        const query = effectiveArgs.join(" ").trim();

        if (!query) {
            await message.reply(`❌ Berikan nama karakter yang ingin dicari.\nContoh: \`${prefix || "!"}character Rem\``);
            return;
        }

        try {
            const results = await searchCharacter(query);

            if (!results || results.length === 0) {
                await message.reply(`❌ Karakter dengan nama *${query}* tidak ditemukan.`);
                return;
            }

            if (isDirect || results.length === 1) {
                await sendCharacterDetail(results[0], message, sock);
                return;
            }

            const text = generateListText(results, 0, query);
            const sentMsg = await sock.sendMessage(message.chat, { text }, { quoted: message });

            registerReplyHandler(sentMsg.key.id, replyHandler, {
                results,
                page: 0,
                query,
                userId: sender,
                messageKey: sentMsg.key,
                commandName: "character"
            });

        } catch (err) {
            console.error("[Character Command Error]:", err);
            if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
                await message.reply("❌ Server AniList sedang sibuk atau timeout. Silakan coba beberapa saat lagi.");
            } else if (err.response?.status === 429) {
                await message.reply("❌ Terlalu banyak request ke AniList API (429 Rate Limit). Mohon tunggu beberapa saat.");
            } else {
                await message.reply(`❌ Terjadi kesalahan: ${err.message || "Unknown error"}`);
            }
        }
    }
};

async function replyHandler({ message, sock, state }) {
    const text = message.text.toLowerCase().trim();
    const { results, page, query, messageKey } = state;
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);

    if (text === "n" || text === "next") {
        if (page < totalPages - 1) {
            state.page += 1;
            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    if (text === "b" || text === "back") {
        if (page > 0) {
            state.page -= 1;
            const newText = generateListText(results, state.page, query);
            await sock.sendMessage(message.chat, { text: newText, edit: messageKey });
        }
        return;
    }

    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= results.length) {
        const char = results[num - 1];
        const charName = char.name?.full || "N/A";

        deleteReplyHandler(messageKey.id);
        await sock.sendMessage(message.chat, { text: `>> *${charName}*`, edit: messageKey });

        await sendCharacterDetail(char, message, sock);
        return;
    }
}

async function sendCharacterDetail(char, message, sock) {
    const name = char.name?.full || "N/A";
    const native = char.name?.native || "";
    const altNames = char.name?.alternative?.filter(n => n)?.join(", ") || "";
    const age = char.age || "N/A";
    const gender = char.gender || "N/A";
    const favourites = char.favourites ? char.favourites.toLocaleString() : "0";
    const description = cleanDescription(char.description);
    const charUrl = char.siteUrl || `https://anilist.co/character/${char.id}`;
    const imageUrl = char.image?.large || null;

    let captionText = `╭━━━〔 🎭 CHARACTER 〕━━━\n`;
    captionText += `┃ 🏷️ *Nama*      : ${name}\n`;
    if (native) captionText += `┃ 🔤 *Native*    : ${native}\n`;
    if (altNames) captionText += `┃ 📝 *Alias*     : ${altNames}\n`;
    captionText += `┃ 🎂 *Umur*      : ${age}\n`;
    captionText += `┃ ⚧️ *Gender*    : ${gender}\n`;
    captionText += `┃ 🌟 *Favorites* : ${favourites}\n`;
    captionText += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Description (truncated for readability)
    if (description && description !== "Tidak ada sinopsis.") {
        const maxLen = 800;
        const truncated = description.length > maxLen
            ? description.substring(0, maxLen).trim() + "..."
            : description;
        captionText += `📝 *Deskripsi:*\n${truncated}\n\n`;
    }

    // Media appearances with voice actors
    const mediaEdges = char.media?.edges || [];
    if (mediaEdges.length > 0) {
        captionText += `╭───「 📺 Muncul Di 」\n`;
        mediaEdges.forEach((edge, i) => {
            const mediaTitle = edge.node?.title?.romaji || "N/A";
            const format = edge.node?.format || "";
            const vaName = edge.voiceActors?.[0]?.name?.full || null;

            captionText += `│ ${i + 1}. ${mediaTitle}`;
            if (format) captionText += ` [${format}]`;
            captionText += `\n`;
            if (vaName && i === 0) {
                captionText += `│    🎙️ VA: ${vaName}\n`;
            }
        });
        captionText += `╰──────────────\n\n`;
    }

    captionText += `🔗 *AniList:* ${charUrl}`;

    if (imageUrl) {
        await sock.sendMessage(
            message.chat,
            {
                image: { url: imageUrl },
                caption: captionText
            },
            { quoted: message }
        );
    } else {
        await message.reply(captionText);
    }
}
