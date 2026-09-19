<script setup>
/*
 * Small modal used when leaving the Settings tab would drop unsaved edits. A native
 * `confirm()` would work in Electron but renders as an OS box in the middle of a dark,
 * frameless-looking app — this keeps the interruption in the same visual language.
 */
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
});

const emit = defineEmits(['confirm', 'cancel']);

const cancelButton = ref(null);

// The safe choice takes the focus: Enter and Escape both keep the user's work.
watch(
  () => props.open,
  (open) => {
    if (open) {
      nextTick(() => cancelButton.value?.focus());
    }
  },
);

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    emit('cancel');
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @mousedown.self="$emit('cancel')" @keydown="onKeydown">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
        <h2 id="dialog-title" class="dialog-title">{{ title }}</h2>
        <p v-if="message" id="dialog-message" class="dialog-message">{{ message }}</p>
        <div class="dialog-actions">
          <button ref="cancelButton" type="button" class="btn-secondary" @click="$emit('cancel')">
            {{ cancelLabel }}
          </button>
          <button type="button" class="btn-danger" @click="$emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: rgba(4, 7, 13, 0.6);
  backdrop-filter: blur(2px);
}

.dialog {
  width: 100%;
  max-width: 380px;
  padding: var(--space-5);
  background: var(--surface-overlay);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
}

.dialog-title {
  margin: 0 0 var(--space-2);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.dialog-message {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
}

.btn-secondary,
.btn-danger {
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.btn-secondary {
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--surface-3);
}

.btn-danger {
  background: var(--danger-surface);
  border: 1px solid var(--danger-border);
  color: var(--danger-fg);
}

.btn-danger:hover {
  background: var(--danger-surface-hover);
  border-color: var(--danger-border-hover);
}

.btn-secondary:focus-visible,
.btn-danger:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 2px;
}
</style>
