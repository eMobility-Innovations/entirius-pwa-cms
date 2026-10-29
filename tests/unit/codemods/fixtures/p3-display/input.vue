<template>
  <div class="toolbar">
    <!-- codemod:chip combos on their P2 names (r06 file list) -->
    <span v-if="isDirty" class="chip bg-warning-subtle t-warning">
      {{ $t("unsaved.changes") }}
    </span>
    <span
      class="chip chip--sm bg-accent-subtle t-strong"
      >{{ lang.toUpperCase() }}</span
    >
    <span v-if="value" class="chip bg-accent-subtle t-strong" :title="value">
      <span class="chip__label">{{ value }}</span>
    </span>
    <span class="chip bg-raised t-secondary" :title="directionLabel(row)">
      <span class="chip__label">{{ directionLabel(row) }}</span>
    </span>
    <span class="chip chip--pill bg-raised t-secondary tree-node__count">{{
      node.product_count || 0
    }}</span>
    <span
      class="chip chip--pill bg-raised t-secondary fs-200"
    >
      {{ group.rows.length }}
    </span>
    <span v-if="isDefault" class="chip t-accent fs-200">{{ $t("pim.default") }}</span>
    <span v-if="isGlobal" class="chip bg-raised t-muted fs-200">{{ $t("pim.global_scope") }}</span>
    <span v-else class="chip bg-raised t-muted">{{ $t("faq.global") }}</span>
    <span
      v-if="isRoot"
      class="chip chip--sm bg-accent-subtle t-strong tree-node__root-badge"
      >Root</span
    >
    <span
      v-if="isDirty"
      class="chip bg-warning-subtle t-warning"
      data-testid="nav-editor-unsaved-badge"
    >
      {{ $t("layout_extender.unsaved") }}
    </span>
    <span class="chip">{{ $t(`faq.items_${key}`, { count }) }}</span>
    <span class="chip bg-positive-subtle t-positive" title="Aktywny">Aktywny</span>
    <span class="chip bg-negative-subtle t-negative" title="Inny opis">Błąd</span>
    <div class="chip bg-info-subtle t-info mr-2">{{ info }}</div>

    <!-- flagged: a :class binding, one-off colours, two tones, a companion alone, content that is not one text, a click -->
    <span class="chip" :class="value ? 'bg-accent-subtle t-strong' : 'bg-raised t-muted'">{{ yes }}</span>
    <span class="chip" :class="colorClass">{{ type }}</span>
    <span class="chip bg-accent-fill t-on-accent-fill">{{ kind }}</span>
    <span class="chip bg-warning-subtle t-positive">{{ mixed }}</span>
    <span class="chip t-muted">{{ muted }}</span>
    <span class="chip bg-raised t-body" @click="pick(opt)">+ {{ opt.label }}</span>
    <span class="chip t-accent" :title="row.type.name">
      <font-awesome-icon v-if="row.type.is_carrier" :icon="$icons.lock" class="mr-1" />
      <span class="chip__label">{{ row.type.name }}</span>
    </span>
    <span class="chip bg-raised">A &amp; B</span>
    <span class="chip bg-raised t-body" @click="pick(opt)">{{ opt.label }}</span>

    <!-- untouched: other chip families, the label class alone -->
    <span class="filter-chip">{{ other }}</span>
    <span class="chip__label">{{ other }}</span>

    <!-- Loading → Loader overlay -->
    <Loading v-if="loading" />
    <Loading :isHandy="true" v-if="handyLoading" />
    <Loading is-handy v-show="busy" />
    <Loading :isHandy="inKit" v-if="busy" />
    <Loading :isHandy="false" v-if="busy" />
  </div>
</template>

<script>
import Loading from "../../components/Loading.vue";
import Other from "./Other.vue";

export default {
  components: {
    Other,
    Loading,
  },
};
</script>
