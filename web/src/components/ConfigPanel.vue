<script setup lang="ts">
import { computed, ref } from "vue";
import type { EndpointForm } from "../types";
import type { ModelOption, PlatformOption } from "../modelCatalog";
import StepProgress from "./StepProgress.vue";

interface StepItem {
  index: number;
  label: string;
  state: "done" | "active" | "todo";
}

const props = defineProps<{
  target: EndpointForm;
  customModel: string;
  platform: PlatformOption;
  platforms: PlatformOption[];
  selectedModelOption?: ModelOption;
  currentModelLabel: string;
  loading: boolean;
  modelMenuOpen: boolean;
  showApiKey: boolean;
  currentStep: number;
  configComplete: boolean;
  steps: StepItem[];
  pingState: "idle" | "loading" | "ok" | "fail";
  pingMessage: string;
}>();

const emit = defineEmits<{
  "update:target": [value: EndpointForm];
  "update:customModel": [value: string];
  "update:modelMenuOpen": [value: boolean];
  "update:showApiKey": [value: boolean];
  "update:currentStep": [value: number];
  selectPlatform: [platformId: string];
  ping: [];
  submit: [];
}>();

const probeInfoOpen = ref(false);

function updateTarget(patch: Partial<EndpointForm>) {
  emit("update:target", { ...props.target, ...patch });
}

const selectedModel = computed(() =>
  props.target.model === "custom" ? props.customModel.trim() : props.target.model
);

const stepValid = computed(() => {
  if (props.currentStep === 1) return Boolean(props.target.platform);
  if (props.currentStep === 2) return Boolean(selectedModel.value);
  return Boolean(props.target.baseUrl && props.target.apiKey);
});

const submitHint = computed(() => {
  if (props.configComplete) return "";
  const missing: string[] = [];
  if (!selectedModel.value) missing.push("模型名");
  if (!props.target.baseUrl) missing.push("BASE URL");
  if (!props.target.apiKey) missing.push("API Key");
  return `配置不完整，请补全：${missing.join("、")}`;
});

function goNext() {
  if (props.currentStep < 3) emit("update:currentStep", props.currentStep + 1);
}

function goPrev() {
  if (props.currentStep > 1) emit("update:currentStep", props.currentStep - 1);
}

function closeModelMenu(event: FocusEvent) {
  const current = event.currentTarget as HTMLElement;
  const next = event.relatedTarget as Node | null;
  if (!next || !current.contains(next)) {
    emit("update:modelMenuOpen", false);
  }
}
</script>

