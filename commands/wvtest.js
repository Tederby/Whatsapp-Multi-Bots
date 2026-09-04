/**
 * Webview Payload Empirical Testing & Diagnostic Suite Command.
 *
 * Provides calibrated trial-and-error probes to audit WhatsApp in-app webview
 * capabilities, runtime sandboxing boundaries, and protobuf transmission limits:
 *
 * 1. !wvtest suite          — Automated in-webview diagnostic runner (50+ browser & async probes)
 * 2. !wvtest probe <kb>     — Precision calibrated stanza size probe (exact byte matching)
 * 3. !wvtest probe range    — Calibrated range probing (950KB - 1300KB) to pinpoint silent drops
 * 4. !wvtest proto <case>   — Protobuf envelope mutation tests (botjid, multisection, trusted, context, quoted, expiration)
 * 5. !wvtest form           — Form controls, soft keyboard viewport watcher & file picker audit
 * 6. !wvtest audio          — Deep audio playback and decoding sandbox audit
 * 7. !wvtest links          — URI schemes, intent URLs, and native interception audit
 * 8. !wvtest lifecycle      — State retention audit across scrolling and app backgrounding
 */

import { randomUUID } from "crypto";
import { sendUI, esc } from "../lib/uiEngine.js";
import {
    makeCalibratedProbeHtml,
    renderDiagnosticSuiteHtml,
    renderFormsTestHtml,
    renderLinksTestHtml,
    renderAudioTestHtml,
    renderLifecycleTestHtml,
} from "./_wvtestTemplates.js";

// ── Constants ───────────────────────────────────────────────────────────────

const BOT_JID = "867051314767696@bot";
const DEFAULT_AUTO_DELETE_MS = 180000; // 3 minutes for testing sessions

// ── Command Definition ───────────────────────────────────────────────────────

