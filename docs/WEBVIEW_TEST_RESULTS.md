# Empirical Webview Payload Audit Report & Benchmark Log

> **Document Type:** Empirical Test Benchmark & Protocol Audit Artifact  
> **Target Specification:** [`docs/WEBVIEW_PAYLOAD.md`](WEBVIEW_PAYLOAD.md)  
> **Benchmark Date:** September 4, 2026  
> **Status:** Completed & Verified  

---

## 1. Executive Summary & Environment Profile

This document records the empirical trial-and-error test results conducted on WhatsApp's native in-app webview container (`GenAIaeacdsnwHtmlPrimitive`). All tests were executed live inside an active WhatsApp chat thread using the automated diagnostic suite and calibrated size probes provided by [`commands/wvtest.js`](../commands/wvtest.js).

### Test Environment Profile
- **Device Model:** Xiaomi Redmi (`M2003J15SC`)
- **OS Version:** Android 12 (Build: `SP1A.210812.016`)
- **WebView Engine:** Chrome WebView `151.0.7922.199` (WebKit `537.36`)
- **Viewport Dimensions:** `393 x 851` CSS px (Device Pixel Ratio: `2.75`)
- **Overall Capability Score:** 23 Supported (`PASS`), 13 Blocked (`BLOCKED`)

### Key Empirical Discoveries
1. **Exact Stanza Drop Ceiling (1350 KB):** WhatsApp delivery routers (`Chatd`/Edge) reliably deliver inline stanzas up to **1350 KB (~1.38 MB)**. Stanzas of **1400 KB** and above are **silently dropped** by the router despite transport-level socket ACK.
2. **Web Audio Decoding Breakthrough:** While HTML5 `<audio>` tags are quarantined (`NotSupportedError`), converting Base64 audio into an `ArrayBuffer` and decoding via Web Audio API (`ctx.decodeAudioData()`) **successfully plays in-memory audio** through an `AudioBufferSourceNode`.
3. **Clean Native Envelope:** Setting `isForwarded: false`, `forwardingScore: 0`, and `forwardOrigin: 1` in `contextInfo` successfully **removes the "Forwarded" tag** above the webview card.
4. **Native Multi-Card / Stacked Layout:** The `sections` array in `unifiedResponse.data` supports multiple `GenAISingleLayoutViewModel` items, rendering multiple HTML cards stacked inside a single message bubble.
5. **Anchor Tag Pseudo-Button Deprecation:** On modern WhatsApp Android builds (Chrome 151+), long-pressing `<a href="...">` is intercepted as a chat message selection gesture rather than extracting text into the composer bar.

---

## 2. Raw Diagnostic Suite Log (`!wvtest suite`)

*The following raw report was captured directly from the client webview test runner via the "Copy Summary" export action:*

