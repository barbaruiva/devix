<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import {
  emptyProxy,
  emptyRoute,
  fingerprint,
  toEditorState,
  toProxiesConfig,
  validateEditor,
} from '../lib/proxyEditor.js';

const props = defineProps({
  // Raw proxies.json shape, or null while it has not been loaded yet.
  config: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['save', 'notify', 'dirty-change']);

const port = ref(12345);
const proxies = ref([]);
// Fingerprint of the last loaded (or saved) config; anything else means unsaved work.
const snapshot = ref('');

const state = computed(() => ({ port: port.value, proxies: proxies.value }));
const dirty = computed(() => fingerprint(state.value) !== snapshot.value);
const validation = computed(() => validateEditor(state.value));
const canSave = computed(() => dirty.value && validation.value.valid && !props.saving);

const statusLabel = computed(() => {
  if (!validation.value.valid) {
    const { count } = validation.value;
    return `${count} ${count === 1 ? 'problem' : 'problems'} to fix`;
  }
  if (dirty.value) {
    return 'Unsaved changes';
  }
  return 'Saving rewrites proxies.json and reloads the proxy server.';
});

// The editor works on its own copy; the parent owns the file and re-emits it after a save.
watch(() => props.config, reset, { immediate: true });

watch(dirty, (value) => emit('dirty-change', value), { immediate: true });

// Both halves of a route row can be wrong at once, and the footer counts both — so both
// have to be spelled out, otherwise a red border would sit there with no reason given.
function routeErrors(proxyIndex, routeIndex) {
  const { key, destination } = validation.value.proxies[proxyIndex].routeErrors[routeIndex];
  return [key, destination].filter(Boolean);
}

function reset() {
  const next = toEditorState(props.config);
  port.value = next.port;
  proxies.value = next.proxies;
  snapshot.value = fingerprint(next);
}

/*
 * Focus for rows that do not exist yet: the ref callback registers each input under the
 * id of the row that owns it, so `addProxy`/`addRoute` can hand the caret over as soon as
 * Vue has painted the new card.
 */
const inputs = new Map();

function setInputRef(key, el) {
  if (el) {
    inputs.set(key, el);
  } else {
    inputs.delete(key);
  }
}

function focusInput(key) {
  nextTick(() => inputs.get(key)?.focus());
}

function addProxy() {
  const proxy = emptyProxy();
  proxies.value.push(proxy);
  focusInput(`name:${proxy.id}`);
}

function removeProxy(index) {
  const [removed] = proxies.value.splice(index, 1);
  emit('notify', {
    message: `Removed ${removed.name || removed.path || 'proxy'} · not saved yet`,
    tone: 'info',
    duration: 8000,
    action: {
      label: 'Undo',
      // The list may have moved on by the time Undo is clicked, so clamp the insert.
      run: () => proxies.value.splice(Math.min(index, proxies.value.length), 0, removed),
    },
  });
}

function addRoute(proxy) {
  const route = emptyRoute();
  proxy.routes.push(route);
  focusInput(`route:${route.id}`);
}

function removeRoute(proxy, index) {
  proxy.routes.splice(index, 1);
}

function discard() {
  reset();
}

function save() {
  if (!canSave.value) {
    return;
  }
  emit('save', toProxiesConfig(state.value));
}
</script>

<template>
  <div class="settings">
    <div class="panel-body">
      <p v-if="loading" class="status">Loading…</p>

      <template v-if="!loading">
        <div class="editor-row">
          <label class="editor-label" for="editor-port">Port</label>
          <input
            id="editor-port"
            v-model.number="port"
            type="number"
            class="editor-input editor-input-sm"
            spellcheck="false"
            min="1"
            max="65535"
          />
        </div>

        <div v-for="(proxy, pi) in proxies" :key="proxy.id" class="proxy-card">
          <div class="proxy-card-header">
            <div class="editor-row-inline">
              <div class="editor-field">
                <label class="editor-label" :for="`name-${proxy.id}`">Name</label>
                <input
                  :id="`name-${proxy.id}`"
                  :ref="(el) => setInputRef(`name:${proxy.id}`, el)"
                  v-model="proxy.name"
                  class="editor-input"
                  spellcheck="false"
                  placeholder="My API"
                />
              </div>
              <div class="editor-field">
                <label class="editor-label" :for="`path-${proxy.id}`">Path</label>
                <input
                  :id="`path-${proxy.id}`"
                  v-model="proxy.path"
                  class="editor-input"
                  spellcheck="false"
                  :class="{ invalid: validation.proxies[pi].path }"
                  :aria-invalid="Boolean(validation.proxies[pi].path)"
                  :aria-describedby="validation.proxies[pi].path ? `path-error-${proxy.id}` : undefined"
                  placeholder="/api"
                />
              </div>
            </div>
            <button class="btn-icon-danger" type="button" @click="removeProxy(pi)" title="Remove proxy">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
              </svg>
            </button>
          </div>

          <!-- Outside the header so it never pushes the remove button out of line with the inputs. -->
          <p v-if="validation.proxies[pi].path" :id="`path-error-${proxy.id}`" class="field-error card-error">
            {{ validation.proxies[pi].path }}
          </p>

          <div class="routes-section">
            <p class="routes-label">Routes</p>
            <p v-if="validation.proxies[pi].routes" class="field-error">{{ validation.proxies[pi].routes }}</p>
            <div v-for="(route, ri) in proxy.routes" :key="route.id" class="route-entry">
              <div class="route-row">
                <input
                  :ref="(el) => setInputRef(`route:${route.id}`, el)"
                  v-model="route.key"
                  class="editor-input editor-input-key"
                  spellcheck="false"
                  :class="{ invalid: validation.proxies[pi].routeErrors[ri].key }"
                  :aria-invalid="Boolean(validation.proxies[pi].routeErrors[ri].key)"
                  :aria-label="`Environment name for ${proxy.name || proxy.path}`"
                  placeholder="env name"
                />
                <input
                  v-model="route.destination"
                  class="editor-input editor-input-dest"
                  spellcheck="false"
                  :class="{ invalid: validation.proxies[pi].routeErrors[ri].destination }"
                  :aria-invalid="Boolean(validation.proxies[pi].routeErrors[ri].destination)"
                  :aria-label="`Destination for ${route.key || 'new route'}`"
                  placeholder="http://localhost:8080"
                />
                <button
                  class="btn-icon-danger btn-icon-sm"
                  type="button"
                  @click="removeRoute(proxy, ri)"
                  :disabled="proxy.routes.length <= 1"
                  title="Remove route"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                  </svg>
                </button>
              </div>
              <p v-for="message in routeErrors(pi, ri)" :key="message" class="field-error route-error">
                {{ message }}
              </p>
            </div>
            <button class="btn-secondary btn-sm" type="button" @click="addRoute(proxy)">+ Add Route</button>
          </div>
        </div>

        <button class="btn-secondary" type="button" @click="addProxy">+ Add Proxy</button>
      </template>
    </div>

    <!-- Sticky so Save never drifts to the bottom of a long, scrolling list of cards. -->
    <div v-if="!loading" class="editor-bar">
      <span class="editor-status" :class="{ dirty, invalid: !validation.valid }">
        <span v-if="dirty" class="dirty-dot" aria-hidden="true"></span>
        {{ statusLabel }}
      </span>
      <button class="btn-secondary" type="button" :disabled="!dirty || saving" @click="discard">Discard</button>
      <button class="btn-primary" type="button" :disabled="!canSave" @click="save">
        {{ saving ? 'Saving…' : 'Save & Reload' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Only the panel body scrolls — the panel itself never grows past the viewport. */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-4) var(--space-5);
}

.status {
  margin-top: var(--space-3);
}

.editor-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.editor-row-inline {
  display: flex;
  gap: var(--space-3);
  flex: 1;
  flex-wrap: wrap;
}

.editor-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 140px;
}

