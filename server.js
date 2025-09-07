import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';

const {
  PORT = 3000,
  LINE_CHANNEL_SECRET,
  LINE_ACCESS_TOKEN,
  DEVICE_BASE_URL,
} = process.env;

// LINE SDK 設定
const config = {
  channelAccessToken: LINE_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// 建立 Express
const app = express();

// LINE 需要原始 body 來驗簽，所以用官方 middleware
app.post('/webhook', middleware(config), async (req, res) => {
  // 逐一處理 event（只處理文字訊息）
  const results = await Promise.all(
    req.body.events.map(async (event) => {
      if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
      }

      // 取純數字
      const text = (event.message.text || '').trim();
      const n = Number(text);

      // 支援 1~5
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請輸入 1~5（對應 5 種面板圖形）',
        });
      }

      // 轉發到 UNO：/set?m=n
      const url = new URL('/set', DEVICE_BASE_URL);
      url.searchParams.set('m', String(n));

      try {
        // Node 18+ 內建 fetch
        const r = await fetch(url, { method: 'GET' });
        const ok = r.ok;
        let memo = '';
        try { memo = await r.text(); } catch (_) {}

        if (ok) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `已切換圖形：${n}\n(${url.toString()})`,
          });
        } else {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `轉發失敗（HTTP ${r.status}）\n${url.toString()}\n${memo}`,
          });
        }
      } catch (err) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `無法連到裝置：${url.toString()}\n${String(err)}`,
        });
      }
    })
  );

  res.status(200).json({ ok: true, results });
});

// 健康檢查
app.get('/', (_req, res) => {
  res.type('text').send('LINE → UNO forwarder OK');
});

app.listen(PORT, () => {
  console.log(`LINE forwarder listening on http://localhost:${PORT}`);
  console.log(`DEVICE_BASE_URL = ${DEVICE_BASE_URL}`);
});
