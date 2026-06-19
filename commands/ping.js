export default {
    name: "ping",
    aliases: ["test", "tes"],
    description: "Check bot response time",
    async handler({ message }) {
        const t = message.messageTimestamp;
        await message.reply(`Pong! 🏓\n\nSpeed: ${Date.now() - t * 1000} ms`);
    }
};
