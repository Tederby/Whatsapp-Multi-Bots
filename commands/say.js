export default {
    name: "say",
    aliases: [],
    description: "Echo text back to the sender",
    async handler({ message, rawArgs }) {
        if (!rawArgs) return message.reply("Masukkan teks!");
        await message.reply(rawArgs);
    }
};
