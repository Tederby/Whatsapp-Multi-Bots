/**
 * GitHub — Search GitHub user profiles and repositories.
 *
 * @module commands/github
 */

import {
    sendGitHubUserDetail,
    sendGitHubRepoDetail,
    extractGitHubFromUrl,
} from "../services/github.js";

export default {
    name: "github",
    aliases: ["gh", "git"],
    category: "search",
    description: "Mencari profil user atau repository GitHub",
    usage: "!github <user> atau !github <user>/<repo>",
    async handler({ message, args, sock, prefix }) {
        try {
            if (args.length === 0) {
                const p = prefix || "!";
                await message.reply(
                    "🐙 *GITHUB SEARCH*\n" +
                    "────────────────────────\n" +
                    "Mencari profil user atau repository GitHub.\n\n" +
                    "*📖 Penggunaan*\n" +
                    `⋄ \`${p}gh <user>\` — Profil user\n` +
                    `⋄ \`${p}gh <user>/<repo>\` — Info repository\n` +
                    `⋄ \`${p}gh <url>\` — Dari URL GitHub\n\n` +
                    "*ℹ️ Notes:* Link GitHub yang dikirim di chat juga akan otomatis terdeteksi.\n" +
                    "────────────────────────"
                );
                return;
            }

            const fullInput = args.join(" ").trim();

            // 1. URL input — extract user/repo from link
            if (/^https?:\/\//i.test(fullInput) || fullInput.includes("github.com/")) {
                const extracted = extractGitHubFromUrl(fullInput);
                if (!extracted) {
                    await message.reply("❌ URL GitHub tidak valid atau tidak dapat diparse.");
                    return;
                }

                if (extracted.type === "repo") {
                    await sendGitHubRepoDetail(extracted.username, extracted.repo, message, sock, false);
                } else {
                    await sendGitHubUserDetail(extracted.username, message, sock, false);
                }
                return;
            }

            // 2. owner/repo format
            if (fullInput.includes("/")) {
                const parts = fullInput.split("/");
                const owner = parts[0].trim();
                const repo = parts.slice(1).join("/").trim();

                if (!owner || !repo) {
                    await message.reply(`❌ Format tidak valid. Gunakan: \`${prefix || "!"}github owner/repo\``);
                    return;
                }

                await sendGitHubRepoDetail(owner, repo, message, sock, false);
                return;
            }

            // 3. Username only
            await sendGitHubUserDetail(fullInput, message, sock, false);
        } catch (error) {
            console.error("[GITHUB]", error);
            await message.reply(`❌ Terjadi kesalahan saat mencari di GitHub: ${error.message}`);
        }
    }
};
