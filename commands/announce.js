/**
 * Announce Command — Send announcements to WhatsApp Channel.
 *
 * Subcommands:
 *   !announce text <text>        — Send free-text to channel
 *   !announce changelog [N]    — Auto-generate from last N CHANGELOG.md entries
 *   !announce resolve <url>    — Resolve channel invite URL to JID (setup helper)
 *   !announce status           — Show current channel config and connectivity
 *   !announce on / off [-g]    — Enable/disable announcer for bot or globally
 *
 * Flags:
 *   -p / --preview             — Preview message without sending
 *   -g / --global              — Apply toggle to all bot instances
 *
 * Security: ownerOnly — only owner numbers can execute this command.
 *
 * @module commands/announce
 */

import setting from "../setting.js";
import {
    getChannelJid,
    getChannelName,
    sendAnnouncement,
    sendChangelog,
    parseChangelog,
    formatChangelogMessage,
    resolveChannelFromUrl,
    isEnabled,
    setEnabled,
} from "../lib/announcer.js";

export default {
    name: "announce",
    aliases: ["ann", "broadcast", "changelog"],
    category: "owner",
    description: "Send announcement or changelog to WhatsApp Channel",
    usage: "!announce text <teks> | !announce changelog [N] | !announce on/off [-g] | !announce status",
    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    botAdminOnly: false,
    ownerOnly: true,
    privateOnly: false,
    registerRequired: false,
    multiBot: false,

    flags: {
        preview: { type: "boolean", char: "p", description: "Preview message without sending" },
        global: { type: "boolean", char: "g", description: "Apply toggle to all bot instances" },
    },

    async handler({ message, sock, cleanArgs, flags, prefix, commandName }) {
        const p = prefix || "!";
        try {
            const subcommand = cleanArgs[0]?.toLowerCase();

            // ── !announce status ────────────────────────────────────────
            if (subcommand === "status") {
                return await handleStatus(sock, message);
            }

            // ── !announce on / off [──global] ─────────────────────────────
            if (subcommand === "on" || subcommand === "off") {
                return await handleToggle(sock, message, subcommand === "on", flags.global);
            }

            // ── !announce resolve <url> ─────────────────────────────────
            if (subcommand === "resolve") {
                return await handleResolve(sock, message, cleanArgs.slice(1).join(" "), p);
            }

            // ── !announce changelog [N] ─────────────────────────────────
            if (subcommand === "changelog" || commandName === "changelog") {
                const count = parseInt(cleanArgs[1], 10) || 1;
                return await handleChangelog(sock, message, count, flags.preview, p);
            }

            // ── !announce text <teks> ───────────────────────────────────
            if (subcommand === "text" || subcommand === "txt") {
                const text = cleanArgs.slice(1).join(" ").trim();
                const quotedText = message.quoted?.text || message.quoted?.caption || "";
                const finalText = text || quotedText;

                if (!finalText) {
                    return await message.reply(
                        `⚠️ Berikan teks untuk dikirim.\n\nContoh: *${p}announce text Halo semua!*`
                    );
                }

                return await handleFreeText(sock, message, finalText, flags.preview, p);
            }

            // ── Unknown subcommand or no args → show usage ──────────────
            return await showUsage(sock, message, p);
        } catch (err) {
            console.error("[ANNOUNCE]", err);
            await message.reply("❌ Terjadi kesalahan saat memproses permintaan.");
        }
    },
};

// ── Usage Display ───────────────────────────────────────────────────────────

async function showUsage(sock, message, p) {
    let usage = "";
    usage += `╭━━━〔 📢 ANNOUNCE 〕━━━\n`;
    usage += `┃\n`;
    usage += `┃ Kirim pengumuman ke WhatsApp Channel.\n`;
    usage += `┃\n`;
    usage += `┣━━━━━━━━━━━━━━━━━━━━\n`;
    usage += `┃\n`;
    usage += `┃ *Penggunaan:*\n`;
    usage += `┃ ⋄ ${p}announce text <teks>\n`;
    usage += `┃ ⋄ ${p}announce changelog [N]\n`;
    usage += `┃ ⋄ ${p}announce resolve <url>\n`;
    usage += `┃ ⋄ ${p}announce status\n`;
    usage += `┃ ⋄ ${p}announce on / off [-g]\n`;
    usage += `┃\n`;
    usage += `┃ *Flag:*\n`;
    usage += `┃ ⋄ -p / --preview : Preview tanpa kirim\n`;
    usage += `┃ ⋄ -g / --global  : Toggle untuk semua bot\n`;
    usage += `┃\n`;
    usage += `╰━━━━━━━━━━━━━━━━━━━━`;
    return message.reply(usage);
}

// ── Subcommand Handlers ─────────────────────────────────────────────────────

