<template>
  <div class="flex-column gap-4" data-testid="enrichment-focus-product">
    <Loader v-if="loading" block />
    <template v-else-if="review">
      <p v-if="review.rounds_used" class="m-0 fs-200 t-secondary" data-testid="enrichment-focus-rounds">
        {{ $t("enrichment.review.focus.sent_back", { n: review.rounds_used }) }}
        · {{ $t(review.waiting_ai ? "enrichment.review.focus.waiting_ai" : "enrichment.review.focus.ai_answered") }}
      </p>
      <section v-if="setProposal" class="focus-product__set flex-column gap-3" data-testid="enrichment-focus-set">
        <div class="flex ai-ct jc-sb flex-wrap gap-3">
          <div class="flex-column gap-1">
            <span class="field-label">{{ $t("enrichment.review.focus.set_heading") }}</span>
            <strong class="focus-product__set-name" data-testid="enrichment-focus-set-name">{{ setName }}</strong>
          </div>
          <BasicButton variant="ghost" size="sm" data-testid="enrichment-focus-source" @click="toggleSource">
            {{ $t("enrichment.review.shop_data") }}
          </BasicButton>
        </div>
        <div class="focus-product__choice">
          <BasicSelect
            :model-value="chosen"
            @update:model-value="chooseSet"
            :options="setOptions"
            :placeholder="$t('enrichment.review.focus.other_set_placeholder')"
            :disabled="busy || locked || savingAttribute"
            searchable
            data-testid="enrichment-focus-set-picker"
          />
          <BasicButton
            v-if="chosen"
            variant="ghost"
            size="sm"
            data-testid="enrichment-focus-keep-ai-set"
            mutates
            :disabled="busy || locked || savingAttribute"
            @click="chooseSet(null)"
          >
            {{ $t("enrichment.review.focus.keep_ai_set") }}
          </BasicButton>
        </div>
      </section>
      <BasicButton
        v-else
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
          :busy="busy || locked || savingAttribute || !!chosen"
          :review-item="reviewItem(proposal.id)"
          @updated="replace"
          @saving="(value) => (attributeSaving[proposal.id] = value)"
        />
      </section>

      <section v-if="missing.length" class="flex-column gap-3" data-testid="enrichment-focus-missing">
        <span class="field-label">{{ $t("enrichment.review.focus.missing_attributes") }}</span>
        <form v-for="row in missing" :key="row.feature_idx" class="flex ai-ct gap-3" @submit.prevent="fill(row)">
          <FormField :label="row.unit ? `${row.name} (${row.unit})` : row.name">
            <BasicInput v-model="missingValues[row.feature_idx]" :disabled="busy || locked || savingAttribute" :data-testid="`enrichment-focus-missing-${row.feature_idx}`" />
          </FormField>
          <BasicButton type="submit" size="sm" mutates :disabled="busy || locked || savingAttribute" :data-testid="`enrichment-focus-fill-${row.feature_idx}`">
            {{ $t("common.save") }}
          </BasicButton>
        </form>
      </section>
      <div class="flex jc-end">
        <BasicButton v-if="canSendBack" mutates :loading="busy" :disabled="locked || savingAttribute" data-testid="enrichment-focus-send-back" @click="$emit('send-back')">
          {{ $t("enrichment.review.focus.send_back") }}
        </BasicButton>
        <BasicButton v-else mutates :loading="busy" :disabled="locked || savingAttribute || !proposals.length || review.waiting_ai" data-testid="enrichment-focus-apply" @click="apply">
          {{ $t("enrichment.review.apply_product") }}
        </BasicButton>
      </div>
    </template>
  </div>
</template>

<script>
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { GET_Proposals, GET_ProposalRevisions, PATCH_Proposal } from "@/api/enrichment/api";
import { getReviewProduct, sendBack, getMissing, fillMissing } from "@/api/integrator/review";
import { acceptProduct } from "./acceptProduct";
import { loadFeatureSetNames } from "./FeatureSetChange.vue";
import FocusAttribute from "./FocusAttribute.vue";
import { loadSource } from "./productSource";
import { acceptOrder } from "./reviewLogic";

