<script setup>
import { ref, watch, computed } from "vue";
import BasicModal from "@/boots/BasicModal/index.vue";
import { t } from "@/i18n";
import { useCategoryFetch, usePageFetch } from "@/composables/useEntityFetch";
import { useMuninStore } from "@/stores/munin";
import { linkTypeOptions } from "@/functionals/linkTypeOptions";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  link: {
    type: Object,
    default: null,
  },
  languages: {
    type: Array,
    default: () => [],
  },
  defaultLanguage: {
    type: String,
    default: "en",
  },
  channelIdx: {
    type: String,
    default: "",
  },
});

const muninStore = useMuninStore();
const pimEnabled = computed(() => muninStore.isPanelEnabled("pim"));
const categoryFetch = computed(() => useCategoryFetch(props.channelIdx));
const pageFetch = computed(() => usePageFetch());

const emit = defineEmits(["save", "close"]);

const linkTypes = computed(linkTypeOptions);

const footerActions = computed(() => [
  { key: "cancel", label: t("common.cancel"), role: "secondary", onClick: () => emit("close") },
  { key: "save", label: t("common.save"), role: "primary", onClick: onSave, testid: "modal-save" },
]);

const translatingField = ref(null);

const form = ref({
  label: "",
  label_t9n: {},
  link_type: "category",
  link_value: "",
  link_display: "",
});

watch(
  () => props.visible,
  (val) => {
    if (!val) return;
    translatingField.value = null;
    skipLinkTypeClear.value = true;
    if (props.link) {
      form.value = {
        label: props.link.label || "",
        label_t9n: props.link.label_t9n ? { ...props.link.label_t9n } : {},
        link_type: props.link.link_type || "category",
        link_value: props.link.link_value || "",
        link_display: props.link.link_display || "",
      };
    } else {
      form.value = { label: "", label_t9n: {}, link_type: "category", link_value: "", link_display: "" };
    }
  }
);

const skipLinkTypeClear = ref(false);

watch(
  () => form.value.link_type,
  () => {
    if (skipLinkTypeClear.value) { skipLinkTypeClear.value = false; return; }
    form.value.link_value = "";
    form.value.link_display = "";
  }
);

function onTranslationsSave({ values }) {
  form.value.label_t9n = { ...values };
  translatingField.value = null;
}

function onSave() {
  if (!form.value.label.trim()) return;
  emit("save", { ...form.value });
}
</script>

<template>
  <BasicModal
    :open="visible"
    :title="link ? $t('layout_extender.edit_link') : $t('layout_extender.add_link')"
    size="md"
    :actions="footerActions"
    @update:open="(open) => !open && emit('close')"
  >
    <div class="flex-column gap-4">
      <FormField :label="$t('layout_extender.label')" required>
        <div class="flex ai-st gap-3">
          <BasicInput v-model="form.label" class="fg-1" />
          <IconButton
            v-if="languages.length > 1"
            icon="translate"
            :label="`${$t('layout_extender.translations')}: ${$t('layout_extender.label')}`"
            variant="outline"
            @click="translatingField = 'label'"
          />
        </div>
      </FormField>

      <FormField :label="$t('layout_extender.link_type')">
        <BasicRadioGroup v-model="form.link_type" :options="linkTypes" />
      </FormField>

      <FormField :label="form.link_type === 'url' ? $t('layout_extender.url') : $t('layout_extender.link_value')">
        <EntitySearchPicker
          v-if="form.link_type === 'category'"
          :modelValue="form.link_value"
          :displayValue="form.link_display"
          :fetchFn="categoryFetch"
          :placeholder="$t('layout_extender.search_category')"
          :manual="!pimEnabled"
          @update:modelValue="form.link_value = $event"
          @update:displayValue="form.link_display = $event"
          @clear="form.link_value = ''; form.link_display = ''"
        />
        <EntitySearchPicker
          v-else-if="form.link_type === 'page'"
          :modelValue="form.link_value"
          :displayValue="form.link_display"
          :fetchFn="pageFetch"
          :placeholder="$t('layout_extender.search_page')"
          :clientFilter="true"
          @update:modelValue="form.link_value = $event"
          @update:displayValue="form.link_display = $event"
          @clear="form.link_value = ''; form.link_display = ''"
        />
        <BasicInput v-else v-model="form.link_value" :placeholder="'https://...'" />
      </FormField>
    </div>
  </BasicModal>

  <TranslationsDrawer
    :visible="!!translatingField"
    :title="$t('layout_extender.label')"
    :languages="languages"
    :default-language="defaultLanguage"
    :values="form.label_t9n || {}"
    @cancel="translatingField = null"
    @save="onTranslationsSave"
  />
</template>
