<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  loadingCopy: string;
  loadingSteps: string[];
  loadingStepIndex: number;
  currentModelLabel: string;
  baseUrl: string;
}>();

const emit = defineEmits<{
  stop: [];
}>();

const progressWidth = computed(() => {
  const stepCount = Math.max(props.loadingSteps.length, 1);
  const currentStep = Math.min(Math.max(props.loadingStepIndex + 1, 0), stepCount);
  return Math.round((currentStep / stepCount) * 100);
});
</script>

<template>
  <div class="rounded-lg border border-line bg-panel/95 p-5 shadow-panel backdrop-blur">
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
      <div class="grid gap-5">
        <div>
          <p class="text-xs font-black uppercase text-brand-600">检测进行中</p>
          <h2 class="mt-2 text-3xl font-black leading-tight sm:text-4xl">正在检测模型行为指纹</h2>
          <p class="mt-3 max-w-2xl leading-7 text-muted">{{ loadingCopy }}</p>
          <button
            class="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 text-sm font-black text-rose-700 transition hover:border-rose-700"
            type="button"
            @click="emit('stop')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
            终止检测
          </button>
        </div>

        <div class="rounded-lg border border-brand-100 bg-brand-50 p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-black text-brand-700">{{ loadingSteps[loadingStepIndex] }}</span>
            <span class="text-xs font-black text-brand-700">{{ loadingStepIndex + 1 }}/{{ loadingSteps.length }}</span>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              class="h-full rounded-full bg-gradient-to-r from-mint-700 to-brand-600 transition-all duration-500"
              :style="{ width: `${progressWidth}%` }"
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
          <p class="mt-2 break-words text-xs leading-5 text-muted">{{ baseUrl }}</p>
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
</template>
