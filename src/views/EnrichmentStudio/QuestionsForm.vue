<template>
  <form v-if="editable" class="questions-form flex-column gap-4" data-testid="questions-form" @submit.prevent @focusout="save">
    <p
      v-if="minimum"
      ref="minimum"
      class="questions-form__minimum type-caption m-0"
      :class="{ 'questions-form__minimum--short': short }"
      :role="short ? 'alert' : undefined"
      data-testid="questions-minimum"
    >
      {{ $t("enrichment.studio.questions.min_answers", { count: minimum }) }}
    </p>
    <FormField
      v-for="(question, index) in questions"
      :key="question.id"
      class="questions-form__question"
      :required="isRequired(question)"
      :error="errors[question.id] ? $t('enrichment.studio.questions.required') : ''"
      :data-testid="`question-${index}`"
    >
      <template #label>
        <span class="questions-form__head flex gap-3">
          <span class="questions-form__number" aria-hidden="true">{{ index + 1 }}</span>
          <span class="questions-form__text">{{ question.question }}</span>
          <StatusBadge
            v-if="isRequired(question)"
            class="questions-form__required"
            :label="$t('enrichment.studio.questions.required_badge')"
            tone="warning"
            size="sm"
            :dot="false"
          />
        </span>
      </template>
      <p v-if="question.why" class="questions-form__why">{{ question.why }}</p>
      <BasicRadioGroup
        v-if="isChoice(question) && question.choices.length <= RADIO_MAX"
        :model-value="answers[question.id] || ''"
        :name="`question-${index}`"
        :options="choiceOptions(question)"
        @update:model-value="(value) => pick(question.id, value)"
      />
      <BasicSelect
        v-else-if="isChoice(question)"
        :model-value="answers[question.id] || null"
        :options="choiceOptions(question)"
        @update:model-value="(value) => pick(question.id, value)"
      />
      <BasicTextarea
        v-else
        :model-value="answers[question.id] || ''"
        :rows="3"
        autogrow
        :placeholder="$t('enrichment.studio.questions.placeholder')"
        @update:model-value="(value) => answer(question.id, value)"
      />
    </FormField>
  </form>

  <dl v-else class="questions-form__answers m-0 flex-column gap-5" data-testid="questions-answers">
    <div v-for="(question, index) in questions" :key="question.id" class="flex-column gap-1" :data-testid="`question-${index}`">
      <dt class="questions-form__answered-question">{{ index + 1 }}. {{ question.question }}</dt>
      <dd v-if="answerOf(question)" class="questions-form__answer m-0">{{ answerOf(question) }}</dd>
      <dd v-else class="m-0 t-muted">{{ $t("enrichment.studio.questions.not_answered") }}</dd>
    </div>
  </dl>
</template>

<script>
import { PATCH_Proposal } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { answeredCount, answersShort, isChoice, missingAnswers } from "./studioLogic";

const RADIO_MAX = 5;

// The questions step: each question as its own block — number, the question, why the AI asks, "Required" where it
// applies (never with a minimum of answers: then any answers count) — with free text or a pick. Answers save by themselves when a field is left (a pick at once); Approve (the
// step panel) calls `prepare()`, which marks what is missing and saves what is not saved yet. Once approved the
// answers read as text. The form's progress goes up as `state` (answered, total, dirty, saving, saved). The artifact's
// `min_answers` (capped at the number of questions) is shown above the form and blocks Approve until it is met; a
// refused Approve scrolls that note into view (Approve sits on the step's bar, the note may be off screen).
export default {
  name: "QuestionsForm",
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["updated", "state"],
  setup() {
    return { notify: useNotifyStore(), isChoice, RADIO_MAX };
  },
  data() {
    return { answers: {}, errors: {}, short: 0, dirty: false, saving: false, saved: false, inflight: null };
  },
  computed: {
    questions() {
      return this.proposal.proposed_value?.questions || [];
    },
    editable() {
      return this.proposal.status === "pending";
    },
    minimum() {
      return Math.min(Number(this.proposal.proposed_value?.min_answers) || 0, this.questions.length);
    },
    state() {
      const { dirty, saving, saved } = this;
      return { answered: answeredCount(this.questions, this.answers), total: this.questions.length, dirty, saving, saved };
    },
  },
  watch: {
    "proposal.id": { immediate: true, handler: "reset" },
    // A saved value comes back from the server; edits made while it was on the way win.
    "proposal.proposed_value"() {
      if (!this.dirty) this.reset();
    },
    state: { immediate: true, handler(state) { this.$emit("state", state); } },
  },
  methods: {
    reset() {
      this.answers = { ...(this.proposal.proposed_value?.answers || {}) };
      this.errors = {};
      this.short = 0;
      this.dirty = false;
    },
    isRequired(question) {
      return !this.minimum && !question.optional;
    },
    answerOf(question) {
      return String(this.proposal.proposed_value?.answers?.[question.id] ?? "").trim();
    },
    choiceOptions(question) {
      return question.choices.map((choice) => ({ label: choice, value: choice }));
    },
    answer(id, value) {
      this.answers = { ...this.answers, [id]: value ?? "" };
      this.dirty = true;
      this.saved = false;
      if (String(value ?? "").trim()) delete this.errors[id];
      if (this.short) this.short = answersShort(this.questions, this.answers, this.minimum);
    },
    pick(id, value) {
      this.answer(id, value);
      this.save();
    },
    validate() {
      const missing = missingAnswers(this.questions, this.answers, this.minimum);
      this.errors = Object.fromEntries(missing.map((id) => [id, true]));
      this.short = answersShort(this.questions, this.answers, this.minimum);
      if (this.short) this.$nextTick(() => this.$refs.minimum?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
      return missing.length === 0 && this.short === 0;
    },
    // One save at a time: a later call waits until none runs (two waiting callers never both start one), then saves
    // only what is still unsaved.
    async save() {
      while (this.inflight) await this.inflight;
      if (!this.dirty) return true;
      this.inflight = this.persist();
      try {
        return await this.inflight;
      } finally {
        this.inflight = null;
      }
    },
    async persist() {
      const answers = this.answers;
      this.saving = true;
      try {
        const value = { ...this.proposal.proposed_value, answers };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: value });
        if (this.answers === answers) this.dirty = false;
        this.saved = true;
        this.$emit("updated", data);
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
      return this.save();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// More specific than FormField's own gap: 12 px between the question and its field.
.questions-form .questions-form__question {
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  gap: var(--space-3);
}
.questions-form__head {
  align-items: flex-start;
}
.questions-form__minimum {
  color: var(--text-secondary);
}
.questions-form__minimum--short {
  color: var(--negative);
  font-weight: 600;
}
.questions-form__number {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--space-6);
  height: var(--space-6);
  border-radius: var(--radius-full);
  background: var(--accent-subtle);
  color: var(--text-strong);
  font-size: var(--fs-200);
  font-weight: 600;
}
.questions-form__text {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-400);
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.questions-form__required {
  flex: none;
  margin-top: 2px;
}
.questions-form__why {
  // Under the question text, past the number circle.
  margin: 0 0 var(--space-2);
  padding-left: calc(var(--space-6) + var(--space-3));
  font-size: var(--fs-250);
  line-height: 1.5;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.questions-form__answered-question {
  font-weight: 600;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.questions-form__answer {
  color: var(--text-body);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

// A phone gives the text the width: less padding, the reason under the number instead of beside it.
@include max-tablet {
  .questions-form .questions-form__question {
    padding: var(--space-4);
  }
  .questions-form__why {
    padding-left: 0;
  }
}
</style>
