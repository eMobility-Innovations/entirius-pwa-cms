<template>
  <BasicSelect
    :floating-label="name"
    :options="withAll"
    :model-value="modelValue"
    searchable
    remote-search
    :more-label="source.moreLabel"
    @open="onOpen"
    @search="source.onSearch"
    @more="source.loadMore"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup>
// Product list filter: one value of one filterable feature. The values are paged and searched on the server
// (a feature such as a brand has thousands) when the list is first opened, the chosen one keeps its label.
import { computed, watch } from "vue";
import { useAttributeOptions } from "@/composables/useRemoteOptions";
import { usePimChannelStore } from "@/stores/pimChannel";
import { t } from "@/i18n";

const props = defineProps({
  featureIdx: { type: String, required: true },
  name: { type: String, default: "" },
  modelValue: { type: [String, Number], default: "" },
});
defineEmits(["update:modelValue"]);

const pimChannel = usePimChannelStore();
const source = useAttributeOptions(
  () => props.featureIdx,
  () => pimChannel.activeChannel?.default_language
);
const withAll = computed(() => [{ value: null, label: t("pim.filter_all") }, ...source.options]);

// The list loads on the first open; a chosen value is labelled by its own lookup, without the list.
let opened = false;
function onOpen() {
  if (opened) return;
  opened = true;
  source.load();
}
watch(() => props.modelValue, (value) => source.track(value), { immediate: true });
</script>
