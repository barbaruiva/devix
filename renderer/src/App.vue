<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

const config = ref(null);
const activeTab = ref('logs');
const loading = ref(true);
const errorMessage = ref('');
const logs = ref([]);
const savingMap = reactive({});
const logsPanel = ref(null);
let unsubscribeLogs = null;
let unsubscribeConfigUpdates = null;

const proxies = computed(() => config.value?.proxies ?? []);

function destinationFor(proxy) {
  return proxy.routes?.[proxy.activeRoute]?.destination || '-';
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '-';
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleString();
}

function formatRequestSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') {
    return '-';
  }
  const size = Number.parseInt(bytes, 10);
  if (!Number.isFinite(size) || size < 0) {
    return '-';
  }
  return String(size);
}

function statusLabel(entry) {
  const code = Number.parseInt(entry.statusCode, 10);
  if (Number.isFinite(code)) {
    return String(code);
  }
  return entry.level === 'error' ? 'ERR' : 'INFO';
}

function statusBadgeClass(entry) {
  const code = Number.parseInt(entry.statusCode, 10);
  if (Number.isFinite(code)) {
    if (code < 200) return 'status-info';
    if (code < 300) return 'status-ok';
    if (code < 400) return 'status-info';
    if (code < 500) return 'status-client-error';
    return 'status-server-error';
  }

  return entry.level === 'error' ? 'status-server-error' : 'status-info';
}

function methodBadgeClass(method) {
  const normalizedMethod = (method || '').toUpperCase();
  if (normalizedMethod === 'GET') return 'method-get';
  if (normalizedMethod === 'POST') return 'method-post';
  if (normalizedMethod === 'PUT') return 'method-put';
  if (normalizedMethod === 'PATCH') return 'method-patch';
  if (normalizedMethod === 'DELETE') return 'method-delete';
  return 'method-default';
}

async function scrollLogsToBottom() {
  await nextTick();
  if (!logsPanel.value) {
    return;
  }
  logsPanel.value.scrollTop = logsPanel.value.scrollHeight;
}

async function onChangeRoute(proxy, routeKey) {
  const previousRoute = proxy.activeRoute;
  proxy.activeRoute = routeKey;
  savingMap[proxy.path] = true;
  errorMessage.value = '';

  try {
    const result = await window.proxyApi.setActiveRoute(proxy.path, routeKey);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update proxy route');
    }

    config.value = result.config;
  } catch (error) {
    proxy.activeRoute = previousRoute;
    errorMessage.value = error.message;
  } finally {
    savingMap[proxy.path] = false;
  }
}

onMounted(async () => {
  try {
    config.value = await window.proxyApi.getConfig();
    logs.value = await window.proxyApi.getLogHistory();
    await scrollLogsToBottom();

    unsubscribeLogs = window.proxyApi.onLogEntry(async (entry) => {
      logs.value.push(entry);
      if (logs.value.length > 1000) {
        logs.value.shift();
      }
      await scrollLogsToBottom();
    });

    unsubscribeConfigUpdates = window.proxyApi.onConfigUpdated((nextConfig) => {
      config.value = nextConfig;
    });
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load application data';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (unsubscribeLogs) {
    unsubscribeLogs();
  }
  if (unsubscribeConfigUpdates) {
    unsubscribeConfigUpdates();
  }
});
</script>