```text
=== WEBVIEW DIAGNOSTIC REPORT ===
UA: Mozilla/5.0 (Linux; Android 12; M2003J15SC Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.199 Mobile Safari/537.36
Screen: 393x851 DPR:2.75
Results: 23 Pass, 13 Blocked
-------------------------------
[BLOCKED] STORAGE: localStorage (SecurityError)
[BLOCKED] STORAGE: sessionStorage (SecurityError)
[PASS] STORAGE: IndexedDB API (Factory present)
[BLOCKED] STORAGE: document.cookie (SecurityError)
[BLOCKED] STORAGE: Cache Storage (Missing)
[BLOCKED] STORAGE: OPFS (Origin FileSystem) (navigator.storage.getDirectory)
[PASS] NETWORK: fetch API (typeof fetch)
[PASS] NETWORK: XMLHttpRequest (typeof XHR)
[PASS] NETWORK: WebSocket (typeof WebSocket)
[PASS] NETWORK: EventSource (SSE) (typeof EventSource)
[PASS] NETWORK: WebRTC (RTCPeerConnection) (RTCPeerConnection)
[PASS] NETWORK: BroadcastChannel (BroadcastChannel)
[BLOCKED] CSP: eval() (Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'unsafe-inline'.)
[BLOCKED] CSP: new Function() (Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'unsafe-inline'.)
[PASS] CSP: WebAssembly (object)
[BLOCKED] CSP: crypto.subtle (Web Crypto API)
[PASS] CSP: Blob Worker (Worker spawned)
[PASS] MEDIA: Web Audio API (AudioContext present)
[PASS] MEDIA: HTML5 <audio> Element (canPlay: "probably")
[PASS] MEDIA: Canvas 2D (getContext("2d"))
[PASS] MEDIA: WebGL 1 (getContext("webgl"))
[PASS] MEDIA: WebGL 2 (getContext("webgl2"))
[BLOCKED] MEDIA: WebGPU (navigator.gpu)
[BLOCKED] MEDIA: Speech Synthesis (window.speechSynthesis)
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

### Conclusion:
- **Maximum Confirmed Ceiling:** **1350 KB (~1.38 MB)**
- **Drop Threshold:** **1400 KB** (Server-side drop without notification)

---

## 4. Protobuf Schema & Envelope Mutation Audit (`!wvtest proto`)

| Test Case | Parameter Modification | Result | Empirical Observation |
|:---|:---|:---:|:---|
| **`botjid`** | Set `forwardedAiBotMessageInfo.botJid` to bot's own phone number JID (`<number>@s.whatsapp.net`). | **PASS** | Payload renders normally. The router does not enforce the Meta AI bot JID (`867051314767696@bot`). |
| **`multisection`** | Array of 2 `GenAISingleLayoutViewModel` items in `sections: [...]`. | **PASS** | **Multi-card layout operational.** WhatsApp renders both HTML card sections stacked together in a single chat bubble. |
| **`trusted`** | Whitelisted `trusted_sources: ["https://upload.wikimedia.org"]` with remote `<img>`. | **FAIL** | Remote image failed to load. The `trusted_sources` array does **not** whitelist external network traffic. Sandbox cross-origin network blocks remain absolute. |
| **`context`** | Set `forwardOrigin: 1`, `forwardingScore: 0`, and `isForwarded: false` in `contextInfo`. | **PASS** | **"Forwarded" tag removed.** Webview card displays cleanly without any forwarding indicators above the header. |

---

## 5. In-Depth Audio & Media Sandbox Audit (`!wvtest audio`)

| Audio Pipeline | Tested API | Result | Observed Behavior & Error Details |
|:---|:---|:---:|:---|
| **Synthesizer** | Web Audio API Oscillator (`440Hz`, `523Hz`) | **PASS** | Generated tone successfully. When triggered repeatedly in rapid succession, sound occasionally cuts out due to audio focus throttling, but recovers after brief idle. |
| **HTML5 Media** | `<audio src="data:audio/wav;base64,...">` | **BLOCKED** | Play button is permanently greyed out. Programmatic `audio.play()` rejects immediately with: `NotSupportedError: The Element has no supported sources`. Media decoding pipeline for `<audio>` tags is quarantined. |
| **Web Audio Buffer** | `AudioContext.decodeAudioData(bytes.buffer)` | **PASS** | **Breakthrough.** Successfully decoded a 0.50s in-memory WAV buffer and played output through `AudioBufferSourceNode` with active audio output (`ctx: running`). |

---

## 6. URI Scheme & Link Interception Audit (`!wvtest links`)

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

## 7. Webview Lifecycle & State Retention Audit (`!wvtest lifecycle`)

| Interaction Scenario | Tested Action | Observed Behavior & State Impact |
|:---|:---|:---|
| **Viewport Scrolling** | User scrolled chat history up by 20 messages, then scrolled back down to the webview. | **Total Instance Destruction & Re-mount.** The running interval counter and manual counter both reset to `0`. All JavaScript in-memory state is wiped. |
| **App Backgrounding** | User minimized WhatsApp (returned to Android home screen) for 5–10 seconds, then returned. | **State Retained & Timer Kept Running.** The active `setInterval` timer continued incrementing in the background without pausing or resetting. |

---

## 8. Technical Recommendations & Design System Updates

1. **Stanza Budgeting:** Keep production payloads well below the **1350 KB** ceiling (ideally `< 500 KB` for safe, instant rendering).
2. **Audio Architecture:** Do not use `<audio>` tags. For short in-app audio effects (< 30s), use `AudioContext.decodeAudioData(ArrayBuffer)` + `AudioBufferSourceNode`. For long-form music or podcasts (> 1 MB), use the **Standalone Document Pattern** (`.html` document attachment via CDN).
3. **Clean Visuals:** Always set `isForwarded: false`, `forwardingScore: 0`, and `forwardOrigin: 1` in `contextInfo` to eliminate the unsightly "Forwarded" badge.
4. **Button Interactivity:** Replace anchor tag pseudo-buttons with selectable monospace chips (`user-select: all`) or `document.execCommand('copy')` on tap, as native long-press extraction is no longer operational on modern client builds.
