/**
 * 微信公众号 AI Agent - 腾讯云函数版本
 * 
 * 部署步骤：
 * 1. 登录腾讯云 https://console.cloud.tencent.com/scf
 * 2. 创建函数 → 选择「从头开始」→ 环境「Node.js 14+」
 * 3. 上传此代码
 * 4. 配置环境变量（和 Vercel 一样）
 * 5. 触发器选择「API 网关触发」
 * 6. 部署后，API网关地址就是你的访问 URL
 */

const https = require('https');
const crypto = require('crypto');

// ============================================
// 配置（从环境变量读取）
// ============================================
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ============================================
// 微信签名验证
// ============================================
function verifySignature(token, signature, timestamp, nonce) {
  const arr = [token, timestamp, nonce].sort();
  const str = arr.join('');
  const sha1 = crypto.createHash('sha1').update(str).digest('hex');
  return sha1 === signature;
}

// ============================================
// XML 消息解析
// ============================================
function parseXml(xml) {
  const result = {};
  const regex = /<(\w+)><!\[CDATA\[([^\]]*)\]\]><\/\1>|<(\w+)>([^<]*)<\/\3>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] !== undefined ? match[2] : match[4];
    result[key] = value;
  }
  return result;
}

// ============================================
// 构建微信回复 XML
// ============================================
function buildReplyXml(toUser, fromUser, content) {
  const time = Math.floor(Date.now() / 1000).toString();
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${time}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

// ============================================
// DeepSeek API 调用
// ============================================
async function callDeepSeek(userMessage) {
  if (!DEEPSEEK_API_KEY) {
    return '抱歉，AI 服务暂未配置，请联系管理员。';
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: `你是一个友好、聪明、有帮助的 AI 助手。请用简洁、有趣的方式回答用户的问题。
如果用户问你关于你自己的问题，你可以说你是一个基于 AI 的助手，由微信公众号提供支持。
保持对话轻松自然，像和朋友聊天一样。`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      stream: false,
    });

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const reply = json.choices?.[0]?.message?.content || '抱歉，我没有收到有效的回复。';
          resolve(reply);
        } catch (e) {
          console.error('Parse error:', e);
          resolve('抱歉，发生了错误，请稍后再试。');
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      resolve('抱歉，AI 服务暂时不可用，请稍后再试。');
    });

    req.setTimeout(4000, () => {
      req.destroy();
      resolve('抱歉，AI 回复超时，请稍后再试。');
    });

    req.write(postData);
    req.end();
  });
}

// ============================================
// 主入口（腾讯云 SCF 格式）
// ============================================
exports.main_handler = async (event, context) => {
  // GET 请求 - 微信验证
  if (event.httpMethod === 'GET') {
    const query = event.queryStringParameters || {};
    const signature = query.signature || '';
    const timestamp = query.timestamp || '';
    const nonce = query.nonce || '';
    const echostr = query.echostr || '';

    if (!WECHAT_TOKEN) {
      return { statusCode: 500, body: 'Token not configured' };
    }

    if (verifySignature(WECHAT_TOKEN, signature, timestamp, nonce)) {
      return { statusCode: 200, body: echostr };
    }

    return { statusCode: 403, body: 'signature verification failed' };
  }

  // POST 请求 - 处理消息
  if (event.httpMethod === 'POST') {
    const query = event.queryStringParameters || {};
    const signature = query.signature || '';
    const timestamp = query.timestamp || '';
    const nonce = query.nonce || '';

    if (!verifySignature(WECHAT_TOKEN, signature, timestamp, nonce)) {
      return { statusCode: 403, body: 'signature verification failed' };
    }

    try {
      const body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      const msg = parseXml(body);

      const msgType = msg.MsgType;
      const fromUser = msg.FromUserName || '';
      const toUser = msg.ToUserName || '';

      // 只处理文本消息
      if (msgType === 'text') {
        const userContent = msg.Content || '';
        const reply = await callDeepSeek(userContent);
        const xml = buildReplyXml(fromUser, toUser, reply);

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/xml' },
          body: xml,
        };
      }

      // 其他消息
      return { statusCode: 200, body: 'success' };
    } catch (error) {
      console.error('Error:', error);
      return { statusCode: 500, body: 'error' };
    }
  }

  return { statusCode: 400, body: 'unsupported method' };
};
