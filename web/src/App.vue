<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import ConfigPanel from "./components/ConfigPanel.vue";
import LoadingPanel from "./components/LoadingPanel.vue";
import ProbePanel from "./components/ProbePanel.vue";
import ReportPanel from "./components/ReportPanel.vue";
import ResultPlaceholder from "./components/ResultPlaceholder.vue";
import TargetSummary from "./components/TargetSummary.vue";
import { findPlatform, platforms } from "./modelCatalog";
import type { EndpointForm, ProbeReport, SiteMetrics } from "./types";

const firstPlatform = platforms[0];
const emptyEndpoint: EndpointForm = {
  platform: firstPlatform.id,
  baseUrl: firstPlatform.baseUrl,
  apiKey: "",
  model: firstPlatform.models[0].id
};

const loadingMessages = [
  "运行跨维度确定性探针...",
  "检查结构化输出、推理和上下文稳定性...",
  "评估模型档位与实际能力差距...",
  "整理异常证据和响应片段..."
];

const loadingSteps = [
  "生成随机探针变体",
  "并发请求目标端点",
  "解析响应与 usage",
  "计算最终分数"
];

const tokenLevelLabels = {
  less: "较少",
  average: "正常",
  more: "偏高",
  unknown: "未知"
};

interface ProbeCoverageItem {
  label: string;
  covered: boolean;
  tip: string;
}

const target = ref<EndpointForm>({ ...emptyEndpoint });
const customModel = ref("");
const report = ref<ProbeReport | null>(null);
const error = ref("");
const loading = ref(false);
const loadingIndex = ref(0);
const modelMenuOpen = ref(false);
const showApiKey = ref(false);
const currentStep = ref(1);
const pingState = ref<"idle" | "loading" | "ok" | "fail">("idle");
const pingMessage = ref("");
const reportJsonOpen = ref(false);
let loadingTimer: number | undefined;
let abortController: AbortController | null = null;

const platform = computed(() => findPlatform(target.value.platform));
const selectedModel = computed(() =>
  target.value.model === "custom" ? customModel.value.trim() : target.value.model
);
const selectedModelOption = computed(() =>
  platform.value.models.find((model) => model.id === target.value.model)
);
const loadingCopy = computed(() => loadingMessages[loadingIndex.value % loadingMessages.length]);
const loadingStepIndex = computed(() => Math.min(loadingIndex.value, loadingSteps.length - 1));
const metrics = computed(() => (report.value ? normalizeMetrics(report.value) : null));
const dimensionEntries = computed<[string, number][]>(() => {
  if (!report.value) return [];
  return Object.entries(report.value.target.summary.dimensionScores).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
});
const currentModelLabel = computed(() => {
  if (target.value.model === "custom") return customModel.value || "手动输入模型名";
  return selectedModelOption.value?.label || target.value.model;
});
const configComplete = computed(() =>
  Boolean(target.value.baseUrl.trim() && target.value.apiKey.trim() && selectedModel.value)
);
const connectionState = computed(() => {
  if (loading.value) return "正在运行";
  if (error.value) return "检测失败";
  if (report.value) return "已有报告";
  if (pingState.value === "ok") return "预检通过";
  if (configComplete.value) return "就绪";
  return "待配置";
});
const statusToneClass = computed(() => {
  if (loading.value || configComplete.value || pingState.value === "ok") return "bg-brand-50 text-brand-700";
  if (error.value) return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
});
const finalScore = computed(() => {
  if (!report.value) return 0;
  return clampScore(report.value.target.summary.weightedScore * 100);
});
const expectedScore = computed(() => {
  if (!report.value) return 0;
  return clampScore(report.value.verdict.expectedScore * 100);
});
const riskScore = computed(() => {
  if (!report.value) return 0;
  return clampScore(report.value.verdict.risk);
});

const readyHighlights = ["在线率", "掺水率", "Token 消耗", "结构化输出", "签名指纹"];
const headerCards = [
  { key: "probes", label: "探针数量", value: "13", icon: "M12 3l7 3v5c0 4.8-2.9 8.4-7 10-4.1-1.6-7-5.2-7-10V6l7-3z" },
  { key: "protocol", label: "协议", value: "OpenAI-compatible", icon: "M4 7h16M4 12h16M4 17h10" },
  { key: "focus", label: "检测重点", value: "身份 / 推理 / Token", icon: "M12 5v14M5 12h14" },
  { key: "output", label: "输出格式", value: "风险报告 JSON", icon: "M7 4h7l3 3v13H7V4z" }
];

const configSteps = computed(() => {
  const completion = [Boolean(target.value.platform), Boolean(selectedModel.value), configComplete.value];
  return ["选平台", "选模型", "连端点"].map((label, index) => {
    const step = index + 1;
    return {
      index: step,
      label,
      state: currentStep.value === step ? "active" : completion[index] ? "done" : "todo"
    } as const;
  });
});

