<script setup lang="ts">
import { ref } from "vue";

interface ProbeCoverageItem {
  label: string;
  covered: boolean;
  tip: string;
}

defineProps<{
  items: ProbeCoverageItem[];
}>();

const collapsed = ref(false);
</script>

<template>
  <div class="self-start rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-black">探针覆盖</h3>
        <p class="mt-1 text-xs leading-5 text-muted">各检测维度是否已在本次报告中覆盖</p>
      </div>
      <button
        class="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-white text-muted transition hover:border-brand-500 hover:text-brand-600"
        type="button"
        :aria-expanded="!collapsed"
        :title="collapsed ? '展开' : '收起'"
        @click="collapsed = !collapsed"
      >
        <svg class="h-4 w-4 transition" :class="collapsed ? '' : 'rotate-180'" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        </svg>
      </button>
    </div>

    <div v-show="!collapsed" class="mt-3 grid gap-2">
      <div
        v-for="item in items"
        :key="item.label"
        class="flex items-center justify-between gap-2 rounded-md border border-line bg-field px-3 py-2"
        :title="item.tip"
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-xs font-bold text-zinc-700">{{ item.label }}</span>
          <svg class="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M12 11v5M12 8h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          </svg>
        </span>
        <span class="flex shrink-0 items-center gap-1.5">
          <span class="text-[11px] font-bold" :class="item.covered ? 'text-mint-700' : 'text-muted'">
            {{ item.covered ? "已覆盖" : "未覆盖" }}
          </span>
          <span class="h-2 w-2 rounded-full" :class="item.covered ? 'bg-mint-600' : 'bg-zinc-300'" />
        </span>
      </div>
    </div>
  </div>
</template>