<template>
  <main class="shell">
    <nav class="tabs">
      <button class="tab-button" :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">Logs</button>
      <button class="tab-button" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
        Configuration
      </button>
    </nav>

    <section v-if="activeTab === 'logs'" class="panel panel-logs">
      <header>
        <h1>Live Logs</h1>
      </header>
      <div ref="logsPanel" class="log-stream">
        <p v-if="!logs.length" class="empty">No logs yet.</p>
        <table v-else class="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Method</th>
              <th>Proxy</th>
              <th>Destination</th>
              <th>Request size</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, index) in logs" :key="`${entry.timestamp}-${index}`">
              <td>{{ formatTimestamp(entry.timestamp) }}</td>
              <td>
                <span class="badge" :class="statusBadgeClass(entry)">
                  {{ statusLabel(entry) }}
                </span>
              </td>
              <td>
                <span class="badge" :class="methodBadgeClass(entry.method)">
                  {{ (entry.method || '-').toUpperCase() }}
                </span>
              </td>
              <td><code>{{ entry.proxyPath || '-' }}</code></td>
              <td><code>{{ entry.destinationPath || entry.message || '-' }}</code></td>
              <td>{{ formatRequestSize(entry.requestSize) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="panel panel-proxies">
      <header>
        <h1>Proxy Router</h1>
        <p v-if="config">Port: <strong>{{ config.port }}</strong></p>
      </header>

      <p v-if="loading" class="status">Loading configuration...</p>
      <p v-else-if="!proxies.length" class="status">No proxies configured.</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <table v-if="!loading && proxies.length" class="proxy-table">
        <thead>
          <tr>
            <th>Application</th>
            <th>Path</th>
            <th>Environment</th>
            <th>Destination</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="proxy in proxies" :key="proxy.path">
            <td>{{ proxy.name }}</td>
            <td><code>{{ proxy.path }}</code></td>
            <td>
              <select
                :value="proxy.activeRoute"
                :disabled="savingMap[proxy.path]"
                @change="onChangeRoute(proxy, $event.target.value)"
              >
                <option v-for="routeKey in Object.keys(proxy.routes)" :key="routeKey" :value="routeKey">
                  {{ routeKey }}
                </option>
              </select>
            </td>
            <td><code>{{ destinationFor(proxy) }}</code></td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
  background: radial-gradient(circle at top left, #1a2030 0%, #0f131d 48%, #090c14 100%);
  color: #d7deef;
}

:global(*) {
  box-sizing: border-box;
}

.shell {
  min-height: 100vh;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabs {
  display: flex;
  gap: 10px;
}

.tab-button {
  border: 1px solid rgba(170, 185, 219, 0.34);
  background: #161e2d;
  color: #c9d7f7;
  border-radius: 10px;
  padding: 8px 14px;
  font: inherit;
  cursor: pointer;
}

.tab-button.active {
  background: #334563;
  color: #f0f5ff;
  border-color: rgba(196, 210, 243, 0.58);
}

.panel {
  background: rgba(20, 26, 39, 0.92);
  border: 1px solid rgba(139, 160, 204, 0.24);
  border-radius: 14px;
  backdrop-filter: blur(7px);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.4);
  padding: 18px;
}

header h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: 0.03em;
}

header p {
  margin: 10px 0 0;
}

.status {
  margin-top: 12px;
}

.error {
  margin-top: 12px;
  color: #ff7f7f;
  font-weight: 600;
}

.proxy-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.proxy-table th,
.proxy-table td {
  text-align: left;
  padding: 10px;
  border-bottom: 1px solid rgba(170, 185, 219, 0.14);
}

select {
  width: 100%;
  border: 1px solid rgba(170, 185, 219, 0.34);
  border-radius: 8px;
  background: #161e2d;
  color: #e5edff;
  padding: 7px 10px;
  font: inherit;
}

.log-stream {
  margin-top: 8px;
  height: calc(100vh - 190px);
  max-height: 760px;
  overflow: auto;
  background: #080d16;
  color: #d7deef;
  border-radius: 10px;
  padding: 12px;
  border: 1px solid rgba(170, 185, 219, 0.2);
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.logs-table th,
.logs-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(170, 185, 219, 0.14);
  vertical-align: middle;
}

.logs-table code {
  color: #c7d7ff;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

.badge {
  display: inline-block;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.status-info {
  background: #2f4e97;
  color: #e0ecff;
}

.status-ok {
  background: #1f7d4d;
  color: #dfffe8;
}

.status-client-error {
  background: #8a6a21;
  color: #fff3d2;
}

.status-server-error {
  background: #9a3535;
  color: #ffe2e2;
}

.method-get {
  background: #235a9e;
  color: #deedff;
}

.method-post {
  background: #21653f;
  color: #dcffe8;
}

.method-put {
  background: #7f5c20;
  color: #fff0cc;
}

.method-patch {
  background: #6441a2;
  color: #efe4ff;
}

.method-delete {
  background: #9c2f55;
  color: #ffe1ee;
}

.method-default {
  background: #4b556b;
  color: #edf2ff;
}

.empty {
  margin: 0;
  color: #8fa3c8;
}

@media (max-width: 980px) {
  .shell {
    padding: 14px;
  }

  .log-stream {
    height: 300px;
  }
}
</style>
