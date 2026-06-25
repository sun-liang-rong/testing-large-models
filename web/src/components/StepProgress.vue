<script setup lang="ts">
type StepState = "done" | "active" | "todo";

interface StepItem {
  index: number;
  label: string;
  state: StepState;
}

defineProps<{
  steps: StepItem[];
}>();

const emit = defineEmits<{
  jump: [index: number];
}>();
</script>

<template>
  <ol class="flex items-center gap-1.5" aria-label="配置进度">
    <li
      v-for="(step, i) in steps"
      :key="step.index"
      class="flex min-w-0 flex-1 items-center gap-1.5"
    >
      <button
        class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition"
        :class="{
          'border-mint-100 bg-mint-50 text-mint-700': step.state === 'done',
          'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100': step.state === 'active',
          'border-line bg-field text-muted': step.state === 'todo'
        }"
        type="button"
        @click="emit('jump', step.index)"
      >
        <span
          class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black"
          :class="{
            'bg-mint-600 text-white': step.state === 'done',
            'bg-brand-600 text-white': step.state === 'active',
            'bg-zinc-200 text-zinc-500': step.state === 'todo'
          }"
        >
          <svg v-if="step.state === 'done'" class="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" />
          </svg>
          <template v-else>{{ step.index }}</template>
        </span>
        <strong class="truncate text-xs font-black">{{ step.label }}</strong>
      </button>
      <span
        v-if="i < steps.length - 1"
        class="h-0.5 w-3 shrink-0 rounded-full"
        :class="step.state === 'done' ? 'bg-mint-600' : 'bg-line'"
      />
    </li>
  </ol>
</template>
