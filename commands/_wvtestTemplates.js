/**
 * Webview Testing Suite HTML & Payload Templates.
 *
 * Companion module to commands/wvtest.js.
 * Encapsulates all HTML document generators, client-side test runners,
 * and calibrated payload builders to keep the main command controller clean.
 *
 * (Prefixed with '_' so commands/_registry.js automatically ignores this file
 * during bot command registration).
 */

// ── Synthetic Audio Helper ───────────────────────────────────────────────────

/**
 * Generate a valid in-memory PCM mono WAV data URI without external dependencies.
 * @param {number} durationSec - Audio duration in seconds
 * @param {number} freq - Sine wave frequency in Hz
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {string} Base64 Data URI (data:audio/wav;base64,...)
 */
export function generateSineWavBase64(durationSec = 0.5, freq = 440, sampleRate = 8000) {
    const numSamples = Math.floor(durationSec * sampleRate);
    const dataSize = numSamples * 2; // 16-bit mono
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // audioFormat (1 for PCM)
    buffer.writeUInt16LE(1, 22);  // numChannels (1)
    buffer.writeUInt32LE(sampleRate, 24); // sampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // byteRate
    buffer.writeUInt16LE(2, 32);  // blockAlign
    buffer.writeUInt16LE(16, 34); // bitsPerSample
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin((2 * Math.PI * freq * i) / sampleRate);
        const intSample = Math.floor(sample * 32767);
        buffer.writeInt16LE(intSample, 44 + i * 2);
    }

    return "data:audio/wav;base64," + buffer.toString("base64");
}

// ── Calibrated Stanza Probe Generator ────────────────────────────────────────

/**
 * Construct an HTML probe whose Base64 unifiedResponse payload matches exact target bytes.
 * @param {number} targetKb - Target size in kilobytes
 * @returns {{ html: string, exactBytes: number, targetKb: number }}
 */
export function makeCalibratedProbeHtml(targetKb) {
    const targetBytes = targetKb * 1024;
    const responseId = "00000000-0000-0000-0000-000000000000";

    const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>Probe ${targetKb}KB</title><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#0d0f13;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;text-align:center}.card{background:#141619;border:1px solid #1e2028;border-radius:12px;padding:20px;margin:auto;max-width:380px}h2{color:#4ade80;margin:0 0 10px;font-size:20px}.val{font-size:28px;font-weight:700;color:#fff;margin:8px 0}.sub{font-size:12px;color:#a1a1aa;line-height:1.5}</style></head><body><div class="card"><h2>🔬 Stanza Size Probe</h2><div class="val">${targetKb} KB</div><p class="sub">Exact Stanza Bytes: <b>${targetBytes.toLocaleString()} B</b></p><p class="sub" style="color:#22c55e;margin-top:14px">✓ Jika card ini berhasil muncul di layar Anda, berarti stansa ${targetKb} KB lolos dari WhatsApp router.</p></div><!-- `;
    const foot = ` --></body></html>`;

    // Measure base payload length to calculate exact padding diff
    const baseJson = JSON.stringify({
        response_id: responseId,
        sections: [
            {
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: head + foot,
                        trusted_sources: [],
                    },
                    __typename: "GenAISingleLayoutViewModel",
                },
            },
        ],
    });

    const currentBase64Len = Buffer.from(baseJson).toString("base64").length;
    const diff = targetBytes - currentBase64Len;
    const rawDiff = Math.max(0, Math.floor((diff * 3) / 4));
    const filler = "Z".repeat(rawDiff);
    const finalHtml = head + filler + foot;

    return {
        html: finalHtml,
        exactBytes: targetBytes,
        targetKb,
    };
}

// ── HTML Templates ──────────────────────────────────────────────────────────

/**
 * Generate the in-webview automated diagnostic suite HTML document.
 * Enhanced with asynchronous real execution:
 * - Real IndexedDB read/write transaction
 * - Real WebAssembly bytecode compilation & execution
 * - Real outbound Fetch CORS & Localhost probe
 * - Real WebSocket handshake probe
 * - Deep Window host bridge scanner
 * - Media <video> & FontFace API checks
 */
