<template>
  <form class="questions-form flex-column gap-6" data-testid="questions-form" @submit.prevent>
    <p class="m-0 t-secondary">{{ $t("enrichment.studio.questions.intro") }}</p>
    <FormField
      v-for="(question, index) in questions"
      :key="question.id"
      :label="`${index + 1}. ${question.question}`"
      :hint="question.why"
      :required="!question.optional"
      :error="errors[question.id] ? $t('enrichment.studio.questions.required') : ''"
      :data-testid="`question-${index}`"
    >
      <BasicRadioGroup
        v-if="isChoice(question) && question.choices.length <= RADIO_MAX"
        :model-value="answers[question.id] || ''"
        :name="`question-${index}`"
        :options="choiceOptions(question)"
        :disabled="!editable"
        @update:model-value="(value) => answer(question.id, value)"
      />
      <BasicSelect
        v-else-if="isChoice(question)"
        :model-value="answers[question.id] || null"
        :options="choiceOptions(question)"
        :disabled="!editable"
        @update:model-value="(value) => answer(question.id, value)"
      />
      <BasicTextarea
        v-else
        :model-value="answers[question.id] || ''"
        :rows="2"
        :disabled="!editable"
        @update:model-value="(value) => answer(question.id, value)"
      />
    </FormField>
    <div v-if="editable" class="flex ai-ct jc-fe gap-3">
      <span v-if="dirty" class="fs-200 t-secondary" data-testid="answers-dirty">{{ $t("enrichment.studio.questions.unsaved") }}</span>
      <BasicButton mutates :disabled="!dirty || saving" :loading="saving" data-testid="answers-save" @click="save">
        {{ $t("common.save") }}
      </BasicButton>
    </div>
  </form>
</template>

<script>
import { PATCH_Proposal } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { isChoice, missingAnswers } from "./studioLogic";

const RADIO_MAX = 5;

// The questions step: every question with why it is asked (the hint) and whether it must be answered; free text or a
// pick. Save keeps the answers on the step; Approve (the step panel) calls `prepare()`, which marks what is missing
// and saves unsaved answers first.
export default {
  name: "QuestionsForm",
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["updated"],
  setup() {
    return { notify: useNotifyStore(), isChoice, RADIO_MAX };
  },
  data() {
    return { answers: {}, errors: {}, dirty: false, saving: false };
  },
  computed: {
    questions() {
      return this.proposal.proposed_value?.questions || [];
    },
    editable() {
      return this.proposal.status === "pending";
    },
  },
  watch: {
    "proposal.proposed_value": { immediate: true, handler: "reset" },
  },
  methods: {
    reset() {
      this.answers = { ...(this.proposal.proposed_value?.answers || {}) };
      this.errors = {};
      this.dirty = false;
    },
    choiceOptions(question) {
      return question.choices.map((choice) => ({ label: choice, value: choice }));
    },
    answer(id, value) {
      this.answers = { ...this.answers, [id]: value ?? "" };
      this.dirty = true;
      if (String(value ?? "").trim()) delete this.errors[id];
    },
    validate() {
      const missing = missingAnswers(this.questions, this.answers);
      this.errors = Object.fromEntries(missing.map((id) => [id, true]));
      return missing.length === 0;
    },
    async save() {
      this.saving = true;
      try {
        const value = { ...this.proposal.proposed_value, answers: this.answers };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: value });
        this.$emit("updated", data);
        this.dirty = false;
        return true;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
        return false;
      } finally {
        this.saving = false;
      }
    },
    // Before an approval: every required answer given and saved.
    async prepare() {
      if (!this.validate()) return false;
      return this.dirty ? this.save() : true;
    },
  },
};
</script>
