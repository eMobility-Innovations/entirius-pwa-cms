<template>
  <div class="flex-column gap-4" data-testid="enrichment-focus-product">
    <Loader v-if="loading" block />
    <template v-else>
      <section v-if="setProposal" class="focus-product__set flex-column gap-3" data-testid="enrichment-focus-set">
        <div class="flex ai-ct jc-sb flex-wrap gap-3">
          <div class="flex-column gap-1">
            <span class="field-label">{{ $t("enrichment.review.focus.set_heading") }}</span>
            <strong class="focus-product__set-name" data-testid="enrichment-focus-set-name">{{ setName }}</strong>
          </div>
          <BasicButton
            v-if="hasSource"
            variant="ghost"
            size="sm"
            data-testid="enrichment-focus-source"
            @click="toggleSource"
          >
            {{ $t("enrichment.review.shop_data") }}
          </BasicButton>
        </div>
        <div class="focus-product__choice">
          <BasicSelect
            v-model="chosen"
            :options="setOptions"
            :placeholder="$t('enrichment.review.focus.other_set_placeholder')"
            :disabled="busy || locked"
            searchable
            data-testid="enrichment-focus-set-picker"
          />
          <BasicButton
            v-if="chosen"
            variant="ghost"
            size="sm"
            data-testid="enrichment-focus-keep-ai-set"
            @click="chosen = null"
          >
            {{ $t("enrichment.review.focus.keep_ai_set") }}
          </BasicButton>
          <BasicButton
            v-else-if="canReject"
            variant="danger"
            size="sm"
            mutates
            :disabled="busy || locked"
            data-testid="enrichment-focus-reject-set"
            @click="$emit('reject-set')"
          >
            {{ $t("enrichment.review.focus.reject_set") }}
          </BasicButton>
        </div>
        <p v-if="chosen" class="m-0 fs-200 t-secondary" data-testid="enrichment-focus-chosen-note">
          {{ $t("enrichment.review.focus.chosen_note") }}
        </p>
        <p v-else-if="lastTry" class="m-0 fs-200 t-warning" data-testid="enrichment-focus-last-try">
          {{ $t("enrichment.review.focus.last_try") }}
        </p>
      </section>
      <BasicButton
        v-else-if="hasSource"
        class="focus-product__source-alone"
        variant="ghost"
        size="sm"
        data-testid="enrichment-focus-source"
        @click="toggleSource"
      >
        {{ $t("enrichment.review.shop_data") }}
      </BasicButton>

      <pre v-if="source != null" class="focus-product__source m-0 fs-200" data-testid="enrichment-focus-source-text">{{
        source || "—"
      }}</pre>

      <section
        v-if="attributes.length"
        class="focus-product__attributes"
        :class="{ 'focus-product__attributes--off': chosen }"
        data-testid="enrichment-focus-attributes"
      >
        <span class="field-label">{{ attributesHeading }}</span>
        <FocusAttribute
          v-for="proposal in attributes"
          :key="proposal.id"
          :proposal="proposal"
          :busy="busy || locked || !!chosen"
          @reject="rejectAttribute"
          @updated="replace"
        />
      </section>

      <div class="flex jc-end">
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
import { GET_Proposals, PATCH_Proposal, POST_RejectProposal } from "@/api/enrichment/api";
import { acceptChosen } from "./applyMode";
import { acceptProduct } from "./acceptProduct";
import { loadFeatureSetNames } from "./FeatureSetChange.vue";
import FocusAttribute from "./FocusAttribute.vue";
import { hasSource, loadSource } from "./productSource";
import { acceptOrder } from "./reviewLogic";

const MAX_PROPOSALS = 100; // the API's page limit; a product has far fewer pending proposals
const MAX_REJECTIONS = 3; // the service stops the AI after the third

// One product of Focus, all of it: the set on top, its attributes under it, read fresh because a product can sit on
// two pages.
// Apply product takes the set first, then the attributes. Choosing another set applies that set alone: the
// attributes belong to the AI's set, so they come back from the AI for the chosen one. A rejected attribute leaves
// the card. The last AI try cannot be rejected, because nothing would bring the product back: a person picks.
export default {
  name: "EnrichmentFocusProduct",
  components: { FocusAttribute },
  props: {
    sku: { type: String, required: true },
    locked: { type: Boolean, default: false },
  },
  emits: ["done", "reject-set"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { proposals: [], loading: true, busy: false, chosen: null, rejected: 0, names: {}, source: null };
  },
  computed: {
    hasSource,
    setProposal() {
      return this.proposals.find((proposal) => proposal.target_kind === "feature_set") || null;
    },
    attributes() {
      return this.proposals.filter((proposal) => proposal !== this.setProposal);
    },
    setName() {
      const idx = this.chosen || this.setProposal?.proposed_value?.featureset_idx;
      return this.names[idx] || idx || "";
    },
    attributesHeading() {
      const key = "enrichment.review.focus.attributes";
      return this.setProposal ? this.$t(`${key}_of`, { set: this.setName }) : this.$t(key);
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
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.loading = false;
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

<style lang="scss" scoped>
.focus-product__set {
  padding: var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.focus-product__set-name {
  font-size: var(--fs-500);
  color: var(--text-strong);
}
.focus-product__choice {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}
.focus-product__attributes {
  margin-left: var(--space-4);
  padding-left: var(--space-4);
  border-left: 2px solid var(--border-strong);

  &--off {
    opacity: 0.5;
  }
}
.focus-product__source {
  white-space: pre-wrap;
}
.focus-product__source-alone {
  align-self: flex-start;
}
</style>
