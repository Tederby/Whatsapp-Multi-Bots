process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidDecode,
  Browsers
} from "baileys";
import qrcode from "qrcode-terminal"
import Pino from "pino";
import { msgHandler as initialMsgHandler } from "./handler.js";
let msgHandler = initialMsgHandler;
import moment from "moment-timezone";
import "./handler.js";
moment.tz.setDefault("Asia/Jakarta").locale("id");
import chokidar from "chokidar";
import { Messages } from "./lib/Messages.js";

// Baileys
const logger = Pino({
    level: "silent"
});

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(`./session`);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
     auth: {
       creds: state.creds,
       keys: makeCacheableSignalKeyStore(state.keys, logger),
     },
     retryRequestDelayMs: 300,
     maxMsgRetryCount: 10,
     version: version,
     logger: logger,  
     markOnlineOnConnect: true,
     generateHighQualityLinkPreview: true,
     browser: Browsers.macOS('Chrome')
   });

  sock.ev.process(async (ev) => {
    if (ev["connection.update"]) {
      const update = ev["connection.update"];
      const { connection, lastDisconnect } = update;
      const status = lastDisconnect?.error?.output?.statusCode;
      // console.log(update.qr);
      if (update.qr) {
        qrcode.generate(update.qr, {small: true}, function (qrcode) {
          console.log(qrcode)
      });
    }

        if (connection === 'close') {
            const reason = Object.entries(DisconnectReason).find(i => i[1] === status)?.[0] || 'unknown';

            console.log(`session | Closed connection, status: ${reason} (${status})`);
            
            switch (reason) {
        case "multideviceMismatch":
        case "loggedOut":
          console.error(lastDisconnect.error);
          fs.rmSync(`./session`, { recursive: true, force: true });
          break;
        default:
        if (status === 403) {
          console.error(lastDisconnect.error);
          fs.rmSync(`./session`, { recursive: true, force: true });
          } else {
          console.error(lastDisconnect.error?.message);
          connectToWhatsApp();
          }
      }

        } else if (connection === 'open') {
            console.log(`session Connected: ${jidDecode(sock?.user?.id)?.user}`);
        }
    }
    if (ev["creds.update"]) {
      await saveCreds();
    }
    
    const upsert = ev["messages.upsert"];
if (upsert) {
  if (upsert.type !== "notify") return;
    const message = Messages(upsert, sock);
    if (message.key && message.key.remoteJid === "status@broadcast") return;
    if (message.key.fromMe) return
        if (!message) return;
            msgHandler(upsert, sock, message);
 }
 
 if (ev["call"]) {
  const call = ev["call"]
        let { id, chatId, isGroup } = call[0];
        if (isGroup) return;
        await sock.rejectCall(id, chatId);
        // await sleep(3000);
        // await sock.updateBlockStatus(chatId, "block"); // Block user
        await sock.sendMessage(
			chatId,
			{
				text: "Tidak bisa menerima panggilan suara/video.",
			},
			{ ephemeralExpiration: upsert?.messages[0].contextInfo?.expiration }
		);
    }
  });
}
    connectToWhatsApp();
// Baileys

// Watch for changes in ./handler/message/index.js
//const watchHandler = (client) => {
  const watcher = chokidar.watch('./handler.js', {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('change', async (path) => {
    console.log(`File ${path} has been changed`);
    try {
      const newHandlerModule = await import(`./handler.js?cacheBust=${Date.now()}`);
      console.log("Updated handler module");
      msgHandler = newHandlerModule.msgHandler;
    } catch (err) {
      console.error("Error updating handler module:", err);
    }
  });
//};
