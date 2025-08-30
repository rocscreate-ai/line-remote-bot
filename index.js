// index.js
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,   // Render 的環境變數
  channelSecret: process.env.LINE_CHANNEL_SECRET,       // Render 的環境變數
};

const app = express();
const client = new Client(config);

// 健康檢查（可對應 Render 的 /healthz）
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// 一定要用 LINE 的 middleware，且 /webhook 要回 200
app.post('/webhook', middleware(config), (req, res) => {
  // 先立即回 200，Verify 就會成功
  res.sendStatus(200);

  // 事件處理可在背景做
  Promise.all(req.body.events.map(handleEvent)).catch(err => {
    console.error('handleEvent error:', err);
  });
});

async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const msg = { type: 'text', text: `收到：${event.message.text}` };
  return client.replyMessage(event.replyToken, msg);
}

const port = process.env.PORT || 10000;
app.listen(port, () => console.log('LINE Bot listening on :' + port));