const probeCoverageItems = computed<ProbeCoverageItem[]>(() => {
  const coveredDimensions = new Set(report.value?.target.results.map((item) => item.dimension) || []);
  return [
    { label: "结构化输出", dimension: "format", tip: "校验 JSON、字段约束与结构化响应稳定性" },
    { label: "身份指纹", dimension: "instruction", tip: "识别模型声明、指令跟随和身份一致性" },
    { label: "复杂推理", dimension: "reasoning", tip: "用多步推理题观察高阶能力是否匹配" },
    { label: "上下文稳定", dimension: "context", tip: "检查长上下文引用和跨轮一致性" },
    { label: "代码能力", dimension: "coding", tip: "验证代码理解、修复和生成能力" },
    { label: "多语言", dimension: "multilingual", tip: "评估跨语言理解和输出质量" },
    { label: "可靠性", dimension: "reliability", tip: "观察拒答、幻觉和边界条件稳定性" }
  ].map((item) => ({
    label: item.label,
    tip: item.tip,
    covered: coveredDimensions.has(item.dimension)
  }));
});

const resultState = computed<"idle" | "running" | "done" | "error">(() => {
  if (loading.value) return "running";
  if (error.value) return "error";
  if (report.value) return "done";
  return "idle";
});

interface MetricCard {
  key: string;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
  emphasis?: boolean;
}

const metricCards = computed<MetricCard[]>(() => {
  const m = metrics.value;
  if (!report.value || !m) return [];
  return [
    { key: "score", label: "最终分数", value: `${finalScore.value}/100`, emphasis: true },
    { key: "expected", label: "模型预期", value: percent(report.value.verdict.expectedScore) },
    { key: "online", label: "在线率", value: percent(m.onlineRate), tone: "ok" },
    { key: "dilution", label: "掺水率", value: percent(m.dilutionRate), tone: m.statusTone },
    { key: "protocol", label: "协议一致性", value: percent(m.protocolScore) },
    { key: "token", label: "Token 消耗", value: tokenLevelLabels[m.tokenUsage.level] },
    { key: "latency", label: "平均延迟", value: `${m.avgLatencyMs}ms` },
    { key: "status", label: "运行状态", value: m.statusLabel, tone: m.statusTone }
  ];
});

watch([target, customModel], () => {
  pingState.value = "idle";
  pingMessage.value = "";
}, { deep: true });

function selectPlatform(platformId: string) {
  const next = findPlatform(platformId);
  modelMenuOpen.value = false;
  target.value = {
    ...target.value,
    platform: next.id,
    baseUrl: next.baseUrl,
    model: next.models[0].id
  };
  currentStep.value = 2;
}

async function runPing() {
  if (!configComplete.value || pingState.value === "loading") return;
  pingState.value = "loading";
  pingMessage.value = "正在校验端点连通性...";
  try {
    const response = await fetch("/api/probe/ping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: {
          ...target.value,
          model: selectedModel.value
        }
      })
    });
    const data = await parseProbeResponse(response);
    if (!response.ok || !data.ok) {
      throw new Error(getProbeErrorMessage(data));
    }
    pingState.value = "ok";
    pingMessage.value = "连通正常，密钥有效";
  } catch (pingError) {
    pingState.value = "fail";
    pingMessage.value = pingError instanceof Error ? pingError.message : "连通性预检失败";
  }
}

async function runProbe() {
  if (loading.value) return;
  if (!configComplete.value) {
    currentStep.value = 3;
    error.value = "配置不完整，请补全 BASE URL、API Key 和模型名";
    return;
  }

  loading.value = true;
  error.value = "";
  report.value = null;
  abortController = new AbortController();
  loadingTimer = window.setInterval(() => {
    loadingIndex.value += 1;
  }, 2800);

  try {
    const response = await fetch("/api/probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        target: {
          ...target.value,
          model: selectedModel.value
        }
      })
    });
    const data = await parseProbeResponse(response);
    if (!response.ok || !data.ok) {
      throw new Error(getProbeErrorMessage(data));
    }
    report.value = data;
  } catch (runError) {
    if (runError instanceof DOMException && runError.name === "AbortError") {
      error.value = "";
      return;
    }
    error.value = runError instanceof Error ? runError.message : "检测失败";
  } finally {
    if (loadingTimer) window.clearInterval(loadingTimer);
    abortController = null;
    loading.value = false;
    loadingIndex.value = 0;
  }
}

function stopProbe() {
  abortController?.abort();
}

