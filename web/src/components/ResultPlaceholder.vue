<script setup lang="ts">
import { computed } from "vue";
import type { ProbeReport } from "../types";

const props = defineProps<{
  state: "idle" | "running" | "done" | "error";
  report: ProbeReport | null;
  riskScore: number;
  readyHighlights: string[];
}>();

const emit = defineEmits<{
  preview: [];
}>();

const verdictTone = computed<"ok" | "warn" | "bad">(() => {
  const band = props.report?.verdict.band;
  if (band === "high") return "bad";
  if (band === "medium") return "warn";
  return "ok";
});
</script>

<template>
  <div class="rounded-lg border border-line bg-panel/95 p-5 shadow-panel backdrop-blur">
    <div class="flex items-center justify-between gap-3 border-b border-line pb-3">
      <div>
        <p class="text-xs font-black uppercase text-brand-600">检测结果</p>
        <h3 class="mt-1 text-lg font-black">风险结论与报告</h3>
      </div>
      <span
        class="grid min-h-7 place-items-center rounded-full px-2.5 text-xs font-black"
        :class="{
          'bg-zinc-100 text-zinc-600': state === 'idle',
          'bg-brand-50 text-brand-700': state === 'running',
          'bg-mint-100 text-mint-700': state === 'done' && verdictTone === 'ok',
          'bg-amber-100 text-amber-700': state === 'done' && verdictTone === 'warn',
          'bg-rose-100 text-rose-700': state === 'error' || (state === 'done' && verdictTone === 'bad')
        }"
      >
        {{
          state === "idle"
            ? "未检测"
            : state === "running"
            ? "检测中"
            : state === "error"
            ? "检测失败"
            : "检测完成"
        }}
      </span>
    </div>

    <!-- 未检测 -->
    <div v-if="state === 'idle'" class="mt-4 grid gap-3">
      <p class="leading-7 text-muted">完成左侧三步配置后开始检测，这里会展示风险结论与 JSON 报告预览。</p>
      <div class="grid gap-2 sm:grid-cols-5">
        <span
          v-for="item in readyHighlights"
          :key="item"
          class="grid min-h-9 place-items-center rounded-md border border-line bg-field px-3 text-xs font-bold text-zinc-700"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- 检测中 -->
    <div v-else-if="state === 'running'" class="mt-4 grid place-items-center gap-3 py-6">
      <span class="h-8 w-8 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
      <p class="text-sm font-bold text-brand-700">正在运行 13 项探针，请稍候...</p>
    </div>

    <!-- 检测完成 -->
    <div v-else-if="state === 'done' && report" class="mt-4 grid gap-3">
      <div
        class="grid gap-1.5 rounded-lg border p-4"
        :class="{
          'border-mint-100 bg-mint-50': verdictTone === 'ok',
          'border-amber-100 bg-amber-50': verdictTone === 'warn',
          'border-rose-100 bg-rose-50': verdictTone === 'bad'
        }"
      >
        <span class="text-xs font-black uppercase text-muted">风险结论</span>
        <strong
          class="text-2xl font-black"
          :class="{
            'text-mint-700': verdictTone === 'ok',
            'text-amber-700': verdictTone === 'warn',
            'text-rose-700': verdictTone === 'bad'
          }"
        >
          {{ report.verdict.label }}
        </strong>
        <span class="text-xs font-bold text-muted">风险评分 {{ riskScore }} / 100</span>
      </div>
      <button
        class="grid h-10 place-items-center rounded-lg border border-line bg-white text-sm font-black text-brand-700 transition hover:border-brand-500"
        type="button"
        @click="emit('preview')"
      >
        查看完整 JSON 报告
      </button>
    </div>

    <!-- 检测失败 -->
    <div v-else class="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-4">
      <strong class="text-sm font-black text-rose-700">检测失败</strong>
      <p class="mt-1 text-xs leading-6 text-rose-700/80">请检查端点配置或使用连通性预检定位问题。</p>
    </div>
  </div>
</template>
