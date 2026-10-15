<template>
  <p v-if="missing.length" class="profile-gate m-0 flex ai-ct gap-3" role="status" data-testid="profile-gate">
    <FontAwesomeIcon :icon="$icons.warning" class="profile-gate__icon" aria-hidden="true" />
    <span>
      {{ $t("enrichment.studio.profile_incomplete", { sections: missingText }) }}
      <router-link :to="profileLink" class="t-accent fw-600" data-testid="profile-gate-link">
        {{ $t("enrichment.studio.profile_fill") }}
      </router-link>
    </span>
  </p>
</template>

<script>
import { GET_ProfileStatus } from "@/api/enrichment/api";

// The soft gate: when the company profile of the channel misses sections, the AI writes generic text — say so, and
// which sections and a link to fill them in, but never block the work. A failed status check shows nothing.
export default {
  name: "ProfileGate",
  props: {
    channel: { type: String, default: "" },
  },
  data() {
    return { missing: [] };
  },
  computed: {
    // The profile of this channel (its scope), where the missing sections are filled in.
    profileLink() {
      return { name: "EnrichmentProfile", query: this.channel ? { channel: this.channel } : {} };
    },
    missingText() {
      return this.missing.map((key) => this.sectionName(key)).join(", ");
    },
  },
  watch: {
    channel: { immediate: true, handler: "load" },
  },
  methods: {
    async load() {
      const channel = this.channel;
      try {
        const { data } = await GET_ProfileStatus({ channel });
        if (channel !== this.channel) return;
        this.missing = data.complete ? [] : data.sections.filter((s) => !s.complete).map((s) => s.key);
      } catch {
        this.missing = [];
      }
    },
    sectionName(key) {
      const path = `enrichment.studio.profile_sections.${key}`;
      const name = this.$t(path);
      return name === path ? key : name;
    },
  },
};
</script>

<style lang="scss" scoped>
.profile-gate {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-base);
  background: var(--warning-subtle);
  color: var(--text-strong);
}
.profile-gate__icon {
  color: var(--warning);
}
</style>
