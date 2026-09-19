<script setup>
import { computed } from 'vue';

const props = defineProps({
  // The whole log entry: entries without a numeric status fall back to the log level.
  entry: { type: Object, required: true },
});

const code = computed(() => Number.parseInt(props.entry.statusCode, 10));

const label = computed(() => {
  if (Number.isFinite(code.value)) {
    return String(code.value);
  }
  return props.entry.level === 'error' ? 'ERR' : 'INFO';
});

const toneClass = computed(() => {
  if (Number.isFinite(code.value)) {
    if (code.value < 200) return 'status-info';
    if (code.value < 300) return 'status-ok';
    if (code.value < 400) return 'status-info';
    if (code.value < 500) return 'status-client-error';
    return 'status-server-error';
  }

  return props.entry.level === 'error' ? 'status-server-error' : 'status-info';
});
</script>

<template>
  <span class="badge" :class="toneClass">{{ label }}</span>
</template>

<style scoped>
.status-info {
  background: var(--info-bg);
  color: var(--info-fg);
}

.status-ok {
  background: var(--ok-bg);
  color: var(--ok-fg);
}

.status-client-error {
  background: var(--warn-bg);
  color: var(--warn-fg);
}

.status-server-error {
  background: var(--danger-bg);
  color: var(--danger-fg);
}
</style>
