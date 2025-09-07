// index.js
require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios'); // 若不想加依賴，Node 18+ 可改用內建 fetch

// ====== 環境變數 ======
const {
  PORT = 3000,
  LINE_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  DEVICE_BASE_URL, // 例: http://192.168.1.120 或 https://xxxx.ngrok-free.app
} = process.env;

// 啟動時印出，方便在 Render 日誌檢查是否有讀到
console.log('[env] PORT              =', PORT);
console.log('[env] DEVICE_BASE_URL   =', DEVICE_BASE_URL ? DEVICE_BASE_URL : '(undefined)');

if (!LINE_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.warn('[warn] LINE_ACCESS_TOKEN / LINE_CHANNEL_SECRET 未設定');
}

// ====== LINE SDK 設定 ======
const config = {
  channelAccessToken: LINE_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// ====== 小工具 ======
const isDigit1to5 = (t) => /^[1-5]$/.test(String(t || '').trim());

// 統一轉人看的錯誤訊息
function toFriendlyError(e) {
  if (!e) return '未知錯誤';
  const msg = e.message || String(e);
  if (msg.includes('DEVICE_BASE_URL not set')) {
    return '尚未設定 DEVICE_BASE_URL';
  }
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return '無法解析裝置網址（可能是 URL 填錯或服務未公開）';
  }
  if (msg.includes('ECONNREFUSED')) {
    return '連線被拒絕（裝置不在該位址或服務沒開）';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
    return '連線逾時（雲端打不到你的裝置，需使用 ngrok/Cloudflare Tunnel）';
  }
  return msg;
}

// ====== 快速選單 ======
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

// ====== 呼叫 UNO API ======
async function sendModeToUno(mode) {
  if (!DEVICE_BASE_URL) throw new Error('DEVICE_BASE_URL not set');
  const url = new URL('/api/matrix', DEVICE_BASE_URL);
  url.searchParams.set('m', String(mode));
  const { data } = await axios.get(url.toString(), { timeout: 8000 });
  return data; // 預期 { ok: true/false, ... }
}

// 偵測 UNO 狀態（非必要，但有助除錯）
async function pollUnoStatus() {
  if (!DEVICE_BASE_URL) return { ok: false, err: 'DEVICE_BASE_URL not set' };
  try {
    const url = new URL('/status', DEVICE_BASE_URL);
    const { data } = await axios.get(url.toString(), { timeout: 5000 }).catch(() => ({ data: null }));
    return { ok: !!data, data };
  } catch (e) {
    return { ok: false, err: toFriendlyError(e) };
  }
}

// ====== 健康檢查 / 首頁 ======
app.get('/', async (_req, res) => {
  res.send('LINE Bot ready. POST /webhook');
});

// 給你自己看用的簡易狀態（非 LINE Webhook）
app.get('/status', async (_req, res) => {
  const uno = await pollUnoStatus();
  res.json({
    ok: true,
    deviceBaseUrl: DEVICE_BASE_URL || '(undefined)',
    uno,
  });
});

// ====== LINE Webhook ======
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const results = await Promise.all(
      req.body.events.map(async (event) => {
        if (event.type !== 'message' || event.message.type !== 'text') return null;

        const text = event.message.text.trim().toUpperCase();

        // 快速選單
        if (text === 'MENU') {
          return client.replyMessage(event.replyToken, quickMenu());
        }

        // 1~5 切模式
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
            console.error('sendModeToUno error:', e);
            return client.replyMessage(event.replyToken, {
              type: 'text',
              text: `切換失敗：${toFriendlyError(e)}`,
            });
          }
        }

        // 其他文字：引導
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請輸入 1~5 或輸入 MENU 叫出快速選單。',
        });
      })
    );

    res.json(results);
  } catch (err) {
    console.error('[webhook] error:', err);
    res.status(500).end();
  }
});

// ====== 啟動 HTTP 伺服器（Render 會指定 PORT） ======
app.listen(PORT, () => {
  console.log(`LINE Bot server running on :${PORT}`);
});
