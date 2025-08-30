// index.js
import express from "express";
import line from "@line/bot-sdk";

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("Missing LINE_ACCESS_TOKEN or LINE_CHANNEL_SECRET.");
  process.exit(1);
}

const app = express();
app.use(express.json());

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(req.body.events.map(handleEvent));
    res.json(results);
  } catch (e) {
    console.error("Webhook error:", e);
    res.status(500).end();
  }
});

app.get("/", (req, res) => res.send("LINE Remote Bot is running ✅"));

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }
  const text = (event.message.text || "").trim();

  if (/^menu$/i.test(text)) {
    return client.replyMessage(event.replyToken, { type: "text", text: "可用指令：V0 ON、V0 OFF、STATUS" });
  }
  if (/^v0 on$/i.test(text)) {
    return client.replyMessage(event.replyToken, { type: "text", text: "已送出：V0=1" });
  }
  if (/^v0 off$/i.test(text)) {
    return client.replyMessage(event.replyToken, { type: "text", text: "已送出：V0=0" });
  }
  if (/^status$/i.test(text)) {
    return client.replyMessage(event.replyToken, { type: "text", text: "查詢裝置狀態中…" });
  }
  return client.replyMessage(event.replyToken, { type: "text", text: `你說了：${text}（輸入 MENU 看指令）` });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LINE Bot listening on :${port}`));
