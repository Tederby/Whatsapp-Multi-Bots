import moment from "moment-timezone";

import { msgFilter, color } from "./lib/utils.js";
import { parseCommand } from "./lib/commandParser.js";
import { getCommand, getReplyHandler } from "./commands/_registry.js";
import { handleDanbooruRequest } from "./lib/danbooru.js";
import setting from "./setting.js";

moment.tz.setDefault("Asia/Jakarta").locale("id");

let msgHandler = async (upsert, sock, message) => {
  try {
    let { text } = message;
    // handle sender kosong
    if (message.sender === "") return;
    const t = message.messageTimestamp;
    const isGroup = message.isGroup;
    const groupMetadata = isGroup
      ? await sock.groupMetadata(message.chat)
      : {};
    let sender = (!message.key.addressingMode || message.key.addressingMode === "pn") ? message.sender : (message.key.remoteJidAlt || message.sender);

    // LID
    let isGroupAdmins;
    let isBotGroupAdmins;
    if (isGroup) {
      if (!message.key.addressingMode || message.key.addressingMode === "pn") {
        sender = message.sender;
        isGroupAdmins = groupMetadata.participants
          .filter((participant) => participant.admin)
          .map((participant) => participant.id)
          .includes(sender);
        isBotGroupAdmins = groupMetadata.participants
          .filter((participant) => participant.admin)
          .map((participant) => participant.id)
          .includes(sock.user.id);
      } else {
        sender = message.key.participantAlt || message.sender;
        isGroupAdmins = groupMetadata.participants
          .filter((participant) => participant.admin)
          .map((participant) => participant.phoneNumber || participant.id)
          .includes(sender);
        isBotGroupAdmins = groupMetadata.participants
          .filter((participant) => participant.admin)
          .map((participant) => participant.phoneNumber || participant.id)
          .includes(sock.user.id);
      }
    }
    // LID

    const groupName = isGroup ? groupMetadata.subject : "";
    const pushname = message.pushName || sender;
    const botNumber = sock.user.id;
    if (!sender) return;
    const ownerNumber = setting.owner + "@s.whatsapp.net";

    // Check blocked users in group
    if (isGroup) {
      const listBlocked = await sock.fetchBlocklist();
      const isBlocked = listBlocked.includes(sender);
      if (isBlocked) return;
    }

    // ── 1. Reply Handler Interception ──────────────────────────────────
    // Catches replies to multi-step commands (e.g. ytdlf format selection)
    // before the command parser runs, because these replies have no prefix.
    if (message.quoted && message.contextInfo?.stanzaId) {
      const entry = getReplyHandler(message.contextInfo.stanzaId);
      if (entry) {
        // Validate ownership: only the original requester may reply
        if (entry.state.userId !== sender) {
          await message.reply("❌ Hanya pengirim asli yang bisa memilih format");
          return;
        }
        console.log(
          color("[EXEC]"),
          color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"),
          color(`reply:${entry.state.commandName || "unknown"}`),
          "from", color(pushname),
          ...(isGroup ? ["in", color(groupName)] : [])
        );
        await sock.readMessages([message.key]);
        await entry.handler({ message, sock, state: entry.state });
        return;
      }
    }

    // ── 1.5 Auto-Detect Danbooru Link ─────────────────────────────────
    const danbooruRegex = /(?:https?:\/\/)?(?:www\.)?danbooru\.donmai\.us\/posts\/(\d+)(?:\?.*)?/i;
    const danbooruMatch = text.match(danbooruRegex);
    if (danbooruMatch) {
      console.log(
        color("[AUTO-DETECT]"),
        color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"),
        color(`danbooru:${danbooruMatch[1]}`),
        "from", color(pushname),
        ...(isGroup ? ["in", color(groupName)] : [])
      );
      await sock.readMessages([message.key]);
      await handleDanbooruRequest({ input: danbooruMatch[1], sock, message, isAutoDetect: true });
      return;
    }

    // ── 2. Command Parsing (exact-match only) ─────────────────────────
    const parsed = parseCommand(text);
    if (!parsed) return; // Not a command → silent ignore

    const { prefix, commandName, args, rawArgs } = parsed;
    const cmd = getCommand(commandName);
    if (!cmd) return; // Unknown command → silent ignore

    // Spam filter
    if (msgFilter.isFiltered(message.chat)) {
      return console.log(
        color("[SPAM]", "red"),
        color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"),
        color(`${prefix}${commandName} [${args.length}]`),
        "from", color(pushname),
        ...(isGroup ? ["in", color(groupName)] : [])
      );
    }

    // Log execution
    console.log(
      color("[EXEC]"),
      color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"),
      color(`${prefix}${commandName} [${args.length}]`),
      "from", color(pushname),
      ...(isGroup ? ["in", color(groupName)] : [])
    );

    await sock.readMessages([message.key]); // Auto read

    // ── 3. Execute Command ────────────────────────────────────────────
    await cmd.handler({
      message,
      sock,
      upsert,
      args,
      rawArgs,
      prefix,
      sender,
      pushname,
      isGroup,
      groupMetadata,
      groupName,
      isGroupAdmins,
      isBotGroupAdmins,
      ownerNumber,
      botNumber,
    });

  } catch (err) {
    console.log(color("[ERROR]", "red"), err);
  }
};

export { msgHandler };
export default {
  msgHandler,
};
