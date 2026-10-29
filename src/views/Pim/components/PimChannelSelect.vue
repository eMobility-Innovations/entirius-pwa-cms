<template>
  <div class="flex ai-ct flex-wrap gap-3">
    <FormField v-if="isDesktop" :label="$t('pim.channel')" layout="inline">
      <BasicSelect v-bind="selectProps" @update:model-value="pimChannel.setActiveChannel" />
    </FormField>
    <BasicSelect
      v-else
      v-bind="selectProps"
      :aria-label="$t('pim.channel')"
      @update:model-value="pimChannel.setActiveChannel"
    />
    <StatusBadge
      v-if="isGlobalScope"
      tone="neutral"
      :dot="false"
      :label="$t('pim.global_scope')"
    />
    <StatusBadge
      v-else-if="pimChannel.isDefaultChannel"
      tone="accent"
      :dot="false"
      :label="$t('pim.default')"
    />
  </div>
</template>

<script setup>
// The channel selector of Pim in a view's PageHeader `meta` (P5 page frame), with the channel's badge. Below the shell
// breakpoint the select is named by `aria-label` only: any label above it (a FormField's or a floating one) pushes
// the select box off the line of the title; it shows the channel. The store owns the channels and the active channel;
// the panel wrapper (index.vue) provides the global-scope flag and fetches the channels. The store-wide translation
// is not here: it belongs to the Translation panel (TranslationDashboard), a single view offers only scoped actions.
import { computed, inject, ref } from "vue";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useIsDesktop } from "@/composables/useIsDesktop";
import { t } from "@/i18n";

const pimChannel = usePimChannelStore();
const globalScope = inject("isGlobalScope", ref(false));
const isGlobalScope = computed(() => globalScope.value);
const isDesktop = useIsDesktop();

const selectProps = computed(() => ({
  options: channelOptions.value,
  modelValue: pimChannel.activeChannelIdx,
  placeholder: t("pim.select_channel"),
  disabled: isGlobalScope.value,
  "data-testid": "pim-channel-select",
}));

const channelOptions = computed(() => {
  if (!pimChannel.channels.length) {
    return [{ label: pimChannel.activeChannelIdx, value: pimChannel.activeChannelIdx }];
  }
  return pimChannel.channels.map((ch) => ({ label: ch.name || ch.idx, value: ch.idx }));
});
</script>