<template>
  <aside
    class="self-start rounded-lg border border-line bg-panel/95 p-4 shadow-panel backdrop-blur xl:sticky xl:top-5"
    aria-label="检测配置"
  >
    <div class="flex items-center justify-between gap-3 border-b border-line pb-3">
      <div>
        <h2 class="text-base font-black">检测配置</h2>
        <p class="mt-1 text-xs font-medium text-muted">分步配置目标端点并运行探针</p>
      </div>
      <span class="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-black text-brand-700">
        {{ currentStep }} / 3
      </span>
    </div>

    <div class="mt-3">
      <StepProgress :steps="steps" @jump="emit('update:currentStep', $event)" />
    </div>

    <form class="mt-4 grid gap-4" @submit.prevent="emit('submit')">
      <!-- Step 1: 平台 -->
      <fieldset v-show="currentStep === 1" class="grid gap-2.5">
        <legend class="text-[13px] font-black text-zinc-800">1. 选择平台</legend>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="item in platforms"
            :key="item.id"
            class="flex min-h-[48px] items-center gap-2 rounded-lg border bg-field p-2.5 text-left text-[13px] font-bold leading-tight transition hover:-translate-y-0.5 hover:shadow-sm"
            :class="target.platform === item.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-zinc-300'"
            type="button"
            @click="emit('selectPlatform', item.id)"
          >
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.accent }" />
            <strong class="min-w-0">{{ item.name }}</strong>
          </button>
        </div>
        <p class="text-xs text-muted">选平台后自动筛选对应模型并填充接口 BASE 地址。</p>
      </fieldset>

      <!-- Step 2: 模型 -->
      <fieldset v-show="currentStep === 2" class="grid gap-2.5">
        <legend class="text-[13px] font-black text-zinc-800">2. 选择模型</legend>
        <div class="relative" @blur="closeModelMenu">
          <button
            class="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:ring-2 hover:ring-brand-100"
            :aria-expanded="modelMenuOpen"
            aria-haspopup="listbox"
            type="button"
            @click="emit('update:modelMenuOpen', !modelMenuOpen)"
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
              @click="updateTarget({ model: model.id }); emit('update:modelMenuOpen', false)"
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
              @click="updateTarget({ model: 'custom' }); emit('update:modelMenuOpen', false)"
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
            :value="customModel"
            class="h-11 w-full rounded-md border border-line bg-white px-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            autocomplete="off"
            placeholder="例如 gpt-4.1 / claude-sonnet-4..."
            type="text"
            @input="emit('update:customModel', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </fieldset>

      <!-- Step 3: 连接信息 -->
      <fieldset v-show="currentStep === 3" class="grid gap-2.5">
        <legend class="text-[13px] font-black text-zinc-800">3. 连接信息</legend>
        <label class="grid gap-1.5">
          <span class="text-xs font-bold text-muted">BASE URL</span>
          <input
            :value="target.baseUrl"
            class="h-11 w-full rounded-md border border-line bg-white px-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            autocomplete="off"
            placeholder="https://relay.example.com/v1"
            type="url"
            @input="updateTarget({ baseUrl: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs font-bold text-muted">API Key</span>
          <span class="relative block">
            <input
              :value="target.apiKey"
              class="h-11 w-full rounded-md border border-line bg-white px-3 pr-16 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              autocomplete="off"
              placeholder="sk-..."
              :type="showApiKey ? 'text' : 'password'"
              @input="updateTarget({ apiKey: ($event.target as HTMLInputElement).value })"
            />
            <button
              class="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-md px-2 text-xs font-black text-brand-700 transition hover:bg-brand-50"
              type="button"
              @click="emit('update:showApiKey', !showApiKey)"
            >
              {{ showApiKey ? "隐藏" : "显示" }}
            </button>
          </span>
        </label>

        <!-- 连通性预检 -->
        <div class="grid gap-2 rounded-lg border border-line bg-field p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-black text-zinc-800">接口连通性预检</span>
            <button
              class="grid h-8 min-w-[88px] place-items-center rounded-md border border-brand-100 bg-brand-50 px-2.5 text-xs font-black text-brand-700 transition hover:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!target.baseUrl || !target.apiKey || !selectedModel || pingState === 'loading' || loading"
              type="button"
              @click="emit('ping')"
            >
              {{ pingState === "loading" ? "检测中..." : "立即预检" }}
            </button>
          </div>
          <p
            v-if="pingState !== 'idle'"
            class="flex items-center gap-1.5 text-xs font-bold"
            :class="{
              'text-brand-700': pingState === 'loading',
              'text-mint-700': pingState === 'ok',
              'text-rose-700': pingState === 'fail'
            }"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="{
                'bg-brand-600': pingState === 'loading',
                'bg-mint-600': pingState === 'ok',
                'bg-rose-700': pingState === 'fail'
              }"
            />
            <span class="break-words">{{ pingMessage }}</span>
          </p>
          <p v-else class="text-xs text-muted">提前校验密钥有效性，避免无效配置浪费探针调用。</p>
        </div>
      </fieldset>

      <!-- 分步导航 -->
      <div class="flex items-center gap-2">
        <button
          v-if="currentStep > 1"
          class="grid h-11 flex-1 place-items-center rounded-lg border border-line bg-white text-sm font-black text-zinc-700 transition hover:border-zinc-300"
          type="button"
          @click="goPrev"
        >
          上一步
        </button>
        <button
          v-if="currentStep < 3"
          class="grid h-11 flex-1 place-items-center rounded-lg bg-gradient-to-br from-mint-700 to-brand-600 text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!stepValid"
          type="button"
          @click="goNext"
        >
          下一步
        </button>
      </div>

      <!-- 折叠探针说明 -->
      <div class="overflow-hidden rounded-lg border border-line">
        <button
          class="flex w-full items-center justify-between gap-3 bg-field px-3 py-2.5 text-left transition hover:bg-zinc-50"
          type="button"
          :aria-expanded="probeInfoOpen"
          @click="probeInfoOpen = !probeInfoOpen"
        >
          <strong class="text-sm font-black">13 项探针说明</strong>
          <svg
            class="h-4 w-4 shrink-0 text-muted transition"
            :class="probeInfoOpen ? 'rotate-180' : ''"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
        </button>
        <div v-show="probeInfoOpen" class="border-t border-line bg-white px-3 py-2.5">
          <span class="text-xs font-medium leading-6 text-muted">
            身份一致性、签名指纹、协议结构、复杂推理、上下文稳定、Token 消耗与掺水率估算等共 13 项跨维度确定性探针。
          </span>
        </div>
      </div>

      <!-- 开始检测 -->
      <button
        v-if="currentStep === 3"
        class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-mint-700 to-brand-600 font-black text-white shadow-lg shadow-brand-500/15 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="loading || !configComplete"
        :title="submitHint"
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
      <p v-if="currentStep === 3 && !configComplete" class="text-center text-xs font-bold text-amber-700">
        {{ submitHint }}
      </p>
    </form>
  </aside>
</template>
