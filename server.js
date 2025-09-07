import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';

const {
  PORT = 3000,
  LINE_CHANNEL_SECRET,
  LINE_ACCESS_TOKEN,
  DEVICE_BASE_URL,             // 例如 http://192.168.50.120 或你的 ngrok URL
} = process.env;

// LINE SDK 設定
const config = {
  channelAccessToken: LINE_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// 建立 Express
const app = express();

// ---- Webhook：立即 ACK，事件背景處理 ----
app.post('/webhook', middleware(config), (req, res) => {
  // 先回 200，避免讓 LINE 等你處理外部裝置
  res.status(200).end();

  // 背景處理每個事件
  for (const event of req.body.events ?? []) {
    handleEvent(event).catch(err => {
      console.error('handleEvent error:', err);
    });
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const text = (event.message.text || '').trim();
  const n = Number(text);

  // 僅接受 1~5
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '請輸入 1~5（對應 5 種面板圖形）',
    });
    return;
  }

  // 1) 先回覆「切換中…」給使用者（不等 UNO）
  client.replyMessage(event.replyToken, {
    type: 'text',
    text: `已收到：${n}，切換中…`,
  }).catch(console.error);

  // 2) 背景轉發到 UNO：/set?m=n，加短超時避免卡住
  const url = new URL('/set', DEVICE_BASE_URL);
  url.searchParams.set('m', String(n));

  try {
    // Node 18+ 支援 AbortSignal.timeout()
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(800) });
    const memo = await r.text().catch(() => '');

    if (!r.ok) throw new Error(`HTTP ${r.status} ${memo || ''}`.trim());

    // 3) （可選）完成後用 push 告知結果
    //    需要啟用 Push Message，且一對一聊天室會有 userId
    if (event.source?.userId) {
      await client.pushMessage(event.source.userId, {
        type: 'text',
        text: `切換成功：${n}`,
      });
    }
  } catch (err) {
    if (event.source?.userId) {
      await client.pushMessage(event.source.userId, {
        type: 'text',
        text: `切換失敗：${n}\n${String(err)}`,
      });
    }
  }
}

// 健康檢查
app.get('/', (_req, res) => {
  res.type('text').send('LINE → UNO forwarder OK');
});

app.listen(PORT, () => {
  console.log(`LINE forwarder listening on http://localhost:${PORT}`);
  console.log(`DEVICE_BASE_URL = ${DEVICE_BASE_URL}`);
});
