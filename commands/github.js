/**
 * GitHub — Search GitHub user profiles and repositories.
 */

import {
    sendGitHubUserDetail,
    sendGitHubRepoDetail,
    extractGitHubFromUrl,
} from "../services/github.js";

export default {
    name: "github",
    aliases: ["gh"],
    category: "search",
    description: "Mencari profil user atau repository GitHub",
    usage: "!github <user> atau !github <user>/<repo>",
    async handler({ message, args, sock }) {
        if (args.length === 0) {
            await message.reply(
                "❌ Berikan *username* atau *owner/repo* yang ingin dicari.\n\n" +
                "Contoh Penggunaan:\n" +
                "• `!gh torvalds` — Melihat profil user\n" +
                "• `!gh torvalds/linux` — Melihat info repository\n" +
                "• `!gh https://github.com/torvalds` — Dari URL profil\n" +
                "• `!gh https://github.com/torvalds/linux` — Dari URL repo\n\n" +
                "💡 _Link GitHub yang dikirim di chat juga akan otomatis terdeteksi._"
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
                await message.reply("❌ Format tidak valid. Gunakan: `!github owner/repo`");
                return;
            }

            await sendGitHubRepoDetail(owner, repo, message, sock, false);
            return;
        }

        // 3. Username only
        await sendGitHubUserDetail(fullInput, message, sock, false);
    }
};
