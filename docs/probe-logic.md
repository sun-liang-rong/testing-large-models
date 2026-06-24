# 后端探针逻辑

后端探针入口在 `POST /api/probe`，控制器调用 `ProbeService.run(dto)`。请求体只需要 `target.baseUrl`、`target.apiKey`、`target.model`，可选 `target.platform`。

核心文件：

- `src/probe/probe.service.ts`：编排执行、调用目标端点、组装报告。
- `src/probe/probes/probe-definitions.ts`：13 个探针定义和单项评分。
- `src/probe/probes/probe-variants.ts`：每轮随机探针变体生成。
- `src/probe/probes/probe-utils.ts`：JSON 解析、检查点评分和基础工具。
- `src/probe/scoring/model-profile.ts`：模型档位识别。
- `src/probe/scoring/report-scoring.ts`：汇总分、指标和风险结论。

## 执行流程

1. 校验目标端点：`baseUrl`、`apiKey`、`model` 不能为空。
2. 根据模型名识别档位：旗舰、强模型、标准、轻量、未知。
3. 按声明模型名和本轮随机种子构建 13 个确定性探针变体。
4. 用有限并发池调用目标端点的 OpenAI-compatible `/chat/completions`，当前并发为 4。
5. 每个探针独立解析响应并评分，记录响应内容、延迟、HTTP 状态、usage、finish_reason 和响应 model 字段。
6. 汇总加权分、通过率、维度分、在线率、掺水率、协议一致性和风险结论。

端点标准化规则：

- 如果 `baseUrl` 已以 `/chat/completions` 结尾，直接使用。
- 如果以 `/openai` 或 `/v1` 结尾，追加 `/chat/completions`。
- 其他情况追加 `/v1/chat/completions`。

每次请求固定参数：

- `temperature: 0.1`
- `stream: false`
- `max_tokens` 使用每个探针自己的上限
- 超时为 45000ms

探针题目会在每轮请求中生成变体，包括哨兵 token、签名字符串、算术数字、长上下文 needle、CSV 内容、工具参数和部分推理题实体。这样能降低固定题被中转层缓存或特判的概率。

## 13 个探针

| ID | 名称 | 维度 | 权重 | 检查点 |
| --- | --- | --- | ---: | --- |
| `identity_contract` | 模型身份一致性 | reliability | 0.65 | JSON 中精确复制请求模型名、归一化模型家族、`passthrough_ok=true`、复制本轮 run id |
| `json_schema_and_math` | 结构化输出与精确算术 | format | 1.15 | JSON 键名、随机加法、随机哨兵字符串、质数序列、checksum |
| `instruction_hierarchy` | 抗提示词覆盖 | instruction | 1.2 | 必须输出本轮随机 token，不能被后续覆盖指令带偏 |
| `signature_fingerprint` | 签名指纹保真 | format | 1.05 | 精确保留本轮随机签名字符串 |
| `reasoning_grid` | 多步空间推理 | reasoning | 1.25 | 随机网格和移动序列后输出 row + column |
| `logic_table` | 约束逻辑 | reasoning | 1.35 | 随机人名和颜色的三人三色约束推理 |
| `counterfactual_reasoning` | 反事实规则推理 | reasoning | 1.1 | 虚构规则链推理，答案必须是否定 |
| `needle_recall` | 长上下文取针 | context | 1.15 | 从 54 段噪声中取回本轮随机 audit_key |
| `code_reasoning` | 代码执行心算 | coding | 1.2 | 推断随机 JS 数组和 reduce 初始值的输出 |
| `tool_json_planning` | 工具调用参数规划 | instruction | 1.0 | 生成本轮随机 retries/tags 的 fake tool call JSON 参数 |
| `multilingual_consistency` | 中英混合约束 | multilingual | 0.95 | 中文第一行 + 本轮随机英文 token 第二行，且只输出两行 |
| `benign_safety` | 良性安全建议 | reliability | 0.8 | 对漂白剂存放给出正常安全建议，避免过度拒答 |
| `csv_repair` | CSV 转义修复 | format | 0.9 | 输出本轮随机姓名和分数的 CSV 行 |

## 单项评分

每个探针的 `evaluate(text)` 返回：

- `score`: 0 到 1
- `passed`: 是否通过
- `note`: 失败原因或通过说明

评分方式有两类：

- 精确探针：直接 `pass()` 或 `fail(score, note)`，例如签名、指令覆盖、代码心算。
- 多检查点探针：`scoreFromChecks()` 按检查点通过比例计分，得分 `>= 0.85` 才算通过。

请求失败时该探针直接记 0 分，并记录错误、延迟和状态码。

## 汇总评分

`summary.weightedScore` 是按探针权重计算的加权平均：

```text
weightedScore = sum(score * weight) / sum(weight)
```

`summary.passRate` 是通过探针数量占比。

`summary.dimensionScores` 会按维度聚合加权平均，当前维度包括：

- `format`
- `instruction`
- `reasoning`
- `context`
- `coding`
- `multilingual`
- `reliability`

## 模型档位

后端用模型名正则粗略识别模型档位，并给出期望分：

