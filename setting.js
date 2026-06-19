const setting = {
    name: "SΛNSΞKΛI",
    owner: "6285157729639",
    prefixes: ["!", ".", "#", "/", "-"],
    ytdlp: {
        tempDir: "./temp",
        maxFileSize: 64 * 1024 * 1024,           // 64MB (WhatsApp video limit)
        maxFileSizeDoc: 2 * 1024 * 1024 * 1024,   // 2GB (WhatsApp doc limit)
        stateExpiry: 15 * 60 * 1000,              // 15 menit
        fileExpiry: 30 * 60 * 1000,               // 30 menit
        cleanupInterval: 10 * 60 * 1000,          // Scan setiap 10 menit
        cacheExpiry: 10 * 60 * 1000,              // 10 menit
        maxConcurrent: 4,                          // Max downloads global
        defaultFormats: [
            "bv*[height<=720]+ba/b",
            "bv*[height<=480]+ba/b",
            "bv*[height<=360]+ba/b",
            "b"                                    // Fallback: best single file
        ],
        processTimeout: 5 * 60 * 1000,            // 5 menit timeout
        purgeOnStartup: true,
    }
};

export default setting;