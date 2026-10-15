<template>
  <div class="attribute-editor">
    <EmptyState v-if="!featureSetIdx" size="sm" :title="$t('pim.no_feature_set_attributes')" />

    <Loader block v-else-if="loading" />

    <template v-else>
      <BasicCard v-if="groupedRows.ungrouped.length" gap class="mb-8">
        <div class="form-grid">
          <AttributeField
            v-for="row in groupedRows.ungrouped"
            :key="row.feature_idx"
            :row="row"
            :options="getOptions(row.feature_idx)"
            :has-more="hasMoreOptions(row.feature_idx)"
            :stored-labels="labelsOf(row.feature_idx)"
            :language="defaultLang"
            :translatable="hasSecondaryLanguages"
            :class="{ 'form-grid__wide': WIDE_TYPES.includes(row.feature_type) }"
            @update="(field, value) => updateField(row.feature_idx, field, value)"
            @update-t9n="(field, value) => updateT9nField(row.feature_idx, field, defaultLang, value)"
            @update-json="(raw) => updateJsonField(row.feature_idx, raw)"
            @update-json-t9n="(raw) => updateJsonT9nField(row.feature_idx, defaultLang, raw)"
            @translate="openTranslationsDrawer(row.feature_idx)"
            @open-options="openOptions(row.feature_idx)"
            @load-more="loadMoreOptions(row.feature_idx)"
            @search="loadAllOptions(row.feature_idx)"
          />
        </div>
      </BasicCard>

      <BasicCard
        v-for="group in groupedRows.groups"
        :key="group.idx"
        :title="group.name"
        gap
        class="mb-8"
      >
        <template #actions>
          <div class="flex ai-ct gap-3">
            <CountBadge :count="group.rows.length" />
            <IconButton
              :icon="collapsedGroups.has(group.idx) ? 'expand' : 'collapse'"
              :label="$t(collapsedGroups.has(group.idx) ? 'pim.expand_group' : 'pim.collapse_group', { name: group.name })"
              :aria-expanded="String(!collapsedGroups.has(group.idx))"
              @click="toggleGroupCollapse(group.idx)"
            />
          </div>
        </template>
        <div v-show="!collapsedGroups.has(group.idx)" class="form-grid">
          <AttributeField
            v-for="row in group.rows"
            :key="row.feature_idx"
            :row="row"
            :options="getOptions(row.feature_idx)"
            :has-more="hasMoreOptions(row.feature_idx)"
            :stored-labels="labelsOf(row.feature_idx)"
            :language="defaultLang"
            :translatable="hasSecondaryLanguages"
            :class="{ 'form-grid__wide': WIDE_TYPES.includes(row.feature_type) }"
            @update="(field, value) => updateField(row.feature_idx, field, value)"
            @update-t9n="(field, value) => updateT9nField(row.feature_idx, field, defaultLang, value)"
            @update-json="(raw) => updateJsonField(row.feature_idx, raw)"
            @update-json-t9n="(raw) => updateJsonT9nField(row.feature_idx, defaultLang, raw)"
            @translate="openTranslationsDrawer(row.feature_idx)"
            @open-options="openOptions(row.feature_idx)"
            @load-more="loadMoreOptions(row.feature_idx)"
            @search="loadAllOptions(row.feature_idx)"
          />
        </div>
      </BasicCard>
    </template>

    <!-- Translations drawer -->
    <TranslationsDrawer
      :visible="!!translatingRow"
      :title="translatingRowLabel"
      :languages="effectiveLanguages"
      :default-language="defaultLang"
      :values="translatingRowValues"
      @cancel="translatingRow = null"
      @save="onTranslationsSave"
    >
      <template #input="{ lang, modelValue, onUpdate }">
        <BasicWysiwyg
          v-if="translatingRowData?.feature_type === 6"
          variant="lite"
          :model-value="modelValue"
          @update:model-value="onUpdate"
        />
        <BasicTextarea
          v-else-if="translatingRowData?.feature_type === 11"
          :model-value="jsonToString(modelValue)"
          :placeholder="'{}'"
          @update:model-value="onUpdate"
        />
        <BasicInput
          v-else
          :model-value="modelValue"
          @update:model-value="onUpdate"
        />
      </template>
    </TranslationsDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { GET_FeatureSetFeatures, GET_FeatureAttributes, GET_Attribute } from "@/api/pim/api";
import { useNotifyStore } from "@/stores/notify";
import { t } from "@/i18n";
import { createLimiter } from "@/utils/limit";
import { isSelectType } from "../helpers/pimEnums";
import { effectiveRequired } from "../helpers/requiredFeatures";
import { noteFeatureList } from "@/composables/usePimCapabilities";
import { jsonToString } from "../helpers/attributeValues";
import AttributeField from "./AttributeField.vue";