.editor-input {
  background: var(--surface-0);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-strong);
  padding: 6px 10px;
  font: inherit;
  font-size: 13px;
  width: 100%;
}

.editor-input:focus {
  outline: none;
  border-color: var(--border-strong);
}

.editor-input:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: -1px;
}

.editor-input.invalid {
  border-color: var(--danger);
}

.editor-input-sm {
  width: 100px;
}

.editor-input-key {
  width: 120px;
  flex-shrink: 0;
}

.editor-input-dest {
  flex: 1;
}

/* The reason a field is blocking the save, right under the field that causes it. */
.field-error {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--danger-text);
}

.route-error {
  margin-left: 2px;
}

.proxy-card {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-2);
}

.proxy-card-header {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: var(--space-3);
}

.card-error {
  margin: -6px 0 var(--space-3);
}

.routes-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.routes-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.route-entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.route-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.editor-bar {
  flex-shrink: 0;
  min-height: var(--editor-bar-height); /* the offset the toast host lifts itself by */
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-sticky);
  backdrop-filter: blur(8px);
}

.editor-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.editor-status.dirty {
  color: var(--text-primary);
}

.editor-status.invalid {
  color: var(--danger-text);
}

.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warn);
  flex-shrink: 0;
}

.editor-status.invalid .dirty-dot {
  background: var(--danger);
}

.btn-primary {
  background: var(--accent);
  border: 1px solid var(--accent-border);
  color: var(--text-strong);
  border-radius: var(--radius-md);
  padding: 6px var(--space-4);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: default;
}

.btn-secondary {
  background: var(--surface-2);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: 6px var(--space-4);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--surface-3);
}

.btn-secondary:disabled {
  opacity: 0.45;
  cursor: default;
}

.btn-sm {
  align-self: flex-start;
  padding: 4px var(--space-3);
  font-size: 12px;
}

.btn-icon-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--danger-surface);
  border: 1px solid var(--danger-border);
  color: var(--danger-fg);
  border-radius: var(--radius-sm);
  width: 30px;
  height: 30px;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
}

.btn-icon-danger:hover:not(:disabled) {
  background: var(--danger-surface-hover);
  border-color: var(--danger-border-hover);
}

.btn-icon-danger:disabled {
  opacity: 0.3;
  cursor: default;
}

.btn-icon-sm {
  width: 26px;
  height: 26px;
}

.btn-primary:focus-visible,
.btn-secondary:focus-visible,
.btn-icon-danger:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 2px;
}
</style>
