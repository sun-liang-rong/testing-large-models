<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
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

const dimensionLabels: Record<string, string> = {
  format: "结构化",
  instruction: "指令",
  reasoning: "推理",
  context: "上下文",
  coding: "代码",
  multilingual: "多语言",
  reliability: "可靠性"
};

const tokenLevelLabels = {
  less: "较少",
  average: "正常",
  more: "偏高",
  unknown: "未知"
};

const target = ref<EndpointForm>({ ...emptyEndpoint });
const customModel = ref("");
const report = ref<ProbeReport | null>(null);
const error = ref("");
const loading = ref(false);
const loadingIndex = ref(0);
const modelMenuOpen = ref(false);
let loadingTimer: number | undefined;

const platform = computed(() => findPlatform(target.value.platform));
const selectedModel = computed(() =>
  target.value.model === "custom" ? customModel.value.trim() : target.value.model
);
const selectedModelOption = computed(() =>
  platform.value.models.find((model) => model.id === target.value.model)
);
const loadingCopy = computed(() => loadingMessages[loadingIndex.value % loadingMessages.length]);
const loadingStepIndex = computed(() => Math.min(loadingIndex.value % loadingSteps.length, loadingSteps.length - 1));
const metrics = computed(() => (report.value ? normalizeMetrics(report.value) : null));
const dimensionEntries = computed(() => {
  if (!report.value) return [];
  return Object.entries(report.value.target.summary.dimensionScores).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
});
const currentModelLabel = computed(() => {
  if (target.value.model === "custom") return customModel.value || "手动输入模型名";
  return selectedModelOption.value?.label || target.value.model;
});
const connectionState = computed(() => {
  if (loading.value) return "正在运行";
  if (report.value) return "已有报告";
  if (error.value) return "检测失败";
  return target.value.apiKey && target.value.baseUrl ? "待检测" : "待配置";
});
const finalScore = computed(() => {
  if (!report.value) return 0;
  return Math.round(report.value.target.summary.weightedScore * 100);
});
const expectedScore = computed(() => {
  if (!report.value) return 0;
  return Math.round(report.value.verdict.expectedScore * 100);
});

function selectPlatform(platformId: string) {
  const next = findPlatform(platformId);
  modelMenuOpen.value = false;
  target.value = {
    ...target.value,
    platform: next.id,
    baseUrl: next.baseUrl,
    model: next.models[0].id
  };
}

function closeModelMenu(event: FocusEvent) {
  const current = event.currentTarget as HTMLElement;
  const next = event.relatedTarget as Node | null;
  if (!next || !current.contains(next)) {
    modelMenuOpen.value = false;
  }
}

async function runProbe() {
  loading.value = true;
  error.value = "";
  report.value = null;
  loadingTimer = window.setInterval(() => {
    loadingIndex.value += 1;
  }, 2800);

  try {
    const response = await fetch("/api/probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: {
          ...target.value,
          model: selectedModel.value
        }
      })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || "检测失败");
    }
    report.value = data;
  } catch (runError) {
    error.value = runError instanceof Error ? runError.message : "检测失败";
  } finally {
    if (loadingTimer) window.clearInterval(loadingTimer);
    loading.value = false;
    loadingIndex.value = 0;
  }
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

function metricToneClass(tone?: "ok" | "warn" | "bad") {
  if (tone === "ok") return "border-mint-100 bg-mint-50";
  if (tone === "warn") return "border-amber-100 bg-amber-50";
  if (tone === "bad") return "border-rose-100 bg-rose-50";
  return "border-line bg-field";
}

