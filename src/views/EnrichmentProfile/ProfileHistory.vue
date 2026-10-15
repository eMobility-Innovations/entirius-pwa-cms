<template>
  <SideDrawer :visible="visible" width="50rem" :title="$t('enrichment.profile.history')" @close="$emit('close')">
    <div class="flex-column gap-6" data-testid="profile-history">
      <template v-if="versions.length > 1">
        <ReadonlyOff>
          <div class="flex flex-wrap gap-4">
            <BasicSelect v-model="from" :options="options" :floating-label="$t('enrichment.profile.compare_from')" data-testid="profile-diff-from" />
            <BasicSelect v-model="to" :options="options" :floating-label="$t('enrichment.profile.compare_to')" data-testid="profile-diff-to" />
          </div>
        </ReadonlyOff>
        <!-- What changed, section by section, as text people read: never the stored JSON. -->
        <p v-if="!changes.length" class="m-0 fs-300 t-secondary" data-testid="profile-diff-none">
          {{ $t("enrichment.profile.no_changes") }}
        </p>
        <section
          v-for="change in changes"
          :key="change.key"
          class="flex-column gap-2"
          :data-testid="`profile-diff-${change.key}`"
        >
          <h3 class="profile-history__section m-0">{{ name("sections", change.key) }}</h3>
          <TextDiff :before="readable(change.before)" :after="readable(change.after)" wide />
        </section>
      </template>
      <p v-if="!versions.length" class="m-0 fs-300 t-secondary">{{ $t("enrichment.profile.no_versions") }}</p>
      <ol v-else class="profile-history__list m-0 flex-column gap-3">
        <li v-for="item in versions" :key="item.version" class="profile-history__item" :data-testid="`profile-version-${item.version}`">
          <span class="profile-history__head flex ai-ct flex-wrap gap-3">
            <span class="fw-600">{{ $t("enrichment.profile.version", { n: item.version }) }}</span>
            <span class="fs-200 t-muted">{{ formatDate(item.created_at) }}</span>
          </span>
          <StatusBadge v-if="item.version === latest" class="profile-history__action" :label="$t('enrichment.profile.current')" tone="positive" />
          <BasicButton
            v-else
            class="profile-history__action"
            size="sm"
            mutates
            :disabled="busy"
            :data-testid="`profile-restore-${item.version}`"
            @click="restoring = item.version"
          >
            {{ $t("enrichment.profile.restore") }}
          </BasicButton>
          <span v-if="item.note" class="profile-history__note fs-300 t-secondary">{{ item.note }}</span>
        </li>
      </ol>
    </div>

    <ConfirmDialog
      :open="restoring !== null"
      :title="$t('enrichment.profile.restore_title', { n: restoring })"
      :message="restoreMessage"
      :confirm-label="$t('enrichment.profile.restore')"
      @update:open="(open) => !open && (restoring = null)"
      @confirm="confirmRestore"
    />
  </SideDrawer>
</template>

<script>
import { ReadonlyOff } from "@/composables/useReadonly";
import { formatDate } from "@/utils/format";
import TextDiff from "@/views/EnrichmentReview/TextDiff.vue";
import { changedSections, readableText } from "./profileLogic";

// The saved versions of one profile scope: first the difference between any two of them, section by section as plain
// text, the previous against the latest at first — on top, so comparing never needs a scroll past the list — then the
// versions newest first: when, the note, Restore (a new version with the old data); the latest is marked Current.
export default {
  name: "ProfileHistory",
  components: { ReadonlyOff, TextDiff },
  props: {
    visible: { type: Boolean, default: false },
    versions: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    dirty: { type: Boolean, default: false },
  },
  emits: ["close", "restore"],
  setup() {
    return { formatDate };
  },
  data() {
    return { from: null, to: null, restoring: null };
  },
  computed: {
    latest() {
      return this.versions[0]?.version ?? null;
    },
    restoreMessage() {
      const message = this.$t("enrichment.profile.restore_message");
      return this.dirty ? `${message} ${this.$t("enrichment.profile.restore_discards")}` : message;
    },
    changes() {
      return changedSections(this.dataOf(this.from), this.dataOf(this.to));
    },
    options() {
      return this.versions.map((v) => ({ value: v.version, label: this.$t("enrichment.profile.version", { n: v.version }) }));
    },
  },
  watch: {
    versions: { immediate: true, handler: "resetCompare" },
  },
  methods: {
    resetCompare() {
      this.to = this.latest;
      this.from = this.versions[1]?.version ?? null;
    },
    dataOf(version) {
      return this.versions.find((v) => v.version === version)?.data || {};
    },
    // A section, field or column by its name in the profile editor, else its key.
    name(group, key) {
      for (const path of [`enrichment.profile.${group}.${key}`, `enrichment.profile.columns.${key}`]) {
        const label = this.$t(path);
        if (label !== path) return label;
      }
      return key;
    },
    readable(value) {
      return readableText(value, { label: (key) => this.name("fields", key), offLabel: this.$t("enrichment.profile.row_off") });
    },
    confirmRestore() {
      this.$emit("restore", this.restoring);
      this.restoring = null;
    },
  },
};
</script>

<style lang="scss" scoped>
.profile-history__list {
  padding: 0;
  list-style: none;
}
// Version and date, Restore (or Current) at the right; the note on a full line under them, never under the button.
.profile-history__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.profile-history__note {
  grid-column: 1 / -1;
  overflow-wrap: anywhere;
}
.profile-history__section {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
</style>
