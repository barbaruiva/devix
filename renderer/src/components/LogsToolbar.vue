<script setup>
import { ref } from 'vue';
import { STATUS_BUCKETS } from '../lib/logFilter.js';

const props = defineProps({
  search: { type: String, default: '' },
  statuses: { type: Array, default: () => [] },
  methods: { type: Array, default: () => [] },
  availableMethods: { type: Array, default: () => [] },
  visibleCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  filtered: { type: Boolean, default: false },
});

const emit = defineEmits(['update:search', 'update:statuses', 'update:methods', 'clear', 'reset-filters']);

const searchInput = ref(null);

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function onSearchKeydown(event) {
  if (event.key === 'Escape' && props.search) {
    // Stop here so the shared Escape handler does not also close the detail panel.
    event.stopPropagation();
    emit('update:search', '');
  }
}

defineExpose({ focusSearch: () => searchInput.value?.focus() });
</script>

<template>
  <div class="logs-toolbar">
    <label class="search-field">
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
      </svg>
      <input
        ref="searchInput"
        type="search"
        class="search-input"
        placeholder="Filter by path, destination or method"
        aria-label="Filter logs"
        :value="search"
        @input="$emit('update:search', $event.target.value)"
        @keydown="onSearchKeydown"
      />
    </label>

    <div class="chip-group" role="group" aria-label="Filter by status">
      <button
        v-for="bucket in STATUS_BUCKETS"
        :key="bucket.id"
        type="button"
        class="chip"
        :class="[`chip-${bucket.id}`, { on: statuses.includes(bucket.id) }]"
        :aria-pressed="statuses.includes(bucket.id)"
        @click="$emit('update:statuses', toggle(statuses, bucket.id))"
      >
        {{ bucket.id }}
      </button>
    </div>

    <div v-if="availableMethods.length > 1" class="chip-group" role="group" aria-label="Filter by method">
      <button
        v-for="method in availableMethods"
        :key="method"
        type="button"
        class="chip"
        :class="{ on: methods.includes(method) }"
        :aria-pressed="methods.includes(method)"
        @click="$emit('update:methods', toggle(methods, method))"
      >
        {{ method }}
      </button>
    </div>

    <span class="toolbar-spacer"></span>

    <button v-if="filtered" type="button" class="counter" @click="$emit('reset-filters')">
      <strong>{{ visibleCount }}</strong> of {{ totalCount }} · clear filters
    </button>
    <span v-else class="counter as-text">{{ totalCount }} {{ totalCount === 1 ? 'entry' : 'entries' }}</span>

    <button type="button" class="btn-toolbar" :disabled="!totalCount" @click="$emit('clear')">Clear</button>
  </div>
</template>

<style scoped>
.logs-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-1);
}

.search-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 200px;
  min-width: 140px;
  max-width: 340px;
  height: 26px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--surface-0);
  color: var(--text-dim);
  transition: border-color var(--dur-fast) var(--ease);
}

/* The input itself has no border, so the ring goes on the field that draws one —
   the focus still reads the same as on every other control. */
.search-field:focus-within {
  border-color: var(--accent-border);
  color: var(--text-secondary);
  outline: 2px solid var(--accent-ring);
  outline-offset: 1px;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-dim);
}

/* Native clear affordance of type="search" clashes with the dark chrome. */
.search-input::-webkit-search-cancel-button {
  appearance: none;
}

.chip-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.chip {
  height: 22px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.chip:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.chip.on {
  background: var(--accent-wash);
  border-color: var(--accent-border);
  color: var(--text-strong);
}

/* Status chips carry their range's color once active, mirroring the badges. */
.chip-2xx.on {
  border-color: var(--ok);
  color: var(--ok);
}

.chip-3xx.on {
  border-color: var(--info);
  color: var(--info);
}

.chip-4xx.on {
  border-color: var(--warn);
  color: var(--warn);
}

.chip-5xx.on {
  border-color: var(--danger);
  color: var(--danger-text);
}

.toolbar-spacer {
  flex: 1;
}

.counter {
  border: 0;
  background: transparent;
  padding: 0;
  font: inherit;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  cursor: pointer;
}

.counter strong {
  color: var(--text-strong);
  font-weight: 600;
}

.counter.as-text {
  cursor: default;
}

.counter:not(.as-text):hover {
  color: var(--text-primary);
}

.btn-toolbar {
  height: 22px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.btn-toolbar:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text-strong);
}

.btn-toolbar:disabled {
  opacity: 0.4;
  cursor: default;
}

.chip:focus-visible,
.btn-toolbar:focus-visible,
.counter:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 1px;
}
</style>
