<template>
  <SideDrawer
    :visible="visible"
    mode="focused"
    width="28rem"
    :title="`Translations — ${title}`"
    :inline="inline"
    @close="onCancel"
  >
    <div v-if="visible" class="translations-drawer">
      <div
        v-for="lang in languages"
        :key="lang"
        class="translations-drawer__row"
      >
        <label class="translations-drawer__lang">
          {{ lang.toUpperCase() }}
          <span
            v-if="lang === defaultLanguage"
            class="translations-drawer__badge"
            >base</span
          >
        </label>
        <slot
          name="input"
          :lang="lang"
          :modelValue="localValues[lang] || ''"
          :onUpdate="(val) => (localValues[lang] = val)"
          :isBase="lang === defaultLanguage"
        >
          <BasicInput
            :modelValue="localValues[lang] || ''"
            @update:modelValue="localValues[lang] = $event"
          />
        </slot>
      </div>
      <ActionBar class="translations-drawer__footer" :actions="footerActions" />
    </div>
  </SideDrawer>
</template>

<script setup>
// Per-language editing of one field on a focused SideDrawer; the footer is an ActionBar (R5: Save rightmost).
import { computed, ref, watch } from "vue";
import ActionBar from "@/boots/ActionBar/index.vue";
import { t } from "@/i18n";

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: "" },
  languages: { type: Array, default: () => [] },
  defaultLanguage: { type: String, default: "en" },
  values: { type: Object, default: () => ({}) },
  inline: { type: Boolean, default: false },
});

const emit = defineEmits(["cancel", "save"]);

const localValues = ref({});

watch(
  () => props.visible,
  (isOpen) => {
    if (isOpen) {
      localValues.value = JSON.parse(JSON.stringify(props.values || {}));
    }
  },
  { immediate: true }
);

const footerActions = computed(() => [
  { key: "cancel", label: t("common.cancel"), role: "secondary", onClick: onCancel, testid: "translations-cancel" },
  { key: "save", label: t("common.save"), role: "primary", onClick: onSave, testid: "translations-save" },
]);

function onCancel() {
  emit("cancel");
}

function onSave() {
  emit("save", { values: { ...localValues.value } });
}
</script>

<style lang="scss">
/* Unscoped — SideDrawer teleports to <body>, scoped styles don't reach it */
.translations-drawer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--fs-300);

  &__row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__lang {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--fs-200);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted);
  }

  &__badge {
    font-size: var(--fs-200);
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: 0;
    padding: 1px var(--space-1);
    border-radius: var(--radius-base);
    background: var(--accent-subtle);
    color: var(--text-strong);
  }

  &__footer {
    margin-top: var(--space-8);
    padding-top: var(--space-8);
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
