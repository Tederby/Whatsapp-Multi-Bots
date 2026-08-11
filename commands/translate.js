import axios from "axios";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const PRIMARY_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

/**
 * Build the system prompt for translation.
 * The prompt is designed to:
 * - Return ONLY the translated text, nothing else
 * - Auto-detect source language
 * - Preserve the original tone, register, and style
 * - For single words / idioms: translate literally, then add meaning in parentheses
 */
function buildPrompt(targetLang, text) {
    return [
        `You are a translation engine. Your ONLY job is to output the translated text. Do NOT include any preamble, explanation, label, or filler such as "Here is the translation" or "Sure!". Your response must contain NOTHING except the translation itself.`,
        ``,
        `Rules:`,
        `1. Auto-detect the source language.`,
        `2. Translate the text into: ${targetLang}.`,
        `3. Preserve the original tone, register, slang, and formatting exactly. If the source is casual, the translation must be casual. If formal, keep it formal.`,
        `4. If the input is a single word or a short idiom/expression (≤5 words), translate it literally first, then append a brief contextual meaning in parentheses. Example: "Saudade" → "Kerinduan mendalam (perasaan rindu yang melankolis terhadap sesuatu yang hilang)".`,
        `5. If the input is a normal sentence or paragraph, just translate it naturally. Do NOT add parenthetical explanations.`,
        `6. If the source language is the same as the target language, still output the original text unchanged.`,
        `7. Do NOT transliterate — always translate the meaning.`,
        ``,
        `Text to translate:`,
        text
    ].join("\n");
}

/**
 * Call Gemini generateContent API.
 * Returns the generated text or throws an error.
 */
async function callGemini(model, prompt, apiKey) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent`;
    const res = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.3,
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
 * Uses PRIMARY_MODEL first; if it returns 429 (rate limit), retries with FALLBACK_MODEL.
 */
async function translateWithFallback(targetLang, text, apiKey) {
    const prompt = buildPrompt(targetLang, text);

    try {
        return { text: await callGemini(PRIMARY_MODEL, prompt, apiKey), model: PRIMARY_MODEL };
    } catch (err) {
        const status = err.response?.status;
        if (status === 429) {
            // Primary model is rate-limited, fall back
            return { text: await callGemini(FALLBACK_MODEL, prompt, apiKey), model: FALLBACK_MODEL };
        }
        throw err; // Re-throw non-429 errors
    }
}

export default {
    name: "translate",
    aliases: ["tr", "tl"],
    category: "tools",
    description: "Terjemahkan teks ke bahasa lain menggunakan AI (Gemini)",
    usage: "!translate <kode bahasa> <teks> atau reply pesan dengan !translate <kode bahasa>",
    async handler({ message, args, rawArgs }) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return message.reply("❌ GEMINI_API_KEY belum diatur di file .env.");
        }

        // First arg is target language code
        if (args.length === 0) {
            return message.reply(
                "❌ Sertakan kode bahasa tujuan.\n" +
                "Contoh: `!translate id Hello world`\n" +
                "Atau reply pesan dengan: `!translate en`"
            );
        }

        const targetLang = args[0];

        // Determine source text: inline args or quoted message
        let sourceText = args.slice(1).join(" ");

        if (!sourceText && message.quoted) {
            sourceText = message.quoted.text
                || message.quoted.message?.imageMessage?.caption
                || message.quoted.message?.videoMessage?.caption
                || "";
        }

        if (!sourceText) {
            return message.reply(
                "❌ Tidak ada teks untuk diterjemahkan.\n" +
                "Gunakan: `!translate id <teks>` atau reply pesan dengan `!translate id`"
            );
        }

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
