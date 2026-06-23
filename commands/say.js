export default {
    name: "say",
    aliases: [],
    category: "tools",
    description: "Echo text back to the sender",
    usage: "!say <text>",
    async handler({ message, rawArgs }) {
        if (!rawArgs) return message.reply("Masukkan teks!");
        await message.reply(rawArgs);
    }
};