export default {
    name: "wvtest",
    aliases: ["webviewtest", "wvprobe", "wtest"],
    category: "tools",
    description: "Empirical diagnostic suite and size boundary probes for WhatsApp in-app webviews",
    usage: "!wvtest [suite|probe|proto|form|audio|links|lifecycle] [--keep]",

    groupOnly: false,
    adminOnly: false,
    botAdminRequired: false,
    ownerOnly: true,
    privateOnly: false,
    registerRequired: false,

    async handler({ message, sock, args, prefix }) {
        const subCmd = (args[0] || "suite").toLowerCase();
        const keepFlag = args.includes("--keep");
        const autoDeleteMs = keepFlag ? 0 : DEFAULT_AUTO_DELETE_MS;

        // ── Helper: Schedule Auto Deletion ──────────────────────────────────
        const scheduleDeletion = (sentMsg) => {
            if (!autoDeleteMs || !sentMsg?.key) return;
            setTimeout(() => {
                sock.sendMessage(message.chat, {
                    delete: { ...sentMsg.key, fromMe: true },
                }).catch(() => {});
            }, autoDeleteMs);
        };

        // ── SUBCOMMAND: suite (Automated In-Webview Diagnostic Matrix) ───────
        if (subCmd === "suite" || subCmd === "test") {
            const html = renderDiagnosticSuiteHtml();
            try {
                const sent = await sendUI(sock, message.chat, {
                    title: "🔬 Webview Diagnostic Suite",
                    html,
                });

                scheduleDeletion(sent);

                return await message.reply(
                    `╭━━━〔 🔬 *WEBVIEW DIAGNOSTIC SUITE* 〕━━━\n` +
                    `┃ ✅ Diagnostic Webview berhasil di-relay!\n` +
                    `┃\n` +
                    `┃ 📱 *Langkah Pengujian:* Buka pesan webview di atas.\n` +
                    `┃ Test runner otomatis akan mengaudit 50+ kapabilitas browser:\n` +
                    `┃ • IndexedDB Real Read/Write Transaction\n` +
                    `┃ • WebAssembly Real Bytecode Execution\n` +
                    `┃ • Outbound Fetch (CORS & Localhost) & WebSocket Handshake\n` +
                    `┃ • Deep Window Host Bridge Inspection\n` +
                    `┃ • HTML5 Video & FontFace API Sandbox\n` +
                    `┃\n` +
                    `┃ 📋 Gunakan tombol *'Salin Ringkasan'* di webview untuk\n` +
                    `┃ mendokumentasikan temuan ke chat ini.\n` +
                    `┃ ⏱️ _${keepFlag ? "Pesan dipertahankan (--keep aktif)" : "Otomatis dihapus dalam 3 menit" }_\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            } catch (err) {
                console.error("[wvtest suite error]", err);
                return message.reply(`❌ Gagal meluncurkan diagnostic suite: ${err.message}`);
            }
        }

        // ── SUBCOMMAND: probe (Precision Stanza Size Probe) ──────────────────
        if (subCmd === "probe") {
            const probeParam = (args[1] || "").toLowerCase();

            // Calibrated range probe around the 1MB drop cliff
            if (probeParam === "range" || probeParam === "cliff") {
                const rangeSizesKb = [950, 1000, 1024, 1050, 1100, 1150, 1200, 1300];
                const update = await message.replyUpdate(
                    `🔬 *[PROBE CALIBRATION]* Memulai probe range presisi:\n` +
                    `Ukuran: ${rangeSizesKb.map(k => k + "KB").join(", ")}\n` +
                    `_Tiap probe dikirim berurutan selang 2 detik..._`
                );

                for (let i = 0; i < rangeSizesKb.length; i++) {
                    const sizeKb = rangeSizesKb[i];
                    try {
                        const { html, exactBytes } = makeCalibratedProbeHtml(sizeKb);
                        const sent = await sendUI(sock, message.chat, {
                            title: `🔬 Probe ${sizeKb}KB (${exactBytes.toLocaleString()}B)`,
                            html,
                        });
                        scheduleDeletion(sent);
                        console.log(`[wvtest probe] Dispatched ${sizeKb}KB (${exactBytes}B)`);
                    } catch (probeErr) {
                        console.error(`[wvtest probe] Failed ${sizeKb}KB:`, probeErr.message);
                    }
                    if (i < rangeSizesKb.length - 1) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }

                return await update(
                    `╭━━━〔 🔬 RANGE PROBE SELESAI 〕━━━\n` +
                    `┃ ${rangeSizesKb.length} stansa probe terkalibrasi telah dikirim:\n` +
                    rangeSizesKb.map(k => `┃ • ${k >= 1024 ? "🔴" : "🟡"} ${k} KB (${(k * 1024).toLocaleString()} Bytes)`).join("\n") + "\n" +
                    `┃\n` +
                    `┃ 💡 *Cara Membaca Hasil:* Nomor probe tertinggi yang\n` +
                    `┃ muncul di layar Anda adalah titik batas eksak (drop ceiling)\n` +
                    `┃ sebelum WhatsApp Router membuang stansa.\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            }

            // Single custom size probe (e.g. !wvtest probe 1024)
            const targetKb = parseInt(probeParam, 10);
            if (isNaN(targetKb) || targetKb < 10 || targetKb > 5000) {
                return message.reply(
                    `╭━━━〔 🔬 *STANZA SIZE PROBE* 〕━━━\n` +
                    `┃ Gunakan untuk menguji batas ukuran payload stansa:\n` +
                    `┃\n` +
                    `┃ • \`${prefix}wvtest probe <angka_kb>\` (Contoh: \`${prefix}wvtest probe 1024\`)\n` +
                    `┃ • \`${prefix}wvtest probe range\` (Kirim stansa 950KB - 1300KB)\n` +
                    `┃\n` +
                    `┃ Tambahkan \`--keep\` agar kartu probe tidak otomatis terhapus.\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            }

            const { html, exactBytes } = makeCalibratedProbeHtml(targetKb);

            try {
                const sent = await sendUI(sock, message.chat, {
                    title: `🔬 Probe ${targetKb}KB (${exactBytes.toLocaleString()}B)`,
                    html,
                });
                scheduleDeletion(sent);

                return message.reply(
                    `🔬 *Stansa Probe ${targetKb} KB (${exactBytes.toLocaleString()} Bytes) Dikirim!*\n` +
                    `Periksa apakah kartu muncul di chat. Jika tidak muncul, berarti ukuran melampaui batas router.`
                );
            } catch (err) {
                return message.reply(`❌ Gagal mengirim probe ${targetKb}KB: ${err.message}`);
            }
        }

        // ── SUBCOMMAND: proto (Protobuf Envelope Mutations) ──────────────────
        if (subCmd === "proto") {
            const protoCase = (args[1] || "").toLowerCase();

            if (!protoCase || !["botjid", "multisection", "trusted", "context", "quoted", "expiration"].includes(protoCase)) {
                return message.reply(
                    `╭━━━〔 🔬 *PROTOBUF ENVELOPE MUTATION* 〕━━━\n` +
                    `┃ Uji toleransi router WhatsApp terhadap modifikasi struktur:\n` +
                    `┃\n` +
                    `┃ 1. \`${prefix}wvtest proto botjid\`\n` +
                    `┃    Mengirim dengan botJid nomor bot sendiri (bukan universal Meta AI).\n` +
                    `┃ 2. \`${prefix}wvtest proto multisection\`\n` +
                    `┃    Mengirim array 2 layout sections (uji dukungan multi-card / carousel).\n` +
                    `┃ 3. \`${prefix}wvtest proto trusted\`\n` +
                    `┃    Menguji array trusted_sources untuk memuat external image.\n` +
                    `┃ 4. \`${prefix}wvtest proto context\`\n` +
                    `┃    Menguji variasi forwardOrigin: 1 & forwardingScore: 0.\n` +
                    `┃ 5. \`${prefix}wvtest proto quoted\`\n` +
                    `┃    Menguji pelampiran quotedMessage (reply kartu webview terhadap chat).\n` +
                    `┃ 6. \`${prefix}wvtest proto expiration\`\n` +
                    `┃    Menguji native disappearing message timer (contextInfo.expiration).\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            }

            const responseId = randomUUID();
            let testTitle = `🔬 Proto Test: ${protoCase}`;
            let targetBotJid = BOT_JID;
            let forwardOriginVal = 4;
            let forwardingScoreVal = 1;
            let isForwardedVal = true;
            let sectionsArray = [];

            if (protoCase === "botjid") {
                // Use own bot JID instead of universal Meta AI JID
                targetBotJid = sock.user?.id ? sock.user.id.replace(/:.*@/, "@") : "0@s.whatsapp.net";
                testTitle = `🔬 Proto: Custom botJid (${targetBotJid})`;
                sectionsArray = [
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#0d0f13;color:#fff;font-family:sans-serif;padding:20px;text-align:center"><h3>Proto Test: Custom botJid</h3><p style="color:#38bdf8">botJid: ${targetBotJid}</p><p style="color:#a1a1aa;font-size:12px">Jika card ini tampil, WhatsApp tidak memvalidasi botJid harus Meta AI.</p></body></html>`,
                                trusted_sources: [],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                ];
            } else if (protoCase === "multisection") {
                testTitle = "🔬 Proto: Multi-Section (2 Cards)";
                sectionsArray = [
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#141619;color:#fff;font-family:sans-serif;padding:16px;text-align:center"><h3 style="color:#4ade80">Card Section #1</h3><p style="color:#a1a1aa;font-size:12px">Bagian pertama dari multi-section payload.</p></body></html>`,
                                trusted_sources: [],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#18191f;color:#fff;font-family:sans-serif;padding:16px;text-align:center"><h3 style="color:#38bdf8">Card Section #2</h3><p style="color:#a1a1aa;font-size:12px">Bagian kedua dari multi-section payload.</p></body></html>`,
                                trusted_sources: [],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                ];
            } else if (protoCase === "trusted") {
                testTitle = "🔬 Proto: Trusted Sources Whitelist";
                sectionsArray = [
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#0d0f13;color:#fff;font-family:sans-serif;padding:16px;text-align:center"><h3>Proto: Trusted Sources Test</h3><p style="font-size:11px;color:#a1a1aa">Mencoba memuat gambar dari upload.wikimedia.org:</p><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/220px-Image_created_with_a_mobile_phone.png" style="max-width:100%;border-radius:8px;margin-top:10px" alt="Remote Image" onerror="this.insertAdjacentHTML('afterend', '<p style=\\'color:#ef4444;font-size:11px;margin-top:8px\\'>✗ Gagal memuat remote image (Sandbox network block tetap aktif)</p>')"></body></html>`,
                                trusted_sources: ["https://upload.wikimedia.org"],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                ];
            } else if (protoCase === "context") {
                testTitle = "🔬 Proto: Modified ContextInfo";
                forwardOriginVal = 1;
                forwardingScoreVal = 0;
                isForwardedVal = false;
                sectionsArray = [
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#0d0f13;color:#fff;font-family:sans-serif;padding:20px;text-align:center"><h3>Proto: Modified ContextInfo</h3><p style="color:#a1a1aa;font-size:12px">forwardOrigin: 1 | forwardingScore: 0 | isForwarded: false</p></body></html>`,
                                trusted_sources: [],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                ];
            } else if (protoCase === "quoted") {
                testTitle = "🔬 Proto: Quoted Message Context";
                forwardOriginVal = 1;
                forwardingScoreVal = 0;
                isForwardedVal = false;
                sectionsArray = [
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#0d0f13;color:#fff;font-family:sans-serif;padding:20px;text-align:center"><h3 style="color:#38bdf8">Proto: Quoted Reply Card</h3><p style="color:#a1a1aa;font-size:12px">Kartu webview ini dikirim dengan menyematkan contextInfo.quotedMessage yang mengutip pesan trigger Anda.</p></body></html>`,
                                trusted_sources: [],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                ];
            } else if (protoCase === "expiration") {
                testTitle = "🔬 Proto: Native Disappearing Timer (86400s)";
                forwardOriginVal = 1;
                forwardingScoreVal = 0;
                isForwardedVal = false;
                sectionsArray = [
                    {
                        view_model: {
                            primitive: {
                                __typename: "GenAIaeacdsnwHtmlPrimitive",
                                payload: `<!DOCTYPE html><html><body style="background:#0d0f13;color:#fff;font-family:sans-serif;padding:20px;text-align:center"><h3 style="color:#4ade80">Proto: Native Ephemeral Expiry</h3><p style="color:#a1a1aa;font-size:12px">Kartu ini dikirim dengan contextInfo.expiration = 86400 (24 jam) untuk menguji apakah pesan webview mendukung disappearing messages secara native.</p></body></html>`,
                                trusted_sources: [],
                            },
                            __typename: "GenAISingleLayoutViewModel",
                        },
                    },
                ];
            }

            const payloadBase64 = Buffer.from(
                JSON.stringify({
                    response_id: responseId,
                    sections: sectionsArray,
                })
            ).toString("base64");

            const contextInfoObj = {
                forwardingScore: forwardingScoreVal,
                isForwarded: isForwardedVal,
                forwardOrigin: forwardOriginVal,
                forwardedAiBotMessageInfo: {
                    botJid: targetBotJid,
                },
            };

            if (protoCase === "quoted" && message.message) {
                contextInfoObj.quotedMessage = message.message;
                contextInfoObj.stanzaId = message.key.id;
                contextInfoObj.participant = message.key.participant || message.sender;
            }

            if (protoCase === "expiration") {
                contextInfoObj.expiration = 86400;
            }

            try {
                await sock.relayMessage(
                    message.chat,
                    {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2,
                            botMetadata: {
                                botResponseId: responseId,
                            },
                        },
                        botForwardedMessage: {
                            message: {
                                richResponseMessage: {
                                    messageType: 1,
                                    submessages: [
                                        {
                                            messageType: 2,
                                            messageText: testTitle,
                                        },
                                    ],
                                    unifiedResponse: {
                                        data: payloadBase64,
                                    },
                                    contextInfo: contextInfoObj,
                                },
                            },
                        },
                    },
                    { messageId: responseId }
                );

                scheduleDeletion({ key: { remoteJid: message.chat, fromMe: true, id: responseId } });

                return message.reply(
                    `🔬 *Proto Mutation '${protoCase}' Berhasil Di-Relay!*\n` +
                    `• Title: ${testTitle}\n` +
                    `• BotJid: \`${targetBotJid}\`\n` +
                    `• Sections: ${sectionsArray.length}\n` +
                    `Periksa di chat apakah WhatsApp me-render payload mutasi ini.`
                );
            } catch (err) {
                return message.reply(`❌ Proto mutation gagal di-relay: ${err.message}`);
            }
        }

        // ── SUBCOMMAND: form (Form Controls & Viewport Audit) ───────────────
        if (subCmd === "form" || subCmd === "forms" || subCmd === "input") {
            const html = renderFormsTestHtml();
            try {
                const sent = await sendUI(sock, message.chat, {
                    title: "📝 Form & Viewport Audit",
                    html,
                });
                scheduleDeletion(sent);
                return message.reply(
                    `╭━━━〔 📝 *FORM & VIEWPORT AUDIT* 〕━━━\n` +
                    `┃ ✅ Kartu form & input controls berhasil dikirim!\n` +
                    `┃\n` +
                    `┃ 📱 *Pengujian yang dapat dilakukan:* \n` +
                    `┃ 1. Ketuk text input untuk memicu soft keyboard Android.\n` +
                    `┃    Amati perubahan Live Visual Viewport Watcher di atas.\n` +
                    `┃ 2. Uji dropdown <select>, date picker, color picker, dan slider.\n` +
                    `┃ 3. Ketuk <input type="file"> untuk melihat apakah dialog\n` +
                    `┃    pemilih berkas / kamera Android muncul.\n` +
                    `┃\n` +
                    `┃ ⏱️ _${keepFlag ? "Pesan dipertahankan (--keep aktif)" : "Otomatis dihapus dalam 3 menit" }_\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            } catch (err) {
                return message.reply(`❌ Gagal mengirim kartu form: ${err.message}`);
            }
        }

        // ── SUBCOMMAND: links (URI Scheme Interception) ──────────────────────
        if (subCmd === "links") {
            const html = renderLinksTestHtml();
            try {
                const sent = await sendUI(sock, message.chat, {
                    title: "🔗 URI Scheme Audit",
                    html,
                });
                scheduleDeletion(sent);
                return message.reply("🔗 Kartu uji URI scheme & link interception berhasil dikirim!");
            } catch (err) {
                return message.reply(`❌ Gagal mengirim kartu links: ${err.message}`);
            }
        }

        // ── SUBCOMMAND: audio (Deep Audio & Media Sandbox Audit) ─────────────
        if (subCmd === "audio") {
            const html = renderAudioTestHtml();
            try {
                const sent = await sendUI(sock, message.chat, {
                    title: "🎵 Audio Sandbox Audit",
                    html,
                });
                scheduleDeletion(sent);
                return message.reply("🎵 Kartu uji audio sandbox & oscillator decoding berhasil dikirim!");
            } catch (err) {
                return message.reply(`❌ Gagal mengirim kartu audio: ${err.message}`);
            }
        }

        // ── SUBCOMMAND: lifecycle (State Persistence & Retention) ───────────
        if (subCmd === "lifecycle") {
            const html = renderLifecycleTestHtml();
            try {
                const sent = await sendUI(sock, message.chat, {
                    title: "⏱️ Lifecycle & State Audit",
                    html,
                });
                scheduleDeletion(sent);
                return message.reply("⏱️ Kartu uji lifecycle & state persistence berhasil dikirim!");
            } catch (err) {
                return message.reply(`❌ Gagal mengirim kartu lifecycle: ${err.message}`);
            }
        }

        // ── DEFAULT FALLBACK: Help Menu ─────────────────────────────────────
        return message.reply(
            `╭━━━〔 🔬 *WEBVIEW TESTING COMMAND* 〕━━━\n` +
            `┃ *Penggunaan:* \`${prefix}wvtest <subcommand> [--keep]\`\n` +
            `┃\n` +
            `┃ *Daftar Subcommand:* \n` +
            `┃ 1. \`${prefix}wvtest suite\`\n` +
            `┃    Jalankan automated test matrix (50+ browser & async probes)\n` +
            `┃ 2. \`${prefix}wvtest probe <kb>\`\n` +
            `┃    Uji stansa presisi (misal: \`${prefix}wvtest probe 1024\`)\n` +
            `┃ 3. \`${prefix}wvtest probe range\`\n` +
            `┃    Kirim probe range kalibrasi (950KB - 1300KB)\n` +
            `┃ 4. \`${prefix}wvtest proto <case>\`\n` +
            `┃    Mutasi protobuf (\`botjid\`, \`multisection\`, \`trusted\`, \`context\`, \`quoted\`, \`expiration\`)\n` +
            `┃ 5. \`${prefix}wvtest form\`\n` +
            `┃    Uji form controls, soft keyboard viewport, dan file picker\n` +
            `┃ 6. \`${prefix}wvtest audio\`\n` +
            `┃    Uji mendalam Web Audio API vs HTML5 audio\n` +
            `┃ 7. \`${prefix}wvtest links\`\n` +
            `┃    Uji klik berbagai URI schemes (\`whatsapp://\`, \`tel:\`, dll)\n` +
            `┃ 8. \`${prefix}wvtest lifecycle\`\n` +
            `┃    Uji persistensi state saat scroll atau minimize\n` +
            `┃\n` +
            `┃ 💡 _Tambahkan flag \`--keep\` agar kartu tidak otomatis dihapus._\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        );
    },
};
