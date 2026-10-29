<template>
  <div class="toolbar">
    <!-- codemod:chip combos on their P2 names (r06 file list) -->
    <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
    <StatusBadge
      tone="accent"
      size="sm"
      :dot="false"
      :label="lang.toUpperCase()"
    />
    <StatusBadge v-if="value" tone="accent" :dot="false" :label="value" />
    <StatusBadge tone="neutral" :dot="false" :label="directionLabel(row)" />
    <StatusBadge tone="neutral" :dot="false" :label="node.product_count || 0" class="tree-node__count" />
    <StatusBadge
      tone="neutral"
      :dot="false"
      :label="group.rows.length"
      class="fs-200"
    />
    <StatusBadge v-if="isDefault" tone="accent" :dot="false" :label="$t('pim.default')" class="fs-200" />
    <StatusBadge v-if="isGlobal" tone="neutral" :dot="false" :label="$t('pim.global_scope')" class="fs-200" />
    <StatusBadge v-else tone="neutral" :dot="false" :label="$t('faq.global')" />
    <StatusBadge
      v-if="isRoot"
      tone="accent"
      size="sm"
      :dot="false"
      label="Root"
      class="tree-node__root-badge"
    />
    <StatusBadge
      v-if="isDirty"
      tone="warning"
      :dot="false"
      :label="$t('layout_extender.unsaved')"
      data-testid="nav-editor-unsaved-badge"
    />
    <StatusBadge tone="neutral" :dot="false" :label="$t(`faq.items_${key}`, { count })" />
    <StatusBadge tone="positive" :dot="false" label="Aktywny" />
    <StatusBadge tone="negative" :dot="false" label="Błąd" title="Inny opis" />
    <StatusBadge tone="info" :dot="false" :label="info" class="mr-2" />

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
    <Loader v-if="loading" overlay />
    <Loader v-if="handyLoading" overlay contained />
    <Loader v-show="busy" overlay contained />
    <Loader v-if="busy" overlay :contained="inKit" />
    <Loader v-if="busy" overlay />
  </div>
</template>

<script>
import Other from "./Other.vue";

export default {
  components: {
    Other,
  },
};
</script>
