<script setup>
defineProps({
  statusText: { type: String, required: true },
  listening: { type: Boolean, default: false },
  detail: { type: String, default: '' },
  port: { type: [Number, String], default: null },
  proxyCount: { type: Number, default: 0 },
  requestCount: { type: Number, default: 0 },
});
</script>

<template>
  <footer class="status-bar">
    <span class="status-item" :title="detail || statusText">
      <span class="status-dot" :class="{ online: listening }"></span>
      {{ statusText }}
    </span>
    <span class="status-sep"></span>
    <span class="status-item">Port <strong>{{ port ?? '-' }}</strong></span>
    <span class="status-sep"></span>
    <span class="status-item">
      <strong>{{ proxyCount }}</strong> {{ proxyCount === 1 ? 'proxy' : 'proxies' }}
    </span>
    <span class="status-sep"></span>
    <span class="status-item" title="Requests proxied since this window opened">
      <strong>{{ requestCount }}</strong> {{ requestCount === 1 ? 'request' : 'requests' }}
    </span>
    <span class="status-spacer"></span>
  </footer>
</template>

<style scoped>
.status-bar {
  flex-shrink: 0;
  height: var(--status-bar-height);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  font-size: 11px;
  color: var(--text-secondary);
  /* Translucent over the shell gradient: the bar reads as chrome laid on the app,
     not as another opaque band. */
  background: var(--surface-bar);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-subtle);
  user-select: none;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.status-item strong {
  color: var(--text-strong);
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--danger);
  box-shadow: 0 0 6px var(--danger);
}

.status-dot.online {
  background: var(--ok);
  box-shadow: 0 0 6px var(--ok);
}

.status-sep {
  width: 1px;
  height: 12px;
  background: var(--border-default);
}

.status-spacer {
  flex: 1;
}
</style>
