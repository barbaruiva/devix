<script setup>
import { computed } from 'vue';

const props = defineProps({
  text: { type: String, default: '' },
  // A DOMRect (or plain {top,bottom,left}) of the element being hovered; null hides it.
  anchor: { type: Object, default: null },
});

const MAX_LINES = 22;
const WIDTH = 420;
const MARGIN = 12;

const lines = computed(() => props.text.split('\n'));

const truncated = computed(() => lines.value.length > MAX_LINES);

const body = computed(() =>
  truncated.value ? lines.value.slice(0, MAX_LINES).join('\n') : props.text,
);

// Placed against the viewport, so the tooltip is never clipped by the scrolling
// log stream. Flips above the anchor in the lower half of the window.
const style = computed(() => {
  const rect = props.anchor;
  if (!rect) {
    return {};
  }

  const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - WIDTH - MARGIN));
  const placeAbove = rect.bottom > window.innerHeight * 0.55;

  return placeAbove
    ? { left: `${left}px`, bottom: `${window.innerHeight - rect.top + 6}px` }
    : { left: `${left}px`, top: `${rect.bottom + 6}px` };
});
</script>

<template>
  <Teleport to="body">
    <div v-if="anchor && text" class="hover-tooltip" role="tooltip" :style="style">
      <pre>{{ body }}</pre>
      <p v-if="truncated" class="hover-tooltip-more">
        + {{ lines.length - MAX_LINES }} more lines · open the inspector
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.hover-tooltip {
  position: fixed;
  z-index: 60;
  max-width: 420px;
  padding: var(--space-2) 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--surface-overlay);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-2);
  pointer-events: none;
}

.hover-tooltip pre {
  margin: 0;
  max-width: 100%;
  font-size: 11px;
  line-height: 1.45;
  font-family: var(--font-mono);
  color: var(--text-code);
  white-space: pre-wrap;
  word-break: break-all;
}

.hover-tooltip-more {
  margin: 6px 0 0;
  font-size: 10px;
  color: var(--text-dim);
}
</style>
