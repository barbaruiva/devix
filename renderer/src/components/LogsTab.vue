<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import HoverTooltip from './HoverTooltip.vue';
import LogDetail from './LogDetail.vue';
import LogsToolbar from './LogsToolbar.vue';
import MethodBadge from './MethodBadge.vue';
import PayloadIndicator from './PayloadIndicator.vue';
import StatusBadge from './StatusBadge.vue';
import { formatTime, formatTimestamp } from '../lib/format.js';
import { destinationParts } from '../lib/inspect.js';
import { countAppended, filterLogs, hasActiveFilter, methodsInLogs } from '../lib/logFilter.js';

const props = defineProps({
  logs: { type: Array, default: () => [] },
});

const emit = defineEmits(['clear']);

const SPLIT_STORAGE_KEY = 'devix.logs.splitPercent';
const SPLIT_DEFAULT = 60;
const SPLIT_MIN = 30;
const SPLIT_MAX = 75;
// How far from the bottom still counts as "pinned to the bottom".
const BOTTOM_THRESHOLD = 24;

const streamEl = ref(null);
const layoutEl = ref(null);
const toolbar = ref(null);

const selectedLog = ref(null);
const sectionOpen = reactive({
  responseHeaders: true,
  responseBody: true,
  requestHeaders: false,
  requestBody: false,
});

/* ---------------------------------------------------------------- filters */

const search = ref('');
const statuses = ref([]);
const methods = ref([]);

const availableMethods = computed(() => methodsInLogs(props.logs));

const filterState = computed(() => ({
  search: search.value,
  statuses: statuses.value,
  methods: methods.value,
}));

const filtered = computed(() => hasActiveFilter(filterState.value));

const visibleLogs = computed(() => filterLogs(props.logs, filterState.value));

function resetFilters() {
  search.value = '';
  statuses.value = [];
  methods.value = [];
}

/* ------------------------------------------------------------ autoscroll */

const autoScroll = ref(true);
const pendingCount = ref(0);

async function scrollToBottom() {
  await nextTick();
  if (streamEl.value) {
    streamEl.value.scrollTop = streamEl.value.scrollHeight;
  }
}

// The stream follows new traffic only while the user is parked at the bottom;
// scrolling up pauses it and the pending counter takes over.
function onScroll() {
  hideTooltip();
  const el = streamEl.value;
  if (!el) {
    return;
  }

  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
  autoScroll.value = atBottom;
  if (atBottom) {
    pendingCount.value = 0;
  }
}

function resumeAutoScroll() {
  autoScroll.value = true;
  pendingCount.value = 0;
  scrollToBottom();
}

// `visibleLogs` is a fresh array on every change, so this fires on new traffic and
// on filter changes alike; `countAppended` is what tells the two apart.
watch(visibleLogs, (next, previous) => {
  if (autoScroll.value) {
    pendingCount.value = 0;
    scrollToBottom();
    return;
  }
  pendingCount.value += countAppended(next, previous);
});

watch(
  () => props.logs.length,
  () => {
    // Clearing the buffer (or the ring buffer dropping the entry) closes the inspector.
    if (selectedLog.value && !props.logs.some((entry) => entry._id === selectedLog.value._id)) {
      closeDetail();
    }
  },
);

/* ---------------------------------------------------------------- detail */

function isSelected(entry) {
  return selectedLog.value?._id === entry._id;
}

function openDetail(entry) {
  selectedLog.value = entry;
}

function closeDetail() {
  selectedLog.value = null;
}

function toggleDetail(entry) {
  if (isSelected(entry)) {
    closeDetail();
    return;
  }
  openDetail(entry);
}

function toggleSection(key) {
  sectionOpen[key] = !sectionOpen[key];
}

/* --------------------------------------------------------- row keyboard */

const focusedRowId = ref(null);

