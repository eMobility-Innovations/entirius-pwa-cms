<template>
  <BasicCard
    v-if="rows.length"
    :title="$t('pim.required_attributes')"
    gap
    class="mb-8"
    data-testid="required-attributes"
  >
    <div class="form-grid">
      <AttributeField
        v-for="row in rows"
        :key="row.feature_idx"
        :row="row"
        :options="optionsOf(row.feature_idx)"
        :has-more="hasMore(row.feature_idx)"
        :language="language"
        :error="errorOf(row.feature_idx)"
        @update="(field, value) => setValue(row, field, value)"
        @update-t9n="(field, value) => setT9n(row, field, value)"
        @update-json="(raw) => setJson(row, raw)"
        @update-json-t9n="(raw) => setJson(row, raw, language)"
        @open-options="loadPage(row.feature_idx)"
        @load-more="loadPage(row.feature_idx)"
      />
    </div>
  </BasicCard>
</template>

<script setup>
// The inputs of the required features a product create must carry (PIM >= 3.3.0). The rows are the parent's
// (`v-model:rows`, shape of helpers/requiredFeatures.requiredRow); the payload is built there.
import { reactive } from "vue";
import { GET_FeatureAttributes } from "@/api/pim/api";
import AttributeField from "./AttributeField.vue";

const props = defineProps({
  rows: { type: Array, default: () => [] },
  channelIdx: { type: String, required: true },
  language: { type: String, default: "en" },
  errorOf: { type: Function, default: () => "" },
});

const emit = defineEmits(["change"]);

// Select values per feature: { options, next } — the first page loads when the select opens, more on "more".
const loaded = reactive({});
const PAGE_SIZE = 100;

const optionsOf = (idx) => loaded[idx]?.options || [];
const hasMore = (idx) => Boolean(loaded[idx]?.next);

async function loadPage(idx) {
  const entry = (loaded[idx] ??= { options: [], next: 1 });
  if (!entry.next || entry.busy) return;
  entry.busy = true;
  try {
    const params = { page_size: PAGE_SIZE, page: entry.next };
    const { data } = await GET_FeatureAttributes(idx, props.channelIdx, params);
    const page = (data.results || data || []).map((a) => ({
      label: a.name_t9n?.[props.language] || a.name || a.idx,
      value: a.idx,
    }));
    entry.options = [...entry.options, ...page];
    entry.next = data.next ? entry.next + 1 : null;
  } catch {
    // the select stays empty; opening it again retries
  } finally {
    entry.busy = false;
  }
}

const setValue = (row, field, value) => {
  row[field] = value;
  emit("change", row.feature_idx);
};

const setT9n = (row, field, value) =>
  setValue(row, field, { ...row[field], [props.language]: value });

function setJson(row, raw, lang) {
  let value = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    // a half-typed JSON stays text; the PIM rejects it
  }
  setValue(
    row,
    "value_json",
    lang ? { ...(row.value_json || {}), [lang]: value } : value
  );
}
</script>
