<template>
  <div ref="bar" class="review-actions" data-testid="review-actions">
    <!-- R5 in the slot: the more menu (utility) · Not now · Send, the one primary, rightmost -->
    <ActionBar>
      <BasicMenu :items="menuItems" :label="$t('leads.review.more')" placement="top-end" @select="emit($event.key)">
        <template #trigger>
          <IconButton icon="more" variant="outline" :label="$t('leads.review.more')" :disabled="busy" data-testid="review-more" />
        </template>
      </BasicMenu>
      <BasicButton :disabled="busy" data-testid="review-skip" @click="emit('skip')">{{ $t("leads.review.not_now") }}</BasicButton>
      <BasicButton variant="primary" :disabled="busy" data-testid="review-send" @click="emit('send')">
        {{ $t("leads.review.send") }}
      </BasicButton>
    </ActionBar>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { t } from "@/i18n";

const props = defineProps({
  busy: { type: Boolean, default: false },
  aiDisabled: { type: Boolean, default: false },
});
const emit = defineEmits(["send", "skip", "rewrite", "edit", "skip-company"]);
const bar = ref(null);

// An item's key is the event it emits.
const menuItems = computed(() => [
  { key: "rewrite", label: t("leads.review.rewrite"), disabled: props.aiDisabled, testid: "review-rewrite" },
  { key: "edit", label: t("leads.review.edit"), testid: "review-edit" },
  { key: "skip-company", label: t("leads.review.skip_company"), testid: "review-skip-company" },
]);

// Where focus returns after a dialog opened from the more menu closes (the menu item is gone by then).
defineExpose({ focusMore: () => bar.value?.querySelector('[data-testid="review-more"]')?.focus() });

// A phone toast sits above this bar (Notifications.vue), so Send / Not now stay reachable while one is on screen.
const root = document.documentElement.style;
// Re-measured on every resize: orientation, text wrap, a late web font or a language switch change the bar's height.
const measure = () => root.setProperty("--action-bar-height", `${bar.value.offsetHeight}px`);
onMounted(() => {
  measure();
  window.addEventListener("resize", measure);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", measure);
  root.removeProperty("--action-bar-height");
});
</script>
