import { ProbeResult, ProbeSideReport } from "../probe.types";
import { ModelProfile } from "./model-profile";

export function buildVerdict(target: ProbeSideReport, profile: ModelProfile) {
  const targetScore = target.summary.weightedScore;
  const passRate = target.summary.passRate;
  const expectedGap = Math.max(0, profile.expectedScore - targetScore);
  let risk = Math.round((1 - targetScore) * 58 + (1 - passRate) * 18 + expectedGap * 42);
  const evidence: string[] = [];
  const weakDimensions = Object.entries(target.summary.dimensionScores)
    .filter(([, score]) => score < 0.72)
    .sort((a, b) => a[1] - b[1]);

  if (target.summary.transportErrors > 0 || target.summary.errors > 0) {
    risk += 14;
    evidence.push("目标端点存在请求失败，可能是限流、鉴权、模型名错误或中转层异常");
  }
  if (expectedGap > 0.18) {
    evidence.push(
      `该模型按 ${profile.label} 档评估，当前得分低于预期 ${Math.round(expectedGap * 100)} 分`
    );
  }
  if (targetScore < 0.62) evidence.push("确定性探针整体得分偏低");
  if (passRate < 0.7) evidence.push("多项基础能力或格式遵循测试未通过");
  for (const [dimension, score] of weakDimensions.slice(0, 3)) {
    evidence.push(`${dimensionLabel(dimension)}维度偏弱：${Math.round(score * 100)}%`);
  }
  if (target.metrics.dilutionRate > 0.35) {
    evidence.push(`掺水率估算偏高：${Math.round(target.metrics.dilutionRate * 100)}%`);
  }
  if (target.metrics.protocolScore < 0.72) {
    evidence.push(`协议一致性偏弱：${Math.round(target.metrics.protocolScore * 100)}%`);
  }

  const responseModels = Array.from(
    new Set(target.results.map((item) => item.responseModel).filter(Boolean))
  );
  if (responseModels.length && !responseModels.includes(target.model)) {
    evidence.push(`响应中的 model 字段为 ${responseModels.join(", ")}，与请求模型不完全一致`);
    risk += 6;
  }

  risk = clamp(risk, 0, 100);
  const band = risk >= 70 ? "high" : risk >= 40 ? "medium" : "low";
  const label =
    band === "high"
      ? "高风险：疑似替换或能力严重不符"
      : band === "medium"
      ? "中风险：存在异常，建议复测"
      : "低风险：本轮未发现明显参假证据";

  if (!evidence.length) evidence.push("目标端点通过了大多数跨维度确定性探针");

  return {
    risk,
    band,
    label,
    expectedScore: profile.expectedScore,
    evidence
  };
}

export function summarizeSide(results: ProbeResult[]) {
  const totalWeight = results.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weightedScore =
    results.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
  const passRate =
    results.filter((item) => item.passed).length / Math.max(results.length, 1);
  const avgLatencyMs =
    results.reduce((sum, item) => sum + (item.latencyMs || 0), 0) /
    Math.max(results.length, 1);
  const errors = results.filter((item) => item.status && item.status >= 400).length;
  const transportErrors = results.filter((item) => !item.status && !item.content).length;
  const dimensionScores = buildDimensionScores(results);
  return {
    weightedScore: round(weightedScore),
    passRate: round(passRate),
    avgLatencyMs: Math.round(avgLatencyMs),
    errors,
    transportErrors,
    dimensionScores
  };
}

