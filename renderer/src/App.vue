<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import AppBar from './components/AppBar.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import LogsTab from './components/LogsTab.vue';
import RoutesTab from './components/RoutesTab.vue';
import SettingsTab from './components/SettingsTab.vue';
import StatusBar from './components/StatusBar.vue';
import ToastHost from './components/ToastHost.vue';
import { useToasts } from './lib/toasts.js';

// Tab identity is internal ('logs' | 'config' | 'apis'); only the labels are user-facing.
const tabs = [
  { id: 'logs', label: 'Logs' },
  { id: 'config', label: 'Routes' },
  { id: 'apis', label: 'Settings' },
];
const activeTab = ref('logs');

const config = ref(null);
const status = ref(null);
const loading = ref(true);
const logs = ref([]);
const requestCount = ref(0);
// path -> 'saving' | 'saved'. The Routes tab renders it as a spinner and then a check;
// the entry is dropped once the check has had its moment.
const routeSaveState = reactive({});
const SAVED_FEEDBACK_MS = 1600;
const savedTimers = new Map();

const editorConfig = ref(null);
const editorSaving = ref(false);
const editorLoading = ref(false);
// The Settings tab is unmounted when the user leaves it, which is exactly why the shell
// has to know about pending edits before the switch happens.
const editorDirty = ref(false);
const pendingTab = ref(null);

const { toasts, pushToast, dismissToast, runToastAction } = useToasts();

let unsubscribeLogs = null;
let unsubscribeConfigUpdates = null;
let unsubscribeStatusUpdates = null;
let logSeq = 0;

function withLogId(entry) {
  logSeq += 1;
  return { ...entry, _id: `log-${logSeq}` };
}

// Only proxied requests carry a method; server/runtime lines do not count as traffic.
function isRequestEntry(entry) {
  return Boolean(entry.method);
}

const proxies = computed(() => config.value?.proxies ?? []);

const isListening = computed(() => status.value?.listening === true);

const statusText = computed(() => {
  if (isListening.value) {
    return 'Running';
  }
  return status.value?.error ? 'Error' : 'Stopped';
});

const statusPort = computed(() => status.value?.port ?? config.value?.port ?? null);

const statusProxyCount = computed(() => status.value?.proxyCount ?? proxies.value.length);

async function loadEditor() {
  editorLoading.value = true;
  try {
    editorConfig.value = await window.proxyApi.getProxiesConfig();
  } catch (error) {
    pushToast(error.message || 'Failed to load proxies config', { tone: 'error' });
  } finally {
    editorLoading.value = false;
  }
}

async function saveProxies(payload) {
  editorSaving.value = true;
  try {
    const result = await window.proxyApi.saveProxiesConfig(payload);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save');
    }
    config.value = result.config;
    pushToast('Configuration saved · proxy server reloaded', { tone: 'success' });
    await loadEditor();
  } catch (error) {
    pushToast(error.message || 'Failed to save proxies config', { tone: 'error' });
  } finally {
    editorSaving.value = false;
  }
}

function clearSavedTimer(path) {
  const timer = savedTimers.get(path);
  if (timer) {
    clearTimeout(timer);
    savedTimers.delete(path);
  }
}

function markRouteSaved(path) {
  routeSaveState[path] = 'saved';
  savedTimers.set(
    path,
    setTimeout(() => {
      savedTimers.delete(path);
      if (routeSaveState[path] === 'saved') {
        delete routeSaveState[path];
      }
    }, SAVED_FEEDBACK_MS),
  );
}

async function onChangeRoute(proxy, routeKey) {
  const previousRoute = proxy.activeRoute;
  proxy.activeRoute = routeKey;
  clearSavedTimer(proxy.path);
  routeSaveState[proxy.path] = 'saving';

  try {
    const result = await window.proxyApi.setActiveRoute(proxy.path, routeKey);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update proxy route');
    }

    config.value = result.config;
    markRouteSaved(proxy.path);
  } catch (error) {
    // Roll the control back to what the runtime still has, and let the toast explain.
    proxy.activeRoute = previousRoute;
    delete routeSaveState[proxy.path];
    pushToast(error.message || 'Failed to update proxy route', { tone: 'error' });
  }
}

// View-only: the main process ring buffer and the session counter stay untouched.
function clearLogs() {
  logs.value = [];
}

watch(activeTab, (tab) => {
  if (tab === 'apis') loadEditor();
  else editorDirty.value = false;
});

