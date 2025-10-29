import {
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  getContentType,
  Browsers
} from "baileys";
import moment from "moment-timezone";
import anyAscii from "any-ascii";
import Pino from "pino";
import axios from "axios";

import { msgFilter, color } from "./lib/utils.js";

import setting from "./setting.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");

let msgHandler = async (upsert, sock, message) => {
  try {
    let { text } = message;
    // handle sender kosong
    if (message.sender === "") return;
    const t = message.messageTimestamp;
    const verifquoted = message.quoted ? true : false;
    const msg = verifquoted ? { message: message.quoted.message } : { message: message.message };
    let quotedMsg = message.quoted ? message.quoted : message;
    const groupMetadata = message.isGroup
    ? await sock.groupMetadata(message.chat)
    : {};
    const isGroup = message.isGroup;
    let sender = message.key.addressingMode === "pn" ? message.sender : message.key.remoteJidAlt;

    // LID
    let isGroupAdmins
    let isBotGroupAdmins
    if (isGroup) {
      if (message.key.addressingMode === "pn") {
        sender = message.sender;
      isGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.id)
        .includes(sender)
      isBotGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.id)
        .includes(sock.user.id)
      } else {
        sender = message.key.participantAlt
      isGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.phoneNumber)
        .includes(sender)
      isBotGroupAdmins = groupMetadata.participants
        .filter((participant) => participant.admin)
        .map((participant) => participant.phoneNumber)
        .includes(sock.user.id)
      }
    }
    // LID

    const groupName = isGroup ? groupMetadata.subject : "";
    const pushname = message.pushName || sender;
    const botNumber = sock.user.id;
    if (!sender) return
    const ownerNumber = setting.owner + "@s.whatsapp.net";

    let budy = (typeof message.text == 'string' ? message.text : '')
    const cmd = budy || "";

    let command;
    if (cmd.startsWith(". ") || cmd.startsWith("! ") || cmd.startsWith("# ") || cmd.startsWith("/ ")) {
      const parts = cmd.toLowerCase().split(" ");
      command = parts[0] + parts[1];
    } else {
      command = cmd.toLowerCase().split(" ")[0] || "";
    }
    command = anyAscii(command).toLowerCase()
    const prefix = /^[.#!]/.test(command) ? command.match(/^[.#!]/gi) : "/"; 
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    let args;
    if (cmd.startsWith(". ") || cmd.startsWith("! ") || cmd.startsWith("# ") || cmd.startsWith("/ ")) {
      args = budy.trim().split(/ +/).slice(2);
    } else {
      args = budy.trim().split(/ +/).slice(1);
    }
    const string = args.slice().join(" ");
    const isCmd = budy.startsWith(prefix);
    const url = args.length !== 0 ? args[0] : "";
    const q = args.join(" ");
    const isImage = message.mtype === "image/jpeg" || message.mtype === "image/png";
    const isVideo = message.mtype === "video/mp4" || message.mtype === "image/gif";
    const isQuotedImage = quotedMsg && (quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedVideo = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif");
    const isQuotedVandI = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/gif" || quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedGif = quotedMsg && quotedMsg.mtype === "video/mp4";
    const isQuotedSticker = quotedMsg && quotedMsg.mtype === "image/webp";
    const isQuotedAudio = quotedMsg && (quotedMsg.mtype === "audio/mpeg" || quotedMsg.mtype === "audio/ogg; codecs=opus" || quotedMsg.mtype === "audio/mp4");
    const isQuotedAudioVn = quotedMsg && quotedMsg.mtype === "audio/mpeg";
    const isQuotedFile = quotedMsg && (quotedMsg.mtype === "video/mp4" || quotedMsg.mtype === "image/jpeg" || quotedMsg.mtype === "image/png");
    const isQuotedText = quotedMsg && quotedMsg.mtype === "conversation";
    const isQuotedpdf = quotedMsg && quotedMsg.mtype === "application/pdf";
    const stickerName = "SΛNSΞKΛI Bot";
    const stickerAuthor = "Cek nomor bot wa yang aktif di web https://s.id/mybot";

        if (isGroup) {
          const listBlocked = await sock.fetchBlocklist()
        const isBlocked = listBlocked.includes(sender)
        if (isBlocked) return; 
    }

    if (isCmd && msgFilter.isFiltered(message.chat) && !isGroup) {
      return console.log(color("[SPAM]", "red"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname));
    }
    if (isCmd && msgFilter.isFiltered(message.chat) && isGroup) {
      return console.log(color("[SPAM]", "red"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname), "in", color(groupName));
    }
     
    if (!isCmd && !isGroup) return;
    if (!isCmd && isGroup) return;
    if (isCmd && !isGroup) {
      console.log(color("[EXEC]"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname));
    }
    if (isCmd && isGroup) {
      console.log(color("[EXEC]"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), color(`${command} [${args.length}]`), "from", color(pushname), "in", color(groupName));
    }
    
    await sock.readMessages([message.key]) // Auto read

    // fitur
  switch (command) {
    case prefix + "ping": case prefix + "test": case prefix + "tes":
      await message.reply(`Pong! 🏓\n\nSpeed: ${Date.now() - t * 1000} ms`);
      break;
      case prefix + "say":
    if (!q) return message.reply("Masukkan teks!");
    await message.reply(q);
    break;
        case prefix + "resend": // contoh fitur download video atau gambar
        if ((isImage || isQuotedImage) || (isVideo || isQuotedVideo)) {
          const type = Object.keys(quotedMsg.message || quotedMsg)[0];
            try {
          const buffer = await downloadMediaMessage(msg, "buffer", {}, { Pino, reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(
            message.chat,
            { [type.includes("image") ? "image" : "video"]: buffer, caption: "*Success Resend*" },
            { quoted: message, ephemeralExpiration: message.contextInfo.expiration }
          );
          } catch (err) {
            console.log(err);
            message.reply("ada yang error!");
          }
        } else {
          message.reply(`Reply gambar atau video yang ingin diresend`);
        }
        break;
    default:
      if (isCmd) {
        console.log(color("[ERROR]", "red"), color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "yellow"), "Unregistered Command from", color(pushname));
      }
      break; 
  }
  } catch (err) {
    console.log(color("[ERROR]", "red"), err);
  }
};

export { msgHandler };
export default {
  msgHandler,
};
