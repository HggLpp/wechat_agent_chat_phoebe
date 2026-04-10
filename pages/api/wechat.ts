/**
 * 微信公众号 AI Agent - Vercel 部署版本
 *
 * 支持功能：
 * - 微信签名验证（GET 请求）
 * - 接收用户消息并转发给 DeepSeek，返回 AI 回复（POST 请求）
 *
 * 部署方式：
 * 1. 将整个项目上传到 GitHub
 * 2. 在 Vercel 导入项目
 * 3. 在 Vercel 环境变量中配置 .env 中的所有变量
 * 4. 部署后，将 Vercel 提供的域名填入微信公众平台的服务器配置
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// 配置（从环境变量读取，部署时在 Vercel 设置）
// ============================================
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || '';
const WECHAT_APP_ID = process.env.WECHAT_APP_ID || '';
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ============================================
// DeepSeek API 调用
// ============================================
async function callDeepSeek(userMessage: string, openId: string): Promise<string> {
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
function verifySignature(token: string, signature: string, timestamp: string, nonce: string): boolean {
  const arr = [token, timestamp, nonce].sort();
  const str = arr.join('');
  const sha1 = crypto.createHash('sha1').update(str).digest('hex');
  return sha1 === signature;
}

// ============================================
// XML 消息解析
// ============================================
function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const matches = xml.matchAll(/<(\w+)><!\[CDATA\[([^\]]*)\]\]><\/\1>|<(\w+)>([^<]*)<\/\3>/g);
  for (const match of matches) {
    const key = match[1] || match[3];
    const value = match[2] !== undefined ? match[2] : match[4];
    result[key] = value;
  }
  return result;
}

// ============================================
// 构建微信回复 XML
// ============================================
function buildReplyXml(toUser: string, fromUser: string, content: string): string {
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
// 获取 Access Token（缓存机制）
// ============================================
let cachedToken: { token: string; expireAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expireAt) {
    return cachedToken.token;
  }

  try {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.access_token) {
      cachedToken = {
        token: data.access_token,
        expireAt: Date.now() + (data.expires_in - 200) * 1000,
      };
      return cachedToken.token;
    }
  } catch (error) {
    console.error('Failed to get access token:', error);
  }
  return null;
}

// ============================================
// 客服消息发送（可选，用于异步回复）
// ============================================
async function sendCustomerServiceMessage(openId: string, content: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  try {
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: openId,
          msgtype: 'text',
          text: { content },
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Failed to send customer message:', error);
    return false;
  }
}

// ============================================
// 主处理函数
// ============================================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const signature = searchParams.get('signature') || '';
  const timestamp = searchParams.get('timestamp') || '';
  const nonce = searchParams.get('nonce') || '';
  const echostr = searchParams.get('echostr') || '';

  if (!WECHAT_TOKEN) {
    return new NextResponse('Token not configured', { status: 500 });
  }

  // 验证签名
  if (verifySignature(WECHAT_TOKEN, signature, timestamp, nonce)) {
    return new NextResponse(echostr, { status: 200 });
  }

  return new NextResponse(' signature verification failed', { status: 403 });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const signature = searchParams.get('signature') || '';
  const timestamp = searchParams.get('timestamp') || '';
  const nonce = searchParams.get('nonce') || '';

  // 验证签名
  if (!verifySignature(WECHAT_TOKEN, signature, timestamp, nonce)) {
    return new NextResponse('signature verification failed', { status: 403 });
  }

  try {
    const body = await request.text();
    const msg = parseXml(body);

    const msgType = msg.MsgType;
    const fromUser = msg.FromUserName || '';
    const toUser = msg.ToUserName || '';

    // 只处理文本消息
    if (msgType === 'text') {
      const userContent = msg.Content || '';

      // 同步回复模式（简单直接，但有5秒超时风险）
      const reply = await callDeepSeek(userContent, fromUser);
      const xml = buildReplyXml(fromUser, toUser, reply);

      return new NextResponse(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    // 处理其他类型的消息（图片、语音等），返回空表示不回复
    if (msgType === 'image') {
      const xml = buildReplyXml(fromUser, toUser, '收到图片了！不过我现在还看不懂图片，发送文字消息和我聊天吧 😊');
      return new NextResponse(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml' },
      });
    }

    // 非文本消息返回空（success）
    return new NextResponse('success', { status: 200 });
  } catch (error) {
    console.error('POST handler error:', error);
    return new NextResponse('error', { status: 500 });
  }
}
