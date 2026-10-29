<template>
  <div class="mapping-row b-subtle rounded p-5 mb-2">
    <div class="mapping-row__grid">
      <FormField
        :label="$t('atlas.mappings.category.source_field')"
        hint-level="important"
        :hint="$t('atlas.mappings.category.source_field_help')"
      >
        <EntitySearchPicker
          v-if="isNew"
          v-model="local.source_field"
          :display-value="local.source_field"
          :fetch-fn="sourceFieldFetchFn"
          :placeholder="
            $t('atlas.mappings.category.source_field_placeholder')
          "
          :client-filter="true"
          :data-testid="`cat-mapping-source-${rowKey}`"
        />
        <BasicInput
          v-else
          v-model="local.source_field"
          :disabled="true"
          :data-testid="`cat-mapping-source-${rowKey}`"
        />
      </FormField>
      <FormField :label="$t('atlas.mappings.category.source_value')">
        <div class="flex gap-1">
          <BasicInput
            v-model="local.source_value"
            :maxlength="512"
            class="flex-1"
            :disabled="!isNew"
            :placeholder="isNew ? $t('atlas.mappings.category.source_value_placeholder') : ''"
            :data-testid="`cat-mapping-value-${rowKey}`"
            @update:model-value="sourceValuePicked = false"
          />
          <BasicMenu
            v-if="isNew"
            :items="sourceValueItems"
            :label="$t('atlas.mappings.category.source_value_picker_open')"
            @open="loadSourceValues"
            @select="pickSourceValue($event.value)"
          >
            <template #trigger>
              <IconButton
                icon="expand"
                :label="$t('atlas.mappings.category.source_value_picker_open')"
                :disabled="!local.source_field"
                :data-testid="`cat-mapping-values-${rowKey}`"
              />
            </template>
          </BasicMenu>
        </div>
      </FormField>
      <FormField :label="$t('atlas.mappings.category.target_category_idx')">
        <EntitySearchPicker
          v-if="channelIdx"
          v-model="local.target_category_idx"
          :display-value="categoryDisplayValue"
          :fetch-fn="categoryFetchFn"
          :placeholder="
            $t('atlas.mappings.category.target_category_placeholder')
          "
          :data-testid="`cat-mapping-target-${rowKey}`"
        />
        <BasicInput
          v-else
          v-model="local.target_category_idx"
          :maxlength="64"
          :placeholder="
            $t('atlas.mappings.category.target_category_no_channel_hint')
          "
          :data-testid="`cat-mapping-target-${rowKey}`"
        />
      </FormField>
    </div>
    <div class="flex ai-ct gap-2 mt-5 jc-end">
      <span
        v-if="rowWarnings.length"
        class="row-warning t-warning"
        :title="warningTitle"
        :data-testid="`cat-mapping-warning-${rowKey}`"
      >
        <FontAwesomeIcon :icon="$icons.warning" />
        <span class="fs-200 fw-600">{{ rowWarnings.length }}</span>
      </span>
      <IconButton
        v-if="!isNew"
        icon="delete"
        variant="danger"
        size="sm"
        :label="$t('common.delete')"
        :data-testid="`cat-mapping-delete-${rowKey}`"
        @click="$emit('delete', mapping)"
      />
      <BasicButton
        size="sm"
        :disabled="busy"
        :data-testid="`cat-mapping-save-${rowKey}`"
        @click="emitSave"
      >
        {{ $t("common.save") }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import { GET_Categories } from "@/api/pim/api";
import { GET_DataValues } from "@/api/atlas/api";
import { extractApiMessage } from "@/composables/useFormErrors";

const EMPTY = () => ({
  source_field: "",
  source_value: "",
  target_category_idx: "",
});

export default {
  name: "CategoryMappingRow",
  props: {
    mapping: { type: Object, default: null },
    busy: { type: Boolean, default: false },
    supplierIdx: { type: String, default: "" },
    channelIdx: { type: String, default: null },
    dataKeys: {
      type: Object,
      default: () => ({ tokens: [], data_keys: [], sample_size: 0 }),
    },
    warnings: { type: Array, default: () => [] },
  },
  emits: ["save", "delete"],
  data() {
    return {
      local: this.mapping ? { ...this.mapping } : EMPTY(),
      _categoryCache: [],
      sourceValues: { field: null, values: [] },
      sourceValuesState: "idle",
      sourceValuesError: "",
      // A value picked from the menu shows the full list again; typing filters it. Not reset by a new source_field:
      // that field's full list shows, which is what a pick there would show anyway.
      sourceValuePicked: false,
    };
  },
  computed: {
    isNew() {
      return !this.mapping?.id;
    },
    rowKey() {
      return this.mapping?.id ?? "new";
    },
    sourceFieldOptions() {
      const tokens = (this.dataKeys?.tokens || []).map((t) => ({
        value: t.key,
        label: t.key,
        secondary: t.description,
      }));
      const dataKeys = (this.dataKeys?.data_keys || []).map((k) => ({
        value: k.key,
        label: k.key,
        secondary: `${k.presence_pct}% • ${k.type}${
          k.sample_value ? ` • "${k.sample_value}"` : ""
        }`,
      }));
      return [...tokens, ...dataKeys];
    },
    // The feed's values of the source field that contain the typed text — all of them while the field holds a value
    // picked from this list and not typed over since (reopening shows the full list); null values are skipped,
    // numbers read as text. A failed load shows the API message instead of the list.
    sourceValueItems() {
      const note = (label) => [{ key: "note", heading: true, label }];
      if (this.sourceValuesState === "loading") return note(this.$t("entity_picker.searching"));
      if (this.sourceValuesState === "error") return note(this.sourceValuesError);
      const values = this.sourceValues.values.filter((v) => v.value != null);
      const q = this.sourceValuePicked ? "" : String(this.local.source_value ?? "").trim().toLowerCase();
      const suffix = this.$t("atlas.mappings.category.source_value_picker_count_suffix");
      const items = values
        .filter((v) => String(v.value).toLowerCase().includes(q))
        .map((v) => ({ key: String(v.value), value: String(v.value), label: `${v.value} · ${v.count} ${suffix}` }));
      return items.length ? items : note(this.$t("entity_picker.no_results"));
    },
    categoryDisplayValue() {
      const cached = this._categoryCache.find(
        (c) => c.idx === this.local.target_category_idx
      );
      if (cached) return cached.name || cached.idx;
      return this.local.target_category_idx || "";
    },
    rowWarnings() {
      if (!this.mapping?.id) return [];
      return (this.warnings || []).filter(
        (w) => w.mapping_kind === "category" && w.mapping_id === this.mapping.id
      );
    },
    warningTitle() {
      return this.rowWarnings
        .map((w) => {
          const suggestion = w.details?.suggestion;
          return suggestion ? `${w.message} — ${suggestion}?` : w.message;
        })
        .join("\n");
    },
  },
  watch: {
    mapping(val) {
      this.local = val ? { ...val } : EMPTY();
    },
  },
  methods: {
    pickSourceValue(value) {
      this.local.source_value = value;
      this.sourceValuePicked = true;
    },
    emitSave() {
      this.$emit("save", { ...this.local, id: this.mapping?.id });
    },
    sourceFieldFetchFn() {
      return Promise.resolve(this.sourceFieldOptions);
    },
    // One successful request per source field; a failed one is not kept, the next open asks again. An answer for a
    // source field that is no longer chosen is dropped.
    async loadSourceValues() {
      const field = this.local.source_field;
      if (!field || this.sourceValues.field === field) return;
      this.sourceValuesState = "loading";
      try {
        const { data } = await GET_DataValues(this.supplierIdx, { source_field: field });
        if (field !== this.local.source_field) return;
        this.sourceValues = { field, values: data?.values || [] };
        this.sourceValuesState = "idle";
      } catch (err) {
        if (field !== this.local.source_field) return;
        this.sourceValuesError = extractApiMessage(err, this.$t("notifications.error"));
        this.sourceValuesState = "error";
      }
    },
    async categoryFetchFn(query) {
      if (!this.channelIdx) return [];
      try {
        const params = { page_size: 200 };
        if (query) params.search = query;
        const { data } = await GET_Categories(this.channelIdx, params);
        const items = data?.results || data || [];
        this._categoryCache = items;
        return items.map((c) => ({
          value: c.idx,
          label: c.name || c.idx,
          secondary: c.idx,
        }));
      } catch {
        return [];
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.mapping-row {
  background: var(--surface-base);
}
.mapping-row__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-5);
}
.row-warning {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-1);
}
</style>
