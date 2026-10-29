<template>
  <CatalogueSection id="icons" :title="$t('ui_catalogue.sections.icons')">
    <div class="icons-grid grid gap-3">
      <CatalogueCell
        v-for="[meaning, glyph] in meanings"
        :id="`icons-${kebab(meaning)}-default`"
        :key="meaning"
        :label="`${meaning} · ${glyph}`"
      >
        <span class="flex ai-ct gap-4 t-strong">
          <FontAwesomeIcon :icon="glyph" class="fs-400" />
          <FontAwesomeIcon :icon="glyph" class="fs-500" />
          <FontAwesomeIcon :icon="glyph" class="fs-600" />
        </span>
      </CatalogueCell>
    </div>
  </CatalogueSection>
</template>

<script setup>
// Plan 10: every meaning of the registry at 16 / 20 / 24 px (fs-400 / fs-500 / fs-600).
import { ICONS } from "@/boots/Icons/icons";
import CatalogueSection from "../CatalogueSection.vue";
import CatalogueCell from "../CatalogueCell.vue";

const meanings = Object.entries(ICONS);
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.icons-grid {
  grid-template-columns: repeat(6, minmax(0, 1fr));

  @include max-tablet {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
