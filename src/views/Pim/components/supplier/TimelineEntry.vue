<template>
  <li class="timeline-entry" :class="{ 'timeline-entry--applied': entry.applied_to_pim }">
    <div class="timeline-entry__marker" :class="`timeline-entry__marker--${entry.applied_to_pim ? 'applied' : 'pending'}`" />
    <BasicCard class="timeline-entry__body">
      <div class="timeline-entry__row">
        <span class="timeline-entry__date t-body fw-600">{{ formatDate(entry.created_at) }}</span>
        <StatusBadge :label="sourceLabel" :tone="sourceVariant" />
        <StatusBadge
          :label="entry.applied_to_pim ? $t('pim.supplier.timeline.applied') : $t('pim.supplier.timeline.pending')"
          :tone="entry.applied_to_pim ? 'positive' : 'warning'"
        />
        <span v-if="entry.triggered_by" class="timeline-entry__user fs-200 t-muted">
          {{ $t("pim.supplier.timeline.triggered_by", { user: entry.triggered_by }) }}
        </span>
      </div>
      <div class="timeline-entry__field-row">
        <span class="t-muted fs-200">{{ $t("pim.supplier.timeline.field") }}:</span>
        <code class="timeline-entry__field">{{ entry.field_path || "—" }}</code>
        <span v-if="diffComponent === 'NumericDiff'" class="ml-5">
          <NumericDiff :before="entry.before" :after="entry.after" />
        </span>
      </div>
      <div v-if="hasComplexDiff" class="timeline-entry__diff-controls">
        <BasicButton size="sm" variant="ghost" @click="expanded = !expanded">
          {{ expanded ? $t("pim.supplier.timeline.hide_diff") : $t("pim.supplier.timeline.show_diff") }}
        </BasicButton>
      </div>
      <div v-if="hasComplexDiff && expanded" class="timeline-entry__diff">
        <component :is="diffComponent" :before="entry.before" :after="entry.after" />
      </div>
    </BasicCard>
  </li>
</template>

<script>
import NumericDiff from "./diffs/NumericDiff.vue";
import StringDiff from "./diffs/StringDiff.vue";
import ArrayDiff from "./diffs/ArrayDiff.vue";
import JsonDiff from "./diffs/JsonDiff.vue";

const NUMERIC_PATHS = new Set(["cost", "stock", "weight", "width", "height", "depth"]);
const NUMERIC_SUFFIXES = [".weight", ".width", ".height", ".depth"];
const ARRAY_FIELDS = new Set(["image_urls", "images", "files"]);

const SOURCE_VARIANTS = {
  full_sync: "info",
  delta_sync: "info",
  init_push: "neutral",
  force_repush: "warning",
  operator_sp_edit: "neutral",
  auto_link: "info",
  auto_preferred_switch: "warning",
  manual_override: "warning",
  emergency_switch: "negative",
  operator_acknowledge: "positive",
  // etap-10 (Dziura #31) — physical race detection.
  physical_skipped: "info",
  physical_overwrite: "warning",
};

export default {
  name: "TimelineEntry",
  components: { NumericDiff, StringDiff, ArrayDiff, JsonDiff },
  props: {
    entry: { type: Object, required: true },
  },
  data() {
    return { expanded: false };
  },
  computed: {
    diffComponent() {
      const path = this.entry.field_path || "";
      if (NUMERIC_PATHS.has(path) || NUMERIC_SUFFIXES.some((s) => path.endsWith(s))) {
        return "NumericDiff";
      }
      if (ARRAY_FIELDS.has(path) || Array.isArray(this.entry.before) || Array.isArray(this.entry.after)) {
        return "ArrayDiff";
      }
      if (
        path === "name" ||
        path === "description_html" ||
        path === "short_description" ||
        path === "description"
      ) {
        return "StringDiff";
      }
      if (this.isObjectLike(this.entry.before) || this.isObjectLike(this.entry.after)) {
        return "JsonDiff";
      }
      return "StringDiff";
    },
    hasComplexDiff() {
      return this.diffComponent !== "NumericDiff";
    },
    sourceLabel() {
      return (this.entry.source || "?").replaceAll("_", " ");
    },
    sourceVariant() {
      return SOURCE_VARIANTS[this.entry.source] || "neutral";
    },
  },
  methods: {
    isObjectLike(v) {
      return v != null && typeof v === "object" && !Array.isArray(v);
    },
    formatDate(iso) {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.timeline-entry {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: var(--space-5);
  list-style: none;
}
.timeline-entry__marker {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  margin-top: var(--space-6);
  justify-self: center;
}
.timeline-entry__marker--applied {
  background: var(--positive-fill);
}
.timeline-entry__marker--pending {
  background: var(--warning-fill);
}
.timeline-entry__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-5);
}
.timeline-entry__field-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--fs-200);
}
.timeline-entry__field {
  background: var(--surface-raised);
  padding: 2px var(--space-1);
  border-radius: var(--radius-base);
  font-family: var(--font-mono, monospace);
  font-size: var(--fs-200);
}
.timeline-entry__diff {
  margin-top: var(--space-5);
}
.timeline-entry__user {
  margin-left: auto;
}
</style>
