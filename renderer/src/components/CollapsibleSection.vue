<script setup>
defineProps({
  label: { type: String, required: true },
  meta: { type: String, default: '' },
  empty: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
});

defineEmits(['toggle']);
</script>

<template>
  <section class="detail-section">
    <!-- The toggle is its own button so the header keeps a single tab stop and the
         Copy action in the slot is not nested inside it. -->
    <div class="section-head" :class="{ open }">
      <button type="button" class="section-toggle" :aria-expanded="open" @click="$emit('toggle')">
        <span class="section-chevron" aria-hidden="true">›</span>
        <span class="section-title">{{ label }}</span>
        <span class="section-meta" :class="{ empty }">{{ meta }}</span>
      </button>
      <slot name="actions" />
    </div>

    <div v-show="open" class="section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.detail-section {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.section-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 10px;
  background: var(--surface-2);
  user-select: none;
  transition: background var(--dur-fast) var(--ease);
}

.section-head:hover {
  background: var(--surface-3);
}

.section-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.section-toggle:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.section-chevron {
  display: inline-block;
  font-size: 14px;
  line-height: 1;
  color: var(--text-muted);
  transition: transform var(--dur-fast) var(--ease);
}

.section-head.open .section-chevron {
  transform: rotate(90deg);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong);
}

.section-meta {
  flex: 1;
  font-size: 11px;
  color: var(--text-muted);
}

/* A dimmer step rather than opacity, which would drop the contrast below AA. */
.section-meta.empty {
  color: var(--text-dim);
}

.section-body {
  padding: var(--space-2) 10px;
  border-top: 1px solid var(--border-subtle);
}
</style>
