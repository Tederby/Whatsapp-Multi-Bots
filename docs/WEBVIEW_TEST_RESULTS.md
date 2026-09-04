# Empirical Webview Payload Audit Report & Benchmark Log

> **Document Type:** Empirical Test Benchmark & Protocol Audit Artifact  
> **Target Specification:** [`docs/WEBVIEW_PAYLOAD.md`](WEBVIEW_PAYLOAD.md)  
> **Benchmark Date:** September 4, 2026  
> **Status:** Completed & Empirically Verified  

---

## 1. Executive Summary & Environment Profile

This document records the empirical trial-and-error test results conducted on WhatsApp's native in-app webview container (`GenAIaeacdsnwHtmlPrimitive`). All tests were executed live inside an active WhatsApp chat thread using the automated diagnostic suite, calibrated size probes, form watchers, and envelope mutators provided by [`commands/wvtest.js`](../commands/wvtest.js) and [`commands/_wvtestTemplates.js`](../commands/_wvtestTemplates.js).

### Test Environment Profile
- **Device Model:** Xiaomi Redmi (`M2003J15SC`)
- **OS Version:** Android 12 (Build: `SP1A.210812.016`)
- **WebView Engine:** Chrome WebView `151.0.7922.199` (WebKit `537.36`)
- **Screen Resolution:** `393 x 851` CSS px (DPR: `2.75`), Webview Client Rect: `299 x 610` px
- **Overall Capability Score:** **25 Supported (`PASS`)**, **18 Blocked (`BLOCKED`)** (43 total verified checks)

### Key Empirical Discoveries
1. **Air-Gapped Network Sandbox:** While JavaScript constructors (`fetch`, `WebSocket`, `XMLHttpRequest`) exist in `window`, real runtime network execution is **strictly blocked**:
   - Outbound `fetch('https://httpbin.org/get')` rejects with `TypeError: Failed to fetch`.
   - Localhost / SSRF probe `fetch('http://127.0.0.1:8080')` rejects with `TypeError: Failed to fetch`.
   - Outbound `new WebSocket('wss://...')` is rejected during handshake (`Handshake rejected / blocked`).
   - The webview container is an **entirely air-gapped, offline sandbox**.
2. **IndexedDB Execution Denied:** Although `window.indexedDB` factory exists, calling `indexedDB.open()` immediately throws `SecurityError: Failed to execute 'open' on 'IDBFactory': access to the Indexed Database API is denied in this context.` due to the opaque `about:blank` sandbox origin. **All client-side UI state MUST reside in JavaScript memory variables**.
3. **WebAssembly Instantiation Blocked by CSP:** Although `typeof WebAssembly === 'object'`, calling `WebAssembly.instantiate()` or `WebAssembly.compile()` throws a CSP violation: `Compiling or instantiating WebAssembly module violates the following Content Security policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'unsafe-inline'`. WASM cannot execute without `'wasm-unsafe-eval'`.
4. **Native Reply Context Supported (`quotedMessage`):** Protobuf envelope mutation confirmed that setting `contextInfo.quotedMessage`, `contextInfo.stanzaId`, and `contextInfo.participant` renders a **clean native reply bubble** quoting the user's trigger message directly above the webview card.
5. **Native Form Controls Operational:**
   - Dropdown `<select>` successfully triggers native Android selection dialogs.
   - Date picker `<input type="date">` successfully opens the native Android date calendar picker.
   - Color picker `<input type="color">` opens the native Android palette dialog with HSV sliders.
   - Soft keyboard pops up normally on text input focus, pushing the webview card downward to the chat bar boundary without covering content.
6. **File Chooser Inert (`<input type="file">` Blocked):** Tapping `<input type="file">` produces zero response. WhatsApp's Android `WebChromeClient` does **not** implement `onShowFileChooser()`. File picking and camera capture through HTML forms are completely impossible.
7. **Slider Touch Gesture Collision:** Dragging horizontal sliders (`<input type="range">`) can trigger WhatsApp's outer chat vertical scroll listener if the finger shifts vertically, pausing slider interaction.
8. **Dialog System (`alert()`):** Calling `window.alert()` does not render in-webview HTML; it opens a **native WhatsApp modal dialog** with an "OK" button. Device vibration (`navigator.vibrate`) triggers after the user dismisses the dialog.
9. **Exact Stanza Drop Ceiling (1350 KB):** WhatsApp delivery routers (`Chatd`/Edge) reliably deliver inline stanzas up to **1350 KB (~1.38 MB)**. Stanzas of **1400 KB** and above are **silently dropped** by the router despite transport-level socket ACK.
10. **Web Audio Decoding Breakthrough:** While HTML5 `<audio>` tags are quarantined (`NotSupportedError`), converting Base64 audio into an `ArrayBuffer` and decoding via Web Audio API (`ctx.decodeAudioData()`) **successfully plays in-memory audio** through an `AudioBufferSourceNode`.