async function handleStatus(sock, message) {
    const channelJid = getChannelJid();
    const channelName = getChannelName();
    const channelUrl = setting.branding?.channelUrl || "(not set)";

    let text = "";
    text += `╭━━━〔 📡 CHANNEL STATUS 〕━━━\n`;
    text += `┃\n`;
    text += `┃ ⋄ URL      : ${channelUrl}\n`;
    text += `┃ ⋄ JID      : ${channelJid || "❌ Not resolved"}\n`;
    text += `┃ ⋄ Name     : ${channelName || "N/A"}\n`;
    text += `┃ ⋄ Channel  : ${channelJid ? "✅ Connected" : "⚠️ Not connected"}\n`;
    text += `┃ ⋄ Enabled  : ${isEnabled() ? "✅ Active" : "🔴 Disabled"}\n`;
    text += `┃\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━`;

    return message.reply(text);
}

async function handleToggle(sock, message, enable, isGlobal) {
    const scope = isGlobal ? "global" : "bot";
    const scopeLabel = isGlobal ? "semua bot (global)" : `bot ini (${setting.botId})`;

    setEnabled(scope, enable);

    const icon = enable ? "✅" : "🔴";
    const action = enable ? "diaktifkan" : "dinonaktifkan";
    return message.reply(`${icon} Announcer ${action} untuk ${scopeLabel}.`);
}

async function handleResolve(sock, message, url, p) {
    const chatId = message.chat || message.key.remoteJid;

    if (!url) {
        return message.reply(`⚠️ Berikan URL channel.\n\nContoh: *${p}announce resolve https://whatsapp.com/channel/xxxx*`);
    }

    const sent = await sock.sendMessage(chatId, { text: "🔍 Resolving channel..." });

    const result = await resolveChannelFromUrl(sock, url);
    if (!result) {
        return sock.sendMessage(chatId, {
            text: "❌ Gagal resolve channel. Pastikan URL valid dan bot memiliki akses.",
            edit: sent.key,
        });
    }

    let text = "";
    text += `╭━━━〔 🔗 CHANNEL RESOLVED 〕━━━\n`;
    text += `┃\n`;
    text += `┃ ⋄ Name : ${result.name || "N/A"}\n`;
    text += `┃ ⋄ JID  : ${result.jid}\n`;
    if (result.description) {
        text += `┃ ⋄ Desc : ${result.description.substring(0, 100)}\n`;
    }
    text += `┃\n`;
    text += `╰━━━━━━━━━━━━━━━━━━━━`;

    return sock.sendMessage(chatId, { text, edit: sent.key });
}

async function handleChangelog(sock, message, count, isPreview, p) {
    const chatId = message.chat || message.key.remoteJid;
    const channelJid = getChannelJid();

    const entries = parseChangelog(count);
    if (entries.length === 0) {
        return message.reply("⚠️ Tidak ada entry yang ditemukan di `docs/CHANGELOG.md`.");
    }

    // Preview mode: show formatted message without sending to channel
    if (isPreview) {
        const formatted = formatChangelogMessage(entries);
        const previewText = `_📋 Preview (${entries.length} entry, tidak dikirim ke channel):_\n\n${formatted}\n\n_Kirim tanpa -p untuk mengirim ke channel._`;
        return message.reply(previewText);
    }

    // Send to channel
    if (!channelJid) {
        return message.reply("❌ Channel belum ter-resolve. Pastikan `CHANNEL_URL` di .env valid dan bot sudah online.");
    }

    const sent = await sock.sendMessage(chatId, { text: "📤 Mengirim changelog ke channel..." });
    const ok = await sendChangelog(sock, entries);

    if (ok) {
        return sock.sendMessage(chatId, {
            text: `✅ Changelog (${entries.length} entry) berhasil dikirim ke channel.`,
            edit: sent.key,
        });
    } else {
        return sock.sendMessage(chatId, {
            text: "❌ Gagal mengirim changelog. Periksa log console untuk detail.",
            edit: sent.key,
        });
    }
}

async function handleFreeText(sock, message, text, isPreview, p) {
    const chatId = message.chat || message.key.remoteJid;
    const channelJid = getChannelJid();

    if (isPreview) {
        return message.reply(
            `_📢 Preview (tidak dikirim ke channel):_\n\n${text}\n\n_Kirim tanpa -p untuk mengirim ke channel._`
        );
    }

    if (!channelJid) {
        return message.reply("❌ Channel belum ter-resolve. Pastikan `CHANNEL_URL` di .env valid dan bot sudah online.");
    }

    const sent = await sock.sendMessage(chatId, { text: "📤 Mengirim pengumuman ke channel..." });
    const ok = await sendAnnouncement(sock, { text });

    if (ok) {
        return sock.sendMessage(chatId, {
            text: "✅ Pengumuman berhasil dikirim ke channel.",
            edit: sent.key,
        });
    } else {
        return sock.sendMessage(chatId, {
            text: "❌ Gagal mengirim pengumuman. Periksa log console untuk detail.",
            edit: sent.key,
        });
    }
}
