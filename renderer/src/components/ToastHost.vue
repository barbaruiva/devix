<script setup>
defineProps({
  toasts: { type: Array, default: () => [] },
  // The Settings tab ends in its own sticky action bar; without this the toasts would
  // land on top of Save & Reload, which is exactly when a toast is most likely to show.
  lifted: { type: Boolean, default: false },
});

defineEmits(['dismiss', 'action']);
</script>

<template>
  <div class="toast-host" :class="{ lifted }" role="status" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.tone}`">
      <span class="toast-message">{{ toast.message }}</span>
      <button
        v-if="toast.action"
        class="toast-action"
        type="button"
        @click="$emit('action', toast)"
      >
        {{ toast.action.label }}
      </button>
      <button class="toast-close" type="button" title="Dismiss" @click="$emit('dismiss', toast.id)">✕</button>
    </div>
  </div>
</template>

<style scoped>
/* Sits above the status bar, out of the layout flow so it never resizes a panel. */
.toast-host {
  position: fixed;
  right: var(--space-4);
  bottom: calc(var(--status-bar-height) + var(--space-3));
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-end;
  pointer-events: none;
}

.toast-host.lifted {
  bottom: calc(var(--status-bar-height) + var(--editor-bar-height) + var(--space-3));
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 460px;
  padding: 10px var(--space-3);
  font-size: 12px;
  color: var(--text-strong);
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
}

.toast-error {
  border-left-color: var(--danger);
}

.toast-success {
  border-left-color: var(--ok);
}

.toast-info {
  border-left-color: var(--info);
}

.toast-message {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.toast-action {
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  background: var(--surface-3);
  color: var(--text-strong);
  border-radius: var(--radius-sm);
  padding: 3px var(--space-2);
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.toast-action:hover {
  background: var(--accent);
}

.toast-close {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
  padding: 2px;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease);
}

.toast-close:hover {
  color: var(--text-strong);
}

.toast-action:focus-visible,
.toast-close:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 1px;
}
</style>
