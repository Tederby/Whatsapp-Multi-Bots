import puppeteer from "puppeteer";
import puppeteerQueue from "../services/puppeteerQueue.js";

/**
 * Generate a premium monochrome minimalist quote image using HTML and Puppeteer
 * @param {string} text - The quote text
 * @param {string} name - The author name
 * @param {string} avatarUrl - The URL of the avatar image
 * @param {string|null} contentImageBase64 - Optional base64 data URI of content image from the quoted message
 * @returns {Promise<Buffer>} - PNG image buffer
 */
export async function generateQuote(text, name, avatarUrl, contentImageBase64 = null) {
    // Sanitize text to prevent HTML injection issues if users type raw HTML
    const escapeHtml = (unsafe) => {
        return (unsafe || "").replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const safeText = escapeHtml(text).replace(/\n/g, "<br>");
    const safeName = escapeHtml(name);
    // If no avatar is provided, fallback to a transparent png or solid color
    const safeAvatarUrl = avatarUrl || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // Dynamic font size based on text length — smaller for longer quotes
    const textLen = text.length;
    let fontSize, lineClamp;
    if (textLen < 80) {
        fontSize = 28;
        lineClamp = 5;
    } else if (textLen < 200) {
        fontSize = 23;
        lineClamp = 8;
    } else if (textLen < 400) {
        fontSize = 19;
        lineClamp = 11;
    } else if (textLen < 700) {
        fontSize = 16;
        lineClamp = 14;
    } else {
        fontSize = 14;
        lineClamp = 16;
    }

    // Content image section (only rendered if image is provided)
    const contentImageHtml = contentImageBase64
        ? `<div class="content-image-wrapper">
             <img src="${contentImageBase64}" class="content-image" />
           </div>`
        : "";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: #111111;
                color: #ffffff;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                width: 800px;
                display: flex;
                padding: 44px;
                gap: 32px;
                align-items: flex-start;
            }

            /* ── Avatar ── */
            .avatar-side {
                flex-shrink: 0;
                padding-top: 6px;
            }
            .avatar-ring {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                border: 2px solid #444;
                padding: 3px;
            }
            .avatar {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                filter: grayscale(100%) brightness(0.85);
            }

            /* ── Content ── */
            .content-side {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
            }

            /* ── Content Image (optional) ── */
            .content-image-wrapper {
                margin-bottom: 18px;
                border-radius: 6px;
                overflow: hidden;
                border: 1px solid #2a2a2a;
                max-height: 260px;
            }
            .content-image {
                width: 100%;
                max-height: 260px;
                object-fit: cover;
                filter: saturate(0.6) brightness(0.8);
                display: block;
            }

            /* ── Quote Marks ── */
            .quote-open {
                font-size: 56px;
                line-height: 1;
                color: #555;
                font-family: Georgia, 'Times New Roman', serif;
                margin-bottom: -6px;
                user-select: none;
            }
            .quote-close {
                font-size: 56px;
                line-height: 1;
                color: #555;
                font-family: Georgia, 'Times New Roman', serif;
                text-align: right;
                margin-top: -4px;
                user-select: none;
            }

            /* ── Quote Text ── */
            .quote-text {
                font-size: ${fontSize}px;
                line-height: 1.65;
                font-weight: 300;
                color: #e0e0e0;
                padding: 4px 0 4px 10px;
                display: -webkit-box;
                -webkit-line-clamp: ${lineClamp};
                -webkit-box-orient: vertical;
                overflow: hidden;
                word-break: break-word;
            }

            /* ── Divider & Author ── */
            .divider {
                height: 1px;
                background: #2a2a2a;
                margin: 18px 0 14px 0;
            }
            .author {
                font-size: 15px;
                color: #777;
                font-style: italic;
                font-weight: 400;
                text-align: right;
                letter-spacing: 0.3px;
            }
            .author::before {
                content: "— ";
            }
        </style>
    </head>
    <body>
        <div class="avatar-side">
            <div class="avatar-ring">
                <img src="${safeAvatarUrl}" class="avatar" />
            </div>
        </div>
        <div class="content-side">
            ${contentImageHtml}
            <div class="quote-open">\u201C</div>
            <div class="quote-text">${safeText}</div>
            <div class="quote-close">\u201D</div>
            <div class="divider"></div>
            <div class="author">${safeName}</div>
        </div>
    </body>
    </html>
    `;

    return await puppeteerQueue.run(async () => {
        // Launch puppeteer with optimal flags for VPS stability
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process" // save memory
            ],
        });

        try {
            const page = await browser.newPage();
            // Initial wide viewport — height will be adjusted after content renders
            await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
            // wait until networkidle0 so Google Fonts have time to load
            await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });

            // Measure actual content height and resize viewport to fit perfectly
            const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
            await page.setViewport({ width: 800, height: bodyHeight, deviceScaleFactor: 2 });

            const buffer = await page.screenshot({ type: "png" });
            return buffer;
        } finally {
            await browser.close();
        }
    });
}
