import axios from "axios";
import { jidNormalizedUser } from "baileys";
import { getUser, resolveUserId } from "../lib/database.js";
import setting from "../setting.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

/**
 * Format phone number into clean display string.
 */
function formatPhoneNumber(num) {
    if (num.length >= 10 && num.length <= 15) {
        return `+${num.slice(0, 2)} ${num.slice(2, 5)}-${num.slice(5, 9)}${num.length > 9 ? '-' + num.slice(9) : ''}`;
    }
    return `+${num}`;
}

/**
 * Replace mention IDs (@62812... or @lid...) in text with human-readable user names or formatted numbers.
 */
function resolveMentionsInText(text, message) {
    if (!text) return text;

    // Kumpulkan seluruh mention JID dari pesan utama dan pesan yang di-reply
    const mentions = [
        ...(message.mentionedJid || []),
        ...(message.quoted?.mentionedJid || [])
    ];

    const existingMentionIds = mentions.map(jid => jid.split('@')[0]);

    // Parsing manual tag angka (misal @628123456789)
    const manualMentions = [...text.matchAll(/@(\d{10,16})/g)]
        .map(v => v[1])
        .filter(num => !existingMentionIds.includes(num))
        .map(num => num + '@s.whatsapp.net');

    // Parsing manual LID tag (misal @123456789012345@lid)
    const manualLidMentions = [...text.matchAll(/@(\d{10,20})@lid/g)]
        .map(v => v[1])
        .filter(num => !existingMentionIds.includes(num))
        .map(num => num + '@lid');

    const allMentions = [...mentions, ...manualMentions, ...manualLidMentions];
    if (allMentions.length === 0) return text;

    let result = text;
    for (const jid of allMentions) {
        const id = jid.split('@')[0];
        const mentionNormal = resolveUserId(jidNormalizedUser(jid));
        const mentionUser = getUser(mentionNormal);

        let mentionName = mentionUser.name;
        if (!mentionName) {
            const normalId = mentionNormal.split('@')[0];
            if (/^\d+$/.test(normalId)) {
                mentionName = formatPhoneNumber(normalId);
            } else if (/^\d+$/.test(id)) {
                mentionName = formatPhoneNumber(id);
            } else {
                mentionName = "User";
            }
        }

        const normalId = mentionNormal.split('@')[0];
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = id === normalId
            ? `@${escapeRegex(id)}(?:@lid)?`
            : `@(?:${escapeRegex(id)}|${escapeRegex(normalId)})(?:@lid)?`;

        result = result.replace(new RegExp(pattern, 'g'), `@${mentionName}`);
    }

    return result;
}

/**
 * Build the system prompt for translation.
 * Updated: Auto-genre detection (Swiss Army Knife approach)
 */
function buildPrompt(targetLang, text) {
    return [
        `You are a highly adaptable translation engine. Your ONLY job is to output the translated text. Do NOT include any preamble, explanation, label, or filler such as "Here is the translation".`,
        ``,
        `Rules:`,
        `1. Auto-detect the source language and the GENRE of the text (e.g., casual chat, technical, manual, song lyrics, poetry, fiction).`,
        `2. Translate the text into: ${targetLang}.`,
        `3. DYNAMIC TRANSLATION STYLE (CRITICAL):`,
        `   - If the text is technical, informational, or everyday conversation: prioritize strict literal accuracy, clarity, and preserve the original tone/formatting.`,
        `   - If the text is a song lyric, poem, or creative fiction: prioritize poetic flow, rhythm, emotional resonance, and natural localization. Translate the implicit meaning (e.g., metaphors) to sound beautiful in the target language rather than strictly word-for-word.`,
        `4. Preserve the line-by-line structure of the input. Each line in the source must correspond to exactly one line in the output. Do NOT merge or collapse multiple lines into one.`,
        `5. If the input is a single word or a short idiom/expression (≤5 words), translate it literally first, then append a brief contextual meaning in parentheses. Example: "Saudade" → "Kerinduan mendalam (perasaan rindu yang melankolis...)".`,
        `6. If the input is a normal sentence, paragraph, or lyric, just translate it naturally based on Rule 3. Do NOT add parenthetical explanations.`,
        `7. If the source language is the same as the target language, still output the original text unchanged.`,
        `8. Do NOT transliterate meaning unless it is a proper noun (names, places, brands).`,
        `9. Preserve user mentions/handles starting with @ (e.g., @Name, @Username, or @+62...) exactly as they are without translating the names.`,
        ``,
        `Text to translate:`,
        text
    ].join("\n");
}

