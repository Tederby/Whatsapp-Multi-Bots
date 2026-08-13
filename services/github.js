/**
 * GitHub Service — Fetch and display GitHub user profiles and repository info.
 *
 * Uses the public GitHub REST API (no auth token required).
 * Rate limit: 60 requests/hour per IP (unauthenticated).
 */

import axios from "axios";

const GITHUB_API = "https://api.github.com";
const GITHUB_HEADERS = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "WhatsApp-Bot/1.0",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(num) {
    if (!num && num !== 0) return "0";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString("id-ID");
}

function formatSize(kb) {
    if (!kb) return "0 KB";
    if (kb >= 1_048_576) return `${(kb / 1_048_576).toFixed(1)} GB`;
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
}

function formatDate(isoString) {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function timeAgo(isoString) {
    if (!isoString) return "";
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} tahun lalu`;
    if (months > 0) return `${months} bulan lalu`;
    if (days > 0) return `${days} hari lalu`;
    if (hours > 0) return `${hours} jam lalu`;
    return `${mins} menit lalu`;
}

/**
 * Extract GitHub username or owner/repo from a URL.
 * Returns { type: "user"|"repo", username, repo? } or null.
 */
export function extractGitHubFromUrl(url) {
    if (!url) return null;

    // Match github.com/<owner>/<repo> (with optional trailing segments)
    const repoMatch = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
    if (repoMatch) {
        let repo = repoMatch[2];
        // Strip .git suffix if present
        repo = repo.replace(/\.git$/, "");
        return { type: "repo", username: repoMatch[1], repo };
    }

    // Match github.com/<user> (bare profile)
    const userMatch = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/?$/i);
    if (userMatch) {
        return { type: "user", username: userMatch[1] };
    }

    return null;
}

// ── GitHub reserved paths (not user/repo) ───────────────────────────────────

const RESERVED_PATHS = new Set([
    "about", "explore", "settings", "marketplace", "notifications",
    "sponsors", "pricing", "issues", "pulls", "codespaces",
    "features", "security", "enterprise", "customer-stories",
    "readme", "organizations", "orgs", "login", "signup", "join",
    "new", "topics", "trending", "collections", "events",
    "search", "stars", "watching", "repositories", "packages",
    "people", "blog", "site", "status", "contact", "support",
    "terms", "privacy", "docs", "resources", "services",
    "team", "community", "education", "open-source", "apps",
]);

/**
 * Check if a path segment is a reserved GitHub path (not a user/repo).
 */
export function isReservedPath(segment) {
    return RESERVED_PATHS.has(segment.toLowerCase());
}

// ── User Profile ────────────────────────────────────────────────────────────

function buildUserProfileText(user) {
    const name = user.name || user.login;
    const isOrg = user.type === "Organization";
    const typeEmoji = isOrg ? "🏢" : "👤";
    const typeLabel = isOrg ? "Organization" : "User";

    let text = `╭━━━〔 🐙 GITHUB PROFILE 〕━━━\n`;
    text += `┃ ${typeEmoji} *Nama*     : ${name}\n`;
    text += `┃ 🏷️ *Username* : ${user.login}\n`;
    if (user.bio) {
        text += `┃ 📝 *Bio*      : ${user.bio}\n`;
    }
    text += `┃ 🔖 *Tipe*     : ${typeLabel}\n`;
    if (user.company) {
        text += `┃ 🏢 *Company*  : ${user.company}\n`;
    }
    if (user.location) {
        text += `┃ 📍 *Lokasi*   : ${user.location}\n`;
    }
    if (user.blog) {
        const blogUrl = user.blog.startsWith("http") ? user.blog : `https://${user.blog}`;
        text += `┃ 🌐 *Website*  : ${blogUrl}\n`;
    }
    if (user.twitter_username) {
        text += `┃ 🐦 *Twitter*  : @${user.twitter_username}\n`;
    }
    text += `┃ 📅 *Bergabung* : ${formatDate(user.created_at)}\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Stats section
    text += `╭───「 📊 Statistik 」\n`;
    text += `│ ⋄ Repos     : ${formatNumber(user.public_repos)}\n`;
    text += `│ ⋄ Gists     : ${formatNumber(user.public_gists)}\n`;
    text += `│ ⋄ Followers : ${formatNumber(user.followers)}\n`;
    text += `│ ⋄ Following : ${formatNumber(user.following)}\n`;
    text += `╰──────────────\n`;

    text += `\n🔗 *Profil:* https://github.com/${user.login}`;

    return text.trim();
}

export async function sendGitHubUserDetail(username, message, sock, isAutoDetect = false) {
    let sentMsg;
    if (!isAutoDetect) {
        sentMsg = await sock.sendMessage(
            message.chat,
            { text: `🔍 Mengambil profil GitHub *${username}*...` },
            { quoted: message }
        );
    }

    try {
        const { data: user } = await axios.get(`${GITHUB_API}/users/${encodeURIComponent(username)}`, {
            headers: GITHUB_HEADERS,
            timeout: 15000,
        });

        const profileText = buildUserProfileText(user);

        if (!isAutoDetect && sentMsg) {
            await sock.sendMessage(message.chat, {
                text: `>> *${user.name || user.login}*`,
                edit: sentMsg.key,
            });
        }

        const msgPayload = user.avatar_url
            ? { image: { url: user.avatar_url }, caption: profileText }
            : { text: profileText };

        await sock.sendMessage(message.chat, msgPayload, { quoted: message });

    } catch (err) {
        console.error("GitHub User Error:", err.message);

        if (!isAutoDetect && sentMsg) {
            let errText;
            if (err.response?.status === 404) {
                errText = `❌ User GitHub *${username}* tidak ditemukan.\n\n` +
                    `⚠️ Pastikan username yang dimasukkan benar (case-insensitive).\n` +
                    "💡 _Cek di: `github.com/`*username_disini*_";
            } else if (err.response?.status === 403) {
                errText = `❌ Rate limit GitHub API tercapai. Coba lagi beberapa saat lagi.`;
            } else {
                errText = `❌ Terjadi kesalahan saat mengambil profil GitHub. Coba lagi nanti.`;
            }

            await sock.sendMessage(message.chat, {
                text: errText,
                edit: sentMsg.key,
            }).catch(() => {});
        }
    }
}

