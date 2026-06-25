<script setup lang="ts">
import type { ProbeReport, SiteMetrics } from "../types";

const props = defineProps<{
  error: string;
  report: ProbeReport | null;
  metrics: SiteMetrics | null;
  metricCards: MetricCard[];
  dimensionEntries: [string, number][];
  finalScore: number;
  expectedScore: number;
  riskScore: number;
  jsonOpen: boolean;
}>();

const emit = defineEmits<{
  download: [];
  "update:jsonOpen": [value: boolean];
}>();

const reportJson = () => (props.report ? JSON.stringify(props.report, null, 2) : "");

interface MetricCard {
  key: string;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
  emphasis?: boolean;
}

const dimensionLabels: Record<string, string> = {
  format: "结构化",
  instruction: "指令",
  reasoning: "推理",
  context: "上下文",
  coding: "代码",
  multilingual: "多语言",
  reliability: "可靠性"
};

function percent(value: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function clampScore(value: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
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
</script>

<template>
  <div v-if="error" class="rounded-lg border border-line bg-panel/95 p-5 shadow-panel backdrop-blur">
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
          <p class="mt-2 text-xs font-bold text-muted">模型预期 {{ expectedScore }} 分 · 风险 {{ riskScore }} 分</p>
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
              :stroke-dashoffset="314 - (riskScore / 100) * 314"
            />
          </svg>
          <strong class="text-3xl font-black">{{ riskScore }}</strong>
          <span class="absolute top-[76px] text-xs font-black text-muted">风险</span>
        </div>
      </div>
    </header>

    <section class="mt-4" aria-label="汇总指标">
      <h3 class="mb-2 text-sm font-black text-zinc-800">核心指标</h3>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in metricCards"
          :key="card.key"
          class="grid min-h-[88px] content-center gap-1.5 rounded-lg border p-3.5"
          :class="card.tone ? metricToneClass(card.tone) : 'border-line bg-field'"
        >
          <span class="text-xs font-semibold text-muted">{{ card.label }}</span>
          <strong class="text-2xl font-black" :class="card.emphasis ? 'text-brand-700' : ''">{{ card.value }}</strong>
        </article>
      </div>
    </section>

    <section class="mt-4 overflow-hidden rounded-lg border border-line bg-field">
      <div class="flex min-h-14 items-center justify-between gap-3 border-b border-line px-3.5">
        <h3 class="text-base font-black">中转站信号</h3>
        <span class="grid min-h-7 place-items-center rounded-full px-2.5 text-xs font-semibold" :class="statusToneClass(metrics.statusTone)">
          {{ metrics.statusLabel }}
        </span>
      </div>
      <div class="flex flex-wrap gap-2 p-3.5">
        <span
          v-for="signal in metrics.signals"
          :key="signal"
          class="grid min-h-7 place-items-center rounded-full border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700"
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
            <strong class="text-[13px] font-semibold">{{ dimensionLabels[dimension] || dimension }}</strong>
            <span class="text-xs font-semibold text-muted">{{ percent(score) }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-zinc-200">
            <i class="block h-full rounded-full bg-gradient-to-r from-mint-700 to-brand-600" :style="{ width: `${clampScore(score * 100)}%` }" />
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
          @click="emit('download')"
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

    <section id="report-json" class="mt-4 overflow-hidden rounded-lg border border-line bg-field">
      <button
        class="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-zinc-50"
        type="button"
        :aria-expanded="jsonOpen"
        @click="emit('update:jsonOpen', !jsonOpen)"
      >
        <h3 class="text-base font-black">JSON 报告预览</h3>
        <svg class="h-4 w-4 shrink-0 text-muted transition" :class="jsonOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        </svg>
      </button>
      <pre v-show="jsonOpen" class="max-h-80 overflow-auto border-t border-line bg-white p-3.5 text-xs leading-5 text-zinc-700">{{ reportJson() }}</pre>
    </section>
  </div>
</template>
