<template>
  <div class="keywords-table flex-column gap-5" data-testid="keywords-table">
    <dl class="keywords-table__summary m-0 flex-column gap-2">
      <div class="flex flex-wrap gap-2">
        <dt class="field-label">{{ $t("enrichment.studio.keywords.primary") }}</dt>
        <dd class="m-0 fw-600" data-testid="keywords-primary">{{ data.primary || "—" }}</dd>
      </div>
      <div class="flex flex-wrap gap-2">
        <dt class="field-label">{{ $t("enrichment.studio.keywords.secondary") }}</dt>
        <dd class="m-0" data-testid="keywords-secondary">{{ (data.secondary || []).join(", ") || "—" }}</dd>
      </div>
      <div v-if="data.intent" class="flex flex-wrap gap-2">
        <dt class="field-label">{{ $t("enrichment.studio.keywords.intent") }}</dt>
        <dd class="m-0">{{ intentLabel(data.intent) }}</dd>
      </div>
    </dl>
    <p v-if="data.serp_notes" class="m-0 keywords-table__notes">{{ data.serp_notes }}</p>

    <div class="table-scroll">
      <table class="table-basic keywords-table__grid">
        <thead>
          <tr>
            <th scope="col">{{ $t("enrichment.studio.keywords.phrase") }}</th>
            <th scope="col" class="keywords-table__num">{{ $t("enrichment.studio.keywords.volume") }}</th>
            <th scope="col">{{ $t("enrichment.studio.keywords.intent") }}</th>
            <th scope="col">{{ $t("enrichment.studio.keywords.serp") }}</th>
            <th scope="col">{{ $t("enrichment.studio.keywords.use") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.phrase" :data-testid="`keyword-${row.phrase}`">
            <td class="fw-600">{{ row.phrase }}</td>
            <td class="keywords-table__num">{{ row.volume ?? "—" }}</td>
            <td>{{ intentLabel(row.intent) }}</td>
            <td class="t-secondary">{{ row.serp_notes || "—" }}</td>
            <td>
              <div class="flex gap-2">
                <BasicButton
                  mutates
                  size="sm"
                  :variant="role(row.phrase) === 'primary' ? 'primary' : 'ghost'"
                  :aria-pressed="String(role(row.phrase) === 'primary')"
                  :disabled="!editable || busy"
                  data-testid="keyword-primary"
                  @click="pick(row.phrase, 'primary')"
                >
                  {{ $t("enrichment.studio.keywords.as_primary") }}
                </BasicButton>
                <BasicButton
                  mutates
                  size="sm"
                  :variant="role(row.phrase) === 'secondary' ? 'secondary' : 'ghost'"
                  :aria-pressed="String(role(row.phrase) === 'secondary')"
                  :disabled="!editable || busy || role(row.phrase) === 'primary'"
                  data-testid="keyword-secondary"
                  @click="pick(row.phrase, 'secondary')"
                >
                  {{ $t("enrichment.studio.keywords.as_secondary") }}
                </BasicButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="editable" class="m-0 fs-200 t-secondary">{{ $t("enrichment.studio.keywords.pick_hint", { max: MAX_SECONDARY }) }}</p>
  </div>
</template>

<script>
import { PATCH_Proposal } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { MAX_SECONDARY, keywordRole, keywordRows, pickKeyword } from "./studioLogic";

// The search-phrases step: the main and supporting phrases the AI chose, then every candidate with its monthly
// searches, what searchers want and what ranks today. A pick saves the step's value at once (a manual version).
export default {
  name: "KeywordsTable",
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["updated"],
  setup() {
    return { notify: useNotifyStore(), MAX_SECONDARY };
  },
  data() {
    return { busy: false };
  },
  computed: {
    data() {
      return this.proposal.proposed_value?.data || {};
    },
    rows() {
      return keywordRows(this.data);
    },
    editable() {
      return this.proposal.status === "pending";
    },
  },
  methods: {
    role(phrase) {
      return keywordRole(this.data, phrase);
    },
    intentLabel(intent) {
      if (!intent) return "—";
      const path = `enrichment.studio.keywords.intents.${intent}`;
      const label = this.$t(path);
      return label === path ? intent : label;
    },
    async pick(phrase, role) {
      const next = pickKeyword(this.data, phrase, role);
      if (next === this.data) return;
      this.busy = true;
      try {
        const value = { ...this.proposal.proposed_value, data: next };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: value });
        this.$emit("updated", data);
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.keywords-table__notes {
  line-height: 1.6;
  white-space: pre-wrap;
}
.keywords-table__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
