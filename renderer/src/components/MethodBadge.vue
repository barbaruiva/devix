<script setup>
import { computed } from 'vue';

const props = defineProps({
  method: { type: String, default: '' },
});

const normalized = computed(() => (props.method || '-').toUpperCase());

const toneClass = computed(() => {
  if (normalized.value === 'GET') return 'method-get';
  if (normalized.value === 'POST') return 'method-post';
  if (normalized.value === 'PUT') return 'method-put';
  if (normalized.value === 'PATCH') return 'method-patch';
  if (normalized.value === 'DELETE') return 'method-delete';
  return 'method-default';
});
</script>

<template>
  <span class="badge" :class="toneClass">{{ normalized }}</span>
</template>

<style scoped>
.method-get {
  background: var(--method-get-bg);
  color: var(--method-get-fg);
}

.method-post {
  background: var(--method-post-bg);
  color: var(--method-post-fg);
}

.method-put {
  background: var(--method-put-bg);
  color: var(--method-put-fg);
}

.method-patch {
  background: var(--method-patch-bg);
  color: var(--method-patch-fg);
}

.method-delete {
  background: var(--method-delete-bg);
  color: var(--method-delete-fg);
}

.method-default {
  background: var(--method-default-bg);
  color: var(--method-default-fg);
}
</style>
