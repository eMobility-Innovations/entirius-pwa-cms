import { computed } from "vue";
import { t } from "@/i18n";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";

/** The channels of PIM and ContentDB as one list of `{ idx, name }`, each idx once. */
export function mergeChannels(...lists) {
  const byIdx = new Map();
  lists.flat().forEach((c) => c?.idx && !byIdx.has(c.idx) && byIdx.set(c.idx, { idx: c.idx, name: c.name || c.idx }));
  return [...byIdx.values()];
}

// The scope picker of the profile and the memory: "Whole company" (blank) and every channel an overlay can belong
// to — a profile overlay applies to PIM tasks and Studio runs alike. Both stores swallow their own load errors.
export function useProfileChannels() {
  const pim = usePimChannelStore();
  const content = useContentDBChannelStore();
  const options = computed(() => [
    { value: "", label: t("enrichment.profile.whole_company") },
    ...mergeChannels(pim.channels, content.channels).map((c) => ({ value: c.idx, label: c.name })),
  ]);
  const load = () => Promise.all([pim.channels.length ? null : pim.fetchChannels(), content.fetchChannelsAndLanguages()]);
  return { options, load };
}
