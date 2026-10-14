<template>
  <section v-if="warnings.length || checkable" class="qa-warnings flex-column gap-3" data-testid="qa-warnings">
    <ul v-if="warnings.length" class="qa-warnings__list m-0 flex-column gap-2">
      <li v-for="(warning, index) in warnings" :key="index" class="qa-warnings__item flex ai-ct flex-wrap gap-2" :data-testid="`qa-warning-${warning.code}`">
        <FontAwesomeIcon :icon="$icons.warning" class="qa-warnings__icon" aria-hidden="true" />
        <span class="fw-600">{{ codeLabel(warning.code) }}:</span>
        <span class="qa-warnings__message">{{ message(warning) }}</span>
        <BasicButton
          v-if="factValue(warning)"
          size="sm"
          variant="ghost"
          mutates
          :disabled="busy || suggested.includes(factValue(warning))"
          data-testid="qa-add-fact"
          @click="suggestFact(warning)"
        >
          {{ suggested.includes(factValue(warning)) ? $t("enrichment.qa.fact_suggested") : $t("enrichment.qa.add_fact") }}
        </BasicButton>
      </li>
    </ul>
    <div v-if="checkable" class="flex ai-ct flex-wrap gap-3">
      <BasicButton size="sm" mutates :disabled="busy" data-testid="qa-check-standard" @click="checkStandard">
        {{ $t("enrichment.qa.check_standard") }}
      </BasicButton>
      <BasicButton v-if="warnings.length" size="sm" mutates :disabled="busy" data-testid="qa-fix-warnings" @click="fixWarnings">
        {{ $t("enrichment.qa.fix_warnings") }}
      </BasicButton>
      <span v-if="busy" class="flex ai-ct gap-2 fs-300 t-secondary" role="status"><Loader :size="32" />{{ $t("enrichment.correct.busy") }}</span>
    </div>
  </section>
</template>

<script>
import { GET_Proposal, POST_ReviseProposal, POST_SuggestFact } from "@/api/enrichment/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import { revisable, valueShape } from "./correction";

const NUMBER = "NUMBER_NOT_IN_FACTS";

// The quality warnings of a proposal's text (contract A4 § 4): a profile rule, a number the facts do not back
// ("Add to facts" leaves a fact suggestion in Memory), a failed checklist item. "Check against the standard" asks
// the AI to check the text with the profile's checklists (no new version); "Fix warnings" makes a corrected version.
// Stores are reached only on an action, so a card without one needs no store.
export default {
  name: "QaWarnings",
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["updated", "busy"],
  data() {
    return { busy: false, suggested: [] };
  },
  computed: {
    warnings() {
      return this.proposal.warnings || [];
    },
    checkable() {
      return revisable(this.proposal) && valueShape(this.proposal.proposed_value) === "text";
    },
  },
  watch: {
    busy(value) {
      this.$emit("busy", value);
    },
  },
  methods: {
    codeLabel(code) {
      const path = `enrichment.qa.code.${code}`;
      const label = this.$t(path);
      return label === path ? this.$t("enrichment.qa.code.rule") : label;
    },
    factValue(warning) {
      return warning.code === NUMBER ? warning.span?.text || "" : "";
    },
    message(warning) {
      const number = this.factValue(warning);
      return number ? this.$t("enrichment.qa.number_message", { number }) : warning.message;
    },
    toast(type, msg) {
      useNotifyStore().spawnNotification({ type, msg });
    },
    async run(work, toastKey) {
      this.busy = true;
      try {
        await work();
        if (toastKey) this.toast("positive", this.$t(toastKey));
      } catch (err) {
        this.toast("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.busy = false;
      }
    },
    suggestFact(warning) {
      const value = this.factValue(warning);
      return this.run(async () => {
        await POST_SuggestFact(this.proposal.id, { value });
        this.suggested = [...this.suggested, value];
        useEnrichmentProfileStore().refresh();
      }, "enrichment.qa.fact_suggested_toast");
    },
    checkStandard() {
      return this.run(async () => {
        const { data } = await POST_ReviseProposal(this.proposal.id, { quick_action: "check_standard" });
        const warnings = data.warnings || [];
        this.$emit("updated", { ...this.proposal, warnings });
        if (!warnings.length) this.toast("positive", this.$t("enrichment.qa.checked_toast"));
      });
    },
    fixWarnings() {
      return this.run(async () => {
        await POST_ReviseProposal(this.proposal.id, { quick_action: "fix_warnings" });
        const { data } = await GET_Proposal(this.proposal.id);
        this.$emit("updated", data);
      }, "enrichment.qa.fixed_toast");
    },
  },
};
</script>

<style lang="scss" scoped>
.qa-warnings__list {
  padding: 0;
  list-style: none;
}
.qa-warnings__item {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-base);
  background: var(--warning-subtle);
  color: var(--text-strong);
}
.qa-warnings__icon {
  color: var(--warning);
}
.qa-warnings__message {
  min-width: 0;
  overflow-wrap: break-word;
}
</style>