/*
 * One tab stop for the whole table — tabbing through a thousand rows would be a
 * trap. The stop follows the last row the user touched, then the selected row, and
 * otherwise sits on the newest entry, which is where the stream is already parked.
 */
const rovingRowId = computed(() => {
  const list = visibleLogs.value;
  const preferred = focusedRowId.value ?? selectedLog.value?._id;
  if (preferred && list.some((entry) => entry._id === preferred)) {
    return preferred;
  }
  return list.length ? list[list.length - 1]._id : null;
});

// Siblings instead of refs: `ref` arrays under v-for carry no order guarantee.
function onRowKeydown(event, entry) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleDetail(entry);
    return;
  }

  const sibling =
    event.key === 'ArrowDown'
      ? event.currentTarget.nextElementSibling
      : event.key === 'ArrowUp'
        ? event.currentTarget.previousElementSibling
        : null;

  // At either end the key falls through, so the stream scrolls as usual.
  if (!sibling) {
    return;
  }
  event.preventDefault();
  sibling.focus();
}

/* ----------------------------------------------------------- split pane */

function clampSplit(value) {
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
}

function readStoredSplit() {
  try {
    const stored = Number.parseFloat(window.localStorage.getItem(SPLIT_STORAGE_KEY));
    return Number.isFinite(stored) ? clampSplit(stored) : SPLIT_DEFAULT;
  } catch (_error) {
    return SPLIT_DEFAULT;
  }
}

function persistSplit(value) {
  try {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(value)));
  } catch (_error) {
    // Private mode or a locked profile: the split just falls back to the default.
  }
}

const splitPercent = ref(readStoredSplit());
const dragging = ref(false);
let dragRect = null;

function startDrag(event) {
  if (!layoutEl.value) {
    return;
  }
  event.preventDefault();
  dragRect = layoutEl.value.getBoundingClientRect();
  dragging.value = true;
  event.currentTarget.setPointerCapture(event.pointerId);
}

function onDrag(event) {
  if (!dragging.value || !dragRect) {
    return;
  }
  splitPercent.value = clampSplit(((event.clientX - dragRect.left) / dragRect.width) * 100);
}

function endDrag(event) {
  if (!dragging.value) {
    return;
  }
  dragging.value = false;
  dragRect = null;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  persistSplit(splitPercent.value);
}

function resetSplit() {
  splitPercent.value = SPLIT_DEFAULT;
  persistSplit(SPLIT_DEFAULT);
}

function onDividerKeydown(event) {
  if (event.key === 'ArrowLeft') {
    splitPercent.value = clampSplit(splitPercent.value - 2);
  } else if (event.key === 'ArrowRight') {
    splitPercent.value = clampSplit(splitPercent.value + 2);
  } else if (event.key === 'Home' || event.key === 'End') {
    splitPercent.value = SPLIT_DEFAULT;
  } else {
    return;
  }
  event.preventDefault();
  persistSplit(splitPercent.value);
}

/* --------------------------------------------------------------- tooltip */

const tooltip = reactive({ anchor: null, text: '' });

function showTooltip(anchor, text) {
  tooltip.anchor = anchor;
  tooltip.text = text;
}

function hideTooltip() {
  tooltip.anchor = null;
  tooltip.text = '';
}

/* -------------------------------------------------------------- keyboard */

function onKeydown(event) {
  if (event.key === 'Escape' && selectedLog.value) {
    closeDetail();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toolbar.value?.focusSearch();
  }
}