export function renderDiagnosticSuiteHtml() {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Webview Diagnostics</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
html,body{width:100%;overflow-x:hidden;background:#0d0f13;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.4;font-size:13px}
.container{max-width:440px;margin:0 auto;padding:12px}
.header{padding:14px;background:#141619;border:1px solid #1e2028;border-radius:10px;margin-bottom:12px;text-align:center}
.header h1{font-size:16px;font-weight:700;color:#fff;margin-bottom:4px}
.header p{font-size:11px;color:#a1a1aa}
.badge-total{display:inline-block;padding:3px 8px;border-radius:12px;font-size:10px;font-weight:700;margin-top:6px;background:#1e2028;color:#38bdf8}

.card{background:#141619;border:1px solid #1e2028;border-radius:10px;padding:12px;margin-bottom:10px}
.card-title{font-size:12px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}

.item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1a1d24}
.item:last-child{border-bottom:none}
.item-label{font-size:12px;color:#d4d4d8;font-family:monospace}
.item-note{font-size:10px;color:#71717a;margin-top:2px;max-width:260px;word-break:break-word}

.status{padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;white-space:nowrap}
.pass{background:#14532d;color:#86efac}
.fail{background:#7f1d1d;color:#fca5a5}
.warn{background:#78350f;color:#fde047}
.info{background:#1e293b;color:#93c5fd}
.pending{background:#374151;color:#9ca3af}

.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.btn{background:#1e2028;color:#fff;border:1px solid #2a2d37;padding:10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;text-align:center}
.btn:active{background:#2a2d37}
.btn-primary{background:#2563eb;border-color:#3b82f6}
.btn-primary:active{background:#1d4ed8}

textarea{width:100%;height:80px;background:#090b10;border:1px solid #1e2028;border-radius:6px;color:#a1a1aa;font-family:monospace;font-size:10px;padding:8px;resize:none;margin-top:8px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🔬 Webview Diagnostic Suite</h1>
    <p>Automated Empirical Capability & Sandbox Audit</p>
    <div id="summary-badge" class="badge-total">Menjalankan pengujian...</div>
  </div>

  <div class="card">
    <div class="card-title">📱 System & Environment</div>
    <div class="item">
      <div><div class="item-label">User Agent</div><div id="env-ua" class="item-note">...</div></div>
    </div>
    <div class="item">
      <div><div class="item-label">Screen & Viewport</div><div id="env-screen" class="item-note">...</div></div>
    </div>
    <div class="item">
      <div><div class="item-label">Hardware Concurrency / Memory</div><div id="env-hw" class="item-note">...</div></div>
    </div>
    <div class="item">
      <div><div class="item-label">Known Host Bridges</div><div id="env-bridges" class="item-note">...</div></div>
    </div>
    <div class="item">
      <div><div class="item-label">Deep Window Properties</div><div id="env-deep-props" class="item-note">...</div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">💾 Storage & State</div>
    <div id="tests-storage"></div>
  </div>

  <div class="card">
    <div class="card-title">🌐 Network & Communications</div>
    <div id="tests-network"></div>
  </div>

  <div class="card">
    <div class="card-title">⚙️ JS Execution & CSP</div>
    <div id="tests-csp"></div>
  </div>

  <div class="card">
    <div class="card-title">🎵 Media, Audio & Graphics</div>
    <div id="tests-media"></div>
  </div>

  <div class="card">
    <div class="card-title">📱 Device Sensors & OS APIs</div>
    <div id="tests-device"></div>
  </div>

  <div class="card">
    <div class="card-title">🎨 Modern CSS Layout</div>
    <div id="tests-css"></div>
  </div>

  <div class="card">
    <div class="card-title">📋 Export Hasil Pengujian</div>
    <p style="font-size:11px;color:#a1a1aa">Salin hasil ringkasan teks di bawah ini untuk didokumentasikan:</p>
    <textarea id="export-box" readonly>Mengumpulkan data pengujian...</textarea>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="copyResults()">📋 Salin Ringkasan</button>
      <button class="btn" onclick="runAllTests()">🔄 Jalankan Ulang</button>
    </div>
    <div class="btn-row" style="margin-top:6px">
      <button class="btn" onclick="testVibrate()">📳 Uji Getar (50ms)</button>
      <button class="btn" onclick="testBeep()">🔊 Uji Synth (440Hz)</button>
    </div>
  </div>
</div>

<script>
const results = [];

function recordTest(category, name, pass, detail, type = null) {
    const statusType = type || (pass ? 'pass' : 'fail');
    const existingIdx = results.findIndex(r => r.category === category && r.name === name);
    if (existingIdx >= 0) {
        results[existingIdx] = { category, name, pass, detail, statusType };
    } else {
        results.push({ category, name, pass, detail, statusType });
    }
    renderResults();
}

function renderResults() {
    const categories = {
        storage: document.getElementById('tests-storage'),
        network: document.getElementById('tests-network'),
        csp: document.getElementById('tests-csp'),
        media: document.getElementById('tests-media'),
        device: document.getElementById('tests-device'),
        css: document.getElementById('tests-css')
    };

    Object.values(categories).forEach(el => { if (el) el.innerHTML = ''; });

    let passCount = 0;
    let failCount = 0;

    results.forEach(t => {
        if (t.pass) passCount++; else failCount++;
        const target = categories[t.category];
        if (!target) return;

        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = \`
          <div>
            <div class="item-label">\${t.name}</div>
            <div class="item-note">\${t.detail || ''}</div>
          </div>
          <span class="status \${t.statusType}">\${t.pass ? '✓ PASS' : '✗ BLOCKED'}</span>
        \`;
        target.appendChild(row);
    });

    const badge = document.getElementById('summary-badge');
    if (badge) {
        badge.textContent = \`✓ \${passCount} Supported | ✗ \${failCount} Blocked\`;
    }

    const exportText = results.map(r => \`[\${r.pass ? 'PASS' : 'BLOCKED'}] \${r.category.toUpperCase()}: \${r.name} (\${r.detail || 'N/A'})\`).join('\\n');
    const ua = navigator.userAgent;
    const box = document.getElementById('export-box');
    if (box) {
        box.value = \`=== WEBVIEW DIAGNOSTIC REPORT ===\\nUA: \${ua}\\nScreen: \${screen.width}x\${screen.height} DPR:\${window.devicePixelRatio}\\nResults: \${passCount} Pass, \${failCount} Blocked\\n-------------------------------\\n\` + exportText;
    }
}

async function runAllTests() {
    results.length = 0;

    // ── 1. Environment ──────────────────────────────────────────────────────
    document.getElementById('env-ua').textContent = navigator.userAgent;
    document.getElementById('env-screen').textContent = \`\${screen.width}x\${screen.height} (Viewport: \${window.innerWidth}x\${window.innerHeight}, DPR: \${window.devicePixelRatio})\`;
    document.getElementById('env-hw').textContent = \`Cores: \${navigator.hardwareConcurrency || 'N/A'}, Mem: \${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'N/A'}\`;

    const bridges = ['Android', 'webkit', 'MetaAI', 'WhatsApp', 'ReactNativeWebView', 'chrome']
        .filter(b => typeof window[b] !== 'undefined');
    document.getElementById('env-bridges').textContent = bridges.length > 0 ? bridges.join(', ') : 'None detected (Standard Sandbox)';

    // Deep window properties inspection
    try {
        const standardProps = new Set([
            'window','self','document','name','location','customElements','history','locationbar','menubar',
            'personalbar','scrollbars','statusbar','toolbar','status','closed','frames','length','top',
            'opener','parent','frameElement','navigator','origin','external','screen','innerWidth','innerHeight',
            'scrollX','pageXOffset','scrollY','pageYOffset','visualViewport','screenX','screenY','outerWidth',
            'outerHeight','devicePixelRatio','clientInformation','screenLeft','screenTop','defaultStatus',
            'defaultstatus','styleMedia','onsearch','isSecureContext','onabort','onblur','oncancel','oncanplay',
            'oncanplaythrough','onchange','onclick','onclose','oncontextmenu','oncuechange','ondblclick',
            'ondrag','ondragend','ondragenter','ondragleave','ondragover','ondragstart','ondrop','ondurationchange',
            'onemptied','onended','onerror','onfocus','onformdata','oninput','oninvalid','onkeydown','onkeypress',
            'onkeyup','onload','onloadeddata','onloadedmetadata','onloadstart','onmousedown','onmouseenter',
            'onmouseleave','onmousemove','onmouseout','onmouseover','onmouseup','onmousewheel','onpause',
            'onplay','onplaying','onprogress','onratechange','onreset','onresize','onscroll','onseeked',
            'onseeking','onselect','onstalled','onsubmit','onsuspend','ontimeupdate','ontoggle','onvolumechange',
            'onwaiting','onwheel','onafterprint','onbeforeprint','onbeforeunload','onhashchange','onlanguagechange',
            'onmessage','onmessageerror','onoffline','ononline','onpagehide','onpageshow','onpopstate','onrejectionhandled',
            'onstorage','onunhandledrejection','onunload','performance','stop','open','alert','confirm','prompt',
            'print','postMessage','captureEvents','releaseEvents','getComputedStyle','matchMedia','moveTo','moveBy',
            'resizeTo','resizeBy','getSelection','find','createImageBitmap','scroll','scrollTo','scrollBy','focus',
            'blur','close','crypto','indexedDB','sessionStorage','localStorage','speechSynthesis','webkitStorageInfo',
            'webkitRequestFileSystem','webkitResolveLocalFileSystemURL','atob','btoa','setTimeout','clearTimeout',
            'setInterval','clearInterval','queueMicrotask','requestAnimationFrame','cancelAnimationFrame',
            'requestIdleCallback','cancelIdleCallback','fetch','caches','crossOriginIsolated','scheduler'
        ]);
        const customProps = Object.getOwnPropertyNames(window).filter(p => !standardProps.has(p) && !p.startsWith('on') && !p.startsWith('WebKit') && !p.startsWith('test') && !p.startsWith('run') && !p.startsWith('render') && !p.startsWith('copy') && !p.startsWith('record') && !p.startsWith('results'));
        document.getElementById('env-deep-props').textContent = customProps.length > 0 ? customProps.slice(0, 8).join(', ') : 'No custom global objects detected';
    } catch (e) {
        document.getElementById('env-deep-props').textContent = 'Inspection blocked: ' + e.message;
    }

    // ── 2. Storage & State ──────────────────────────────────────────────────
    try {
        localStorage.setItem('__wv', '1');
        localStorage.removeItem('__wv');
        recordTest('storage', 'localStorage', true, 'Available');
    } catch (e) {
        recordTest('storage', 'localStorage', false, e.name || 'Blocked');
    }

    try {
        sessionStorage.setItem('__wv', '1');
        sessionStorage.removeItem('__wv');
        recordTest('storage', 'sessionStorage', true, 'Available');
    } catch (e) {
        recordTest('storage', 'sessionStorage', false, e.name || 'Blocked');
    }

    recordTest('storage', 'IndexedDB API Factory', 'indexedDB' in window && !!window.indexedDB, window.indexedDB ? 'Factory present' : 'Missing');

    // Real IndexedDB Transaction Probe
    try {
        if ('indexedDB' in window && window.indexedDB) {
            recordTest('storage', 'IndexedDB Transaction', false, 'Testing read/write...', 'pending');
            const idbReq = indexedDB.open('__wvt_probe_db', 1);
            idbReq.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('probe')) {
                    db.createObjectStore('probe', { keyPath: 'id' });
                }
            };
            idbReq.onsuccess = (e) => {
                try {
                    const db = e.target.result;
                    const tx = db.transaction('probe', 'readwrite');
                    const store = tx.objectStore('probe');
                    store.put({ id: 1, val: 'ok' });
                    tx.oncomplete = () => {
                        const readTx = db.transaction('probe', 'readonly');
                        const readReq = readTx.objectStore('probe').get(1);
                        readReq.onsuccess = () => {
                            if (readReq.result?.val === 'ok') {
                                recordTest('storage', 'IndexedDB Transaction', true, 'Full Read/Write operational');
                            } else {
                                recordTest('storage', 'IndexedDB Transaction', false, 'Read mismatch');
                            }
                            db.close();
                        };
                        readReq.onerror = () => {
                            recordTest('storage', 'IndexedDB Transaction', false, 'Read error');
                            db.close();
                        };
                    };
                    tx.onerror = (txErr) => {
                        recordTest('storage', 'IndexedDB Transaction', false, 'Write tx failed: ' + (txErr.target?.error?.message || 'Error'));
                        db.close();
                    };
                } catch (txEx) {
                    recordTest('storage', 'IndexedDB Transaction', false, 'Tx exception: ' + txEx.message);
                }
            };
            idbReq.onerror = (e) => {
                recordTest('storage', 'IndexedDB Transaction', false, 'open() error: ' + (e.target?.error?.message || e.target?.error?.name || 'Blocked'));
            };
            idbReq.onblocked = () => {
                recordTest('storage', 'IndexedDB Transaction', false, 'open() blocked event');
            };
        } else {
            recordTest('storage', 'IndexedDB Transaction', false, 'indexedDB not supported');
        }
    } catch (e) {
        recordTest('storage', 'IndexedDB Transaction', false, e.name + ': ' + e.message);
    }

    try {
        document.cookie = '__wvt=1; SameSite=Lax';
        const hasCookie = document.cookie.includes('__wvt=1');
        recordTest('storage', 'document.cookie', hasCookie, hasCookie ? 'Read/Write ok' : 'Blocked');
    } catch (e) {
        recordTest('storage', 'document.cookie', false, e.name || 'Blocked');
    }

    recordTest('storage', 'Cache Storage', 'caches' in window, 'caches' in window ? 'API Present' : 'Missing');
    recordTest('storage', 'OPFS (Origin FileSystem)', 'storage' in navigator && 'getDirectory' in navigator.storage, 'navigator.storage.getDirectory');

    // ── 3. Network & Communications ─────────────────────────────────────────
    recordTest('network', 'fetch API (typeof)', typeof fetch === 'function', 'typeof fetch');

    // Real Outbound Fetch Probe (CORS)
    try {
        recordTest('network', 'Fetch CORS (Public API)', false, 'Connecting to httpbin.org...', 'pending');
        const fetchCtrl = new AbortController();
        const fetchTimer = setTimeout(() => fetchCtrl.abort(), 2500);
        fetch('https://httpbin.org/get', { signal: fetchCtrl.signal, mode: 'cors' })
            .then(res => {
                clearTimeout(fetchTimer);
                recordTest('network', 'Fetch CORS (Public API)', res.ok, \`HTTP \${res.status} (CORS Allowed!)\`);
            })
            .catch(err => {
                clearTimeout(fetchTimer);
                const msg = err.name === 'AbortError' ? 'Timeout (2.5s)' : err.message;
                recordTest('network', 'Fetch CORS (Public API)', false, msg);
            });
    } catch (e) {
        recordTest('network', 'Fetch CORS (Public API)', false, e.message);
    }

    // Real Localhost Fetch Probe (SSRF/Cleartext)
    try {
        recordTest('network', 'Fetch Localhost (127.0.0.1)', false, 'Probing 127.0.0.1:8080...', 'pending');
        const localCtrl = new AbortController();
        const localTimer = setTimeout(() => localCtrl.abort(), 1500);
        fetch('http://127.0.0.1:8080', { signal: localCtrl.signal, mode: 'no-cors' })
            .then(() => {
                clearTimeout(localTimer);
                recordTest('network', 'Fetch Localhost (127.0.0.1)', true, 'Cleartext request dispatched');
            })
            .catch(err => {
                clearTimeout(localTimer);
                const msg = err.name === 'AbortError' ? 'Timeout (1.5s)' : err.message;
                recordTest('network', 'Fetch Localhost (127.0.0.1)', false, msg);
            });
    } catch (e) {
        recordTest('network', 'Fetch Localhost (127.0.0.1)', false, e.message);
    }

    recordTest('network', 'WebSocket (typeof)', typeof WebSocket === 'function', 'typeof WebSocket');

    // Real WebSocket Handshake Probe
    try {
        if (typeof WebSocket === 'function') {
            recordTest('network', 'WebSocket Handshake', false, 'Initiating wss handshake...', 'pending');
            const ws = new WebSocket('wss://echo.websocket.events');
            const wsTimer = setTimeout(() => {
                try { ws.close(); } catch(e){}
                recordTest('network', 'WebSocket Handshake', false, 'Timeout (2.5s)');
            }, 2500);

            ws.onopen = () => {
                clearTimeout(wsTimer);
                recordTest('network', 'WebSocket Handshake', true, 'Handshake succeeded (Live WS!)');
                try { ws.close(); } catch(e){}
            };
            ws.onerror = (err) => {
                clearTimeout(wsTimer);
                recordTest('network', 'WebSocket Handshake', false, 'Handshake rejected / blocked');
            };
        } else {
            recordTest('network', 'WebSocket Handshake', false, 'WebSocket not supported');
        }
    } catch (e) {
        recordTest('network', 'WebSocket Handshake', false, e.message);
    }

    recordTest('network', 'XMLHttpRequest', typeof XMLHttpRequest === 'function', 'typeof XHR');
    recordTest('network', 'EventSource (SSE)', typeof EventSource === 'function', 'typeof EventSource');
    recordTest('network', 'WebRTC (RTCPeerConnection)', typeof RTCPeerConnection === 'function' || typeof webkitRTCPeerConnection === 'function', 'RTCPeerConnection');
    recordTest('network', 'BroadcastChannel', typeof BroadcastChannel === 'function', 'BroadcastChannel');

    // ── 4. JS Execution & CSP ───────────────────────────────────────────────
    try {
        const ev = eval('1 + 1');
        recordTest('csp', 'eval()', ev === 2, 'Allowed (No CSP eval restriction)');
    } catch (e) {
        recordTest('csp', 'eval()', false, e.message || 'CSP Blocked');
    }

    try {
        const fn = new Function('return 1+1')();
        recordTest('csp', 'new Function()', fn === 2, 'Allowed');
    } catch (e) {
        recordTest('csp', 'new Function()', false, e.message || 'CSP Blocked');
    }

    recordTest('csp', 'WebAssembly Object', typeof WebAssembly === 'object', typeof WebAssembly);

    // Real WebAssembly Execution Probe (Instantiate 43-byte add(a, b) function)
    try {
        if (typeof WebAssembly === 'object' && WebAssembly.instantiate) {
            const wasmBinary = new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
                0x03, 0x02, 0x01, 0x00,
                0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
                0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b
            ]);
            WebAssembly.instantiate(wasmBinary)
                .then(wasmRes => {
                    const addRes = wasmRes.instance.exports.add(2, 3);
                    if (addRes === 5) {
                        recordTest('csp', 'WebAssembly Execution', true, 'Compiled & executed: add(2,3)=5');
                    } else {
                        recordTest('csp', 'WebAssembly Execution', false, 'Computation mismatch');
                    }
                })
                .catch(wasmErr => {
                    recordTest('csp', 'WebAssembly Execution', false, wasmErr.message || 'WASM instantiation blocked');
                });
        } else {
            recordTest('csp', 'WebAssembly Execution', false, 'WebAssembly API not available');
        }
    } catch (e) {
        recordTest('csp', 'WebAssembly Execution', false, e.message);
    }

    recordTest('csp', 'crypto.subtle', typeof crypto === 'object' && !!crypto.subtle, 'Web Crypto API');

    try {
        const workerBlob = new Blob(['postMessage("ok");'], { type: 'text/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const w = new Worker(workerUrl);
        w.terminate();
        recordTest('csp', 'Blob Worker', true, 'Worker spawned');
    } catch (e) {
        recordTest('csp', 'Blob Worker', false, e.name || 'Blocked');
    }

    // ── 5. Media & Audio ────────────────────────────────────────────────────
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    recordTest('media', 'Web Audio API', !!AudioCtx, AudioCtx ? 'AudioContext present' : 'Missing');

    try {
        const audioEl = document.createElement('audio');
        const canAac = audioEl.canPlayType('audio/mp4; codecs="mp4a.40.2"');
        recordTest('media', 'HTML5 <audio> Element', !!canAac, \`canPlay: "\${canAac || 'no'}"\`);
    } catch (e) {
        recordTest('media', 'HTML5 <audio> Element', false, e.message);
    }

    try {
        const videoEl = document.createElement('video');
        const canMp4 = videoEl.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
        recordTest('media', 'HTML5 <video> Element', !!canMp4, \`canPlay: "\${canMp4 || 'no'}"\`);
    } catch (e) {
        recordTest('media', 'HTML5 <video> Element', false, e.message);
    }

    recordTest('media', 'Canvas 2D', !!document.createElement('canvas').getContext('2d'), 'getContext("2d")');
    recordTest('media', 'WebGL 1', !!document.createElement('canvas').getContext('webgl'), 'getContext("webgl")');
    recordTest('media', 'WebGL 2', !!document.createElement('canvas').getContext('webgl2'), 'getContext("webgl2")');
    recordTest('media', 'WebGPU', 'gpu' in navigator, 'navigator.gpu');
    recordTest('media', 'Speech Synthesis', 'speechSynthesis' in window, 'window.speechSynthesis');
    recordTest('media', 'FontFace API', 'fonts' in document && typeof FontFace === 'function', 'document.fonts / FontFace');

    // ── 6. Device & Sensors ─────────────────────────────────────────────────
    recordTest('device', 'navigator.vibrate', 'vibrate' in navigator, 'navigator.vibrate');
    recordTest('device', 'Clipboard API', 'clipboard' in navigator && !!navigator.clipboard.writeText, 'navigator.clipboard.writeText');
    recordTest('device', 'execCommand(copy)', document.queryCommandSupported && document.queryCommandSupported('copy'), 'queryCommandSupported');
    recordTest('device', 'Geolocation', 'geolocation' in navigator, 'navigator.geolocation');
    recordTest('device', 'Screen Wake Lock', 'wakeLock' in navigator, 'navigator.wakeLock');
    recordTest('device', 'Device Orientation', 'DeviceOrientationEvent' in window, 'DeviceOrientationEvent');
    recordTest('device', 'Fullscreen API', 'requestFullscreen' in document.documentElement, 'requestFullscreen');

    // ── 7. Modern CSS Layout ────────────────────────────────────────────────
    if (window.CSS && CSS.supports) {
        recordTest('css', 'backdrop-filter', CSS.supports('backdrop-filter', 'blur(5px)'), 'CSS.supports');
        recordTest('css', 'Container Queries', CSS.supports('container-type', 'inline-size'), 'container-type');
        recordTest('css', ':has() Selector', CSS.supports('selector(:has(*))'), 'selector(:has(*))');
        recordTest('css', 'oklch() Colors', CSS.supports('color', 'oklch(0.5 0.2 180)'), 'oklch()');
        recordTest('css', 'CSS Subgrid', CSS.supports('grid-template-rows', 'subgrid'), 'subgrid');
    }

    renderResults();
}

function testVibrate() {
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
        alert('Mengirim sinyal getar 50ms!');
    } else {
        alert('navigator.vibrate tidak didukung.');
    }
}

function testBeep() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return alert('AudioContext tidak tersedia');
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        alert('Synth Error: ' + e.message);
    }
}

function copyResults() {
    const box = document.getElementById('export-box');
    if (!box) return;
    box.select();
    try {
        document.execCommand('copy');
        alert('✓ Ringkasan hasil berhasil disalin!');
    } catch (e) {
        alert('Silakan salin teks langsung dari kotak textarea di atas.');
    }
}

window.addEventListener('DOMContentLoaded', runAllTests);
</script>
</body>
</html>`;
}

/**
 * Generate interactive form & keyboard audit HTML.
 * Tests soft keyboard behavior, visual viewport resize, select dialogs, and file picker.
 */
export function renderFormsTestHtml() {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Form & Input Audit</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
body{background:#0d0f13;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:14px;line-height:1.4;font-size:13px}
.card{background:#141619;border:1px solid #1e2028;border-radius:12px;padding:16px;max-width:420px;margin:auto}
h2{font-size:16px;color:#fff;margin-bottom:6px}
p{font-size:11px;color:#a1a1aa;margin-bottom:12px}

.viewport-box{background:#090b10;border:1px solid #2a2d37;border-radius:8px;padding:10px;margin-bottom:14px;font-family:monospace;font-size:11px}
.viewport-title{font-size:10px;color:#38bdf8;font-weight:700;text-transform:uppercase;margin-bottom:4px}
.viewport-val{color:#4ade80;font-weight:700}

.field{margin-bottom:12px}
.label{display:block;font-size:11px;font-weight:600;color:#d4d4d8;margin-bottom:4px}
.input,textarea,select{width:100%;padding:10px 12px;background:#18191f;border:1px solid #2a2d37;border-radius:6px;color:#fff;font-size:13px;font-family:inherit;outline:none}
.input:focus,textarea:focus,select:focus{border-color:#38bdf8}
textarea{resize:vertical;min-height:60px}

.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.file-info{font-size:11px;color:#38bdf8;margin-top:4px;word-break:break-all}
</style>
</head>
<body>
<div class="card">
  <h2>📝 Form Controls & Viewport Audit</h2>
  <p>Uji interaksi input teks, kemunculan soft keyboard, dan dialog pemilih berkas/kamera.</p>

  <div class="viewport-box">
    <div class="viewport-title">📱 Live Visual Viewport Watcher</div>
    <div>Window Inner: <span id="win-dim" class="viewport-val">-</span></div>
    <div>Visual Viewport: <span id="vv-dim" class="viewport-val">-</span></div>
    <div>Keyboard State: <span id="kb-state" class="viewport-val" style="color:#fde047">Belum terdeteksi</span></div>
  </div>

  <div class="field">
    <label class="label">1. Text Input (Fokus untuk memunculkan soft keyboard)</label>
    <input type="text" class="input" placeholder="Ketik sesuatu di sini...">
  </div>

  <div class="field">
    <label class="label">2. Multiline Textarea</label>
    <textarea placeholder="Tulis paragraf teks..."></textarea>
  </div>

  <div class="row">
    <div class="field">
      <label class="label">3. Select Dropdown</label>
      <select>
        <option>Pilihan Alpha</option>
        <option>Pilihan Beta</option>
        <option>Pilihan Gamma</option>
      </select>
    </div>
    <div class="field">
      <label class="label">4. Date Picker</label>
      <input type="date" class="input">
    </div>
  </div>

  <div class="row">
    <div class="field">
      <label class="label">5. Color Picker</label>
      <input type="color" class="input" value="#38bdf8" style="padding:4px;height:42px">
    </div>
    <div class="field">
      <label class="label">6. Range Slider</label>
      <input type="range" class="input" min="0" max="100" value="50" style="padding:0">
    </div>
  </div>

  <div class="field">
    <label class="label">7. File Chooser & Camera (<input type="file">)</label>
    <input type="file" id="file-input" class="input" accept="image/*" style="padding:8px">
    <div id="file-result" class="file-info">Belum ada file dipilih</div>
  </div>
</div>

<script>
function updateViewportInfo() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    document.getElementById('win-dim').textContent = winW + ' x ' + winH + ' px';

    if (window.visualViewport) {
        const vvW = Math.round(window.visualViewport.width);
        const vvH = Math.round(window.visualViewport.height);
        document.getElementById('vv-dim').textContent = vvW + ' x ' + vvH + ' px (Scale: ' + window.visualViewport.scale.toFixed(2) + ')';

        const kbEl = document.getElementById('kb-state');
        if (vvH < winH * 0.75) {
            kbEl.textContent = 'Keyboard Terbuka (Viewport menyusut ' + (winH - vvH) + 'px)';
            kbEl.style.color = '#4ade80';
        } else {
            kbEl.textContent = 'Keyboard Tertutup (Layar penuh)';
            kbEl.style.color = '#a1a1aa';
        }
    } else {
        document.getElementById('vv-dim').textContent = 'visualViewport API tidak tersedia';
    }
}

window.addEventListener('resize', updateViewportInfo);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportInfo);
    window.visualViewport.addEventListener('scroll', updateViewportInfo);
}
updateViewportInfo();

const fileInput = document.getElementById('file-input');
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        const resEl = document.getElementById('file-result');
        if (file) {
            resEl.textContent = '✓ Berhasil memilih file: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB, ' + (file.type || 'unknown type') + ')';
            resEl.style.color = '#4ade80';
        } else {
            resEl.textContent = 'Tidak ada file yang dipilih';
            resEl.style.color = '#ef4444';
        }
    });
}
</script>
</body>
</html>`;
}

/**
 * Generate URI scheme & link interception test card HTML.
 */
export function renderLinksTestHtml() {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>URI Scheme Interception</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
body{background:#0d0f13;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:16px;line-height:1.5}
.card{background:#141619;border:1px solid #1e2028;border-radius:12px;padding:16px;max-width:400px;margin:auto}
h2{font-size:16px;color:#fff;margin-bottom:6px}
p{font-size:12px;color:#a1a1aa;margin-bottom:14px}
.grid{display:grid;gap:8px}
.link-btn{display:block;padding:10px 12px;background:#1e2028;border:1px solid #2a2d37;border-radius:6px;color:#38bdf8;text-decoration:none;font-size:12px;font-family:monospace;text-align:center}
.link-btn:active{background:#2a2d37}
.chip{background:#18191f;border:1px dashed #2a2d37;padding:10px;border-radius:6px;font-size:11px;color:#d4d4d8;user-select:all;margin-top:10px}
</style>
</head>
<body>
<div class="card">
  <h2>🔗 URI Scheme & Interception Audit</h2>
  <p>Ketuk masing-masing link untuk mengamati apakah WhatsApp mengizinkan, memblokir, atau membuka aplikasi eksternal:</p>
  <div class="grid">
    <a href="https://google.com" class="link-btn">https://google.com (Web)</a>
    <a href="whatsapp://send?text=Hello" class="link-btn">whatsapp://send (Internal Scheme)</a>
    <a href="https://wa.me/6287825136146" class="link-btn">https://wa.me/ (Shortlink)</a>
    <a href="tel:+6281234567890" class="link-btn">tel:+6281234567890 (Dialer)</a>
    <a href="mailto:bot@example.com" class="link-btn">mailto:bot@example.com (Email)</a>
    <a href="intent://#Intent;scheme=https;package=com.android.chrome;end" class="link-btn">intent:// (Android Intent)</a>
    <a href="market://details?id=com.whatsapp" class="link-btn">market:// (Play Store)</a>
    <a href="about:blank#anchor" class="link-btn">about:blank#anchor (Relative)</a>
  </div>

  <div class="chip">
    💡 <b>Pseudo-Button Pattern:</b><br>
    Tahan lama (long-press) link di bawah untuk menguji apakah teks & parameter otomatis ter-copy ke chat bar:
    <div style="margin-top:8px">
      <a href="probe 1024" class="link-btn" style="color:#4ade80">!wvtest probe 1024</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Generate audio playback and decoding sandbox test HTML.
 */
export function renderAudioTestHtml() {
    const syntheticWavDataUri = generateSineWavBase64(0.5, 440, 8000);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Audio Sandbox Probe</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
body{background:#0d0f13;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:16px;line-height:1.5}
.card{background:#141619;border:1px solid #1e2028;border-radius:12px;padding:16px;max-width:420px;margin:auto}
h2{font-size:16px;color:#fff;margin-bottom:6px}
p{font-size:12px;color:#a1a1aa;margin-bottom:12px}
.section{background:#18191f;border:1px solid #1e2028;border-radius:8px;padding:12px;margin-bottom:12px}
.section-title{font-size:12px;font-weight:700;color:#38bdf8;margin-bottom:8px}
.btn{background:#1e2028;color:#fff;border:1px solid #2a2d37;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-right:6px;margin-bottom:6px}
.btn:active{background:#2a2d37}
.log{background:#090b10;border:1px solid #1e2028;border-radius:6px;padding:8px;font-family:monospace;font-size:11px;color:#4ade80;min-height:50px;max-height:100px;overflow-y:auto;margin-top:8px}
</style>
</head>
<body>
<div class="card">
  <h2>🎵 Audio & Media Sandbox Audit</h2>
  <p>Menguji isolasi hardware decoding audio dan Web Audio API di webview WhatsApp.</p>

  <div class="section">
    <div class="section-title">1. Web Audio API Oscillator (Synthesized)</div>
    <button class="btn" onclick="playTone(440)">440 Hz (A4)</button>
    <button class="btn" onclick="playTone(523.25)">523 Hz (C5)</button>
    <button class="btn" onclick="playTone(659.25)">659 Hz (E5)</button>
    <div id="osc-log" class="log">Status: Menunggu interaksi...</div>
  </div>

  <div class="section">
    <div class="section-title">2. HTML5 &lt;audio&gt; Element (Base64 WAV)</div>
    <audio id="test-audio" src="${syntheticWavDataUri}" controls style="width:100%;margin-bottom:8px"></audio>
    <button class="btn" onclick="triggerAudioPlay()">▶ Play via Script</button>
    <div id="audio-log" class="log">Audio Element State: Idle</div>
  </div>

  <div class="section">
    <div class="section-title">3. Web Audio decodeAudioData (ArrayBuffer)</div>
    <button class="btn" onclick="testDecodeAudioData()">Decode & Play In-Memory WAV</button>
    <div id="decode-log" class="log">Decode status: Idle</div>
  </div>
</div>

<script>
function log(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerHTML += '<div>> ' + text + '</div>';
}

function playTone(freq) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        log('osc-log', 'Tone ' + freq + 'Hz di-trigger (ctx: ' + ctx.state + ')');
    } catch (e) {
        log('osc-log', 'ERROR: ' + e.message);
    }
}

const audioEl = document.getElementById('test-audio');
if (audioEl) {
    audioEl.addEventListener('play', () => log('audio-log', 'Event: play fired'));
    audioEl.addEventListener('playing', () => log('audio-log', 'Event: playing (Audio hardware running!)'));
    audioEl.addEventListener('pause', () => log('audio-log', 'Event: pause'));
    audioEl.addEventListener('error', (e) => log('audio-log', 'Event: ERROR code=' + (audioEl.error ? audioEl.error.code : 'unknown')));
}

function triggerAudioPlay() {
    if (!audioEl) return;
    audioEl.play().then(() => {
        log('audio-log', 'Promise resolved: audio.play() succeeded');
    }).catch(err => {
        log('audio-log', 'Rejected: ' + err.name + ' - ' + err.message);
    });
}

function testDecodeAudioData() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const base64Data = "${syntheticWavDataUri}".split(',')[1];
        const binary = atob(base64Data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

        ctx.decodeAudioData(bytes.buffer, (buffer) => {
            log('decode-log', '✓ Decoded ' + buffer.duration.toFixed(2) + 's buffer!');
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);
            src.start();
            log('decode-log', 'Source started (ctx: ' + ctx.state + ')');
        }, (err) => {
            log('decode-log', 'Decode error: ' + err);
        });
    } catch (e) {
        log('decode-log', 'ERROR: ' + e.message);
    }
}
</script>
</body>
</html>`;
}

/**
 * Generate lifecycle and state retention test HTML.
 */
export function renderLifecycleTestHtml() {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Lifecycle Audit</title>
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
body{background:#0d0f13;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:16px;text-align:center}
.card{background:#141619;border:1px solid #1e2028;border-radius:12px;padding:20px;max-width:380px;margin:auto}
h2{font-size:16px;color:#fff;margin-bottom:8px}
.count{font-size:42px;font-weight:700;color:#38bdf8;margin:12px 0}
.btn-row{display:flex;justify-content:center;gap:10px;margin-bottom:12px}
.btn{background:#1e2028;border:1px solid #2a2d37;color:#fff;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer}
.btn:active{background:#2a2d37}
.guide{background:#18191f;border:1px solid #1e2028;border-radius:8px;padding:12px;font-size:11px;color:#a1a1aa;text-align:left;line-height:1.6}
</style>
</head>
<body>
<div class="card">
  <h2>⏱️ Lifecycle & Retention Audit</h2>
  <p style="font-size:11px;color:#71717a">Uji apakah timer & state JavaScript tetap hidup saat scroll atau minimize.</p>

  <div id="counter" class="count">0</div>
  <div style="font-size:11px;color:#a1a1aa;margin-bottom:12px">Total Detik Aktif (Interval Ticks)</div>

  <div class="btn-row">
    <button class="btn" onclick="changeManual(-1)">- 1</button>
    <span id="manual-val" style="font-size:18px;font-weight:700;padding:6px 12px;color:#4ade80">0</span>
    <button class="btn" onclick="changeManual(1)">+ 1</button>
  </div>

  <div class="guide">
    <b>Panduan Pengujian:</b><br>
    1. Perhatikan angka counter detik yang sedang berjalan di atas.<br>
    2. Ubah angka tombol manual (+1 / -1).<br>
    3. Scroll chat WhatsApp ke atas sejauh 15-20 pesan.<br>
    4. Scroll kembali ke pesan webview ini:<br>
       → <i>Apakah counter berlanjut atau mengulang dari 0?</i><br>
       → <i>Apakah nilai manual tersimpan atau kembali 0?</i><br>
    5. Minimize aplikasi WhatsApp selama 5 detik lalu buka kembali.
  </div>
</div>

<script>
let ticks = 0;
let manual = 0;

setInterval(() => {
    ticks++;
    const el = document.getElementById('counter');
    if (el) el.textContent = ticks;
}, 1000);

function changeManual(delta) {
    manual += delta;
    const el = document.getElementById('manual-val');
    if (el) el.textContent = manual;
}
</script>
</body>
</html>`;
}
