/*
 * Minimal toast queue. Errors used to be inline paragraphs inside a single tab, so an
 * error raised in Routes vanished the moment the user switched to Logs — toasts live in
 * the shell instead, above the status bar, and outlive the tab that raised them.
 */

import { ref } from 'vue';

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 4000;

let seq = 0;

export function useToasts() {
  const toasts = ref([]);
  const timers = new Map();

  function dismissToast(id) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  /**
   * @param {string} message
   * @param {{ tone?: 'info'|'success'|'error', duration?: number, action?: { label: string, run: Function } }} options
   *   `duration: 0` keeps the toast until it is dismissed — the default for errors.
   */
  function pushToast(message, options = {}) {
    if (!message) {
      return null;
    }

    const tone = options.tone || 'info';
    const duration = options.duration ?? (tone === 'error' ? 0 : DEFAULT_DURATION);
    seq += 1;
    const toast = { id: `toast-${seq}`, message, tone, action: options.action || null };

    toasts.value = [...toasts.value, toast];
    while (toasts.value.length > MAX_TOASTS) {
      dismissToast(toasts.value[0].id);
    }

    if (duration > 0) {
      timers.set(toast.id, setTimeout(() => dismissToast(toast.id), duration));
    }

    return toast.id;
  }

  function runToastAction(toast) {
    toast.action?.run?.();
    dismissToast(toast.id);
  }

  function clearToasts() {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    toasts.value = [];
  }

  return { toasts, pushToast, dismissToast, runToastAction, clearToasts };
}
