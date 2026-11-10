<template>
  <div class="focus-attribute" :data-testid="`focus-attribute-${proposal.id}`">
    <span class="focus-attribute__name">{{ proposalField(proposal) }}</span>

    <!-- Saves on Enter or when the field loses focus; Esc leaves it unchanged. -->
    <form v-if="editing" class="focus-attribute__edit" @submit.prevent="save" @keydown.esc.prevent="cancelEdit">
      <BasicInput
        v-model="draft"
        :disabled="busy || saving"
        focus-on-create
        data-testid="focus-attribute-input"
        @onFocusout="save"
      />
    </form>

    <template v-else>
      <div class="focus-attribute__value">
        <template v-if="comparison">
          <div data-testid="focus-attribute-ai">
            <span class="field-label">{{
              $t("enrichment.review.focus.ai_label")
            }}</span>
            {{ displayValue(comparison.ai_value) }}
          </div>
          <div data-testid="focus-attribute-ecom">
            <span class="field-label">{{
              $t("enrichment.review.focus.ecom_label")
            }}</span>
            {{ displayValue(comparison.ecom_value) }}
          </div>
        </template>
        <TagChanges
          v-else-if="options"
          :proposed="proposal.proposed_value"
          :current="proposal.current_snapshot"
          :locator="proposal.target_locator"
        />
        <template v-else>
          <span data-testid="focus-attribute-value">{{ value }}</span>
          <span
            v-if="before"
            class="fs-200 t-muted ml-2"
            data-testid="focus-attribute-before"
          >
            {{ $t("enrichment.review.focus.was", { value: before }) }}
          </span>
        </template>
      </div>
      <div class="focus-attribute__actions">
        <BasicButton
          v-if="canEdit"
          size="sm"
          variant="ghost"
          mutates
          :disabled="busy"
          data-testid="focus-attribute-edit"
          @click="startEdit"
        >
          {{ $t("common.edit") }}
        </BasicButton>
      </div>
    </template>
    <p
      v-if="reviewItem?.verdict"
      class="focus-attribute__verdict m-0 fs-200 t-secondary"
      data-testid="focus-attribute-verdict"
    >
      {{ $t(`enrichment.review.focus.verdict_${reviewItem.verdict}`)
      }}<span v-if="reviewItem.rationale">: {{ reviewItem.rationale }}</span>
    </p>
  </div>
</template>

<script>
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { GET_ProposalRevisions, PATCH_Proposal } from "@/api/enrichment/api";
import TagChanges from "./TagChanges.vue";
import {
  changeSummary,
  editableText,
  isOptionValue,
  withEditedText,
} from "./reviewLogic";
import { useFieldLabels } from "./useFieldLabels";

// Attribute decisions belong to the product; this row keeps the AI and human values visible.
export default {
  name: "EnrichmentFocusAttribute",
  components: { TagChanges },
  props: {
    proposal: { type: Object, required: true },
    busy: { type: Boolean, default: false },
    reviewItem: { type: Object, default: null },
  },
  emits: ["updated", "saving"],
  setup() {
    return { notify: useNotifyStore(), ...useFieldLabels() };
  },
  data() {
    return {
      editing: false,
      saving: false,
      draft: "",
      revisions: [],
      savedValue: null,
    };
  },
  watch: {
    "proposal.id": { immediate: true, handler: "loadRevisions" },
  },
  computed: {
    comparison() {
      const latest = this.revisions.at(-1);
      const ai = [...this.revisions]
        .reverse()
        .find((revision) => revision.author_kind === "ai");
      const unsent =
        this.savedValue !== null || (latest && latest.author_kind !== "ai");
      const values = unsent
        ? {
            ai_value: ai?.value ?? this.reviewItem?.ai_value ?? null,
            ecom_value: this.savedValue ?? latest.value,
          }
        : this.reviewItem;
      return values &&
        JSON.stringify(values.ai_value) !== JSON.stringify(values.ecom_value)
        ? values
        : null;
    },
    options() {
      return isOptionValue(this.proposal.proposed_value);
    },
    canEdit() {
      return editableText(this.proposal) !== null;
    },
    summary() {
      return changeSummary(this.proposal);
    },
    value() {
      return this.summary.excerpt;
    },
    before() {
      if (this.summary.state !== "changed") return "";
      return changeSummary({
        ...this.proposal,
        proposed_value: this.proposal.current_snapshot,
      }).excerpt;
    },
  },
  methods: {
    async loadRevisions() {
      this.savedValue = null;
      this.revisions = [];
      const id = this.proposal.id;
      try {
        const { data } = await GET_ProposalRevisions(id);
        if (this.proposal.id === id) this.revisions = data;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    displayValue(proposed_value) {
      if (isOptionValue(proposed_value))
        return (proposed_value.options || [proposed_value.option]).join(", ");
      return changeSummary({ ...this.proposal, proposed_value }).excerpt || "—";
    },
    startEdit() {
      this.draft = editableText(this.proposal);
      this.editing = true;
    },
    cancelEdit() {
      this.editing = false;
    },
    async save() {
      if (!this.editing || this.busy || this.saving) return;
      if (this.draft === editableText(this.proposal)) {
        this.editing = false;
        return;
      }
      this.saving = true;
      this.$emit("saving", true);
      try {
        const proposed_value = withEditedText(this.proposal, this.draft);
        const { data } = await PATCH_Proposal(this.proposal.id, {
          proposed_value,
        });
        this.savedValue = proposed_value;
        this.editing = false;
        this.$emit("updated", data);
      } catch (err) {
        const msg = extractApiMessage(err, this.$t("notifications.error"));
        this.notify.spawnNotification({ type: "negative", msg });
      } finally {
        this.saving = false;
        this.$emit("saving", false);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.focus-attribute {
  display: grid;
  grid-template-columns: minmax(120px, 200px) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: 0;
  }
}
.focus-attribute__name {
  font-size: var(--fs-300);
  color: var(--text-secondary);
}
.focus-attribute__value {
  min-width: 0;
  font-weight: 600;
  color: var(--text-strong);
  overflow-wrap: anywhere;

  // The row names the attribute already: the chips need no "Added" heading of their own.
  :deep(.tag-changes .field-label) {
    display: none;
  }
}
.focus-attribute__verdict {
  grid-column: 2 / -1;
}
.focus-attribute__actions {
  display: flex;
  gap: var(--space-1);
}
.focus-attribute__edit {
  grid-column: 2 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