---

## 2. Raw Diagnostic Suite Log (`!wvtest suite`)

*The following raw report was captured directly from the client webview test runner on September 4, 2026:*

```text
=== WEBVIEW DIAGNOSTIC REPORT ===
UA: Mozilla/5.0 (Linux; Android 12; M2003J15SC Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.199 Mobile Safari/537.36
Screen: 393x851 DPR:2.75
Results: 25 Pass, 18 Blocked
-------------------------------
[BLOCKED] STORAGE: localStorage (SecurityError)
[BLOCKED] STORAGE: sessionStorage (SecurityError)
[PASS] STORAGE: IndexedDB API Factory (Factory present)
[BLOCKED] STORAGE: IndexedDB Transaction (SecurityError: Failed to execute 'open' on 'IDBFactory': access to the Indexed Database API is denied in this context.)
[BLOCKED] STORAGE: document.cookie (SecurityError)
[BLOCKED] STORAGE: Cache Storage (Missing)
[BLOCKED] STORAGE: OPFS (Origin FileSystem) (navigator.storage.getDirectory)
[PASS] NETWORK: fetch API (typeof) (typeof fetch)
[BLOCKED] NETWORK: Fetch CORS (Public API) (Failed to fetch)
[BLOCKED] NETWORK: Fetch Localhost (127.0.0.1) (Failed to fetch)
[PASS] NETWORK: WebSocket (typeof) (typeof WebSocket)
[BLOCKED] NETWORK: WebSocket Handshake (Handshake rejected / blocked)
[PASS] NETWORK: XMLHttpRequest (typeof XHR)
[PASS] NETWORK: EventSource (SSE) (typeof EventSource)
[PASS] NETWORK: WebRTC (RTCPeerConnection) (RTCPeerConnection)
[PASS] NETWORK: BroadcastChannel (BroadcastChannel)
[BLOCKED] CSP: eval() (Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'unsafe-inline'.)
[BLOCKED] CSP: new Function() (Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'unsafe-inline'.)
[PASS] CSP: WebAssembly Object (object)
[BLOCKED] CSP: WebAssembly Execution (WebAssembly.instantiate(): Compiling or instantiating WebAssembly module violates the following Content Security policy directive because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'unsafe-inline'".)
[BLOCKED] CSP: crypto.subtle (Web Crypto API)
[PASS] CSP: Blob Worker (Worker spawned)
[PASS] MEDIA: Web Audio API (AudioContext present)
[PASS] MEDIA: HTML5 <audio> Element (canPlay: "probably")
[PASS] MEDIA: HTML5 <video> Element (canPlay: "probably")
[PASS] MEDIA: Canvas 2D (getContext("2d"))
[PASS] MEDIA: WebGL 1 (getContext("webgl"))
[PASS] MEDIA: WebGL 2 (getContext("webgl2"))
[BLOCKED] MEDIA: WebGPU (navigator.gpu)
[BLOCKED] MEDIA: Speech Synthesis (window.speechSynthesis)
[PASS] MEDIA: FontFace API (document.fonts / FontFace)
[PASS] DEVICE: navigator.vibrate (navigator.vibrate)
[BLOCKED] DEVICE: Clipboard API (navigator.clipboard.writeText)
[PASS] DEVICE: execCommand(copy) (queryCommandSupported)
[PASS] DEVICE: Geolocation (navigator.geolocation)
[BLOCKED] DEVICE: Screen Wake Lock (navigator.wakeLock)
[BLOCKED] DEVICE: Device Orientation (DeviceOrientationEvent)
[PASS] DEVICE: Fullscreen API (requestFullscreen)
[PASS] CSS: backdrop-filter (CSS.supports)
[PASS] CSS: Container Queries (container-type)
[PASS] CSS: :has() Selector (selector(:has(*)))
[PASS] CSS: oklch() Colors (oklch())
[PASS] CSS: CSS Subgrid (subgrid)
```

---

## 3. Calibrated Stanza Size Boundary Audit (`!wvtest probe range`)

Calibrated stanzas with exact byte matching were relayed sequentially across the 950 KB – 1400 KB range to pinpoint the WhatsApp delivery router cutoff:

| Probe Target | Exact Stanza Bytes | Client Delivery | Router Behavior & Delivery Notes |
|:---|:---:|:---:|:---|
| **950 KB** | 972,800 B | **DELIVERED** | Arrived cleanly. Instant mount. |
| **1000 KB** | 1,024,000 B | **DELIVERED** | Arrived cleanly. Zero frame drops. |
| **1024 KB** (1 MB) | 1,048,576 B | **DELIVERED** | Arrived cleanly. Normal rendering. |
| **1050 KB** | 1,075,200 B | **DELIVERED** | Arrived cleanly. Normal rendering. |
| **1100 KB** | 1,126,400 B | **DELIVERED** | Arrived cleanly. Slight viewport mount pause. |
| **1150 KB** | 1,177,600 B | **DELIVERED** | Arrived cleanly. Normal rendering. |
| **1200 KB** | 1,228,800 B | **DELIVERED** | Arrived cleanly. Normal rendering. |
| **1300 KB** | 1,331,200 B | **DELIVERED** | Arrived cleanly. Normal rendering. |
| **1350 KB** | 1,382,400 B | **DELIVERED** | **Highest confirmed delivery ceiling.** Measurable mount delay. |
| **1400 KB** | 1,433,600 B | **SILENT DROP** | **Message dropped by WhatsApp router.** Transport socket ACK received, but stanza never delivered to device. |

---

## 4. Protobuf Schema & Envelope Mutation Audit (`!wvtest proto`)

| Test Case | Parameter Modification | Result | Empirical Observation |
|:---|:---|:---:|:---|
| **`botjid`** | Set `forwardedAiBotMessageInfo.botJid` to bot's own phone number JID (`<number>@s.whatsapp.net`). | **PASS** | Payload renders normally. The router does not enforce the Meta AI bot JID (`867051314767696@bot`). |
| **`multisection`** | Array of 2 `GenAISingleLayoutViewModel` items in `sections: [...]`. | **PASS** | **Multi-card layout operational.** WhatsApp renders both HTML card sections stacked together in a single chat bubble. |
| **`trusted`** | Whitelisted `trusted_sources: ["https://upload.wikimedia.org"]` with remote `<img>`. | **FAIL** | Remote image failed to load. The `trusted_sources` array does **not** whitelist external network traffic. Sandbox cross-origin network blocks remain absolute. |
| **`context`** | Set `forwardOrigin: 1`, `forwardingScore: 0`, and `isForwarded: false` in `contextInfo`. | **PASS** | **"Forwarded" tag removed.** Webview card displays cleanly without any forwarding indicators above the header. |
| **`quoted`** | Attached `contextInfo.quotedMessage`, `contextInfo.stanzaId`, and `contextInfo.participant`. | **PASS** | **Native Reply Context Operational.** WhatsApp renders a native quote bubble directly above the webview card, linking it to the user's message. |
| **`expiration`** | Set `contextInfo.expiration = 86400` in `contextInfo`. | **IGNORED** | Card renders cleanly without error, but no disappearing timer/clock icon appears. Disappearing settings in WhatsApp are governed by chat-level policies, not stanza-level metadata. |

---

## 5. Mobile Form Controls & Soft Keyboard Audit (`!wvtest form`)

| Control / Interaction | Tested Behavior | Result | Empirical Findings & Technical Details |
|:---|:---|:---:|:---|
| **Soft Keyboard** | Tapped `<input type="text">` to focus and invoke Android keyboard. | **PASS** | Keyboard pops up smoothly. The webview card is pushed downward toward the chat composer bar boundary, remaining completely visible and un-obscured. |
| **Visual Viewport Watcher** | Monitored `window.visualViewport` dimensions before and during keyboard focus. | **INERT** | Initial dimensions measured `299 x 610 px`. When the keyboard opened, the `visualViewport` resize event did not fire and reported dimensions remained `299 x 610 px`. Avoid relying on `visualViewport.onresize` for keyboard detection inside WhatsApp webviews. |
| **Dropdown `<select>`** | Tapped `<select>` element with multiple `<option>` items. | **PASS** | Successfully opened the **native Android radio/selection dialog**. Selection updates DOM value correctly. |
| **Date Picker** | Tapped `<input type="date">`. | **PASS** | Successfully opened the **native Android date/calendar dialog**. Selection formats cleanly. |
| **Color Picker** | Tapped `<input type="color">`. | **PARTIAL** | Opened the native Android color picker dialog with presets and HSV sliders. The hue slider preview rendered white due to a WebView canvas glitch, but dragging the slider correctly shifted the saturation and output hex value. |
| **Range Slider** | Dragged horizontal `<input type="range" min="0" max="100">`. | **PASS (With Caveat)** | Slider slides smoothly. However, touch gestures that drift vertically collide with WhatsApp's outer chat view scroll listener. If the chat scrolls, slider dragging immediately disengages. |
| **File Picker / Camera** | Tapped `<input type="file" accept="image/*">`. | **BLOCKED** | **Zero response.** Tapping the button produces no action. WhatsApp's `WebChromeClient` leaves `onShowFileChooser()` unhandled. File uploads and camera capture via webview are completely blocked. |