export function buildMetrics(
  results: ProbeResult[],
  summary: ReturnType<typeof summarizeSide>,
  profile: ModelProfile,
  requestedModel: string
) {
  const successCount = results.filter((item) => item.status && item.status >= 200 && item.status < 300 && item.content).length;
  const onlineRate = round(successCount / Math.max(results.length, 1));
  const usage = sumUsage(results);
  const usageLevel = tokenUsageLevel(usage.total, successCount);
  const responseModels = results.map((item) => item.responseModel).filter((model): model is string => Boolean(model));
  const responseModelUnstable = new Set(responseModels.map((model) => normalizeModelName(model))).size > 1;
  const responseModelMismatch = responseModels.some(
    (model) => !modelsCompatible(requestedModel, model)
  );
  const missingUsageRate = round(
    results.filter((item) => item.status && item.status < 300 && !item.usage).length /
      Math.max(successCount, 1)
  );
  const protocolScore = round(
    clamp(
      onlineRate * 0.5 +
        (1 - missingUsageRate) * 0.2 +
        (responseModelMismatch ? 0 : 0.2) +
        (responseModelUnstable ? 0 : 0.1),
      0,
      1
    )
  );
  const capabilityGap = Math.max(0, profile.expectedScore - summary.weightedScore);
  const dilutionRate = round(
    clamp((1 - summary.weightedScore) * 0.55 + capabilityGap * 0.35 + (1 - protocolScore) * 0.1, 0, 1)
  );
  const statusTone: "ok" | "warn" | "bad" =
    onlineRate < 0.6 || dilutionRate > 0.65
      ? "bad"
      : dilutionRate > 0.35 || protocolScore < 0.72
      ? "warn"
      : "ok";
  const signals: string[] = [];
  if (onlineRate < 1) signals.push("存在失败请求");
  if (missingUsageRate > 0.5) signals.push("多数响应缺少 usage 字段");
  if (responseModelMismatch) signals.push("响应 model 字段与请求模型不一致");
  if (responseModelUnstable) signals.push("响应 model 字段不稳定");
  if (usageLevel === "more") signals.push("Token 消耗高于本轮平均预期");
  if (!signals.length) signals.push("协议结构与能力表现暂无明显异常");
  return {
    onlineRate,
    dilutionRate,
    protocolScore,
    avgLatencyMs: summary.avgLatencyMs,
    tokenUsage: {
      ...usage,
      level: usageLevel
    },
    statusLabel: statusTone === "ok" ? "运行正常" : statusTone === "warn" ? "需要复测" : "异常",
    statusTone,
    signals
  };
}

export function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildDimensionScores(results: ProbeResult[]) {
  const grouped = new Map<string, { score: number; weight: number }>();
  for (const result of results) {
    const current = grouped.get(result.dimension) || { score: 0, weight: 0 };
    current.score += result.score * result.weight;
    current.weight += result.weight;
    grouped.set(result.dimension, current);
  }
  return Object.fromEntries(
    Array.from(grouped.entries()).map(([dimension, value]) => [
      dimension,
      round(value.score / Math.max(value.weight, 1))
    ])
  );
}

function sumUsage(results: ProbeResult[]) {
  return results.reduce(
    (sum, item) => {
      const usage = item.usage as
        | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number }
        | null
        | undefined;
      const input = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0);
      const output = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0);
      const total = Number(usage?.total_tokens ?? input + output);
      return {
        input: sum.input + input,
        output: sum.output + output,
        total: sum.total + total
      };
    },
    { input: 0, output: 0, total: 0 }
  );
}

function tokenUsageLevel(totalTokens: number, successCount: number) {
  if (!totalTokens || !successCount) return "unknown" as const;
  const average = totalTokens / successCount;
  if (average < 180) return "less" as const;
  if (average > 420) return "more" as const;
  return "average" as const;
}

function modelsCompatible(requested: string, response: string) {
  const requestedModel = normalizeModelName(requested);
  const responseModel = normalizeModelName(response);
  if (!requestedModel || !responseModel) return true;
  if (requestedModel === responseModel) return true;
  return requestedModel.includes(responseModel) || responseModel.includes(requestedModel);
}

function normalizeModelName(model: string) {
  return String(model || "")
    .toLowerCase()
    .replace(/^models\//, "")
    .replace(/[^a-z0-9.:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function dimensionLabel(dimension: string) {
  const labels: Record<string, string> = {
    format: "结构化输出",
    instruction: "指令遵循",
    reasoning: "推理",
    context: "上下文",
    coding: "代码",
    multilingual: "多语言",
    reliability: "可靠性"
  };
  return labels[dimension] || dimension;
}
