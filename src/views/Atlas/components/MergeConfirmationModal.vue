<template>
  <BasicModal
    :open="true"
    size="sm"
    @update:open="(open) => open || onCancel()"
  >
    <template #title>
      <h2 class="t-warning">
        <FontAwesomeIcon :icon="$icons.warning" class="mr-2" />
        {{ $t("atlas.duplicates.merge_modal.title") }}
      </h2>
    </template>
    <div class="merge-confirm__body">
      <p class="t-body">
        {{ descriptionText }}
      </p>
      <FormField :label="$t('atlas.duplicates.merge_modal.reason_label')">
        <BasicTextarea
          v-model="reason"
          :maxlength="512"
          :placeholder="$t('atlas.duplicates.merge_modal.reason_placeholder')"
          rows="3"
          :disabled="loading"
          data-test="merge-confirm-reason"
        />
      </FormField>
      <p
        v-if="reasonTooShort"
        class="merge-confirm__hint t-muted fs-200"
      >
        {{ $t("atlas.duplicates.merge_modal.reason_label") }}
      </p>
      <div v-if="errorText" class="merge-confirm__error t-negative fs-200">
        <FontAwesomeIcon :icon="$icons.warning" class="mr-2" />
        {{ errorText }}
      </div>
    </div>
    <template #footer>
      <div class="merge-confirm__actions">
        <BasicButton
          variant="secondary"
          :disabled="loading"
          data-test="merge-confirm-cancel"
          @click="onCancel"
        >
          {{ $t('atlas.duplicates.merge_modal.cancel') }}
        </BasicButton>
        <BasicButton mutates
          variant="primary"
          :disabled="!canConfirm"
          data-test="merge-confirm-submit"
          @click="onConfirm"
        >
          {{ $t('atlas.duplicates.merge_modal.confirm') }}
        </BasicButton>
      </div>
    </template>
  </BasicModal>
</template>

<script>
import { POST_MergeByEan } from "@/api/atlas/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "MergeConfirmationModal",
  props: {
    winnerSku: { type: String, required: true },
    loserSku: { type: String, required: true },
  },
  emits: ["confirmed", "cancelled"],
  data() {
    return {
      reason: "",
      loading: false,
      errorText: "",
    };
  },
  computed: {
    descriptionText() {
      return this.$t("atlas.duplicates.merge_modal.description", {
        winner: this.winnerSku,
        loser: this.loserSku,
      });
    },
    trimmedReason() {
      return (this.reason || "").trim();
    },
    reasonTooShort() {
      return this.trimmedReason.length > 0 && this.trimmedReason.length < 3;
    },
    canConfirm() {
      return !this.loading && this.trimmedReason.length >= 3;
    },
  },
  methods: {
    onCancel() {
      if (this.loading) return;
      this.$emit("cancelled");
    },
    async onConfirm() {
      if (!this.canConfirm) return;
      this.loading = true;
      this.errorText = "";
      try {
        const { data } = await POST_MergeByEan({
          winner_sku: this.winnerSku,
          loser_sku: this.loserSku,
          reason: this.trimmedReason,
        });
        this.$emit("confirmed", data);
      } catch (err) {
        const detail = extractApiMessage(err, err?.message || "unknown error");
        this.errorText = this.$t("atlas.duplicates.merge_modal.failed", {
          error: detail,
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.merge-confirm__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.merge-confirm__error {
  padding: var(--space-5);
  border-radius: var(--radius-base);
  background: var(--negative-subtle);
  border-left: 3px solid var(--negative);
}
.merge-confirm__hint {
  margin-top: calc(-1 * var(--space-2));
}
.merge-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-5);
  margin-top: var(--space-5);
}
</style>
