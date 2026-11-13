# cf-relay-worker

零存储、端到端加密无感知的 Cloudflare 中继服务器（Worker + Durable Object）。

它只按 `routing_id` 在同一房间内广播密文信封，**不存储、不解密、不记录消息内容**。
加解密完全由客户端负责，服务器对载荷语义一无所知。

## 它和应用无关

服务器本身不包含任何剪贴板或具体应用的逻辑，任何客户端只要满足下面的契约就能用它做
设备间的加密广播通道：

- 连接 `wss://<host>/ws?rid=<64 位小写 hex>`
- 只发送 text frame，单条 ≤ `MAX_MESSAGE_BYTES`（默认 32 MiB / 33554432 字节），≤ 20 条/秒，每个房间 ≤ 8 条连接
- 客户端自行协商 `rid` 并自行完成加解密

`MAX_MESSAGE_BYTES` 是十进制字节数，写在 `wrangler.toml` 的 `[vars]` 里。未设置或不是正整数时，默认 `33554432`（32 MiB），与 [Durable Objects 入站 WebSocket 消息上限](https://developers.cloudflare.com/durable-objects/platform/limits/) 一致（文档更新于 2026-11-07，只限制收到的消息）。配置大于该上限时会被钳到 `33554432`。要收紧单条消息，把这个变量改小即可。

它是一个通用的加密广播通道，不绑定任何特定应用。能力边界（由设计决定，不是实现缺陷）：

- **纯广播**：消息会发给房间内除自己外的所有连接，无法定向发送给某一方
- **无离线投递**：零存储，不在线的客户端收不到
- **无身份认证**：`rid` 就是全部凭证，安全性依赖 `rid` 的保密性 + 客户端加密

## 开发

```sh
npm install
npm run dev            # 本地 wrangler dev
npm test               # vitest（在 workerd 内运行）
npm run gen:vectors    # 重新生成 test-vectors/vectors.json
```

## 部署到你自己的自定义域名

> 下文用 `clip.example.com` 作占位符，替换成**你自己的**中继域名（其 zone 需托管在同一 Cloudflare 账户）。

1. `npx wrangler login`（登录托管你的域名的 Cloudflare 账户）
2. `npm run deploy`
3. Cloudflare Dashboard → Workers → cf-relay-worker → Settings → Domains & Routes
   → Add Custom Domain → 输入 `clip.example.com`（该域名已托管在本账户，自动签发证书）
   （或改用 `wrangler.toml` 里注释的 `[[routes]]` 模板，填入你的域名后再部署）
4. 验证：`wss://clip.example.com/ws?rid=<64hex>` 可建立 WebSocket。

## 契约与测试向量

`test-vectors/vectors.json` 是客户端与服务端对齐用的加解密基准向量
（Argon2id 派生 + HKDF 展开 + AES-256-GCM 封包）。任何客户端实现都应当通过这些向量。

## 许可

MIT
