# 模型真伪检测台

一个 React + NestJS 本地检测网站，用于检测 OpenAI-compatible 中转站是否存在“声称模型”和实际能力不符的风险。

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

报告会汇总综合得分、通过率、模型预期、平均延迟、维度画像和逐条响应证据。

当前后端按 OpenAI-compatible `/chat/completions` 协议请求目标端点。Anthropic 等非 OpenAI-compatible 官方 API 需要通过兼容中转层接入，或后续再添加原生平台适配器。

## API

- `GET /api/health`：健康检查。
- `POST /api/probe`：运行检测。请求体包含 `target.platform`、`target.baseUrl`、`target.apiKey` 和 `target.model`。

检测探针定义在 `src/probe/probe.service.ts`，前端入口在 `web/src/App.tsx`。

## 说明

这类检测无法给出法律意义上的“绝对证明”。它更适合做自动化筛查：当中转站把低阶模型冒充高阶模型时，格式遵循、复杂指令、上下文取针和推理稳定性通常会暴露异常。建议对高风险端点多次复测，并尽量启用官方参考端点。
