# cf-relay-worker

零存储、端到端加密无感知的 Cloudflare 中继服务器（Worker + Durable Object）。

它只按 `routing_id` 在同一房间内广播密文信封，**不存储、不解密、不记录消息内容**。
加解密完全由客户端负责，服务器对载荷语义一无所知。

## 它和应用无关

服务器本身不包含任何剪贴板或具体应用的逻辑，任何客户端只要满足下面的契约就能用它做
设备间的加密广播通道。

### 连接

- 升级 `GET /ws`。**不要**把房间 id 放在 URL 或查询字符串里（旧的 `?rid=` 已移除，再带也会被忽略）。
- 在升级时通过 `Sec-WebSocket-Protocol` 提交房间 id，推荐同时发送两个 token：
  `cf-relay-v1` 和 `rid.<64 位小写 hex>`。
- 服务端校验 `rid` 为 `/^[0-9a-f]{64}$/`，不合法返回 **400**；校验通过后用
  `idFromName(rid)` 路由到对应的 Durable Object，并在 101 响应里回显
  `Sec-WebSocket-Protocol: cf-relay-v1`（只回显版本 token，避免把 rid 再写进响应头）。
- 非浏览器客户端也可以改用请求头 `X-Relay-Room: <64hex>`（文档上仍以子协议为主路径）。
  若子协议里出现了畸形的 `rid.*` token，不会回退到该请求头。
- 房间已满（每个房间最多 **16** 条连接）时返回 **429** `room full`。重连前请先关闭旧连接。

连接进入房间后，服务端先给新连接发一条控制帧：

```json
{"control":"hello","v":1}
```

同时向房间内**其他已在线**的连接发送（不会发给刚加入的那一方，避免空状态回环重发）：

```json
{"control":"peer_joined","peers":3}
```

`peers` 是加入之后的连接数，便于客户端做展示；已在线的客户端应重发自己缓存的「最新一条」密文信封，新加入方如果还没有任何缓存则不应立刻广播。

### 数据帧与限额

- 只接受 text frame，载荷对服务器是不透明的（不解析应用层信封）。二进制帧回
  `{"control":"error","code":"bad_request"}`。
- 单条 ≤ `MAX_MESSAGE_BYTES`（默认 32 MiB / 33554432 字节 UTF-8），超出回 `too_large`，且不会广播给对端。
- 每条连接 ≤ 20 条/秒；整个房间另有 **4 MiB/s** 的滑动窗口字节预算。超出回 `rate_limited`，不会广播。
- 同一连接累计 **3** 次 `too_large` / `rate_limited`（含房间预算）/ `bad_request` 违规后，服务端关闭该连接（1008），而不是只回错误却一直占着槽位。

`MAX_MESSAGE_BYTES` 是十进制字节数，写在 `wrangler.toml` 的 `[vars]` 里。未设置或不是正整数时，默认 `33554432`（32 MiB），与 [Durable Objects 入站 WebSocket 消息上限](https://developers.cloudflare.com/durable-objects/platform/limits/) 一致（文档更新于 2026-11-07，只限制收到的消息）。配置大于该上限时会被钳到 `33554432`。要收紧单条消息，把这个变量改小即可。

错误帧形状：`{"control":"error","code":"<code>","detail?":"..."}`。

### 健康检查

`GET /health`（无需认证）返回 **200** 和 `{"ok":true}`，供探活用。

## 能力边界（由设计决定，不是实现缺陷）

- **纯广播**：消息会发给房间内除自己外的所有连接，无法定向发送给某一方
- **无离线投递**：零存储，不在线的客户端收不到；后上线设备靠 `peer_joined` 触发对端重发缓存
- **无身份认证**：`rid` 就是全部凭证，安全性依赖 `rid` 的保密性 + 客户端加密
- **不做应用协议**：不解密、不识别剪贴板、不内置隧道（例如 Chisel 只应出现在客户端出网路径上）
- **暂不接受二进制帧**（当前 MVP）

## 日志与可观测性

房间 id 属于密钥材料。不要把 `rid` 放进 URL；本仓库将 `invocation_logs` 设为关闭，因为调用日志会记录请求头（`Sec-WebSocket-Protocol`、`X-Relay-Room`）。应用日志也不应打印子协议、房间头或 rid。

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
4. 验证：对 `wss://clip.example.com/ws` 做 WebSocket 升级，并带上
   `Sec-WebSocket-Protocol: cf-relay-v1, rid.<64hex>`。`GET https://clip.example.com/health` 应返回 `{"ok":true}`。

## 契约与测试向量

`test-vectors/vectors.json` 是客户端与服务端对齐用的加解密基准向量
（Argon2id 派生 + HKDF 展开 + AES-256-GCM 封包）。任何客户端实现都应当通过这些向量。
应用层信封格式由客户端仓库定义，本 Worker 只转发 text frame。

## 许可

MIT
