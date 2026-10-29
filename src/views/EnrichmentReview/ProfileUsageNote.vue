<template>
  <div v-if="text" class="profile-usage flex-column gap-1" data-testid="profile-usage">
    <p class="m-0" data-testid="profile-usage-text">{{ text }}</p>
    <p class="m-0 fs-200 t-secondary">{{ $t("enrichment.profile.used_hint") }}</p>
  </div>
</template>

<script>
import { AREAS } from "@/configs/areas";
import { useAccessStore } from "@/stores/access";
import { valueShape } from "./correction";
import { loadUsedProfile, usedSections } from "./profileUsage";

const KIND_OF_SHAPE = { text: "write", select: "pick" };

// What the AI was likely given from the company profile for this proposal, read from the profile versions its task
// used (`profile_versions`), not the live profile; shown when the user may read the profile, nothing on any failure.
// It sits in the proposal's details panel (ProposalDetails).
export default {
  name: "ProfileUsageNote",
  props: {
    proposal: { type: Object, required: true },
    task: { type: Object, default: null },
  },
  data() {
    return { sections: [] };
  },
  computed: {
    channel() {
      return this.task?.params?.channel || this.proposal.target_locator?.channel || "";
    },
    key() {
      const used = this.task?.profile_versions?.length && useAccessStore().can(AREAS.ENRICHMENT_PROFILE);
      return used ? `${this.task.id}:${this.channel}:${this.task.profile_versions.join(",")}` : "";
    },
    text() {
      if (!this.sections.length) return "";
      const names = this.sections.map(({ key, count }) => (count ? `${this.sectionName(key)} (${count})` : this.sectionName(key)));
      return this.$t("enrichment.profile.used", { sections: names.join(" · ") });
    },
  },
  watch: {
    key: { immediate: true, handler: "load" },
  },
  methods: {
    async load() {
      const key = this.key;
      this.sections = [];
      if (!key) return;
      const data = await loadUsedProfile(this.channel, this.task.profile_versions);
      if (key !== this.key || !data) return;
      const kind = KIND_OF_SHAPE[valueShape(this.proposal.proposed_value)] || "";
      this.sections = usedSections({ data, taskType: this.task.type, kind });
    },
    sectionName(key) {
      const path = `enrichment.profile.sections.${key}`;
      const name = this.$t(path);
      return name === path ? key : name;
    },
  },
};
</script>