onMounted(() => {
  scrollToBottom();
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div
    ref="layoutEl"
    class="logs-layout"
    :class="{ split: !!selectedLog, dragging }"
    :style="{ '--split': `${splitPercent}%` }"
  >
    <div class="stream-pane">
      <LogsToolbar
        ref="toolbar"
        v-model:search="search"
        v-model:statuses="statuses"
        v-model:methods="methods"
        :available-methods="availableMethods"
        :visible-count="visibleLogs.length"
        :total-count="logs.length"
        :filtered="filtered"
        @clear="emit('clear')"
        @reset-filters="resetFilters"
      />

      <div ref="streamEl" class="log-stream" @scroll.passive="onScroll">
        <p v-if="!logs.length" class="empty">No logs yet.</p>

        <div v-else-if="!visibleLogs.length" class="empty empty-filtered">
          <p>No entries match the current filters.</p>
          <button type="button" class="btn-ghost" @click="resetFilters">Clear filters</button>
        </div>

        <table v-else class="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Method</th>
              <th>Proxy</th>
              <th>Destination</th>
              <th>Request</th>
              <th>Response</th>
              <th class="col-inspect"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in visibleLogs"
              :key="entry._id"
              class="log-row"
              :class="{ selected: isSelected(entry) }"
              :tabindex="entry._id === rovingRowId ? 0 : -1"
              @click="openDetail(entry)"
              @focus="focusedRowId = entry._id"
              @keydown="onRowKeydown($event, entry)"
            >
              <td class="col-time">
                {{ selectedLog ? formatTime(entry.timestamp) : formatTimestamp(entry.timestamp) }}
              </td>
              <td><StatusBadge :entry="entry" /></td>
              <td><MethodBadge :method="entry.method" /></td>
              <td><code>{{ entry.proxyPath || '-' }}</code></td>
              <td class="col-destination">
                <code class="destination">
                  <span
                    v-if="destinationParts(entry).base"
                    class="destination-static"
                  >{{ destinationParts(entry).base }}</span>
                  <span>{{ destinationParts(entry).suffix }}</span>
                </code>
              </td>
              <td>
                <div class="payload-icons">
                  <PayloadIndicator
                    kind="headers"
                    label="Request headers"
                    :payload="entry.requestHeaders"
                    @show="showTooltip"
                    @hide="hideTooltip"
                  />
                  <PayloadIndicator
                    kind="body"
                    label="Request body"
                    :payload="entry.requestBody"
                    @show="showTooltip"
                    @hide="hideTooltip"
                  />
                </div>
              </td>
              <td>
                <div class="payload-icons">
                  <PayloadIndicator
                    kind="headers"
                    label="Response headers"
                    :payload="entry.responseHeaders"
                    @show="showTooltip"
                    @hide="hideTooltip"
                  />
                  <PayloadIndicator
                    kind="body"
                    label="Response body"
                    :payload="entry.responseBody"
                    @show="showTooltip"
                    @hide="hideTooltip"
                  />
                </div>
              </td>
              <td class="col-inspect">
                <button
                  class="btn-inspect"
                  :class="{ active: isSelected(entry) }"
                  title="Inspect request"
                  @click.stop="toggleDetail(entry)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Transition name="pill">
        <button
          v-if="pendingCount && !autoScroll"
          type="button"
          class="new-logs-pill"
          @click="resumeAutoScroll"
        >
          ↓ {{ pendingCount }} new
        </button>
      </Transition>
    </div>

    <div
      v-if="selectedLog"
      class="split-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the inspector"
      :aria-valuenow="Math.round(splitPercent)"
      :aria-valuemin="SPLIT_MIN"
      :aria-valuemax="SPLIT_MAX"
      tabindex="0"
      @pointerdown="startDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @dblclick="resetSplit"
      @keydown="onDividerKeydown"
    ></div>

    <LogDetail
      v-if="selectedLog"
      :entry="selectedLog"
      :section-open="sectionOpen"
      @close="closeDetail"
      @toggle-section="toggleSection"
    />

    <HoverTooltip :anchor="tooltip.anchor" :text="tooltip.text" />
  </div>
</template>

<style scoped>
.logs-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: var(--space-3);
  align-items: stretch;
}

/* Stream · divider · inspector. The divider owns the gutter, so no column gap.
   The pixel floors keep both halves usable at the 900px minimum window width. */
.logs-layout.split {
  grid-template-columns: minmax(300px, var(--split)) auto minmax(260px, 1fr);
  column-gap: 0;
}

.logs-layout.dragging {
  user-select: none;
  cursor: col-resize;
}

.stream-pane {
  position: relative;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.log-stream {
  flex: 1;
  min-height: 0;
  overflow: auto;
  color: var(--text-primary);
}

.logs-table {
  width: 100%;
  min-width: 420px;
  border-collapse: collapse;
  font-size: 12px;
}

/* Side by side there is no room for the base URL — and the inspector open next to
   the row is already showing it in full, so the column keeps the proxied suffix. */
.logs-layout.split .destination-static {
  display: none;
}

/* Sticky header: translucent so rows visibly pass underneath it. */
.logs-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  background: var(--surface-sticky);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-default);
}

