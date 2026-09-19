<script setup>
import { computed, onUnmounted, ref } from 'vue';
import CollapsibleSection from './CollapsibleSection.vue';
import MethodBadge from './MethodBadge.vue';
import StatusBadge from './StatusBadge.vue';
import { copyText } from '../lib/clipboard.js';
import { describeSize, formatTimestamp } from '../lib/format.js';
import { highlightJson } from '../lib/highlight.js';
import {
  bodyTooltipValue,
  destinationParts,
  hasInspectableData,
  headerRows,
  headerTooltipValue,
} from '../lib/inspect.js';

const props = defineProps({
  entry: { type: Object, required: true },
  // Open/closed state lives in the parent so it survives closing the panel.
  sectionOpen: { type: Object, required: true },
});

defineEmits(['close', 'toggle-section']);

const copiedKey = ref('');
let copiedTimer = null;

function markCopied(key) {
  copiedKey.value = key;
  if (copiedTimer) {
    clearTimeout(copiedTimer);
  }
  copiedTimer = setTimeout(() => {
    copiedKey.value = '';
    copiedTimer = null;
  }, 1200);
}

async function copy(key, text) {
  if (await copyText(text)) {
    markCopied(key);
  }
}

onUnmounted(() => {
  if (copiedTimer) {
    clearTimeout(copiedTimer);
  }
});

const detailSections = computed(() => {
  const entry = props.entry;

  const definitions = [
    { key: 'responseHeaders', label: 'Response headers', type: 'headers', source: entry.responseHeaders },
    { key: 'responseBody', label: 'Response body', type: 'body', source: entry.responseBody },
    { key: 'requestHeaders', label: 'Request headers', type: 'headers', source: entry.requestHeaders },
    { key: 'requestBody', label: 'Request body', type: 'body', source: entry.requestBody },
  ];

  return definitions.map((definition) => {
    const available = hasInspectableData(definition.source);

    if (definition.type === 'headers') {
      const rows = available ? headerRows(definition.source) : [];
      return {
        ...definition,
        available: rows.length > 0,
        rows,
        text: headerTooltipValue(definition.source),
        meta: rows.length > 0 ? `${rows.length} ${rows.length === 1 ? 'header' : 'headers'}` : 'empty',
      };
    }

    const text = available ? bodyTooltipValue(definition.source) : '';
    return {
      ...definition,
      available,
      rows: [],
      text,
      html: available ? highlightJson(text) : '',
      meta: available ? describeSize(text) : 'empty',
    };
  });
});

const destination = computed(() => destinationParts(props.entry));
</script>

<template>
  <aside class="log-detail">
    <header class="detail-header">
      <div class="detail-heading">
        <StatusBadge :entry="entry" />
        <MethodBadge :method="entry.method" />
        <span class="detail-time">{{ formatTimestamp(entry.timestamp) }}</span>
      </div>
      <button class="btn-icon-ghost" title="Close (Esc)" @click="$emit('close')">✕</button>
    </header>

    <div class="detail-scroll">
      <div class="detail-summary">
        <div class="detail-row">
          <span class="detail-key">Proxy</span>
          <code>{{ entry.proxyPath || '-' }}</code>
        </div>
        <div class="detail-row">
          <span class="detail-key">Destination</span>
          <code class="detail-destination">
            <span v-if="destination.base" class="destination-static">
              {{ destination.base }}</span><span>{{ destination.suffix }}</span>
          </code>
          <button
            class="btn-copy"
            title="Copy URL"
            @click="copy('destination', entry.destinationPath || entry.message || '')"
          >
            {{ copiedKey === 'destination' ? 'Copied' : 'Copy' }}
          </button>
        </div>
      </div>

      <div class="detail-sections">
        <CollapsibleSection
          v-for="section in detailSections"
          :key="section.key"
          :label="section.label"
          :meta="section.meta"
          :empty="!section.available"
          :open="sectionOpen[section.key]"
          @toggle="$emit('toggle-section', section.key)"
        >
          <template #actions>
            <button
              v-if="section.available"
              class="btn-copy"
              :title="`Copy ${section.label.toLowerCase()}`"
              @click.stop="copy(section.key, section.text)"
            >
              {{ copiedKey === section.key ? 'Copied' : 'Copy' }}
            </button>
          </template>

          <table v-if="section.type === 'headers' && section.available" class="headers-table">
            <tbody>
              <tr v-for="row in section.rows" :key="row.name">
                <th>{{ row.name }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
          <!-- eslint-disable-next-line vue/no-v-html -- highlightJson escapes before marking up -->
          <pre v-else-if="section.available" class="body-view" v-html="section.html"></pre>
          <p v-else class="section-empty">Not available</p>
        </CollapsibleSection>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Header stays put; only the body below it scrolls. */
.log-detail {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.detail-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: var(--space-2) var(--space-3);
  background: var(--surface-sticky);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
}

.detail-heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.detail-time {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-icon-ghost {
  border: 1px solid var(--border-default);
  background: var(--surface-2);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-fast) var(--ease);
}

.btn-icon-ghost:hover {
  background: var(--surface-3);
}

.btn-icon-ghost:focus-visible,
.btn-copy:focus-visible {
  outline: 2px solid var(--accent-ring);
  outline-offset: 2px;
}

.detail-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.detail-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.detail-key {
  flex-shrink: 0;
  width: 78px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-row code {
  color: var(--text-code);
  font-family: var(--font-mono);
  word-break: break-all;
}

.detail-destination {
  flex: 1;
  min-width: 0;
}

/* Also used inside CollapsibleSection's actions slot — slot content keeps this scope. */
.btn-copy {
  flex-shrink: 0;
  border: 1px solid var(--border-default);
  background: var(--surface-2);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 2px var(--space-2);
  font: inherit;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.btn-copy:hover {
  background: var(--surface-3);
  color: var(--text-strong);
}

.destination-static {
  color: var(--text-dim);
}

.detail-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.headers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  font-family: var(--font-mono);
}

.headers-table th,
.headers-table td {
  text-align: left;
  vertical-align: top;
  padding: 3px var(--space-2) 3px 0;
  word-break: break-all;
}

.headers-table th {
  width: 38%;
  font-weight: 600;
  color: var(--text-muted);
}

.headers-table td {
  color: var(--text-code);
}

/* No inner max-height: the detail body is the single scroll surface. */
.body-view {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  font-family: var(--font-mono);
  color: var(--text-code);
  white-space: pre-wrap;
  word-break: break-word;
}

/* Highlighter output comes from v-html, so it needs to pierce the scoped styles. */
.body-view :deep(.tok-key) {
  color: var(--code-key);
}

.body-view :deep(.tok-string) {
  color: var(--code-string);
}

.body-view :deep(.tok-number) {
  color: var(--code-number);
}

.body-view :deep(.tok-boolean) {
  color: var(--code-boolean);
}

.body-view :deep(.tok-null) {
  color: var(--code-null);
}

.section-empty {
  margin: 0;
  font-size: 11px;
  color: var(--text-dim);
}
</style>
