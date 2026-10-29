<template>
  <nav v-if="items.length" class="breadcrumbs" :class="`breadcrumbs--${size}`" :aria-label="$t('common.breadcrumb')">
    <ol class="breadcrumbs__list flex ai-ct gap-3">
      <li v-for="(item, index) in items" :key="index" class="breadcrumbs__item flex ai-ct gap-3">
        <span v-if="index" class="breadcrumbs__sep" aria-hidden="true">/</span>
        <span v-if="index === items.length - 1" class="breadcrumbs__label t-strong" aria-current="page" :title="item.label">
          {{ item.label }}
        </span>
        <router-link v-else-if="item.to" :to="item.to" class="breadcrumbs__label breadcrumbs__link" :title="item.label">
          {{ item.label }}
        </router-link>
        <span v-else class="breadcrumbs__label" :title="item.label">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
// The trail above a page title (R3): `items` = [{ label, to? }], the last one is the current page (never a link).
// Lexend Deca 16/400, 12/400 below the tablet breakpoint; `size="sm"` keeps 12 everywhere (the mobile sticky header,
// the catalogue's mobile cells). Ancestors are muted, the current page strong; long labels truncate with a title.
defineProps({
  items: { type: Array, required: true },
  size: { type: String, default: "md", validator: (value) => ["md", "sm"].includes(value) },
});
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.breadcrumbs {
  min-width: 0;
  color: var(--text-muted);
  font-family: var(--font-brand);
  font-weight: 400;
  letter-spacing: var(--brand-font-tracking-brand);
  font-size: var(--fs-400);
  // Figma sets Lexend Deca at 1.1 (the H1 too): 24 px below the trail puts the title row at y 170 (S6), 130 (S7).
  line-height: 1.1;
}

.breadcrumbs--sm {
  font-size: var(--fs-200);
}

@include max-tablet {
  .breadcrumbs {
    font-size: var(--fs-200);
  }
}

.breadcrumbs__list {
  min-width: 0;
  list-style: none;
}

.breadcrumbs__item {
  min-width: 0;
}

// Clipped sideways only: at line-height 1.1 the descenders reach past the line box.
.breadcrumbs__label {
  overflow-x: clip;
  max-width: 20em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.breadcrumbs__link {
  color: inherit;

  &:hover {
    color: var(--text-body);
  }
}
</style>