function previewReportJson() {
  reportJsonOpen.value = true;
  requestAnimationFrame(() => {
    document.getElementById("report-json")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function downloadReport() {
  if (!report.value) return;
  const blob = new Blob([JSON.stringify(report.value, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `model-authenticity-report-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type ProbeResponse = ProbeReport | { ok?: false; message?: string; error?: string };

async function parseProbeResponse(response: Response): Promise<ProbeResponse> {
  const text = await response.text();
  if (!text) return { ok: false, message: response.ok ? "检测响应为空" : "检测失败，服务端未返回错误详情" };

  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) return { ok: false, message: text };
    return { ok: false, message: "检测响应不是有效 JSON" };
  }
}

function getProbeErrorMessage(data: ProbeResponse) {
  if ("message" in data && data.message) return data.message;
  if ("error" in data && data.error) return data.error;
  return "检测失败";
}

function normalizeMetrics(currentReport: ProbeReport): SiteMetrics {
  if (currentReport.target.metrics) return currentReport.target.metrics;
  const results = currentReport.target.results || [];
  const successCount = results.filter(
    (item) => item.status && item.status >= 200 && item.status < 300 && item.content
  ).length;
  const onlineRate = successCount / Math.max(results.length, 1);
  const statusTone: "ok" | "warn" | "bad" =
    onlineRate < 0.6 ? "bad" : currentReport.target.summary.weightedScore < 0.72 ? "warn" : "ok";
  return {
    onlineRate,
    dilutionRate: Math.max(0, Math.min(1, 1 - currentReport.target.summary.weightedScore)),
    protocolScore: onlineRate,
    avgLatencyMs: currentReport.target.summary.avgLatencyMs,
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0,
      level: "unknown"
    },
    statusLabel: statusTone === "ok" ? "运行正常" : statusTone === "warn" ? "需要复测" : "异常",
    statusTone,
    signals: ["当前报告来自旧版接口，已按基础结果降级展示"]
  };
}

function percent(value: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function clampScore(value: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

onUnmounted(() => {
  if (loadingTimer) window.clearInterval(loadingTimer);
  abortController?.abort();
});
</script>

<template>
  <main class="min-h-screen text-ink">
    <div class="mx-auto flex w-full max-w-[1560px] flex-col gap-4 p-3 sm:p-5">
      <header class="rounded-lg border border-line bg-panel/95 shadow-panel backdrop-blur">
        <div class="flex flex-col gap-4 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <div class="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-mint-700 to-brand-600 text-white">
              <svg class="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.8-2.9 8.4-7 10-4.1-1.6-7-5.2-7-10V6l7-3z" fill="currentColor" />
                <path d="M8.7 12.2l2.1 2.1 4.8-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-black uppercase text-brand-600">Model Authenticity Lab</p>
              <h1 class="mt-1 text-2xl font-black leading-tight sm:text-3xl">模型真伪检测台</h1>
            </div>
          </div>
          <div class="min-w-0 rounded-lg border border-line bg-field px-3 py-2 lg:min-w-[560px]">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-muted">
              <span>全局状态</span>
              <span class="h-1 w-1 rounded-full bg-zinc-300" />
              <strong class="text-zinc-800">{{ platform.name }}</strong>
              <span>/</span>
              <strong class="max-w-[220px] truncate text-zinc-800">{{ currentModelLabel }}</strong>
              <span
                class="grid min-h-6 place-items-center rounded-full px-2 text-xs font-black"
                :class="statusToneClass"
              >
                {{ connectionState }}
              </span>
            </div>
          </div>
        </div>
        <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="card in headerCards"
            :key="card.key"
            class="flex items-center gap-3 rounded-lg border border-line bg-white p-3"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="card.icon" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
              </svg>
            </span>
            <span class="min-w-0">
              <span class="text-xs font-black text-muted">{{ card.label }}</span>
              <strong class="mt-1 block truncate text-base font-black">{{ card.value }}</strong>
            </span>
          </div>
        </div>
      </header>

      <section class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)_320px]">
        <ConfigPanel
          v-model:target="target"
          v-model:custom-model="customModel"
          v-model:model-menu-open="modelMenuOpen"
          v-model:show-api-key="showApiKey"
          v-model:current-step="currentStep"
          :platform="platform"
          :platforms="platforms"
          :selected-model-option="selectedModelOption"
          :current-model-label="currentModelLabel"
          :loading="loading"
          :config-complete="configComplete"
          :steps="configSteps"
          :ping-state="pingState"
          :ping-message="pingMessage"
          @select-platform="selectPlatform"
          @ping="runPing"
          @submit="runProbe"
        />

        <section class="grid min-w-0 gap-4">
          <TargetSummary
            :target="target"
            :platform="platform"
            :selected-model-option="selectedModelOption"
            :current-model-label="currentModelLabel"
            :connection-state="connectionState"
          />

          <ResultPlaceholder
            :state="resultState"
            :report="report"
            :risk-score="riskScore"
            :ready-highlights="readyHighlights"
            @preview="previewReportJson"
          />

          <LoadingPanel
            v-if="loading"
            :loading-copy="loadingCopy"
            :loading-steps="loadingSteps"
            :loading-step-index="loadingStepIndex"
            :current-model-label="currentModelLabel"
            :base-url="target.baseUrl"
            @stop="stopProbe"
          />

          <ReportPanel
            v-else-if="error || (report && metrics)"
            :error="error"
            :report="report"
            :metrics="metrics"
            :metric-cards="metricCards"
            :dimension-entries="dimensionEntries"
            :final-score="finalScore"
            :expected-score="expectedScore"
            :risk-score="riskScore"
            v-model:json-open="reportJsonOpen"
            @download="downloadReport"
          />
        </section>

        <ProbePanel :items="probeCoverageItems" />
      </section>
    </div>
  </main>
</template>
