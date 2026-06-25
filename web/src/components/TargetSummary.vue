<script setup lang="ts">
import type { EndpointForm } from "../types";
import type { ModelOption, PlatformOption } from "../modelCatalog";

defineProps<{
  target: EndpointForm;
  platform: PlatformOption;
  selectedModelOption?: ModelOption;
  currentModelLabel: string;
  connectionState: string;
}>();
</script>

<template>
  <div class="rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-black uppercase text-brand-600">当前目标</p>
        <h2 class="mt-1 truncate text-2xl font-black">{{ currentModelLabel }}</h2>
        <p class="mt-2 break-words text-sm leading-6 text-muted">{{ target.baseUrl || "请填写 BASE URL" }}</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <span
          v-if="!target.apiKey"
          class="grid min-h-7 place-items-center rounded-full bg-amber-100 px-2.5 text-xs font-black text-amber-700"
        >
          ⚠ 密钥未填写
        </span>
        <span class="grid min-h-7 w-fit place-items-center rounded-full bg-zinc-100 px-2.5 text-xs font-black text-zinc-700">
          {{ connectionState }}
        </span>
      </div>
    </div>

    <dl class="mt-4 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
      <div class="flex items-center justify-between gap-3 rounded-lg border border-line bg-field px-3 py-2.5">
        <dt class="text-xs font-black text-muted">平台目录</dt>
        <dd class="min-w-0 truncate text-sm font-black">{{ platform.name }}</dd>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-lg border border-line bg-field px-3 py-2.5">
        <dt class="text-xs font-black text-muted">模型档位</dt>
        <dd class="min-w-0 truncate text-sm font-black">
          {{ target.model === "custom" ? "自定义" : selectedModelOption?.tier || "标准" }}
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-lg border border-line bg-field px-3 py-2.5">
        <dt class="text-xs font-black text-muted">模型名</dt>
        <dd class="min-w-0 truncate text-sm font-black">{{ currentModelLabel }}</dd>
      </div>
      <div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
        :class="target.apiKey ? 'border-line bg-field' : 'border-amber-100 bg-amber-50'"
      >
        <dt class="text-xs font-black text-muted">密钥状态</dt>
        <dd class="min-w-0 truncate text-sm font-black" :class="target.apiKey ? '' : 'text-amber-700'">
          {{ target.apiKey ? "已填写" : "未填写" }}
        </dd>
      </div>
    </dl>
  </div>
</template>
