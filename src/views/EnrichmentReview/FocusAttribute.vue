<template>
  <div class="focus-attribute" :data-testid="`focus-attribute-${proposal.id}`">
    <span class="focus-attribute__name">{{ proposalField(proposal) }}</span>

    <form v-if="editing" class="focus-attribute__edit" @submit.prevent="save">
      <BasicInput v-model="draft" focus-on-create data-testid="focus-attribute-input" />
      <BasicButton type="submit" size="sm" mutates :loading="saving" data-testid="focus-attribute-save">
        {{ $t("common.save") }}
      </BasicButton>
      <BasicButton size="sm" variant="ghost" :disabled="saving" @click="editing = false">
        {{ $t("common.cancel") }}
      </BasicButton>
    </form>

    <template v-else>
      <div class="focus-attribute__value">
        <TagChanges
          v-if="options"
          :proposed="proposal.proposed_value"
          :current="proposal.current_snapshot"
          :locator="proposal.target_locator"
        />
        <template v-else>
          <span data-testid="focus-attribute-value">{{ value }}</span>
          <span v-if="before" class="fs-200 t-muted ml-2" data-testid="focus-attribute-before">
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
        <BasicButton
          size="sm"
          variant="ghost"
          mutates
          :disabled="busy"
          data-testid="focus-attribute-reject"
          @click="$emit('reject', { proposal })"
        >
          {{ $t("common.reject") }}
        </BasicButton>
      </div>
    </template>
  </div>
</template>

<script>
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { PATCH_Proposal } from "@/api/enrichment/api";
import TagChanges from "./TagChanges.vue";
import { changeSummary, editableText, isOptionValue, withEditedText } from "./reviewLogic";
import { useFieldLabels } from "./useFieldLabels";

// One attribute of a product in Focus, on one line: its name, its value with the unit, Edit and Reject. It has no
// Apply of its own: Apply product takes it, after the set.
export default {
  name: "EnrichmentFocusAttribute",
  components: { TagChanges },
  props: {
    proposal: { type: Object, required: true },
    busy: { type: Boolean, default: false },
  },
  emits: ["reject", "updated"],
  setup() {
    return { notify: useNotifyStore(), ...useFieldLabels() };
  },
  data() {
    return { editing: false, saving: false, draft: "" };
  },
  computed: {
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
      return changeSummary({ ...this.proposal, proposed_value: this.proposal.current_snapshot }).excerpt;
    },
  },
  methods: {
    startEdit() {
      this.draft = editableText(this.proposal);
      this.editing = true;
    },
    async save() {
      this.saving = true;
      try {
        const proposed_value = withEditedText(this.proposal, this.draft);
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value });
        this.editing = false;
        this.$emit("updated", data);
      } catch (err) {
        const msg = extractApiMessage(err, this.$t("notifications.error"));
        this.notify.spawnNotification({ type: "negative", msg });
      } finally {
        this.saving = false;
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
  :deep(.field-label) {
    display: none;
  }
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