/**
 * Call Gemini generateContent API.
 */
async function callGemini(model, prompt, apiKey) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent`;
    const res = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            // Dinaikin dikit jadi 0.4 biar dapet balance antara kaku & puitis
            temperature: 0.4,
            maxOutputTokens: 2048,
        },
    }, {
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        timeout: 30000,
    });

    const candidate = res.data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
        const reason = candidate?.finishReason || "UNKNOWN";
        throw new Error(`Model returned no text (finishReason: ${reason})`);
    }

    return text.trim();
}

/**
 * Translate with automatic fallback.
 */
async function translateWithFallback(targetLang, text, apiKey) {
    const prompt = buildPrompt(targetLang, text);

    try {
        return { text: await callGemini(PRIMARY_MODEL, prompt, apiKey), model: PRIMARY_MODEL };
    } catch (err) {
        const status = err.response?.status;
        if (status === 429) {
            return { text: await callGemini(FALLBACK_MODEL, prompt, apiKey), model: FALLBACK_MODEL };
        }
        throw err;
    }
}

export default {
    name: "translate",
    aliases: ["tr", "tl"],
    category: "tools",
    description: "Terjemahkan teks ke bahasa lain menggunakan AI (Gemini)",
    usage: "!translate <kode bahasa> <teks> atau reply pesan dengan !translate <kode bahasa>",
    async handler({ message, args, rawArgs }) {
        const apiKey = setting.gemini?.apiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return message.reply("❌ GEMINI_API_KEY belum diatur di file .env.");
        }

        if (args.length === 0) {
            return message.reply(
                "❌ Sertakan kode bahasa tujuan.\n" +
                "Contoh: `!translate id Hello world`\n" +
                "Atau reply pesan dengan: `!translate en`"
            );
        }

        const targetLang = args[0];

        let inlineText = "";
        if (args.length > 1 && rawArgs) {
            const firstWhitespace = rawArgs.search(/\s/);
            if (firstWhitespace !== -1) {
                inlineText = rawArgs.slice(firstWhitespace + 1);
            }
        }

        const quotedText = message.quoted
            ? (message.quoted.text
                || message.quoted.message?.imageMessage?.caption
                || message.quoted.message?.videoMessage?.caption
                || "")
            : "";

        let sourceText = "";
        if (quotedText && inlineText) {
            sourceText = quotedText + "\n\n" + inlineText;
        } else {
            sourceText = inlineText || quotedText;
        }

        if (!sourceText) {
            return message.reply(
                "❌ Tidak ada teks untuk diterjemahkan.\n" +
                "Gunakan: `!translate id <teks>` atau reply pesan dengan `!translate id`"
            );
        }

        // Resolusi tag/mention (@62812... atau @lid...) menjadi nama user (@Name)
        sourceText = resolveMentionsInText(sourceText, message);

        const update = await message.replyUpdate("⏳ Menerjemahkan...");

        try {
            const result = await translateWithFallback(targetLang, sourceText, apiKey);
            await update(result.text);
        } catch (err) {
            console.error("[TRANSLATE]", err.message);

            let errorMsg = "❌ Gagal menerjemahkan: ";
            if (err.response?.status === 400) {
                errorMsg += "Permintaan tidak valid. Cek kode bahasa.";
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                errorMsg += "API key tidak valid atau tidak memiliki akses.";
            } else if (err.response?.status === 429) {
                errorMsg += "Semua model sedang penuh. Coba lagi nanti.";
            } else {
                errorMsg += err.message || "Terjadi kesalahan tidak diketahui.";
            }
            await update(errorMsg);
        }
    }
};