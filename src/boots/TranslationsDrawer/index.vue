<template>
  <SideDrawer
    :visible="visible"
    mode="focused"
    width="28rem"
    :title="`${$t('common.translations')} — ${title}`"
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
      <div class="translations-drawer__footer">
        <BasicButton
          :text="$t('common.cancel')"
          class="bg-basic-200 t-basic-600"
          @click="onCancel"
        />
        <BasicButton
          :text="$t('common.save')"
          class="bg-support-400 t-basic-100"
          @click="onSave"
        />
      </div>
    </div>
  </SideDrawer>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: "" },
  languages: { type: Array, default: () => [] },
  defaultLanguage: { type: String, default: "en" },
  values: { type: Object, default: () => ({}) },
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
  gap: 10px;
  font-size: var(--fs-300);

  &__row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__lang {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-200);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--c-basic-500);
  }

  &__badge {
    font-size: var(--fs-100);
    font-weight: 500;
    text-transform: lowercase;
    letter-spacing: 0;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--c-support-100);
    color: var(--c-support-400);
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-200);
    margin-top: var(--space-300);
    padding-top: var(--space-300);
    border-top: 1px solid var(--c-basic-200);
  }
}
</style>
