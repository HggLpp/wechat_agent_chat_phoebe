# 微信公众号 AI Agent - 腾讯云函数部署教程

## 腾讯云函数 SCF 部署步骤

### 第一步：注册腾讯云

登录 https://console.cloud.tencent.com/scf

### 第二步：创建函数

1. 进入「函数服务」
2. 点击「创建」
3. 选择「从头开始」
4. 填写：
   - 函数名称：`wechat-agent`
   - 运行环境：`Node.js 14.17.0` 或更高
   - 创建方式：「在线编辑」，粘贴 `index.js` 的内容
5. 点击「完成」

### 第三步：配置环境变量

在函数详情页 → 「函数管理」→「环境变量」→ 「编辑」

添加以下环境变量：

| 变量名 | 值 |
|--------|-----|
| `WECHAT_TOKEN` | 你的 Token（和公众号后台填的一致） |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key |
| `DEEPSEEK_MODEL` | `deepseek-chat` |

### 第四步：配置触发器

1. 函数详情页 → 「触发管理」→ 「创建触发器」
2. 触发方式：选择「API 网关触发器」
3. 其他保持默认，点击「确定」

### 第五步：获取访问地址

创建触发器后，API 网关会给你一个访问地址，格式类似：
```
https://service-xxxxx-1234567890.gz.apigw.tencentcs.com/release/wechat-agent
```

**这个就是你的 URL**，在公众号后台填这个地址（注意：**不需要加 `/api/wechat`**，直接用这个完整地址）。

### 第六步：公众号后台配置

1. 登录 mp.weixin.qq.com
2. 设置与开发 → 基本配置 → 服务器配置
3. URL 填腾讯云 API 网关的地址
4. Token 填你在环境变量里设置的 `WECHAT_TOKEN`
5. EncodingAESKey：随机生成
6. 消息加密方式：明文模式

---

## 注意事项

- 腾讯云函数有免费额度，日常使用够用
- 如果公众号是订阅号，只能被动回复
- 修改代码后需要重新「部署」函数
