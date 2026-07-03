export default {
    name: "say",
    aliases: [],
    category: "tools",
    description: "Echo text back to the sender",
    usage: "!say <text>",
    async handler({ message, rawArgs, sock }) {
        if (!rawArgs) return message.reply("Masukkan teks!");
        
        // Cari URL di dalam teks
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = rawArgs.match(urlRegex);
        
        if (match && match.length > 0) {
            // Jika ada link, gunakan matchedText agar Baileys men-generate preview
            await sock.sendMessage(
                message.chat,
                { 
                    text: rawArgs,
                    matchedText: match[0] 
                },
                { quoted: message }
            );
        } else {
            await message.reply(rawArgs);
        }
    }
};
