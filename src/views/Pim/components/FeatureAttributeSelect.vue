<template>
  <BasicSelect
    :floating-label="name"
    :options="withAll"
    :model-value="modelValue"
    searchable
    remote-search
    :more-label="source.moreLabel"
    @search="source.onSearch"
    @more="source.loadMore"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup>
// Product list filter: one value of one filterable feature. The values are paged and searched on the server
// (a feature such as a brand has thousands), the chosen one keeps its label.
import { computed, watch } from "vue";
import { useAttributeOptions } from "@/composables/useRemoteOptions";
import { t } from "@/i18n";

const props = defineProps({
  featureIdx: { type: String, required: true },
  name: { type: String, default: "" },
  modelValue: { type: [String, Number], default: "" },
});
defineEmits(["update:modelValue"]);

const source = useAttributeOptions(() => props.featureIdx);
const withAll = computed(() => [{ value: null, label: t("pim.filter_all") }, ...source.options]);

watch(() => props.featureIdx, () => source.reload(), { immediate: true });
watch(() => props.modelValue, (value) => source.track(value), { immediate: true });
</script>
