import puppeteer from "puppeteer";

/**
 * Generate a beautiful quote image using HTML and Puppeteer
 * @param {string} text - The quote text
 * @param {string} name - The author name
 * @param {string} avatarUrl - The URL of the avatar image
 * @returns {Promise<Buffer>} - PNG image buffer
 */
export async function generateQuote(text, name, avatarUrl) {
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

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
                background-color: #0d0d0d;
                color: #ffffff;
                font-family: 'Playfair Display', serif;
                width: 800px;
                height: 400px; /* Fixed dimension landscape card */
                display: flex;
                overflow: hidden;
            }
            .avatar-container {
                width: 350px;
                height: 100%;
                position: relative;
            }
            .avatar {
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center;
                filter: brightness(0.9);
            }
            /* The gradient fade to black */
            .gradient-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(to right, transparent 0%, transparent 40%, #0d0d0d 100%);
            }
            .content {
                flex: 1;
                padding: 40px 50px 40px 10px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                position: relative;
                z-index: 2;
            }
            .text {
                font-size: 26px;
                line-height: 1.5;
                font-weight: 400;
                margin-bottom: 25px;
                z-index: 1;
                /* Limit to max lines if it's too long */
                display: -webkit-box;
                -webkit-line-clamp: 7;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .name {
                font-size: 22px;
                font-style: italic;
                color: #cccccc;
                text-align: right;
                z-index: 1;
            }
            .name::before {
                content: "— ";
            }
        </style>
    </head>
    <body>
        <div class="avatar-container">
            <img src="${safeAvatarUrl}" class="avatar" />
            <div class="gradient-overlay"></div>
        </div>
        <div class="content">
            <div class="text">${safeText}</div>
            <div class="name">${safeName}</div>
        </div>
    </body>
    </html>
    `;

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
        // deviceScaleFactor: 2 gives a nice crisp retina resolution output (1600x800)
        await page.setViewport({ width: 800, height: 400, deviceScaleFactor: 2 });
        // wait until networkidle0 so Google Fonts have time to load
        await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });
        const buffer = await page.screenshot({ type: "png" });
        return buffer;
    } finally {
        await browser.close();
    }
}