// Every tab switch funnels through here so unsaved editor work gets a confirmation first.
function requestTab(tabId) {
  if (tabId === activeTab.value) {
    return;
  }
  if (activeTab.value === 'apis' && editorDirty.value) {
    pendingTab.value = tabId;
    return;
  }
  activeTab.value = tabId;
}

function confirmLeaveEditor() {
  activeTab.value = pendingTab.value;
  pendingTab.value = null;
}

// Ctrl/Cmd+1..3 jumps straight to a tab from anywhere in the app.
function onKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
    const index = Number.parseInt(event.key, 10) - 1;
    if (Number.isInteger(index) && index >= 0 && index < tabs.length) {
      event.preventDefault();
      requestTab(tabs[index].id);
    }
  }
}

onMounted(async () => {
  try {
    config.value = await window.proxyApi.getConfig();
    status.value = await window.proxyApi.getStatus();

    const history = await window.proxyApi.getLogHistory();
    logs.value = history.map(withLogId);
    requestCount.value = history.filter(isRequestEntry).length;

    window.addEventListener('keydown', onKeydown);

    unsubscribeLogs = window.proxyApi.onLogEntry((entry) => {
      logs.value.push(withLogId(entry));
      if (logs.value.length > 1000) {
        logs.value.shift();
      }
      if (isRequestEntry(entry)) {
        requestCount.value += 1;
      }
    });

    unsubscribeConfigUpdates = window.proxyApi.onConfigUpdated((nextConfig) => {
      config.value = nextConfig;
    });

    unsubscribeStatusUpdates = window.proxyApi.onStatusUpdated((nextStatus) => {
      status.value = nextStatus;
    });
  } catch (error) {
    pushToast(error.message || 'Failed to load application data', { tone: 'error' });
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
  if (unsubscribeStatusUpdates) {
    unsubscribeStatusUpdates();
  }
  for (const timer of savedTimers.values()) {
    clearTimeout(timer);
  }
  savedTimers.clear();
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <main class="shell">
    <AppBar :model-value="activeTab" :tabs="tabs" @update:model-value="requestTab" />

    <div class="content">
      <section
        v-if="activeTab === 'logs'"
        id="panel-logs"
        class="panel panel-logs"
        role="tabpanel"
        aria-labelledby="tab-logs"
        tabindex="0"
      >
        <LogsTab :logs="logs" @clear="clearLogs" />
      </section>

      <section
        v-else-if="activeTab === 'config'"
        id="panel-config"
        class="panel"
        role="tabpanel"
        aria-labelledby="tab-config"
        tabindex="0"
      >
        <RoutesTab
          :proxies="proxies"
          :loading="loading"
          :save-state="routeSaveState"
          @change-route="onChangeRoute"
          @open-settings="requestTab('apis')"
        />
      </section>

      <section
        v-else-if="activeTab === 'apis'"
        id="panel-apis"
        class="panel"
        role="tabpanel"
        aria-labelledby="tab-apis"
        tabindex="0"
      >
        <SettingsTab
          :config="editorConfig"
          :loading="editorLoading"
          :saving="editorSaving"
          @save="saveProxies"
          @notify="(toast) => pushToast(toast.message, toast)"
          @dirty-change="editorDirty = $event"
        />
      </section>
    </div>

    <ConfirmDialog
      :open="pendingTab !== null"
      title="Discard unsaved changes?"
      message="Your edits to the proxy configuration have not been saved. Leaving this tab drops them."
      confirm-label="Discard"
      cancel-label="Keep editing"
      @confirm="confirmLeaveEditor"
      @cancel="pendingTab = null"
    />

    <ToastHost
      :toasts="toasts"
      :lifted="activeTab === 'apis'"
      @dismiss="dismissToast"
      @action="runToastAction"
    />

    <StatusBar
      :status-text="statusText"
      :listening="isListening"
      :detail="status?.error || ''"
      :port="statusPort"
      :proxy-count="statusProxyCount"
      :request-count="requestCount"
    />
  </main>
</template>

<style scoped>
/* Layout skeleton: the shell owns the viewport, every panel fills what is left. */
.shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  padding: var(--space-4) var(--space-6);
}

.panel {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
}

.panel-logs {
  padding: var(--space-3);
}

.panel:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: -2px;
}

@media (max-width: 980px) {
  .content {
    padding: var(--space-3);
  }
}
</style>
