<template>
  <div class="flex-column gap-6" data-testid="enrichment-focus-product">
    <Loader v-if="loading" block />
    <template v-else>
      <div class="flex ai-ct jc-sb flex-wrap gap-3">
        <BasicButton variant="ghost" size="sm" data-testid="enrichment-focus-source" @click="toggleSource">
          {{ $t("enrichment.review.shop_data") }}
        </BasicButton>
      </div>
      <pre v-if="source != null" class="focus-product__source m-0 fs-200" data-testid="enrichment-focus-source-text">{{
        source || "—"
      }}</pre>

      <ProposalPanel
        v-for="proposal in proposals"
        :key="proposal.id"
        :proposal="proposal"
        :task="tasks[proposal.task_id] || null"
        :busy="busy || locked"
        wide
        with-product
        @reject="rejectAttribute"
        @updated="replace"
      />

      <FormField v-if="setProposal" :label="$t('enrichment.review.focus.other_set')">
        <BasicSelect
          v-model="chosen"
          :options="setOptions"
          :placeholder="$t('enrichment.review.focus.other_set_placeholder')"
          :disabled="busy || locked"
          searchable
          data-testid="enrichment-focus-set-picker"
        />
      </FormField>
      <div v-if="chosen" class="flex ai-ct jc-sb flex-wrap gap-3">
        <p class="m-0 fs-300 t-secondary" data-testid="enrichment-focus-chosen-note">
          {{ $t("enrichment.review.focus.chosen_note") }}
        </p>
        <BasicButton variant="ghost" size="sm" data-testid="enrichment-focus-keep-ai-set" @click="chosen = null">
          {{ $t("enrichment.review.focus.keep_ai_set") }}
        </BasicButton>
      </div>
      <p v-else-if="lastTry" class="m-0 fs-300 t-warning" data-testid="enrichment-focus-last-try">
        {{ $t("enrichment.review.focus.last_try") }}
      </p>

      <div class="flex ai-ct jc-end flex-wrap gap-3">
        <BasicButton
          v-if="canReject && !chosen"
          variant="danger"
          mutates
          :disabled="busy || locked"
          data-testid="enrichment-focus-reject-set"
          @click="$emit('reject-set')"
        >
          {{ $t("enrichment.review.focus.reject_set") }}
        </BasicButton>
        <BasicButton
          mutates
          :loading="busy"
          :disabled="locked || !proposals.length"
          data-testid="enrichment-focus-apply"
          @click="apply"
        >
          {{ $t(chosen ? "enrichment.review.focus.apply_set" : "enrichment.review.apply_product") }}
        </BasicButton>
      </div>
    </template>
  </div>
</template>

<script>
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { GET_Proposals, GET_Task, PATCH_Proposal, POST_RejectProposal } from "@/api/enrichment/api";
import { acceptChosen } from "./applyMode";
import { acceptProduct } from "./acceptProduct";
import { loadFeatureSetNames } from "./FeatureSetChange.vue";
import ProposalPanel from "./ProposalPanel.vue";
import { loadSource } from "./productSource";
import { acceptOrder } from "./reviewLogic";

const MAX_PROPOSALS = 100; // the API's page limit; a product has far fewer pending proposals
const MAX_REJECTIONS = 3; // CLASSIFY_MAX_REJECTIONS in esc-service-volkanos: the AI stops after the third

// One product of Focus, all of it: the set and the attributes, read fresh because a product can sit on two pages.
// Apply product takes the set first, then the attributes. Choosing another set applies that set alone: the
// attributes belong to the AI's set, so they come back from the AI for the chosen one. A rejected attribute leaves
// the card. The last AI try cannot be rejected, because nothing would bring the product back: a person picks.
export default {
  name: "EnrichmentFocusProduct",
  components: { ProposalPanel },
  props: {
    sku: { type: String, required: true },
    locked: { type: Boolean, default: false },
  },
  emits: ["done", "reject-set"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { proposals: [], loading: true, busy: false, chosen: null, rejected: 0, names: {}, tasks: {}, source: null };
  },
  computed: {
    setProposal() {
      return this.proposals.find((proposal) => proposal.target_kind === "feature_set") || null;
    },
    lastTry() {
      return !!this.setProposal && this.rejected >= MAX_REJECTIONS - 1;
    },
    canReject() {
      return !!this.setProposal && !this.lastTry;
    },
    setOptions() {
      const proposed = this.setProposal?.proposed_value?.featureset_idx;
      return Object.entries(this.names)
        .filter(([idx]) => idx !== "default" && idx !== proposed)
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
  },
  async created() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      const by = { subject_ref: this.sku };
      try {
        const [pending, rejected, names] = await Promise.all([
          GET_Proposals({ ...by, status: "pending", page_size: MAX_PROPOSALS }),
          GET_Proposals({ ...by, status: "rejected", target_kind: "feature_set", page_size: 1 }),
          loadFeatureSetNames(),
        ]);
        this.proposals = acceptOrder(pending.data.results || []);
        this.rejected = rejected.data.count || 0;
        this.names = names;
        if (!this.proposals.length) this.$emit("done", { decided: false });
        this.proposals.forEach((proposal) => this.loadTask(proposal.task_id));
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.loading = false;
      }
    },
    async loadTask(id) {
      if (id == null || id in this.tasks) return;
      this.tasks[id] = null;
      try {
        this.tasks[id] = (await GET_Task(id)).data;
      } catch {
        // The card stands without its run.
      }
    },
    async toggleSource() {
      if (this.source != null) {
        this.source = null;
        return;
      }
      this.source = await loadSource(this.proposals[0]);
    },
    replace(proposal) {
      this.proposals = this.proposals.map((row) => (row.id === proposal.id ? { ...row, ...proposal } : row));
    },
    say(type, msg) {
      this.notify.spawnNotification({ type, msg });
    },
    async applyChosenSet() {
      const value = { proposed_value: { featureset_idx: this.chosen } };
      const { data } = await PATCH_Proposal(this.setProposal.id, value);
      return (await acceptChosen(data)).data.status === "drifted";
    },
    async apply() {
      if (this.busy || this.locked || !this.proposals.length) return;
      this.busy = true;
      try {
        const drifted = this.chosen ? await this.applyChosenSet() : (await acceptProduct(this.sku)).drifted;
        if (drifted) {
          this.say("warning", this.$t("enrichment.drift.title"));
          await this.load();
          return;
        }
        this.say("positive", this.$t("enrichment.review.toast.accepted"));
        this.$emit("done", { decided: true });
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.busy = false;
      }
    },
    async rejectAttribute({ proposal }) {
      if (this.busy) return;
      this.busy = true;
      try {
        await POST_RejectProposal(proposal.id, {});
        this.proposals = this.proposals.filter((row) => row.id !== proposal.id);
        this.say("positive", this.$t("enrichment.review.toast.rejected"));
        if (!this.proposals.length) this.$emit("done", { decided: true });
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style scoped>
.focus-product__source {
  white-space: pre-wrap;
}
</style>
