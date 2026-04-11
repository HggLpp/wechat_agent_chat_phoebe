'use strict';

const crypto = require('crypto');

// ============================================
// 配置（在腾讯云函数的环境变量中设置）
// ============================================
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ============================================
// DeepSeek API 调用
// ============================================
async function callDeepSeek(userMessage) {
  if (!DEEPSEEK_API_KEY) {
    return '抱歉，AI 服务暂未配置，请联系管理员。';
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一个友好、聪明、有帮助的 AI 助手。请用简洁、有趣的方式回答用户的问题。保持对话轻松自然，像和朋友聊天一样。',
          },
          { role: 'user', content: userMessage },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      return '抱歉，AI 服务暂时不可用，请稍后再试。';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '抱歉，我没有收到有效的回复。';
  } catch (error) {
    console.error('DeepSeek call error:', error);
    return '抱歉，发生了一点错误，请稍后再试。';
  }
}

// ============================================
// 微信签名验证
// ============================================
function verifySignature(signature, timestamp, nonce) {
  const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
  const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  return sha1 === signature;
}

// ============================================
// XML 解析 & 构建
// ============================================
function parseXml(xml) {
  const result = {};
  const matches = xml.matchAll(/<(\w+)><!\[CDATA\[([^\]]*)\]\]><\/\1>|<(\w+)>([^<]*)<\/\3>/g);
  for (const match of matches) {
    result[match[1] || match[3]] = match[2] !== undefined ? match[2] : match[4];
  }
  return result;
}

function buildReplyXml(toUser, fromUser, content) {
  const time = Math.floor(Date.now() / 1000);
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${time}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

// ============================================
// 云函数入口
// ============================================
exports.main_handler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event));

  const method = event.httpMethod || event.requestContext?.httpMethod || 'GET';
  const query = event.queryString || event.queryStringParameters || {};

  const signature = query.signature || '';
  const timestamp = query.timestamp || '';
  const nonce = query.nonce || '';

  // GET：微信验证
  if (method === 'GET') {
    const echostr = query.echostr || '';
    if (verifySignature(signature, timestamp, nonce)) {
      return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: echostr };
    }
    return { statusCode: 403, body: 'signature verification failed' };
  }

  // POST：处理消息
  if (method === 'POST') {
    if (!verifySignature(signature, timestamp, nonce)) {
      return { statusCode: 403, body: 'signature verification failed' };
    }

    try {
      const body = event.body || '';
      const msg = parseXml(body);
      const msgType = msg.MsgType;
      const fromUser = msg.FromUserName || '';
      const toUser = msg.ToUserName || '';

      if (msgType === 'text') {
        const reply = await callDeepSeek(msg.Content || '');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/xml' },
          body: buildReplyXml(fromUser, toUser, reply),
        };
      }

      if (msgType === 'image') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/xml' },
          body: buildReplyXml(fromUser, toUser, '收到图片了！不过我现在还看不懂图片，发送文字消息和我聊天吧 😊'),
        };
      }

      return { statusCode: 200, body: 'success' };
    } catch (error) {
      console.error('POST handler error:', error);
      return { statusCode: 500, body: 'error' };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
