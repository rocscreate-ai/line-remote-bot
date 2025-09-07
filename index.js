require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const {
  PORT = 3000,
  LINE_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  DEVICE_BASE_URL,
} = process.env;

const config = {
  channelAccessToken: LINE_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);
const app = express();

const replyText = (replyToken, text) =>
  client.replyMessage(replyToken, { type: 'text', text });

function isDigit1to5(t) {
  return /^[1-5]$/.test(t.trim());
}

async function sendModeToUno(mode) {
  if (!DEVICE_BASE_URL) throw new Error('DEVICE_BASE_URL not set');
  const url = new URL('/api/matrix', DEVICE_BASE_URL).toString();
  const { status, data } = await axios.get(url, {
    params: { m: mode },
    timeout: 6000,
  });
  return { ok: status >= 200 && status < 300, data };
}

function quickMenu() {
  return {
    type: 'text',
    text: '選擇顯示模式（1~5）：',
    quickReply: {
      items: [1, 2, 3, 4, 5].map(n => ({
        type: 'action',
        action: { type: 'message', label: String(n), text: String(n) },
      })),
    },
  };
}

app.get('/', (_req, res) => res.send('LINE Bot ready. POST /webhook'));

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(
      req.body.events.map(async (event) => {
        if (event.type !== 'message' || event.message.type !== 'text') {
          return null;
        }
        const text = event.message.text.trim().toUpperCase();

        if (text === 'MENU') {
          return client.replyMessage(event.replyToken, quickMenu());
        }

        if (isDigit1to5(text)) {
          try {
            const r = await sendModeToUno(Number(text));
            const ok = r && r.ok;
            const desc = ok ? 'OK' : 'NG';
            return replyText(event.replyToken, `已切換模式 ${text}（${desc}）`);
          } catch (e) {
            console.error('sendModeToUno error:', e.message);
            return replyText(event.replyToken, `切換模式失敗：${e.message}`);
          }
        }

        return replyText(
          event.replyToken,
          '請輸入 1~5 或輸入 MENU 叫出快捷選單。'
        );
      })
    );
    res.json(results);
  } catch (err) {
    console.error('[webhook] error:', err);
    res.status(500).end();
  }
});

app.listen(PORT, () => {
  console.log(`LINE Bot on :${PORT}`);
});
