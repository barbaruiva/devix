<script setup>
import { computed } from 'vue';
import { bodyTooltipValue, hasInspectableData, headerTooltipValue } from '../lib/inspect.js';

const props = defineProps({
  // 'headers' | 'body' — decides both the icon and how the payload is rendered.
  kind: { type: String, required: true },
  payload: { type: null, default: null },
  label: { type: String, required: true },
});

const emit = defineEmits(['show', 'hide']);

const available = computed(() => hasInspectableData(props.payload));

// Serialized only on hover: doing it per row would parse every payload in the buffer.
function show(event) {
  if (!available.value) {
    return;
  }
  const text = props.kind === 'headers' ? headerTooltipValue(props.payload) : bodyTooltipValue(props.payload);
  emit('show', event.currentTarget.getBoundingClientRect(), text);
}
</script>

<template>
  <span
    class="payload-indicator"
    :class="{ unavailable: !available }"
    :aria-label="available ? label : `${label} (empty)`"
    @mouseenter="show"
    @mouseleave="$emit('hide')"
  >
    <svg
      v-if="kind === 'headers'"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M3 4.5h10M3 8h10M3 11.5h6" />
    </svg>
    <svg
      v-else
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M6.4 2.5c-1.4 0-2 .7-2 1.9v1.4c0 .9-.5 1.4-1.4 1.4v.6c.9 0 1.4.5 1.4 1.4v1.4c0 1.2.6 1.9 2 1.9" />
      <path d="M9.6 2.5c1.4 0 2 .7 2 1.9v1.4c0 .9.5 1.4 1.4 1.4v.6c-.9 0-1.4.5-1.4 1.4v1.4c0 1.2-.6 1.9-2 1.9" />
    </svg>
  </span>
</template>

<style scoped>
.payload-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: default;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.payload-indicator:hover {
  background: var(--surface-3);
  color: var(--text-strong);
}

.payload-indicator.unavailable {
  background: transparent;
  color: var(--text-dim);
  opacity: 0.35;
}

.payload-indicator.unavailable:hover {
  background: transparent;
  color: var(--text-dim);
}
</style>
