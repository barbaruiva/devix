<script setup>
import { computed, useTemplateRef } from 'vue';
import { SEGMENTED_MAX } from '../lib/routes.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: 'Environment' },
});

const emit = defineEmits(['update:modelValue']);

// Two or three environments is the common case, and there switching should cost one
// click; past that the segments get too narrow to read and a select wins.
const segmented = computed(() => props.options.length > 0 && props.options.length <= SEGMENTED_MAX);

const segmentEls = useTemplateRef('segments');

function select(option) {
  if (props.disabled || option === props.modelValue) {
    return;
  }
  emit('update:modelValue', option);
}

const STEPS = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

// Roving focus, as a native radio group behaves: arrows move and select in one go.
function onKeydown(event) {
  const step = STEPS[event.key];
  if (!step || props.disabled || props.options.length < 2) {
    return;
  }

  event.preventDefault();
  const current = props.options.indexOf(props.modelValue);
  const next = (current + step + props.options.length) % props.options.length;
  select(props.options[next]);
  segmentEls.value?.[next]?.focus();
}
</script>

<template>
  <div
    v-if="segmented"
    class="segmented"
    :class="{ disabled }"
    role="radiogroup"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :key="option"
      ref="segments"
      type="button"
      role="radio"
      class="segment"
      :class="{ on: option === modelValue }"
      :aria-checked="option === modelValue"
      :tabindex="option === modelValue ? 0 : -1"
      :disabled="disabled"
      @click="select(option)"
    >
      {{ option }}
    </button>
  </div>

  <div v-else class="select-field" :class="{ disabled }">
    <select
      class="select"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="label"
      @change="select($event.target.value)"
    >
      <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
    </select>
    <svg class="chevron" viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true">
      <path d="M8 11.2 2.8 6a1 1 0 0 1 1.4-1.4L8 8.4l3.8-3.8A1 1 0 0 1 13.2 6z" />
    </svg>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-0);
}

.segment {
  padding: 3px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.segment:hover:not(:disabled):not(.on) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.segment.on {
  background: var(--accent-wash);
  border-color: var(--accent-border);
  color: var(--text-strong);
}

.segmented.disabled,
.select-field.disabled {
  opacity: 0.55;
}

.segment:disabled {
  cursor: default;
}

/* The native arrow cannot be themed, so the select hides it and draws its own. */
.select-field {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.select {
  appearance: none;
  min-width: 120px;
  padding: 4px 26px 4px 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--text-strong);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.select:hover:not(:disabled) {
  background: var(--surface-3);
}

.select:disabled {
  cursor: default;
}

.chevron {
  position: absolute;
  right: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

.segment:focus-visible,
.select:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 1px;
}
</style>