const MAX_PROPOSALS = 100; // the API's page limit; a product has far fewer pending proposals
export default {
  name: "EnrichmentFocusProduct",
  components: { FocusAttribute },
  props: {
    sku: { type: String, required: true },
    locked: { type: Boolean, default: false },
  },
  emits: ["done", "send-back"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { proposals: [], loading: true, busy: false, chosen: null, names: {}, source: null, review: null, missing: [], missingValues: {}, originalValues: {}, filled: false, attributeSaving: {} };
  },
  computed: {
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
    savingAttribute() {
      return Object.values(this.attributeSaving).some(Boolean);
    },
    hasLocalEdits() {
      return this.filled || this.proposals.some((row) => JSON.stringify(row.proposed_value) !== JSON.stringify(this.originalValues[row.id]));
    },
    canSendBack() {
      return !!this.review && !this.review.waiting_ai && this.review.rounds_left > 0 && (this.review.has_unsent_edits || this.hasLocalEdits);
    },
    setOptions() {
      const proposed = this.originalValues[this.setProposal?.id]?.featureset_idx;
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
      this.review = null;
      const by = { subject_ref: this.sku };
      try {
        const [pending, review, missing, names] = await Promise.all([
          GET_Proposals({ ...by, status: "pending", page_size: MAX_PROPOSALS }),
          getReviewProduct(this.sku),
          getMissing(this.sku),
          loadFeatureSetNames(),
        ]);
        this.proposals = acceptOrder(pending.data.results || []);
        this.review = review.data;
        this.missing = missing.data;
        this.originalValues = Object.fromEntries(this.proposals.map((row) => [row.id, JSON.parse(JSON.stringify(row.proposed_value))]));
        this.chosen = null;
        this.filled = false;
        this.attributeSaving = {};
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
    reviewItem(id) {
      return [...this.review.rounds].sort((a, b) => b.n - a.n).flatMap((round) => round.items).find((item) => item.proposal_id === id) || null;
    },
    async chooseSet(value) {
      if (this.busy || this.locked || this.savingAttribute) return;
      const idx = value || this.originalValues[this.setProposal.id].featureset_idx;
      this.busy = true;
      try {
        const { data } = await PATCH_Proposal(this.setProposal.id, { proposed_value: { ...this.setProposal.proposed_value, featureset_idx: idx } });
        this.replace(data);
        this.chosen = value;
        this.missing = (await getMissing(this.sku)).data;
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.busy = false;
      }
    },
    async fill(row) {
      if (this.busy || this.locked || this.savingAttribute) return;
      this.busy = true;
      try {
        const { data } = await fillMissing({ sku: this.sku, feature_idx: row.feature_idx, value: this.missingValues[row.feature_idx] ?? "" });
        this.proposals.push(data);
        this.missing = this.missing.filter((item) => item.feature_idx !== row.feature_idx);
        this.filled = true;
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
      } finally {
        this.busy = false;
      }
    },
    async sendBack(reason = "") {
      if (this.busy || this.savingAttribute || !this.canSendBack) return false;
      this.busy = true;
      try {
        await sendBack({ sku: this.sku, ...(reason ? { reason } : {}) });
        this.say("positive", this.$t("enrichment.review.focus.send_back_done"));
        this.$emit("done", { decided: true });
        return true;
      } catch (err) {
        this.say("negative", extractApiMessage(err, this.$t("notifications.error")));
        return false;
      } finally {
        this.busy = false;
      }
    },
    async hasSavedPersonEdit(id) {
      if (!this.review.has_unsent_edits) return false;
      const { data } = await GET_ProposalRevisions(id);
      return data.at(-1)?.author_kind !== "ai";
    },
    async retainPersonValues() {
      if (this.review.rounds_left !== 0) return;
      for (const proposal of this.proposals) {
        const item = this.reviewItem(proposal.id);
        const unchanged = JSON.stringify(proposal.proposed_value) === JSON.stringify(this.originalValues[proposal.id]);
        if (!item || !unchanged || JSON.stringify(proposal.proposed_value) !== JSON.stringify(item.value)) continue;
        if (await this.hasSavedPersonEdit(proposal.id)) continue;
        const { data } = await PATCH_Proposal(proposal.id, { proposed_value: item.ecom_value });
        this.replace(data);
      }
    },
    async apply() {
      if (this.busy || this.locked || this.savingAttribute || !this.review || this.review.waiting_ai || this.canSendBack || !this.proposals.length) return;
      this.busy = true;
      try {
        await this.retainPersonValues();
        const drifted = (await acceptProduct(this.sku)).drifted;
        if (drifted) {
          this.say("warning", this.$t("enrichment.drift.title"));
          await this.load();
          return;
        }
        this.say("positive", this.$t("enrichment.review.toast.accepted"));
        this.$emit("done", { decided: true });
      } catch (err) {
        const message = extractApiMessage(err, this.$t("notifications.error"));
        const status = err?.httpStatus ?? err?.response?.status;
        if (status === 409 || (status === 400 && message.toLowerCase().includes("proposal changed meanwhile"))) {
          this.say("warning", this.$t("enrichment.review.focus.decided_elsewhere"));
          await this.load();
        } else {
          this.say("negative", message);
        }
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
