// index.js
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');            // 如不想加依賴，可改成內建 fetch

const {
  PORT = 3000,
  LINE_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  DEVICE_BASE_URL,                         // 例: http://192.168.1.120
} = process.env;

if (!LINE_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.warn('[warn] LINE_ACCESS_TOKEN / LINE_CHANNEL_SECRET 未設定');
}

const config = {
  channelAccessToken: LINE_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// 健康檢查 / 首頁
app.get('/', (_req, res) => res.send('LINE Bot ready. POST /webhook'));

// 1~5 檢查
const isDigit1to5 = (t) => /^[1-5]$/.test(String(t || '').trim());

// 快速選單
const quickMenu = () => ({
  type: 'text',
  text: '選一個模式：',
  quickReply: {
    items: [1, 2, 3, 4, 5].map((n) => ({
      type: 'action',
      action: { type: 'message', label: String(n), text: String(n) },
    })),
  },
});

// 呼叫 UNO /api/matrix?m=n
async function sendModeToUno(mode) {
  if (!DEVICE_BASE_URL) throw new Error('DEVICE_BASE_URL not set');
  const url = new URL('/api/matrix', DEVICE_BASE_URL);
  url.searchParams.set('m', String(mode));
  const { data } = await axios.get(url.toString(), { timeout: 5000 });
  return data;
}

// Webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(
      req.body.events.map(async (event) => {
        if (event.type !== 'message' || event.message.type !== 'text') return null;

        const text = event.message.text.trim().toUpperCase();

        if (text === 'MENU') {
          return client.replyMessage(event.replyToken, quickMenu());
        }

        if (isDigit1to5(text)) {
          try {
            const r = await sendModeToUno(Number(text));
            const ok = r && (r.ok === true || r.ok === 'true');
            const desc = ok ? 'OK' : 'NG';
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `已切換模式 ${text}（${desc}）`,
            });
          } catch (e) {
            console.error('sendModeToUno error:', e.message);
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `切換失敗：${e.message}`,
            });
          }
        }

        // 其他文字
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請輸入 1~5 或輸入 MENU 叫出快速選單。',
        });
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// **一定要** 監聽 Render 指定 PORT，否則會啟動失敗
app.listen(PORT, () => {
  console.log(`LINE Bot server running on :${PORT}`);
});
