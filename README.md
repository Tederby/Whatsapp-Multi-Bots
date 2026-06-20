# Simple WhatsApp Bot (SΛNSΞKΛI)

Sebuah base bot WhatsApp yang sederhana namun scalable, dibangun menggunakan pustaka [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) dan Node.js. Bot ini dirancang agar mudah dikembangkan dan dimodifikasi untuk proyek pribadi maupun publik.

## ✨ Fitur Utama

- **Modular & Auto-Reload:** Menggunakan sistem handler yang dimonitor oleh `chokidar`. Kamu bisa mengedit atau menambahkan command tanpa perlu me-restart bot.
- **YouTube Downloader (`ytdl` & `ytdlf`):** Integrasi tingkat lanjut dengan `yt-dlp` yang mendukung antrean unduhan (queue), auto-cleanup file sementara, pemilihan resolusi, dan caching.
- **Danbooru Integration (`danbooru`):** Dapat mencari gambar dari Danbooru atau mendeteksi link Danbooru secara otomatis pada chat untuk langsung mengirimkan gambarnya. Dilengkapi dengan proteksi NSFW/Explicit.
- **Auto Reject Call:** Otomatis menolak panggilan suara atau video yang masuk untuk menjaga koneksi bot tetap stabil.
- **Self-Trigger:** Perintah bisa dijalankan langsung dari nomor owner (perangkat tertaut).
- **Basic Commands:** Terdapat command dasar seperti `ping`, `say`, `tag` (mention all di grup), dan `resend`.

## 📋 Persyaratan Sistem

- **Node.js** (Disarankan versi 18 ke atas)
- **FFmpeg** (Dibutuhkan oleh Baileys untuk pemrosesan media/stiker)
- **yt-dlp** (Wajib diinstal dan ditambahkan ke system PATH jika ingin menggunakan fitur `ytdl`)

## 🚀 Cara Instalasi

1. **Clone repositori ini** (jika menggunakan Git) atau unduh dan ekstrak source code.
   ```bash
   git clone https://github.com/Tederby/wa-bot.git
   cd wa-bot
   ```

2. **Instal dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Bot**
   Buka file `setting.js` dan sesuaikan konfigurasinya:
   ```javascript
   const setting = {
       name: "SΛNSΞKΛI", // Nama Bot
       owner: "6285157729639", // Ganti dengan nomor WhatsApp kamu (tanpa +, gunakan 62)
       prefixes: ["!", ".", "#", "/", "-"], // Prefix yang ingin digunakan
       ytdlp: {
           // ... konfigurasi yt-dlp lainnya
       }
   };
   ```

4. **Jalankan Bot**
   ```bash
   npm start
   ```

5. **Scan QR Code**
   Saat pertama kali dijalankan, bot akan memunculkan QR Code di terminal. Buka aplikasi WhatsApp kamu > Perangkat Tertaut (Linked Devices) > Tautkan Perangkat, lalu scan QR Code tersebut. Sesi akan tersimpan secara otomatis di folder `./session`.

## 📂 Struktur Direktori

- `index.js` - Titik masuk (entry point) utama untuk koneksi Baileys.
- `handler.js` - Pusat pemrosesan pesan (message router) yang mendukung auto-reload.
- `setting.js` - File konfigurasi global bot.
- `commands/` - Tempat kamu meletakkan script command baru. Semua file di sini akan diregistrasi otomatis.
- `lib/` - Kumpulan utilitas, parser, dan helper untuk mempermudah pembuatan bot.
- `services/` - Service background, seperti antrean `yt-dlp` dan script pembersih file sementara (cleanup).
- `temp/` - Folder penyimpanan file sementara (media).

## 🛠️ Cara Menambahkan Command Baru

Untuk menambah fitur, kamu cukup membuat file JavaScript baru di dalam folder `commands/`. Gunakan struktur modular sederhana yang meregister fungsi handler dari `_registry.js`. Pastikan untuk me-restart bot jika menambah file baru, atau bot akan otomatis memuat ulang jika kamu hanya mengedit file yang sudah ada (tergantung setup chokidar di sistemmu).

## 🤝 Lisensi & Kontribusi

Bot ini awalnya dibuat untuk proyek pribadi, namun bersifat *open-source*. Siapapun bebas untuk meng-clone, memodifikasi, dan mengembangkannya sesuai kebutuhan.

---
*Dibuat dengan ❤️ dan Node.js*