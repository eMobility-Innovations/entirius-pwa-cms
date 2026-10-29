<template>
  <ul v-if="warnings.length" class="qa-warnings m-0 flex-column gap-2" data-testid="qa-warnings">
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
</template>

<script>
import { POST_SuggestFact } from "@/api/enrichment/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import { sentenceWith, valueText } from "./correction";

const NUMBER = "NUMBER_NOT_IN_FACTS";

// The quality warnings of a proposal's text (contract A4 § 4), right under the text they are about: a profile rule,
// a number the facts do not back ("Add to facts" leaves a fact suggestion in Memory), a failed checklist item. The
// check and "Fix warnings" sit in the card's tools row (QaCheckStatus). Stores are reached only on an action.
export default {
  name: "QaWarnings",
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["busy"],
  data() {
    return { busy: false, suggested: [] };
  },
  computed: {
    warnings() {
      return this.proposal.warnings || [];
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
    // The fact is named by the sentence the number stands in ("7 años de garantía…"), so Memory shows what it means.
    async suggestFact(warning) {
      const value = this.factValue(warning);
      const label = sentenceWith(valueText(this.proposal.proposed_value), value);
      const notify = useNotifyStore();
      this.busy = true;
      try {
        await POST_SuggestFact(this.proposal.id, { value, label });
        this.suggested = [...this.suggested, value];
        useEnrichmentProfileStore().refresh();
        notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.qa.fact_suggested_toast") });
      } catch (err) {
        notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.qa-warnings {
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
