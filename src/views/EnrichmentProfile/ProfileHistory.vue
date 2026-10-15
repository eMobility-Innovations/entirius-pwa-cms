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
        <TextDiff :before="jsonOf(from)" :after="jsonOf(to)" wide />
      </template>
      <p v-if="!versions.length" class="m-0 fs-300 t-secondary">{{ $t("enrichment.profile.no_versions") }}</p>
      <ol v-else class="profile-history__list m-0 flex-column gap-3">
        <li v-for="item in versions" :key="item.version" class="profile-history__item flex ai-ct flex-wrap gap-3" :data-testid="`profile-version-${item.version}`">
          <span class="fw-600">{{ $t("enrichment.profile.version", { n: item.version }) }}</span>
          <span class="fs-200 t-muted">{{ formatDate(item.created_at) }}</span>
          <span class="profile-history__note fs-300 t-secondary">{{ item.note || "—" }}</span>
          <BasicButton
            v-if="item.version !== latest"
            size="sm"
            mutates
            :disabled="busy"
            :data-testid="`profile-restore-${item.version}`"
            @click="restoring = item.version"
          >
            {{ $t("enrichment.profile.restore") }}
          </BasicButton>
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
import { prettyJson } from "./profileLogic";

// The saved versions of one profile scope: first the difference between any two of them as text (pretty JSON), the
// previous against the latest at first — on top, so comparing never needs a scroll past the list — then the versions
// newest first: when, the note, Restore (a new version with the old data).
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
    jsonOf(version) {
      return prettyJson(this.versions.find((v) => v.version === version)?.data);
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
.profile-history__item {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.profile-history__note {
  flex: 1;
  min-width: 0;
}
</style>
