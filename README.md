# 微信公众号 AI Agent 部署教程

## 项目结构

```
wechat-agent/
├── .env.example          # 配置模板（你自己填入真实值）
├── package.json
├── next.config.js
├── tsconfig.json
└── pages/
    └── api/
        └── wechat.ts    # 核心代码（接收微信消息 + 调用 AI）
```

---

## 第一步：配置 .env 文件

复制 `.env.example` 并重命名为 `.env.local`（本地测试用），或者直接在 **Vercel** 后台填写环境变量。

需要填写的变量：

| 变量名 | 说明 | 从哪里获取 |
|--------|------|-----------|
| `WECHAT_APP_ID` | 公众号 AppID | 公众号后台 → 设置与开发 → 基本配置 |
| `WECHAT_APP_SECRET` | 公众号 AppSecret | 同上 |
| `WECHAT_TOKEN` | 自定义 Token | 自己设一个随机字符串，如 `abc123xyz` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | [platform.deepseek.com](https://platform.deepseek.com) → API Keys |
| `DEEPSEEK_MODEL` | 模型名称 | 默认 `deepseek-chat` |

---

## 第二步：上传到 GitHub

1. 登录 [GitHub](https://github.com)
2. 点击右上角 **+** → **New repository**
3. 仓库名随便填，比如 `wechat-agent`
4. 选择 **Private**（私有）
5. 点击 **Create repository**
6. 按照页面提示，把本地代码推上去：

```bash
cd wechat-agent
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/wechat-agent.git
git push -u origin main
```

---

## 第三步：部署到 Vercel

1. 登录 [Vercel](https://vercel.com)（用 GitHub 登录）
2. 点击 **Add New** → **Project**
3. 选择你的 GitHub 仓库 `wechat-agent`
4. Framework Preset 选择 **Next.js**（会自动识别）
5. 点击 **Environment Variables**，添加以下环境变量：

   - `WECHAT_APP_ID` = 你的 AppID
   - `WECHAT_APP_SECRET` = 你的 AppSecret
   - `WECHAT_TOKEN` = 你设的 Token
   - `DEEPSEEK_API_KEY` = 你的 DeepSeek API Key
   - `DEEPSEEK_MODEL` = `deepseek-chat`

6. 点击 **Deploy**

部署成功后，Vercel 会给你一个域名，比如：
`https://wechat-agent.vercel.app`

---

## 第四步：在公众号后台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入 **设置与开发** → **基本配置**
3. 找到 **服务器配置**，点击 **修改配置**
4. 填写：

   - **URL**：`https://wechat-agent.vercel.app/api/wechat`（注意是 `/api/wechat`）
   - **Token**：填写你在 `.env` 里设置的 `WECHAT_TOKEN`
   - **EncodingAESKey**：点击随机生成
   - **消息加密方式**：选择 **明文模式**（最简单）

5. 点击 **提交**

---

## 第五步：验证

在公众号后台「服务器配置」页面，状态显示为「已启用」。

然后在公众号里给自己发一条消息，看看 AI 是否回复了！

---

## ⚠️ 注意事项

1. **订阅号限制**：只能被动回复（用户发一条你回一条），不能主动推送
2. **响应时间**：如果 AI 回复慢，可能超过 5 秒限制，建议用 DeepSeek（速度快）
3. **免费额度**：Vercel 每月有 100 小时免费部署额度，够用
4. **DeepSeek 额度**：新用户有免费 Token，用完需要充值

---

## 常见问题

**Q: 提交时报错"URL 配置失败"**
- 确保 Vercel 部署成功，访问 `https://你的域名/api/wechat` 能看到 "Token not configured" 或正常响应
- 用 GET 请求访问时，URL 带参数：`https://你的域名/api/wechat?signature=xxx&timestamp=xxx&nonce=xxx&echostr=xxx`

**Q: 消息发出去没反应**
- 检查 Vercel 日志，看是否有报错
- 确认 DeepSeek API Key 正确

**Q: 想自定义 AI 的性格/角色**
- 修改 `pages/api/wechat.ts` 中的 system prompt 内容即可