function statusToneClass(tone: "ok" | "warn" | "bad") {
  if (tone === "ok") return "bg-mint-100 text-mint-700";
  if (tone === "warn") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function gaugeToneClass(band: "low" | "medium" | "high") {
  if (band === "medium") return "stroke-amber-700";
  if (band === "high") return "stroke-rose-700";
  return "stroke-mint-700";
}

onUnmounted(() => {
  if (loadingTimer) window.clearInterval(loadingTimer);
});
</script>

<template>
  <main class="min-h-screen text-ink">
    <div class="mx-auto flex w-full max-w-[1520px] flex-col gap-4 p-3 sm:p-5">
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
          <div class="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <div class="rounded-lg border border-line bg-field px-3 py-2">
              <span class="text-xs font-black text-muted">平台</span>
              <strong class="mt-1 block truncate text-sm font-black">{{ platform.name }}</strong>
            </div>
            <div class="rounded-lg border border-line bg-field px-3 py-2">
              <span class="text-xs font-black text-muted">模型</span>
              <strong class="mt-1 block truncate text-sm font-black">{{ currentModelLabel }}</strong>
            </div>
            <div class="rounded-lg border border-line bg-field px-3 py-2">
              <span class="text-xs font-black text-muted">状态</span>
              <strong class="mt-1 block truncate text-sm font-black">{{ connectionState }}</strong>
            </div>
          </div>
        </div>
        <div class="grid gap-3 p-4 md:grid-cols-4">
          <div class="rounded-lg border border-brand-100 bg-brand-50 p-3">
            <span class="text-xs font-black text-brand-700">探针数量</span>
            <strong class="mt-1 block text-2xl font-black">13</strong>
          </div>
          <div class="rounded-lg border border-line bg-white p-3">
            <span class="text-xs font-black text-muted">协议</span>
            <strong class="mt-1 block text-lg font-black">OpenAI-compatible</strong>
          </div>
          <div class="rounded-lg border border-line bg-white p-3">
            <span class="text-xs font-black text-muted">检测重点</span>
            <strong class="mt-1 block text-lg font-black">身份 / 推理 / Token</strong>
          </div>
          <div class="rounded-lg border border-line bg-white p-3">
            <span class="text-xs font-black text-muted">输出</span>
            <strong class="mt-1 block text-lg font-black">风险报告 JSON</strong>
          </div>
        </div>
      </header>

      <section class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <aside
        class="self-start rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur xl:sticky xl:top-5"
        aria-label="检测配置"
      >
        <div class="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 class="text-base font-black">检测配置</h2>
            <p class="mt-1 text-xs font-medium text-muted">选择目标端点并运行探针</p>
          </div>
          <span class="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">3 步</span>
        </div>

        <form class="mt-4 grid gap-4" @submit.prevent="runProbe">
          <fieldset class="grid gap-2.5">
            <legend class="text-[13px] font-black text-zinc-800">1. 选择平台</legend>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="item in platforms"
                :key="item.id"
                class="flex min-h-[48px] items-center gap-2 rounded-lg border bg-field p-2.5 text-left text-[13px] font-bold leading-tight transition hover:-translate-y-0.5 hover:shadow-sm"
                :class="target.platform === item.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-zinc-300'"
                type="button"
                @click="selectPlatform(item.id)"
              >
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.accent }" />
                <strong class="min-w-0">{{ item.name }}</strong>
              </button>
            </div>
          </fieldset>

          <fieldset class="grid gap-2.5">
            <legend class="text-[13px] font-black text-zinc-800">2. 选择模型</legend>
            <div class="relative" @blur="closeModelMenu">
              <button
                class="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:ring-2 hover:ring-brand-100"
                :aria-expanded="modelMenuOpen"
                aria-haspopup="listbox"
                type="button"
                @click="modelMenuOpen = !modelMenuOpen"
              >
                <span class="grid min-w-0 gap-1">
                  <strong class="truncate text-[15px] font-black">{{ currentModelLabel }}</strong>
                  <em class="truncate text-xs font-bold not-italic text-muted">
                    {{
                      target.model === "custom"
                        ? "自定义"
                        : `${selectedModelOption?.tier || "标准"} · ${platform.name}`
                    }}
                  </em>
                </span>
                <svg
                  class="h-5 w-5 shrink-0 text-brand-600 transition"
                  :class="modelMenuOpen ? 'rotate-180' : ''"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                </svg>
              </button>

              <div
                v-if="modelMenuOpen"
                class="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-white p-1.5 shadow-2xl"
                role="listbox"
                tabindex="-1"
              >
                <button
                  v-for="model in platform.models"
                  :key="model.id"
                  class="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left transition"
                  :class="target.model === model.id ? 'border-brand-100 bg-brand-50' : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50'"
                  :aria-selected="target.model === model.id"
                  role="option"
                  type="button"
                  @click="target.model = model.id; modelMenuOpen = false"
                >
                  <span class="grid min-w-0 gap-0.5">
                    <strong class="truncate text-sm font-black">{{ model.label }}</strong>
                    <em class="truncate text-xs font-semibold not-italic text-muted">{{ model.id }}</em>
                  </span>
                  <b class="grid min-h-6 min-w-12 place-items-center rounded-full bg-brand-50 px-2 text-xs font-black text-brand-700">
                    {{ model.tier }}
                  </b>
                </button>
                <button
                  class="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left transition"
                  :class="target.model === 'custom' ? 'border-brand-100 bg-brand-50' : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50'"
                  :aria-selected="target.model === 'custom'"
                  role="option"
                  type="button"
                  @click="target.model = 'custom'; modelMenuOpen = false"
                >
                  <span class="grid min-w-0 gap-0.5">
                    <strong class="truncate text-sm font-black">手动输入模型名</strong>
                    <em class="truncate text-xs font-semibold not-italic text-muted">适合未收录模型或私有别名</em>
                  </span>
                  <b class="grid min-h-6 min-w-12 place-items-center rounded-full bg-brand-50 px-2 text-xs font-black text-brand-700">
                    自定义
                  </b>
                </button>
              </div>
            </div>

            <label v-if="target.model === 'custom'" class="grid gap-1.5">
              <span class="text-xs font-bold text-muted">模型名</span>
              <input
                v-model="customModel"
                class="h-11 w-full rounded-md border border-line bg-white px-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                autocomplete="off"
                placeholder="例如 gpt-4.1 / claude-sonnet-4..."
                required
                type="text"
              />
            </label>
          </fieldset>

          <fieldset class="grid gap-2.5">
            <legend class="text-[13px] font-black text-zinc-800">3. 连接信息</legend>
            <label class="grid gap-1.5">
              <span class="text-xs font-bold text-muted">BASE URL</span>
              <input
                v-model="target.baseUrl"
                class="h-11 w-full rounded-md border border-line bg-white px-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                autocomplete="off"
                placeholder="https://relay.example.com/v1"
                required
                type="url"
              />
            </label>
            <label class="grid gap-1.5">
              <span class="text-xs font-bold text-muted">API Key</span>
              <input
                v-model="target.apiKey"
                class="h-11 w-full rounded-md border border-line bg-white px-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                autocomplete="off"
                placeholder="sk-..."
                required
                type="password"
              />
            </label>
          </fieldset>

          <div class="grid gap-1 rounded-lg border border-brand-100 bg-brand-50 p-3">
            <strong class="text-sm font-black">13 项探针</strong>
            <span class="text-xs font-medium leading-6 text-muted">身份一致性、签名指纹、协议结构、推理、上下文、Token 消耗与掺水率估算</span>
          </div>

          <button
            class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-mint-700 to-brand-600 font-black text-white shadow-lg shadow-brand-500/15 transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
            :disabled="loading || !selectedModel"
            type="submit"
          >
            <span v-if="loading">检测中...</span>
            <template v-else>
              <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3l14 9-14 9V3z" fill="currentColor" />
              </svg>
              开始检测
            </template>
          </button>
        </form>
      </aside>

      <section class="grid min-w-0 gap-4">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div class="rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <p class="text-xs font-black uppercase text-brand-600">当前目标</p>
                <h2 class="mt-1 truncate text-2xl font-black">{{ currentModelLabel }}</h2>
                <p class="mt-2 break-words text-sm leading-6 text-muted">{{ target.baseUrl || "请填写 BASE URL" }}</p>
              </div>
              <span class="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-black text-zinc-700">{{ connectionState }}</span>
            </div>
            <div class="mt-4 grid gap-2 sm:grid-cols-3">
              <div class="rounded-lg border border-line bg-field p-3">
                <span class="text-xs font-black text-muted">平台目录</span>
                <strong class="mt-1 block truncate text-sm font-black">{{ platform.name }}</strong>
              </div>
              <div class="rounded-lg border border-line bg-field p-3">
                <span class="text-xs font-black text-muted">模型档位</span>
                <strong class="mt-1 block truncate text-sm font-black">{{ target.model === "custom" ? "自定义" : selectedModelOption?.tier || "标准" }}</strong>
              </div>
              <div class="rounded-lg border border-line bg-field p-3">
                <span class="text-xs font-black text-muted">密钥状态</span>
                <strong class="mt-1 block truncate text-sm font-black">{{ target.apiKey ? "已填写" : "未填写" }}</strong>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur">
            <h3 class="text-sm font-black">探针覆盖</h3>
            <div class="mt-3 grid gap-2">
              <div v-for="item in ['结构化输出', '身份指纹', '复杂推理', '上下文稳定', 'Token 消耗']" :key="item" class="flex items-center justify-between rounded-md border border-line bg-field px-3 py-2">
                <span class="text-xs font-bold text-zinc-700">{{ item }}</span>
                <span class="h-2 w-2 rounded-full bg-brand-600" />
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="loading"
          class="rounded-lg border border-line bg-panel/95 p-5 shadow-panel backdrop-blur"
        >
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
            <div class="grid gap-5">
              <div>
                <p class="text-xs font-black uppercase text-brand-600">检测进行中</p>
                <h2 class="mt-2 text-3xl font-black leading-tight sm:text-4xl">正在检测模型行为指纹</h2>
                <p class="mt-3 max-w-2xl leading-7 text-muted">{{ loadingCopy }}</p>
              </div>

              <div class="rounded-lg border border-brand-100 bg-brand-50 p-4">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-sm font-black text-brand-700">{{ loadingSteps[loadingStepIndex] }}</span>
                  <span class="text-xs font-black text-brand-700">{{ loadingStepIndex + 1 }}/{{ loadingSteps.length }}</span>
                </div>
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-mint-700 to-brand-600 transition-all duration-500"
                    :style="{ width: `${((loadingStepIndex + 1) / loadingSteps.length) * 100}%` }"
                  />
                </div>
              </div>

              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div
                  v-for="(step, index) in loadingSteps"
                  :key="step"
                  class="rounded-lg border p-3"
                  :class="index <= loadingStepIndex ? 'border-brand-100 bg-brand-50' : 'border-line bg-field'"
                >
                  <span class="text-xs font-black" :class="index <= loadingStepIndex ? 'text-brand-700' : 'text-muted'">
                    STEP {{ index + 1 }}
                  </span>
                  <strong class="mt-1 block text-sm font-black">{{ step }}</strong>
                </div>
              </div>
            </div>

            <div class="grid gap-3 rounded-lg border border-line bg-field p-4">
              <div class="relative h-36 overflow-hidden rounded-lg border border-brand-100 bg-[linear-gradient(#dbeafe_1px,transparent_1px),linear-gradient(90deg,#dbeafe_1px,transparent_1px),#f8fbff] bg-[length:20px_20px]">
                <span class="absolute left-0 right-0 h-1 animate-[scan_1.8s_ease-in-out_infinite] bg-brand-600 shadow-[0_0_24px_rgba(37,99,235,0.75)]" />
              </div>
              <div>
                <span class="text-xs font-black text-muted">当前目标</span>
                <strong class="mt-1 block break-words text-lg font-black">{{ currentModelLabel }}</strong>
                <p class="mt-2 break-words text-xs leading-5 text-muted">{{ target.baseUrl }}</p>
              </div>
              <div class="grid grid-cols-2 gap-2 text-center">
                <div class="rounded-md bg-white p-2">
                  <strong class="block text-lg font-black">13</strong>
                  <span class="text-[11px] font-bold text-muted">探针</span>
                </div>
                <div class="rounded-md bg-white p-2">
                  <strong class="block text-lg font-black">4</strong>
                  <span class="text-[11px] font-bold text-muted">并发</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="error" class="rounded-lg border border-line bg-panel/95 p-5 shadow-panel backdrop-blur">
          <header class="grid gap-5 border-b border-line pb-5 sm:grid-cols-[minmax(0,1fr)_128px] sm:items-center">
            <div>
              <p class="text-xs font-black uppercase text-brand-600">检测报告</p>
              <h2 class="mt-1.5 text-3xl font-black leading-tight sm:text-4xl">检测失败</h2>
              <p class="mt-2.5 leading-7 text-muted">{{ error }}</p>
            </div>
            <div class="relative grid h-[120px] w-[120px] place-items-center" aria-label="风险分数">
              <svg class="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                <circle class="fill-none stroke-zinc-200 stroke-[10]" cx="60" cy="60" r="50" />
                <circle class="fill-none stroke-rose-700 stroke-[10]" cx="60" cy="60" r="50" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="0" />
              </svg>
              <strong class="text-3xl font-black">100</strong>
              <span class="absolute top-[76px] text-xs font-black text-muted">风险</span>
            </div>
          </header>
          <section class="mt-4 rounded-lg border border-line bg-field p-4">
            <h3 class="text-base font-black">证据摘要</h3>
            <ul class="mt-3 list-disc pl-5 leading-7 text-zinc-700">
              <li>端点配置或网络请求失败，请检查 BASE URL、API Key、模型名和中转站兼容性。</li>
            </ul>
          </section>
        </div>

        <div
          v-else-if="report && metrics"
          class="rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur sm:p-5"
        >
          <header class="grid gap-5 border-b border-line pb-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase text-brand-600">检测报告</p>
              <h2 class="mt-1.5 text-3xl font-black leading-tight sm:text-4xl">{{ report.verdict.label }}</h2>
              <p class="mt-2.5 break-words leading-7 text-muted">
                {{ report.target.model }} · {{ report.modelProfile.label }} · {{ report.target.baseUrl }} ·
                {{ new Date(report.generatedAt).toLocaleString() }}
              </p>
            </div>
            <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
              <div class="rounded-lg border border-brand-100 bg-brand-50 p-4">
                <span class="text-xs font-black uppercase text-brand-700">最终分数</span>
                <div class="mt-2 flex items-end gap-2">
                  <strong class="text-6xl font-black leading-none tracking-normal text-brand-700">{{ finalScore }}</strong>
                  <span class="pb-1 text-lg font-black text-brand-700">/ 100</span>
                </div>
                <div class="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-mint-700 to-brand-600"
                    :style="{ width: `${finalScore}%` }"
                  />
                </div>
                <p class="mt-2 text-xs font-bold text-muted">模型预期 {{ expectedScore }} 分 · 风险 {{ report.verdict.risk }} 分</p>
              </div>
              <div class="relative grid h-[120px] w-[120px] place-items-center" aria-label="风险分数">
                <svg class="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                  <circle class="fill-none stroke-zinc-200 stroke-[10]" cx="60" cy="60" r="50" />
                  <circle
                    class="fill-none stroke-[10] transition-[stroke-dashoffset]"
                    :class="gaugeToneClass(report.verdict.band)"
                    cx="60"
                    cy="60"
                    r="50"
                    stroke-linecap="round"
                    stroke-dasharray="314"
                    :stroke-dashoffset="314 - (report.verdict.risk / 100) * 314"
                  />
                </svg>
                <strong class="text-3xl font-black">{{ report.verdict.risk }}</strong>
                <span class="absolute top-[76px] text-xs font-black text-muted">风险</span>
              </div>
            </div>
          </header>

          <section class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="汇总指标">
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border p-3.5" :class="metricToneClass('ok')">
              <span class="text-xs font-black text-muted">在线率</span>
              <strong class="text-2xl font-black">{{ percent(metrics.onlineRate) }}</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border p-3.5" :class="metricToneClass(metrics.statusTone)">
              <span class="text-xs font-black text-muted">掺水率</span>
              <strong class="text-2xl font-black">{{ percent(metrics.dilutionRate) }}</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border border-line bg-field p-3.5">
              <span class="text-xs font-black text-muted">Token 消耗</span>
              <strong class="text-2xl font-black">{{ tokenLevelLabels[metrics.tokenUsage.level] }}</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border border-line bg-field p-3.5">
              <span class="text-xs font-black text-muted">平均延迟</span>
              <strong class="text-2xl font-black">{{ metrics.avgLatencyMs }}ms</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border border-line bg-field p-3.5">
              <span class="text-xs font-black text-muted">最终分数</span>
              <strong class="text-2xl font-black">{{ finalScore }}/100</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border border-line bg-field p-3.5">
              <span class="text-xs font-black text-muted">模型预期</span>
              <strong class="text-2xl font-black">{{ percent(report.verdict.expectedScore) }}</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border border-line bg-field p-3.5">
              <span class="text-xs font-black text-muted">协议一致性</span>
              <strong class="text-2xl font-black">{{ percent(metrics.protocolScore) }}</strong>
            </article>
            <article class="grid min-h-[88px] content-center gap-2 rounded-lg border p-3.5" :class="metricToneClass(metrics.statusTone)">
              <span class="text-xs font-black text-muted">运行状态</span>
              <strong class="text-2xl font-black">{{ metrics.statusLabel }}</strong>
            </article>
          </section>

          <section class="mt-4 overflow-hidden rounded-lg border border-line bg-field">
            <div class="flex min-h-14 items-center justify-between gap-3 border-b border-line px-3.5">
              <h3 class="text-base font-black">中转站指标</h3>
              <span class="grid min-h-7 place-items-center rounded-full px-2.5 text-xs font-black" :class="statusToneClass(metrics.statusTone)">
                {{ metrics.statusLabel }}
              </span>
            </div>
            <div class="overflow-x-auto px-3.5 pb-3.5">
              <div class="grid min-w-[740px] grid-cols-[minmax(160px,1.6fr)_repeat(5,minmax(86px,1fr))] gap-2.5 py-2 text-xs font-black text-muted">
                <span>模型</span>
                <span>Token</span>
                <span>在线率</span>
                <span>掺水率</span>
                <span>延迟</span>
                <span>状态</span>
              </div>
              <div class="grid min-h-[42px] min-w-[740px] grid-cols-[minmax(160px,1.6fr)_repeat(5,minmax(86px,1fr))] items-center gap-2.5 border-t border-line text-[13px] text-zinc-700">
                <strong class="break-words">{{ report.target.model }}</strong>
                <span>{{ metrics.tokenUsage.total || "未知" }}</span>
                <span>{{ percent(metrics.onlineRate) }}</span>
                <span>{{ percent(metrics.dilutionRate) }}</span>
                <span>{{ metrics.avgLatencyMs }}ms</span>
                <span>{{ metrics.statusLabel }}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-2 px-3.5 pb-3.5">
              <span
                v-for="signal in metrics.signals"
                :key="signal"
                class="grid min-h-7 place-items-center rounded-full border border-zinc-200 bg-white px-2.5 text-xs font-bold text-zinc-700"
              >
                {{ signal }}
              </span>
            </div>
          </section>

          <section class="mt-4 rounded-lg border border-line bg-field p-3.5">
            <div class="mb-3 flex min-h-8 items-center justify-between">
              <h3 class="text-base font-black">维度画像</h3>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div v-for="[dimension, score] in dimensionEntries" :key="dimension" class="grid gap-2">
                <div class="flex items-center justify-between gap-2">
                  <strong class="text-[13px] font-black">{{ dimensionLabels[dimension] || dimension }}</strong>
                  <span class="text-xs font-black text-muted">{{ percent(score) }}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-zinc-200">
                  <i class="block h-full rounded-full bg-gradient-to-r from-mint-700 to-brand-600" :style="{ width: `${Math.round(score * 100)}%` }" />
                </div>
              </div>
            </div>
          </section>

          <section class="mt-4 rounded-lg border border-line bg-field p-4">
            <h3 class="text-base font-black">证据摘要</h3>
            <ul class="mt-3 list-disc pl-5 leading-7 text-zinc-700">
              <li v-for="item in report.verdict.evidence" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="mt-4 overflow-hidden rounded-lg border border-line bg-field">
            <div class="flex min-h-14 items-center justify-between gap-3 border-b border-line px-3.5">
              <h3 class="text-base font-black">探针明细</h3>
              <button
                class="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-brand-600 transition hover:border-brand-500"
                title="下载 JSON 报告"
                type="button"
                @click="downloadReport"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                  <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                  <path d="M5 21h14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                </svg>
              </button>
            </div>
            <div class="overflow-x-auto">
              <article
                v-for="probe in report.target.results"
                :key="probe.id"
                class="grid min-w-[660px] grid-cols-[minmax(170px,1.1fr)_96px_112px_minmax(260px,2fr)] items-start gap-3 border-b border-line p-3.5 last:border-b-0"
              >
                <div>
                  <strong class="block text-sm font-black">{{ probe.title }}</strong>
                  <span class="text-xs text-muted">{{ probe.category }}</span>
                </div>
                <div>
                  <span
                    class="inline-grid h-7 min-w-[70px] place-items-center rounded-full px-2.5 text-xs font-black"
                    :class="probe.passed ? 'bg-mint-100 text-mint-700' : 'bg-rose-100 text-rose-700'"
                  >
                    {{ probe.passed ? "通过" : "异常" }}
                  </span>
                </div>
                <div>
                  <strong class="block text-sm font-black">{{ percent(probe.score) }}</strong>
                  <span class="text-xs text-muted">{{ probe.latencyMs || 0 }}ms</span>
                </div>
                <div>
                  <strong class="block text-sm font-black">{{ probe.note }}</strong>
                  <div class="mt-2 max-h-[72px] overflow-auto whitespace-pre-wrap break-words text-xs text-muted">
                    {{ probe.content || "无响应内容" }}
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div
          v-else
          class="rounded-lg border border-line bg-panel/95 p-5 shadow-panel backdrop-blur"
        >
          <div>
            <p class="text-xs font-black uppercase text-brand-600">准备检测</p>
            <h2 class="mt-2 text-3xl font-black leading-tight">配置完成后即可运行 13 项探针</h2>
            <p class="mt-3 max-w-2xl leading-7 text-muted">报告会把在线率、掺水率、协议一致性、响应片段和维度画像放在同一张工作台里，便于快速判断中转站是否存在模型替换风险。</p>
          </div>
          <div class="mt-5 grid gap-2 sm:grid-cols-5">
            <span
              v-for="item in ['在线率', '掺水率', 'Token 消耗', '结构化输出', '签名指纹']"
              :key="item"
              class="grid min-h-9 place-items-center rounded-md border border-line bg-field px-3 text-xs font-bold text-zinc-700"
            >
              {{ item }}
            </span>
          </div>
        </div>
      </section>
      </section>
    </div>
  </main>
</template>
