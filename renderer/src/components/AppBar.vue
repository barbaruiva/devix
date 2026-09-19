<script setup>
import { nextTick, ref } from 'vue';

const props = defineProps({
  tabs: { type: Array, required: true },
  modelValue: { type: String, required: true },
});

const emit = defineEmits(['update:modelValue']);

const tabButtons = ref([]);

function setTabButtonRef(el, index) {
  if (el) {
    tabButtons.value[index] = el;
  }
}

function activateTabAt(index, { focus = false } = {}) {
  const tab = props.tabs[index];
  if (!tab) {
    return;
  }
  emit('update:modelValue', tab.id);
  if (focus) {
    nextTick(() => tabButtons.value[index]?.focus());
  }
}

// Arrow/Home/End only apply while the focus is inside the tablist.
function onTabsKeydown(event) {
  const current = props.tabs.findIndex((tab) => tab.id === props.modelValue);
  let next = null;

  if (event.key === 'ArrowRight') next = (current + 1) % props.tabs.length;
  else if (event.key === 'ArrowLeft') next = (current - 1 + props.tabs.length) % props.tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = props.tabs.length - 1;
  else return;

  event.preventDefault();
  activateTabAt(next, { focus: true });
}
</script>

<template>
  <header class="app-bar">
    <span class="app-brand">devix</span>

    <nav class="tabs" role="tablist" aria-label="Sections" @keydown="onTabsKeydown">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :ref="(el) => setTabButtonRef(el, index)"
        :id="`tab-${tab.id}`"
        class="tab-button"
        :class="{ active: modelValue === tab.id }"
        type="button"
        role="tab"
        :aria-selected="modelValue === tab.id"
        :aria-controls="`panel-${tab.id}`"
        :tabindex="modelValue === tab.id ? 0 : -1"
        @click="activateTabAt(index)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- Contextual actions per tab (search in Logs, Save/Discard in Settings). -->
    <div class="app-bar-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
/* App bar: brand · tabs · contextual actions. Its bottom border is the rail the
   tab indicators sit on — that is what anchors the tabs to the content below. */
.app-bar {
  flex-shrink: 0;
  height: var(--app-bar-height);
  display: flex;
  align-items: stretch;
  gap: var(--space-5);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  user-select: none;
}

.app-brand {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--text-dim);
}

.tabs {
  display: flex;
  align-items: stretch;
  gap: var(--space-1);
}

.app-bar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.tab-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  padding: 6px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

/* The indicator overlaps the app-bar border (bottom: -1px) so it reads as a
   segment of the same rail rather than a separate line. */
.tab-button::after {
  content: '';
  position: absolute;
  left: var(--space-2);
  right: var(--space-2);
  bottom: -1px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--accent-border);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.tab-button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.tab-button.active {
  color: var(--text-strong);
}

.tab-button.active::after {
  opacity: 1;
}

.tab-button:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: -2px;
}

@media (max-width: 980px) {
  .app-bar {
    gap: var(--space-3);
    padding: 0 var(--space-3);
  }
}
</style>