.logs-table th,
.logs-table td {
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.logs-table td {
  padding: var(--space-1) 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.logs-table code {
  color: var(--text-code);
  font-family: var(--font-mono);
}

.col-time {
  color: var(--text-secondary);
}

/* The elastic column: it takes whatever the fixed columns leave and truncates there,
   so the table always fits its pane instead of scrolling sideways — which is what it
   did in split view, pushing the inspect button out of reach. */
.col-destination {
  width: 100%;
  max-width: 0;
}

.destination {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.destination-static {
  color: var(--text-dim);
}

.payload-icons {
  display: flex;
  gap: var(--space-1);
}

.log-row {
  cursor: pointer;
}

.log-row:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: -2px;
}

/* Zebra keeps long lists scannable without drawing vertical rules. */
.log-row:nth-child(even) {
  background: var(--surface-zebra);
}

.log-row:hover {
  background: var(--surface-hover);
}

.log-row.selected {
  background: var(--accent-wash);
}

/* Selection reads as an accent rail rather than a heavy blue fill. */
.log-row.selected td:first-child {
  box-shadow: inset 2px 0 0 var(--accent-border);
}

.col-inspect {
  width: 34px;
  padding-right: var(--space-1) !important;
}

.btn-inspect {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.btn-inspect:hover {
  background: var(--surface-3);
  color: var(--text-strong);
}

.btn-inspect.active {
  background: var(--accent);
  border-color: var(--accent-border);
  color: var(--text-strong);
}

.split-divider {
  width: var(--space-3);
  cursor: col-resize;
  background: transparent;
  position: relative;
}

.split-divider::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: transparent;
  transition: background var(--dur-fast) var(--ease);
}

.split-divider:hover::after,
.logs-layout.dragging .split-divider::after {
  background: var(--accent-border);
}

.split-divider:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: -2px;
  border-radius: var(--radius-sm);
}

.new-logs-pill {
  position: absolute;
  left: 50%;
  bottom: var(--space-3);
  transform: translateX(-50%);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--text-strong);
  font: inherit;
  font-size: 11px;
  box-shadow: var(--shadow-2);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease);
}

.new-logs-pill:hover {
  background: var(--accent-hover);
}

.new-logs-pill:focus-visible,
.btn-inspect:focus-visible,
.btn-ghost:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 1px;
}

.pill-enter-active,
.pill-leave-active {
  transition: opacity var(--dur-fast) var(--ease);
}

.pill-enter-from,
.pill-leave-to {
  opacity: 0;
}

.empty {
  margin: 0;
  padding: var(--space-3);
  color: var(--text-muted);
  font-size: 12px;
}

.empty-filtered {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.empty-filtered p {
  margin: 0;
}

.btn-ghost {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-secondary);
  padding: 2px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--surface-3);
  color: var(--text-strong);
}

@media (max-width: 980px) {
  /* Detail panel stacks under the stream; the divider only makes sense side by side. */
  .logs-layout.split {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    row-gap: var(--space-3);
  }

  .logs-layout.split .split-divider {
    display: none;
  }
}
</style>
