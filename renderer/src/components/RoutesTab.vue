<script setup>
import RouteSelector from './RouteSelector.vue';
import { activeDestination, effectiveRoute, routeKeys } from '../lib/routes.js';

defineProps({
  proxies: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  // path -> 'saving' | 'saved'; absent means idle.
  saveState: { type: Object, default: () => ({}) },
});

defineEmits(['change-route', 'open-settings']);
</script>

<template>
  <div class="panel-body">
    <p v-if="loading" class="status">Loading configuration…</p>

    <div v-else-if="!proxies.length" class="empty">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 7h7l2 2h7" stroke-linecap="round" stroke-linejoin="round" />
        <rect x="3" y="7" width="18" height="12" rx="2" />
      </svg>
      <h2>No proxies configured</h2>
      <p>Add an application in Settings to start routing traffic through devix.</p>
      <button type="button" class="btn-primary" @click="$emit('open-settings')">Open Settings</button>
    </div>

    <table v-else class="routes-table">
      <thead>
        <tr>
          <th>Application</th>
          <th>Path</th>
          <th>Environment</th>
          <th>Destination</th>
          <th class="col-state"><span class="visually-hidden">Save state</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="proxy in proxies" :key="proxy.path" class="route-row">
          <td class="col-name">{{ proxy.name }}</td>
          <td><code>{{ proxy.path }}</code></td>
          <td class="col-env">
            <RouteSelector
              :model-value="effectiveRoute(proxy)"
              :options="routeKeys(proxy)"
              :disabled="saveState[proxy.path] === 'saving'"
              :label="`Environment for ${proxy.name}`"
              @update:model-value="$emit('change-route', proxy, $event)"
            />
          </td>
          <td class="col-destination">
            <code :title="activeDestination(proxy)">{{ activeDestination(proxy) || '—' }}</code>
          </td>
          <td class="col-state">
            <!-- Saving is usually a few milliseconds, so the check is the real feedback:
                 it confirms the write landed, then fades on its own. -->
            <span
              v-if="saveState[proxy.path] === 'saving'"
              class="spinner"
              role="status"
              :aria-label="`Saving ${proxy.name}`"
            ></span>
            <!-- `appear`: the Transition mounts only when the spinner leaves, so without it
                 the check would pop in and only fade on the way out. -->
            <Transition v-else appear name="check">
              <svg
                v-if="saveState[proxy.path] === 'saved'"
                class="check"
                viewBox="0 0 16 16"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                role="img"
                :aria-label="`${proxy.name} saved`"
              >
                <path d="m3 8.5 3.2 3.2L13 4.8" />
              </svg>
            </Transition>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Only the panel body scrolls — the panel itself never grows past the viewport. */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-4) var(--space-5);
}

.status {
  margin: var(--space-2) 0;
  color: var(--text-muted);
  font-size: 12px;
}

.routes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.routes-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--surface-sticky);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-default);
}

.routes-table td {
  padding: var(--space-1) 10px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-subtle);
}

.route-row:nth-child(even) {
  background: var(--surface-zebra);
}

.route-row:hover {
  background: var(--surface-hover);
}

.col-name {
  color: var(--text-strong);
  font-weight: 500;
}

.routes-table code {
  color: var(--text-code);
  font-family: var(--font-mono);
}

.col-env {
  width: 1%;
}

/* The elastic column: it absorbs the leftover width and truncates instead of
   pushing the save indicator off the row. */
.col-destination {
  width: 100%;
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-state {
  width: 28px;
  text-align: center !important;
  color: var(--ok);
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent-border);
  border-radius: 50%;
  animation: spin 640ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.check {
  display: block;
  margin: 0 auto;
}

.check-enter-active,
.check-appear-active,
.check-leave-active {
  transition: opacity var(--dur-base) var(--ease);
}

.check-enter-from,
.check-appear-from,
.check-leave-to {
  opacity: 0;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  max-width: 340px;
  margin: 12vh auto 0;
  text-align: center;
  color: var(--text-muted);
}

.empty svg {
  color: var(--text-dim);
}

.empty h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}

.empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.btn-primary {
  margin-top: var(--space-2);
  padding: 6px 14px;
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--text-strong);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/*
 * With reduced motion the global rule in theme.css stops the spin, so the ring stays
 * still — the accent arc still marks the row as busy, the `role="status"` label still
 * announces it, and the check that follows is the real confirmation either way.
 */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    border-top-color: var(--accent-border);
    border-right-color: var(--accent-border);
  }
}
</style>