// ── Repository Info ─────────────────────────────────────────────────────────

function buildRepoText(repo) {
    const fullName = repo.full_name;
    const desc = repo.description || "_Tidak ada deskripsi._";
    const language = repo.language || "N/A";
    const license = repo.license?.spdx_id || "Tidak ada";

    // Status badges
    const badges = [];
    if (repo.fork) badges.push("🍴 Fork");
    if (repo.archived) badges.push("📦 Archived");
    if (repo.private) badges.push("🔒 Private");
    if (repo.is_template) badges.push("📋 Template");

    let text = `╭━━━〔 📦 GITHUB REPO 〕━━━\n`;
    text += `┃ 📦 *Repo*     : ${fullName}\n`;
    text += `┃ 📝 *Desc*     : ${desc}\n`;
    text += `┃ 💻 *Bahasa*   : ${language}\n`;
    text += `┃ 📜 *Lisensi*  : ${license}\n`;
    text += `┃ 🌿 *Branch*   : ${repo.default_branch}\n`;
    if (badges.length > 0) {
        text += `┃ 🔖 *Status*   : ${badges.join(" | ")}\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Stats section
    text += `╭───「 📊 Statistik 」\n`;
    text += `│ ⋄ Stars       : ⭐ ${formatNumber(repo.stargazers_count)}\n`;
    text += `│ ⋄ Forks       : 🍴 ${formatNumber(repo.forks_count)}\n`;
    text += `│ ⋄ Watchers    : 👁️ ${formatNumber(repo.watchers_count)}\n`;
    text += `│ ⋄ Open Issues : ⚠️ ${formatNumber(repo.open_issues_count)}\n`;
    text += `│ ⋄ Ukuran      : 💾 ${formatSize(repo.size)}\n`;
    text += `╰──────────────\n`;

    // Topics
    if (repo.topics && repo.topics.length > 0) {
        text += `\n╭───「 🏷️ Topics 」\n`;
        text += `│ ${repo.topics.join(", ")}\n`;
        text += `╰──────────────\n`;
    }

    // Dates
    text += `\n╭───「 📅 Tanggal 」\n`;
    text += `│ ⋄ Dibuat  : ${formatDate(repo.created_at)}\n`;
    text += `│ ⋄ Update  : ${formatDate(repo.updated_at)} _(${timeAgo(repo.updated_at)})_\n`;
    if (repo.pushed_at) {
        text += `│ ⋄ Push    : ${formatDate(repo.pushed_at)} _(${timeAgo(repo.pushed_at)})_\n`;
    }
    text += `╰──────────────\n`;

    // Owner
    if (repo.parent) {
        text += `\n💡 _Forked dari: ${repo.parent.full_name}_\n`;
    }

    text += `\n🔗 *Repository:* https://github.com/${fullName}`;

    return text.trim();
}

export async function sendGitHubRepoDetail(owner, repo, message, sock, isAutoDetect = false) {
    let sentMsg;
    if (!isAutoDetect) {
        sentMsg = await sock.sendMessage(
            message.chat,
            { text: `🔍 Mengambil info repo *${owner}/${repo}*...` },
            { quoted: message }
        );
    }

    try {
        const { data: repoData } = await axios.get(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
            {
                headers: GITHUB_HEADERS,
                timeout: 15000,
            }
        );

        const repoText = buildRepoText(repoData);

        if (!isAutoDetect && sentMsg) {
            await sock.sendMessage(message.chat, {
                text: `>> *${repoData.full_name}*`,
                edit: sentMsg.key,
            });
        }

        // Use owner avatar as image
        const avatarUrl = repoData.owner?.avatar_url;
        const msgPayload = avatarUrl
            ? { image: { url: avatarUrl }, caption: repoText }
            : { text: repoText };

        await sock.sendMessage(message.chat, msgPayload, { quoted: message });

    } catch (err) {
        console.error("GitHub Repo Error:", err.message);

        if (!isAutoDetect && sentMsg) {
            let errText;
            if (err.response?.status === 404) {
                errText = `❌ Repository *${owner}/${repo}* tidak ditemukan.\n\n` +
                    `⚠️ Pastikan nama owner dan repo benar.\n` +
                    "💡 _Format: `!github owner/repo`_";
            } else if (err.response?.status === 403) {
                errText = `❌ Rate limit GitHub API tercapai. Coba lagi beberapa saat lagi.`;
            } else {
                errText = `❌ Terjadi kesalahan saat mengambil info repository. Coba lagi nanti.`;
            }

            await sock.sendMessage(message.chat, {
                text: errText,
                edit: sentMsg.key,
            }).catch(() => {});
        }
    }
}
