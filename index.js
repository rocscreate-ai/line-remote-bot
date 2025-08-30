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

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text.trim().toUpperCase();

  // ⬇️ 這段就是「收到 MENU 回 Quick Reply」
  if (text === 'MENU') {
  const buttonsMsg = {
    type: 'template',
    altText: '控制選單',
    template: {
      type: 'buttons',
      title: 'IoT 控制',
      text: '請選擇動作',
      actions: [
        { type: 'message', label: '開燈', text: 'V0 ON' },
        { type: 'message', label: '關燈', text: 'V0 OFF' },
        { type: 'message', label: '查詢狀態', text: 'STATUS' },
        { type: 'uri', label: '說明文件', uri: 'https://你的說明網址' }
      ]
    }
  };
  return client.replyMessage(event.replyToken, buttonsMsg);
  }

  // 你原本處理 V0 ON / V0 OFF / STATUS 的程式邏輯放在下面…
  if (text === 'V0 ON') {
    // ... 開燈
    return client.replyMessage(event.replyToken, { type: 'text', text: '已開燈' });
  }
  if (text === 'V0 OFF') {
    // ... 關燈
    return client.replyMessage(event.replyToken, { type: 'text', text: '已關燈' });
  }
  if (text === 'STATUS') {
    // ... 查詢狀態
    return client.replyMessage(event.replyToken, { type: 'text', text: '目前狀態：...' });
  }

  // 其他訊息的預設回覆
  return client.replyMessage(event.replyToken, { type: 'text', text: '指令：MENU / V0 ON / V0 OFF / STATUS' });
}