| 档位 | expectedScore | 示例匹配 |
| --- | ---: | --- |
| 旗舰模型 | 0.86 | `gpt-5.5`、`gpt-5.4`、`gpt-4.1`、`claude-opus`、`claude-sonnet-4-6`、`gemini-3.5`、`deepseek-reasoner`、`qwen3-max`、`glm-5.2` |
| 强模型 | 0.78 | `gpt-5.4-mini`、`claude-sonnet-4-5`、`gemini-3-flash`、`deepseek-chat`、`qwen-plus`、`kimi-k2`、`glm-5` |
| 标准模型 | 0.68 | `mini`、`flash`、`haiku`、`lite`、`small`、`qwen-turbo` |
| 轻量模型 | 0.56 | `nano`、`tiny`、`8b`、`7b`、`3b`、`1b` |
| 未知档位模型 | 0.70 | 未命中以上规则 |

## 指标计算

### 在线率

成功请求数量占比。成功条件是：

- HTTP 状态码 2xx
- 响应中有 content

```text
onlineRate = successCount / probeCount
```

### Token 消耗

汇总所有响应中的 `usage`：

- input: `prompt_tokens` 或 `input_tokens`
- output: `completion_tokens` 或 `output_tokens`
- total: `total_tokens`，缺失时使用 input + output

平均每个成功请求：

- `< 180`: `less`
- `180 - 420`: `average`
- `> 420`: `more`
- 无 token 或无成功请求：`unknown`

### 协议一致性

协议分由在线率、usage 字段完整度、响应 model 与请求模型的兼容性、响应 model 稳定性组成：

```text
protocolScore =
  onlineRate * 0.5
  + (1 - missingUsageRate) * 0.2
  + (responseModelMismatch ? 0 : 0.2)
  + (responseModelUnstable ? 0 : 0.1)
```

结果会 clamp 到 0 到 1。

`responseModelMismatch` 会把响应 model 字段直接和请求模型做归一化兼容比较，而不是只判断本轮响应之间是否一致。

### 掺水率估算

掺水率是能力差距和协议异常的综合估算：

```text
capabilityGap = max(0, expectedScore - weightedScore)

dilutionRate =
  (1 - weightedScore) * 0.55
  + capabilityGap * 0.35
  + (1 - protocolScore) * 0.1
```

结果会 clamp 到 0 到 1。

### 运行状态

- `bad`: 在线率 `< 0.6` 或掺水率 `> 0.65`
- `warn`: 掺水率 `> 0.35` 或协议一致性 `< 0.72`
- `ok`: 其他情况

对应标签：

- `运行正常`
- `需要复测`
- `异常`

## 风险结论

风险分基础公式：

```text
risk =
  (1 - weightedScore) * 58
  + (1 - passRate) * 18
  + expectedGap * 42
```

其中：

```text
expectedGap = max(0, expectedScore - weightedScore)
```

额外加分项：

- 有 HTTP 错误或传输错误：`+14`
- 响应 `model` 字段与请求模型不完全一致：`+6`

风险分 clamp 到 0 到 100。

风险等级：

- `>= 70`: `high`，高风险：疑似替换或能力严重不符
- `>= 40`: `medium`，中风险：存在异常，建议复测
- `< 40`: `low`，低风险：本轮未发现明显参假证据

证据摘要会收集：

- 请求失败
- 低于模型档位预期
- 总体得分偏低
- 通过率偏低
- 最弱的最多 3 个维度
- 掺水率偏高
- 协议一致性偏弱
- 响应 model 字段不一致

## 返回结构

成功响应结构：

```ts
{
  ok: true,
  generatedAt: string,
  target: {
    label: "target",
    model: string,
    platform: string,
    baseUrl: string,
    results: ProbeResult[],
    summary: {
      weightedScore: number,
      passRate: number,
      avgLatencyMs: number,
      errors: number,
      transportErrors: number,
      dimensionScores: Record<string, number>
    },
    metrics: {
      onlineRate: number,
      dilutionRate: number,
      protocolScore: number,
      avgLatencyMs: number,
      tokenUsage: {
        input: number,
        output: number,
        total: number,
        level: "less" | "average" | "more" | "unknown"
      },
      statusLabel: string,
      statusTone: "ok" | "warn" | "bad",
      signals: string[]
    }
  },
  modelProfile: {
    tier: "flagship" | "strong" | "standard" | "economy" | "unknown",
    expectedScore: number,
    label: string
  },
  verdict: {
    risk: number,
    band: "low" | "medium" | "high",
    label: string,
    expectedScore: number,
    evidence: string[]
  }
}
```

## 注意点

- 当前探针是确定性能力筛查，不是法律意义上的绝对证明。
- 评分依赖中转站是否兼容 OpenAI `/chat/completions` 响应结构。
- 有些官方平台原生 API 不兼容 OpenAI 格式，需要通过兼容层接入。
- `profileModel()` 里的模型正则需要随着模型目录更新而维护。
- 探针已加入本轮变体，但还不是多次重复测量；后续可对关键探针跑多个变体并使用中位数/低分位评分。
- `responseModelMismatch` 现在直接比较响应 model 与请求模型；如果中转站统一隐藏 model 字段，只会影响 usage、在线率和能力表现等其他指标。
