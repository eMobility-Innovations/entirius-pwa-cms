<template>
  <span v-if="checkable" class="qa-check flex ai-ct flex-wrap gap-3" data-testid="qa-check">
    <span v-if="checked" class="qa-check__state flex ai-ct gap-2 fs-250" :class="`qa-check__state--${tone}`" data-testid="qa-check-state">
      <FontAwesomeIcon :icon="warnings.length ? $icons.warning : $icons.success" aria-hidden="true" />
      {{ stateLabel }}
    </span>
    <BasicTooltip v-else :text="$t('enrichment.qa.check_hint')">
      <BasicButton :size="size" variant="ghost" icon="check" mutates :disabled="busy" data-testid="qa-check-standard" @click="checkStandard">
        {{ $t("enrichment.qa.check") }}
      </BasicButton>
    </BasicTooltip>
    <BasicButton v-if="warnings.length" :size="size" variant="ghost" mutates :disabled="busy" data-testid="qa-fix-warnings" @click="fixWarnings">
      {{ $t("enrichment.qa.fix_warnings") }}
    </BasicButton>
    <span v-if="busy" class="flex ai-ct gap-2 fs-250 t-secondary" role="status"><Loader :size="24" />{{ $t("enrichment.correct.busy") }}</span>
  </span>
</template>

<script>
import { GET_Proposal, POST_ReviseProposal } from "@/api/enrichment/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { pluralKey } from "@/utils/plural";
import { revisable, valueShape } from "./correction";

// The guidelines check of a pending text proposal, in the card's tools row: the state of its current version —
// "Checked against the guidelines ✓", "Checked: 2 warnings" — or, not checked yet, the button that asks the AI to
// check the text against the profile's checklists (a paid call, no new version; the tooltip says so). "Fix warnings"
// makes a corrected version from the warnings on the card. A new version is unchecked again (`standard_checked_at`).
export default {
  name: "QaCheckStatus",
  props: {
    proposal: { type: Object, required: true },
    size: { type: String, default: "sm" },
  },
  emits: ["updated", "busy"],
  data() {
    return { busy: false };
  },
  computed: {
    checkable() {
      return revisable(this.proposal) && valueShape(this.proposal.proposed_value) === "text";
    },
    warnings() {
      return this.proposal.warnings || [];
    },
    checked() {
      return !!this.proposal.standard_checked_at;
    },
    tone() {
      return this.warnings.length ? "warning" : "positive";
    },
    stateLabel() {
      const count = this.warnings.length;
      if (!count) return this.$t("enrichment.qa.checked_ok");
      return this.$t(`enrichment.qa.checked_${pluralKey(count)}`, { count });
    },
  },
  watch: {
    busy(value) {
      this.$emit("busy", value);
    },
  },
  methods: {
    async run(work) {
      const notify = useNotifyStore();
      this.busy = true;
      try {
        await work();
      } catch (err) {
        notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
    checkStandard() {
      return this.run(async () => {
        const { data } = await POST_ReviseProposal(this.proposal.id, { quick_action: "check_standard" });
        const { warnings = [], standard_checked_at: checkedAt = new Date().toISOString() } = data;
        this.$emit("updated", { ...this.proposal, warnings, standard_checked_at: checkedAt });
      });
    },
    fixWarnings() {
      return this.run(async () => {
        await POST_ReviseProposal(this.proposal.id, { quick_action: "fix_warnings" });
        const { data } = await GET_Proposal(this.proposal.id);
        this.$emit("updated", data);
        useNotifyStore().spawnNotification({ type: "positive", msg: this.$t("enrichment.qa.fixed_toast") });
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.qa-check__state {
  font-weight: 500;
  color: var(--text-strong);
}
.qa-check__state--positive svg {
  color: var(--positive);
}
.qa-check__state--warning svg {
  color: var(--warning);
}
</style>
