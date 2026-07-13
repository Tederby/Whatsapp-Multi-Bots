import puppeteer from "puppeteer";

// ── SSRF Protection ─────────────────────────────────────────────────────────
// Block requests to localhost, private IPs, and reserved ranges.
const BLOCKED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "[::1]",
];

const PRIVATE_IP_REGEX = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})$/;

function isBlockedUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        const hostname = parsed.hostname.toLowerCase();
        if (BLOCKED_HOSTS.includes(hostname)) return true;
        if (PRIVATE_IP_REGEX.test(hostname)) return true;
        // Block file:// and other non-http protocols
        if (!["http:", "https:"].includes(parsed.protocol)) return true;
        return false;
    } catch {
        return true;
    }
}

// ── Flag / URL Parsing ──────────────────────────────────────────────────────

const FLAG_DEFINITIONS = {
    "-m":      "mobile",
    "-mobile": "mobile",
    "-f":      "full",
    "-full":   "full",
    "-d":      "dark",
    "-dark":   "dark",
};

function parseArgs(args) {
    const flags = new Set();
    let url = null;

    for (const arg of args) {
        const lower = arg.toLowerCase();
        if (FLAG_DEFINITIONS[lower]) {
            flags.add(FLAG_DEFINITIONS[lower]);
        } else if (!url) {
            url = arg;
        }
    }

    return { flags, url };
}

function normalizeUrl(raw) {
    // If no protocol, prepend https://
    if (!/^https?:\/\//i.test(raw)) {
        raw = "https://" + raw;
    }
    // Validate URL structure
    new URL(raw); // throws if invalid
    return raw;
}

// ── Viewport Presets ────────────────────────────────────────────────────────

const VIEWPORT = {
    desktop: { width: 1280, height: 800, isMobile: false, hasTouch: false },
    mobile:  { width: 375,  height: 812, isMobile: true,  hasTouch: true },
};

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ── Constants ───────────────────────────────────────────────────────────────

const NAVIGATION_TIMEOUT = 30_000;  // 30s max for page load
const SCREENSHOT_MAX_HEIGHT = 16384; // Cap full-page to prevent absurd images

// ── Command ─────────────────────────────────────────────────────────────────

export default {
    name: "screenshot",
    aliases: ["ss", "web", "capture"],
    category: "tools",
    description: "Mengambil screenshot tampilan website",
    usage: "!ss <url> [-m mobile] [-f fullpage] [-d darkmode]",
    async handler({ message, args, sock }) {
        if (args.length === 0) {
            await message.reply(
                "❌ Berikan URL website yang ingin di-screenshot.\n\n" +
                "Contoh:\n" +
                "• `!ss google.com`\n" +
                "• `!ss -m https://github.com`\n" +
                "• `!ss reddit.com -f -d`\n\n" +
                "╭───「 🏷️ Flags 」\n" +
                "│ `-m` — Tampilan mobile\n" +
                "│ `-f` — Full-page (seluruh halaman)\n" +
                "│ `-d` — Dark mode\n" +
                "╰──────────────"
            );
            return;
        }

        // ── Parse flags & URL ───────────────────────────────────────────
        const { flags, url: rawUrl } = parseArgs(args);

        if (!rawUrl) {
            await message.reply("❌ URL tidak ditemukan. Pastikan kamu menyertakan link website.");
            return;
        }

        let url;
        try {
            url = normalizeUrl(rawUrl);
        } catch {
            await message.reply("❌ URL tidak valid. Pastikan formatnya benar.\nContoh: `!ss google.com` atau `!ss https://example.com`");
            return;
        }

        if (isBlockedUrl(url)) {
            await message.reply("❌ URL tersebut tidak diperbolehkan.");
            return;
        }

        const isMobile  = flags.has("mobile");
        const isFullPage = flags.has("full");
        const isDark    = flags.has("dark");

        // Build status description
        const modeParts = [];
        modeParts.push(isMobile ? "📱 Mobile" : "🖥️ Desktop");
        if (isFullPage) modeParts.push("📜 Full-page");
        if (isDark)     modeParts.push("🌙 Dark mode");
        const modeLabel = modeParts.join(" • ");

        const update = await message.replyUpdate(`⏳ Mengambil screenshot...\n┃ 🔗 ${url}\n┃ ${modeLabel}`);

        // ── Puppeteer ───────────────────────────────────────────────────
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            });

            const page = await browser.newPage();

            // Set viewport
            const viewport = isMobile ? { ...VIEWPORT.mobile } : { ...VIEWPORT.desktop };
            await page.setViewport(viewport);

            // Set mobile user agent
            if (isMobile) {
                await page.setUserAgent(MOBILE_UA);
            }

            // Inject dark mode preference
            if (isDark) {
                await page.emulateMediaFeatures([
                    { name: "prefers-color-scheme", value: "dark" },
                ]);
            }

            // Navigate
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout: NAVIGATION_TIMEOUT,
            });

            // Take screenshot
            const screenshotOptions = {
                type: "png",
                fullPage: isFullPage,
            };

            // If full-page, cap max height to prevent enormous images
            if (isFullPage) {
                const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
                if (bodyHeight > SCREENSHOT_MAX_HEIGHT) {
                    // Set a clip instead of fullPage to cap it
                    screenshotOptions.fullPage = false;
                    screenshotOptions.clip = {
                        x: 0,
                        y: 0,
                        width: viewport.width,
                        height: SCREENSHOT_MAX_HEIGHT,
                    };
                }
            }

            const buffer = await page.screenshot(screenshotOptions);

            // Capture title before closing the browser
            const pageTitle = await page.title().catch(() => "");

            await browser.close();
            browser = null;

            // ── Send Image ──────────────────────────────────────────────

            let caption = `╭━━━〔 📸 SCREENSHOT 〕━━━\n`;
            caption += `┃ 🔗 URL   : ${url}\n`;
            caption += `┃ 📐 Mode  : ${modeLabel}\n`;
            if (pageTitle) {
                caption += `┃ 📄 Title : ${pageTitle}\n`;
            }
            caption += `╰━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(message.chat, {
                image: buffer,
                caption,
            }, { quoted: message });

            await update("✅ Screenshot berhasil dikirim!");

        } catch (err) {
            console.error("[SCREENSHOT]", err);

            // Provide user-friendly error messages
            let errMsg = "Terjadi kesalahan saat mengambil screenshot.";
            if (err.message?.includes("net::ERR_NAME_NOT_RESOLVED")) {
                errMsg = "Domain tidak ditemukan. Pastikan URL benar.";
            } else if (err.message?.includes("net::ERR_CONNECTION_REFUSED")) {
                errMsg = "Koneksi ditolak oleh server.";
            } else if (err.message?.includes("net::ERR_CONNECTION_TIMED_OUT") || err.name === "TimeoutError") {
                errMsg = "Koneksi timeout. Website terlalu lama merespons.";
            } else if (err.message?.includes("net::ERR_CERT")) {
                errMsg = "Sertifikat SSL website tidak valid.";
            }

            await update(`❌ ${errMsg}`);
        } finally {
            // Safety: always close browser if still open
            if (browser) {
                try { await browser.close(); } catch { /* ignore */ }
            }
        }
    }
};
