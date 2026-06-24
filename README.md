# 模型真伪检测台

一个 Vue 3 + NestJS 本地检测网站，用于检测 OpenAI-compatible 中转站是否存在“声称模型”和实际能力不符的风险。

## 启动

开发模式：

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。NestJS API 默认运行在 `http://localhost:3000/api`。

如果端口被旧进程占用，先结束旧的 `npm run dev`，或检查：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

生产构建：

```bash
npm run build
npm start
```

当前 `npm start` 启动 NestJS API，前端构建产物在 `dist-web/`。后续可以把它接到 Nest 静态托管或单独部署到 Nginx/Vercel。

## 工作方式

- 选择平台：用于快速选择主流模型目录。
- 选择模型：支持 OpenAI、Anthropic、Gemini、DeepSeek、通义千问、Moonshot 等常见模型名，也支持手动输入。
- 连接信息：只需要填写 `BASE URL` 和 `API Key`。

报告会汇总综合得分、模型预期、在线率、掺水率、Token 消耗、协议一致性、平均延迟、维度画像和逐条响应证据。指标口径参考 Hvoy 的模型检测台：用接口可用性、返回结构、身份一致性、签名指纹、能力探针和 Token 用量做交叉判断。

当前后端按 OpenAI-compatible `/chat/completions` 协议请求目标端点。Anthropic 等非 OpenAI-compatible 官方 API 需要通过兼容中转层接入，或后续再添加原生平台适配器。

## API

- `GET /api/health`：健康检查。
- `POST /api/probe`：运行检测。请求体包含 `target.platform`、`target.baseUrl`、`target.apiKey` 和 `target.model`。

检测探针定义在 `src/probe/probe.service.ts`，完整后端探针逻辑见 `docs/probe-logic.md`。前端入口在 `web/src/App.vue`。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

测试用例覆盖：

- 最新模型档位识别和 13 项探针报告结构。
- Gemini OpenAI-compatible Base URL 拼接。
- 中转站请求失败时的高风险/异常状态判断。

## 说明

这类检测无法给出法律意义上的“绝对证明”。它更适合做自动化筛查：当中转站把低阶模型冒充高阶模型时，格式遵循、复杂指令、上下文取针、签名指纹、协议一致性和推理稳定性通常会暴露异常。建议对高风险端点多次复测，并结合真实业务样本继续验证。
