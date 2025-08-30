const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ✅ 只保留一個 handleEvent
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const text = event.message.text.trim().toUpperCase();

  if (text === 'MENU') {
    const quickReplyMsg = {
      type: 'text',
      text: '選一個動作：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '開燈', text: 'V0 ON' } },
          { type: 'action', action: { type: 'message', label: '關燈', text: 'V0 OFF' } },
          { type: 'action', action: { type: 'message', label: '查詢狀態', text: 'STATUS' } }
        ]
      }
    };
    return client.replyMessage(event.replyToken, quickReplyMsg);
  }

  if (text === 'V0 ON') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '已開燈' });
  }
  if (text === 'V0 OFF') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '已關燈' });
  }
  if (text === 'STATUS') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '目前狀態：...' });
  }

  return client.replyMessage(event.replyToken, { type: 'text', text: '指令：MENU / V0 ON / V0 OFF / STATUS' });
}

app.listen(process.env.PORT || 3000, () => {
  console.log('LINE Bot server running');
});
