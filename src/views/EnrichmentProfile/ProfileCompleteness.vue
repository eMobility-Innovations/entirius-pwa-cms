<template>
  <div v-if="summary.total" class="profile-completeness flex-column gap-2" data-testid="profile-completeness">
    <span class="fs-300 t-secondary">{{ $t("enrichment.profile.completeness", { done: summary.done, total: summary.total }) }}</span>
    <ol class="profile-completeness__bar m-0">
      <li
        v-for="section in status.sections"
        :key="section.key"
        class="profile-completeness__part"
        :class="{ 'profile-completeness__part--done': section.complete }"
        :title="sectionName(section.key)"
        :data-testid="`profile-completeness-${section.key}`"
      >
        <span class="profile-completeness__label fs-200">{{ sectionName(section.key) }}</span>
      </li>
    </ol>
  </div>
</template>

<script>
import { completeness } from "./profileLogic";

// How complete the effective profile is: one segment per checked section, filled when the section meets its minimum.
export default {
  name: "ProfileCompleteness",
  props: {
    status: { type: Object, default: null },
  },
  computed: {
    summary() {
      return completeness(this.status);
    },
  },
  methods: {
    sectionName(key) {
      const path = `enrichment.profile.sections.${key}`;
      const name = this.$t(path);
      return name === path ? key : name;
    },
  },
};
</script>

<style lang="scss" scoped>
.profile-completeness__bar {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: var(--space-1);
  padding: 0;
  list-style: none;
}
.profile-completeness__part {
  min-width: 0;
  padding-top: var(--space-2);
  border-top: 4px solid var(--border-subtle);
  color: var(--text-secondary);
}
.profile-completeness__part--done {
  border-top-color: var(--positive);
  color: var(--text-body);
}
.profile-completeness__label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