const props = defineProps({
  attributes: { type: Array, default: () => [] },
  featureSetIdx: { type: String, default: null },
  channelIdx: { type: String, required: true },
  languages: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:attributes"]);
const notify = useNotifyStore();

// Rich text and JSON attributes take the full width of the form grid.
const WIDE_TYPES = [5, 6, 9, 11];
const OPTIONS_PAGE_SIZE = 100;
// A typed query loads the values left up to this many; past it the operator is told the search is partial.
const SEARCH_CAP = 2000;
// Name lookups of stored values in flight at once, for the whole editor.
const limitLabels = createLimiter(6);

const effectiveLanguages = computed(() =>
  props.languages.length > 0 ? props.languages : ["en"]
);

const loading = ref(false);
const editableRows = ref([]);
// Loaded values and stored-value names per channel + feature set + feature (`cacheKey`), reset when either changes:
// a late answer of the previous channel lands under its own key and is never shown.
const optionsCache = ref({});
const storedLabels = ref({});
const searchLoads = new Set();
// Bumped by every reset: a loop of an earlier scope stops even when the channel is switched there and back (A → B → A).
let generation = 0;
const collapsedGroups = reactive(new Set());
const translatingRow = ref(null);

function openTranslationsDrawer(featureIdx) {
  translatingRow.value = featureIdx;
}

function onTranslationsSave({ values }) {
  if (!translatingRowData.value) return;
  const field =
    translatingRowData.value.feature_type === 11 ? "value_json" : "value_txt_t9n";
  // For JSON fields, parse string values back to objects
  if (field === "value_json") {
    const parsed = {};
    for (const [lang, val] of Object.entries(values)) {
      try {
        parsed[lang] = typeof val === "string" ? JSON.parse(val) : val;
      } catch {
        parsed[lang] = val;
      }
    }
    translatingRowData.value[field] = parsed;
  } else {
    translatingRowData.value[field] = values;
  }
  emitAttributes();
  translatingRow.value = null;
}

const defaultLang = computed(() =>
  (effectiveLanguages.value[0] || "en").toLowerCase()
);

const hasSecondaryLanguages = computed(() => effectiveLanguages.value.length > 1);

const translatingRowLabel = computed(() => {
  if (!translatingRow.value) return "";
  const row = editableRows.value.find(
    (r) => r.feature_idx === translatingRow.value
  );
  return row ? row.feature_name || row.feature_idx : translatingRow.value;
});

const translatingRowData = computed(() => {
  if (!translatingRow.value) return null;
  return editableRows.value.find(
    (r) => r.feature_idx === translatingRow.value
  );
});

const translatingRowValues = computed(() => {
  if (!translatingRowData.value) return {};
  const field =
    translatingRowData.value.feature_type === 11 ? "value_json" : "value_txt_t9n";
  return translatingRowData.value[field] || {};
});

// --- Grouping ---

const groupedRows = computed(() => {
  const groups = {};
  const ungrouped = [];
  for (const row of editableRows.value) {
    const gIdx = row.attributes_group_idx;
    if (!gIdx) {
      ungrouped.push(row);
      continue;
    }
    if (!groups[gIdx]) {
      groups[gIdx] = {
        idx: gIdx,
        name: row.attributes_group_name || gIdx,
        rows: [],
      };
    }
    groups[gIdx].rows.push(row);
  }
  return { ungrouped, groups: Object.values(groups) };
});

function toggleGroupCollapse(groupIdx) {
  if (collapsedGroups.has(groupIdx)) {
    collapsedGroups.delete(groupIdx);
  } else {
    collapsedGroups.add(groupIdx);
  }
}

// --- Data fetching ---

function buildEmptyAttribute(featureIdx) {
  return {
    feature_idx: featureIdx,
    value_bool: null,
    value_decimal: null,
    value_txt: null,
    value_txt_t9n: null,
    value_datetime: null,
    value_json: null,
    attribute_idx: null,
    attribute_idxs: [],
  };
}

function mergeWithExisting(features) {
  return features.map((f) => {
    const matchingAttrs = props.attributes.filter(
      (a) => a.feature_idx === f.feature_idx
    );
    const firstMatch = matchingAttrs[0] || null;
    const base = buildEmptyAttribute(f.feature_idx);
    const aggregatedIdxs = matchingAttrs
      .map((a) => a.attribute_idx)
      .filter(Boolean);
    return {
      ...base,
      ...(firstMatch || {}),
      attribute_idxs: aggregatedIdxs.length ? aggregatedIdxs : [],
      feature_idx: f.feature_idx,
      feature_name: f.feature_name,
      feature_type: f.feature_type,
      is_required: f.is_required,
      attributes_group_idx: f.attributes_group_idx,
      attributes_group_name: f.attributes_group_name,
    };
  });
}

async function fetchFeatureSet() {
  if (!props.featureSetIdx) return;
  loading.value = true;
  try {
    const { data } = await GET_FeatureSetFeatures(
      props.channelIdx,
      props.featureSetIdx
    );
    const results = data.results || data || [];
    noteFeatureList(results);
    const normalized = results.map((f) => ({
      feature_idx: f.feature?.idx || f.feature_idx,
      feature_name: f.feature?.name || f.feature_name,
      feature_type: f.feature?.feature_type ?? f.feature_type,
      is_required: effectiveRequired(f),
      attributes_group_idx: f.attributes_group_idx || null,
      attributes_group_name: f.attributes_group_name || null,
      position: f.position || 0,
    }));
    editableRows.value = mergeWithExisting(normalized);
    prefetchStoredOptions(editableRows.value);
  } catch {
    // Called unawaited (mount, a feature set change): a failure the page would never see — a backend down — is told.
    notify.spawnNotification({ type: "negative", msg: t("pim.attributes_failed") });
  } finally {
    loading.value = false;
  }
}

const scopeKey = () => `${props.channelIdx}/${props.featureSetIdx}`;
const cacheKey = (featureIdx) => `${scopeKey()}/${featureIdx}`;
const storedValues = (row) => [...new Set([row.attribute_idx, ...row.attribute_idxs].filter(Boolean))];
const notifyValuesFailed = () => notify.spawnNotification({ type: "negative", msg: t("pim.attribute_values_failed") });

// Fire-and-forget: the first page of every select that holds a value, in parallel, then the names of the stored
// values that page lacks; the editor shows at once. The other selects load when they open. One notice per round,
// however many selects failed; none for a round of a channel or feature set that is no longer shown.
async function prefetchStoredOptions(rows) {
  const started = generation;
  const loads = rows
    .filter((r) => isSelectType(r.feature_type) && storedValues(r).length)
    .map((r) => prefetchSelect(r.feature_idx, storedValues(r)));
  if ((await Promise.all(loads)).includes(false) && generation === started) notifyValuesFailed();
}

async function prefetchSelect(featureIdx, stored) {
  const ok = await ensureOptions(featureIdx);
  if (ok) await loadStoredLabels(featureIdx, stored);
  return ok;
}

function ensureOptions(featureIdx) {
  return optionsCache.value[cacheKey(featureIdx)] ? Promise.resolve(true) : loadOptionsPage(featureIdx);
}

// A select the operator opens, or its "more" row: a failure gets its own notice.
async function openOptions(featureIdx) {
  if (!(await ensureOptions(featureIdx))) notifyValuesFailed();
}

async function loadMoreOptions(featureIdx) {
  if (!(await loadOptionsPage(featureIdx))) notifyValuesFailed();
}

// A typed query must reach every value (the channel endpoint takes no search param): the pages left load once, up to
// SEARCH_CAP values, while BasicSelect filters what has arrived. The key is taken before the first await, so the
// keystrokes of one query run one loop and raise one notice. A failure lets the next query try again.
async function loadAllOptions(featureIdx) {
  const key = cacheKey(featureIdx);
  if (searchLoads.has(key)) return;
  searchLoads.add(key);
  const outcome = await loadPagesUpToCap(featureIdx);
  if (outcome === "failed") {
    searchLoads.delete(key);
    notifyValuesFailed();
  }
  if (outcome === "capped") notify.spawnNotification({ type: "info", msg: t("pim.attribute_values_capped", { count: SEARCH_CAP }) });
}

// → "done" | "capped" | "failed" | "stale" (the channel or feature set changed under the loop: it stops, silent).
async function loadPagesUpToCap(featureIdx) {
  const started = generation;
  const outcomeOf = (ok) => (generation !== started ? "stale" : ok ? null : "failed");
  let stop = outcomeOf(await ensureOptions(featureIdx));
  while (!stop && hasMoreOptions(featureIdx) && getOptions(featureIdx).length < SEARCH_CAP) {
    stop = outcomeOf(await loadOptionsPage(featureIdx));
  }
  return stop || (hasMoreOptions(featureIdx) ? "capped" : "done");
}

// The names of stored values missing from the loaded values, through the shared limiter (the channel list takes no
// idx filter, so each is its own global request); a failed one keeps its idx as the label.
async function loadStoredLabels(featureIdx, idxs) {
  const key = cacheKey(featureIdx);
  const missing = idxs.filter((idx) => !getOptions(featureIdx).some((o) => o.value === idx));
  if (!missing.length) return;
  const nameOf = (idx) =>
    limitLabels(() => GET_Attribute(featureIdx, idx))
      .then(({ data }) => [idx, labelOf(data, idx)])
      .catch(() => [idx, idx]);
  storedLabels.value[key] = Object.fromEntries(await Promise.all(missing.map(nameOf)));
}

// One label rule for listed and stored values: the editor's default language, else the name, else the idx.
const labelOf = (attribute, idx) => attribute.name_t9n?.[defaultLang.value] || attribute.name || idx;

// The next page of a select feature's values → true when it arrived. Concurrent callers share the request in flight;
// a failed page stays next, a failed first page drops the entry so the next open asks again.
function loadOptionsPage(featureIdx) {
  const key = cacheKey(featureIdx);
  const entry = (optionsCache.value[key] ??= { options: [], nextPage: 1, pending: null });
  if (!entry.nextPage) return Promise.resolve(true);
  entry.pending ??= fetchOptionsPage(featureIdx, key).finally(() => (entry.pending = null));
  return entry.pending;
}

async function fetchOptionsPage(featureIdx, key) {
  const entry = optionsCache.value[key];
  try {
    const params = { page_size: OPTIONS_PAGE_SIZE, page: entry.nextPage };
    const { data } = await GET_FeatureAttributes(featureIdx, props.channelIdx, params);
    const options = (data.results || data || []).map((a) => ({ label: labelOf(a, a.idx), value: a.idx }));
    entry.options = [...entry.options, ...options];
    entry.nextPage = data.next ? entry.nextPage + 1 : null;
    return true;
  } catch {
    if (!entry.options.length && optionsCache.value[key] === entry) delete optionsCache.value[key];
    return false;
  }
}

function getOptions(featureIdx) {
  return optionsCache.value[cacheKey(featureIdx)]?.options || [];
}

function hasMoreOptions(featureIdx) {
  return Boolean(optionsCache.value[cacheKey(featureIdx)]?.nextPage);
}

function labelsOf(featureIdx) {
  return storedLabels.value[cacheKey(featureIdx)];
}

function resetOptions() {
  generation += 1;
  optionsCache.value = {};
  storedLabels.value = {};
  searchLoads.clear();
}

// --- Field updates ---

function updateField(featureIdx, field, value) {
  const row = editableRows.value.find((r) => r.feature_idx === featureIdx);
  if (!row) return;
  row[field] = value;
  emitAttributes();
}

function updateT9nField(featureIdx, field, lang, value) {
  const row = editableRows.value.find((r) => r.feature_idx === featureIdx);
  if (!row) return;
  if (!row[field]) row[field] = {};
  row[field] = { ...row[field], [lang]: value };
  emitAttributes();
}

function updateJsonField(featureIdx, rawString) {
  const row = editableRows.value.find((r) => r.feature_idx === featureIdx);
  if (!row) return;
  try {
    row.value_json = JSON.parse(rawString);
  } catch {
    row.value_json = rawString;
  }
  emitAttributes();
}

function updateJsonT9nField(featureIdx, lang, rawString) {
  const row = editableRows.value.find((r) => r.feature_idx === featureIdx);
  if (!row) return;
  if (!row.value_json || typeof row.value_json !== "object")
    row.value_json = {};
  try {
    row.value_json = { ...row.value_json, [lang]: JSON.parse(rawString) };
  } catch {
    row.value_json = { ...row.value_json, [lang]: rawString };
  }
  emitAttributes();
}

function emitAttributes() {
  const payload = editableRows.value.map((r) => ({
    feature_idx: r.feature_idx,
    value_bool: r.value_bool ?? null,
    value_decimal: r.value_decimal ?? null,
    value_txt: r.value_txt ?? null,
    value_txt_t9n: r.value_txt_t9n ?? null,
    value_datetime: r.value_datetime ?? null,
    value_json: r.value_json ?? null,
    attribute_idx: r.attribute_idx ?? null,
    attribute_idxs: r.attribute_idxs || [],
  }));
  emit("update:attributes", payload);
}

// --- Watchers ---

watch(
  () => props.featureSetIdx,
  (val) => {
    resetOptions();
    if (val) fetchFeatureSet();
    else editableRows.value = [];
  }
);

watch(
  () => props.channelIdx,
  () => {
    resetOptions();
    prefetchStoredOptions(editableRows.value);
  }
);

watch(
  () => props.attributes,
  () => {
    if (editableRows.value.length) {
      editableRows.value = mergeWithExisting(editableRows.value);
    }
  },
  { deep: true }
);

onMounted(() => {
  if (props.featureSetIdx) fetchFeatureSet();
});
</script>
