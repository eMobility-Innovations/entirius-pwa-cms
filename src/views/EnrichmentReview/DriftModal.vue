<template>
  <BasicModal
    :open="visible"
    :title="$t('enrichment.drift.title')"
    size="lg"
    :actions="actions"
    @close="$emit('close')"
  >
    <div class="flex-column gap-4" data-testid="enrichment-drift-modal">
      <p class="fs-200 t-secondary">
        <FontAwesomeIcon :icon="$icons.warning" class="t-warning" />
        {{ $t("enrichment.drift.intro") }}
      </p>
      <DiffRenderer
        v-if="active"
        :target-kind="active.target_kind"
        :proposed="active.proposed_value"
        :current="active.current_snapshot"
        :proposal-id="active.id"
        :subject-label="active.subject_label || active.subject_ref"
        :locator="active.target_locator || {}"
      />
      <FormField :label="$t('enrichment.review.reject_reason')">
        <BasicTextarea
          v-model="reason"
          :maxlength="512"
          :rows="2"
          :placeholder="$t('enrichment.review.reject_reason_placeholder')"
          data-testid="enrichment-drift-reason"
        />
      </FormField>
    </div>
  </BasicModal>
</template>

<script>
import DiffRenderer from "./DiffRenderer.vue";

export default {
  name: "EnrichmentDriftModal",
  components: { DiffRenderer },
  props: {
    visible: { type: Boolean, default: false },
    // The proposal handed in by the parent IS the accept response — when status
    // flipped to `drifted` the bus already refreshed `current_snapshot` to the
    // live value, so there is nothing fresher to fetch.
    proposal: { type: Object, default: null },
    busy: { type: Boolean, default: false },
  },
  emits: ["confirm", "reject", "close"],
  data() {
    return { reason: "" };
  },
  computed: {
    active() {
      return this.proposal;
    },
    actions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), disabled: this.busy,
          onClick: () => this.$emit("close") },
        { key: "reject", role: "danger", label: this.$t("common.reject"), disabled: this.busy,
          testid: "enrichment-drift-reject", onClick: () => this.$emit("reject", { proposal: this.active, reason: this.reason }) },
        { key: "confirm", role: "primary", label: this.$t("enrichment.drift.confirm"), disabled: this.busy,
          testid: "enrichment-drift-confirm", onClick: () => this.$emit("confirm", this.active) },
      ];
    },
  },
  watch: {
    visible(open) {
      if (open) this.reason = "";
    },
  },
};
</script>