---

## 6. In-Depth Audio & Media Sandbox Audit (`!wvtest audio`)

| Audio Pipeline | Tested API | Result | Observed Behavior & Error Details |
|:---|:---|:---:|:---|
| **Synthesizer** | Web Audio API Oscillator (`440Hz`, `523Hz`) | **PASS** | Generated tone successfully. When triggered repeatedly in rapid succession, sound occasionally cuts out due to audio focus throttling, but recovers after brief idle. |
| **HTML5 Media** | `<audio src="data:audio/wav;base64,...">` | **BLOCKED** | Play button is permanently greyed out. Programmatic `audio.play()` rejects immediately with: `NotSupportedError: The Element has no supported sources`. Media decoding pipeline for `<audio>` tags is quarantined. |
| **Web Audio Buffer** | `AudioContext.decodeAudioData(bytes.buffer)` | **PASS** | **Breakthrough.** Successfully decoded an in-memory WAV buffer and played output through `AudioBufferSourceNode` with active audio output (`ctx: running`). |

---

## 7. URI Scheme & Link Interception Audit (`!wvtest links`)

| URI Scheme / Target | Example Tested | Action & Behavior Upon Tap |
|:---|:---|:---|
| **Web HTTPS** | `https://google.com` | CSS active button animation triggers, but link is completely suppressed. External browser does not open. |
| **WhatsApp Deep Link** | `whatsapp://send?text=Hello` | Suppressed by container. Native WhatsApp chat does not open. |
| **Shortlink** | `https://wa.me/628xxx` | Suppressed by container. No action taken. |
| **Phone Dialer** | `tel:+6281234567890` | Suppressed by container. System dialer does not open. |
| **Email Client** | `mailto:bot@example.com` | Suppressed by container. Email client does not open. |
| **Android Intent** | `intent://#Intent;...` | Suppressed by container. No intent dispatched. |
| **Relative Fragment** | `about:blank#anchor` | Suppressed by container. No action taken. |
| **Pseudo-Button (Long Press)** | `<a href="param">!cmd</a>` | **Failed.** Long-pressing the anchor tag does not copy text to the chat bar; instead, WhatsApp's outer chat view catches the gesture as a **standard message selection** (for delete/star/forward). |

---

## 8. Webview Lifecycle & State Retention Audit (`!wvtest lifecycle`)

| Interaction Scenario | Tested Action | Observed Behavior & State Impact |
|:---|:---|:---|
| **Viewport Scrolling** | User scrolled chat history up by 20 messages, then scrolled back down to the webview. | **Total Instance Destruction & Re-mount.** The running interval counter and manual counter both reset to `0`. All JavaScript in-memory state is wiped. |
| **App Backgrounding** | User minimized WhatsApp (returned to Android home screen) for 5–10 seconds, then returned. | **State Retained & Timer Kept Running.** The active `setInterval` timer continued incrementing in the background without pausing or resetting. |

---

## 9. Technical Recommendations & Architectural Rules

1. **Strictly Air-Gapped Single-Page Design:**
   Never attempt outbound `fetch()`, `XMLHttpRequest`, or `WebSocket` connections from within the webview. All data required for multi-screen navigation, search results, or catalogs must be bundled into the initial HTML payload.
2. **State Management:**
   Because `IndexedDB.open()` throws `SecurityError` and scrolling unmounts the webview, state cannot be stored on disk. Keep views lightweight and design workflows to complete in a single uninterrupted view session.
3. **Quoted Context for Bot Replies:**
   Always include `contextInfo.quotedMessage`, `contextInfo.stanzaId`, and `contextInfo.participant` when dispatching webviews in response to user commands. This produces a clean, professional reply bubble linking the webview directly to the conversation.
4. **Interactive Controls & Input Formats:**
   - Dropdown selections (`<select>`) and date pickers (`<input type="date">`) are safe and provide native mobile UX.
   - Do **not** use `<input type="file">` — it is completely inoperative.
   - For range sliders (`<input type="range">`), style them with ample vertical padding or touch boundaries to minimize accidental chat scrolling.
5. **In-App Audio Effects:**
   Use `AudioContext.decodeAudioData(ArrayBuffer)` for sound effects. Never rely on `<audio>` elements.
6. **120-Second Deletion Hygiene:**
   Because webview stanzas re-mount on viewport scroll, keep the mandatory 120-second automatic deletion policy active to prevent chat history lag.
