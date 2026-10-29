<template>
  <PageLayout data-testid="communicator-sequences">
    <template #header>
      <PageHeader :title="$t('communicator.sequences.title')" :back="{ name: 'LeadsSettings' }" />
    </template>
    <div class="flex-column gap-8">
      <BasicCard v-for="sequence in sequences" :key="sequence.id" :title="sequence.key" gap data-testid="sequence">
        <template v-if="!sequence.is_active" #actions>
          <StatusBadge tone="neutral" size="sm" :dot="false" :label="$t('communicator.sequences.inactive')" />
        </template>
        <DataTable :columns="stepColumns" :rows="sequence.steps" row-key="id" />
        <h3 class="sequence__subtitle m-0">{{ $t("communicator.sequences.texts") }}</h3>
        <p class="t-muted m-0" data-testid="pool-random-hint">{{ $t("communicator.sequences.texts_random") }}</p>
        <TextPool :sequence-id="sequence.id" :texts="texts[sequence.id] || []" @changed="load" />
        <form class="flex ai-fe flex-wrap gap-5" @submit.prevent="addText(sequence.id)">
          <FormField class="sequence__text" :label="$t('communicator.sequences.new_text')" required>
            <BasicTextarea v-model="newText[sequence.id]" :rows="2" :maxlength="4000" data-testid="sequence-new-text" />
          </FormField>
          <BasicButton type="submit" data-testid="sequence-add-text">{{ $t("communicator.sequences.add_text") }}</BasicButton>
        </form>
        <p v-if="errors[sequence.id]" class="t-negative m-0" role="alert">{{ errors[sequence.id] }}</p>
      </BasicCard>
      <BasicCard :title="$t('communicator.sequences.add')" data-testid="sequence-add">
        <form class="flex-column gap-4" @submit.prevent="addSequence">
          <FormField class="sequence__key" :label="$t('communicator.template.key')" :error="keyError" required>
            <BasicInput v-model="draft.key" :maxlength="64" data-testid="sequence-key" />
          </FormField>
          <div v-for="(step, i) in draft.steps" :key="i" class="flex ai-fe flex-wrap gap-5" data-testid="sequence-step">
            <span class="sequence__number">#{{ i + 1 }}</span>
            <FormField :label="$t('communicator.sequences.days')" required>
              <NumberInput v-model.number="step.days_after_previous" :min="0" :max="365" />
            </FormField>
            <FormField :label="$t('communicator.template.key')" required>
              <BasicInput v-model="step.template_key" :maxlength="128" />
            </FormField>
          </div>
          <p v-if="errors.add" class="t-negative m-0" role="alert" data-testid="sequence-error">{{ errors.add }}</p>
          <div class="flex jc-fe flex-wrap gap-3">
            <BasicButton @click="draft.steps.push(emptyStep())">{{ $t("communicator.sequences.add_step") }}</BasicButton>
            <BasicButton variant="primary" type="submit" data-testid="sequence-save">{{ $t("communicator.sequences.save") }}</BasicButton>
          </div>
        </form>
      </BasicCard>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { t } from "@/i18n";
import { GET_SequenceTexts, GET_Sequences, POST_Sequence, POST_SequenceText } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import TextPool from "./TextPool.vue";

// Sequences: steps (create only — the API has no step edit) and the follow-up text pool (add, edit, remove).
const KEY_PATTERN = /^[-a-zA-Z0-9_]+$/;
const stepColumns = [
  { key: "number", label: "#", numeric: true },
  { key: "days_after_previous", label: t("communicator.sequences.days"), numeric: true },
  { key: "template_key", label: t("communicator.template.key"), width: "1fr" },
];
const sequences = ref([]);
const texts = reactive({});
const newText = reactive({});
const errors = reactive({}); // sequence id → its add-text error; `add` → the new sequence's
// On the key field itself, live after the first refused create (as SettingsPolicy): it clears while the key is fixed.
const keyChecked = ref(false);
const keyError = computed(() => (keyChecked.value && !KEY_PATTERN.test(draft.key) ? t("leads.stages.key_invalid") : ""));
const emptyStep = () => ({ days_after_previous: 3, template_key: "" });
const draft = reactive({ key: "", steps: [emptyStep()] });

async function load() {
  sequences.value = (await GET_Sequences()).data.results;
  const pools = await Promise.all(sequences.value.map((s) => GET_SequenceTexts(s.id)));
  sequences.value.forEach((s, i) => (texts[s.id] = pools[i].data.results));
}

// The error lands in the card the action came from.
async function attempt(key, call) {
  errors[key] = "";
  try {
    await call();
    await load();
    return true;
  } catch (err) {
    errors[key] = extractApiMessage(err, t("leads.review.error"));
    return false;
  }
}

async function addText(id) {
  if (await attempt(id, () => POST_SequenceText(id, { body: newText[id] }))) newText[id] = "";
}

async function addSequence() {
  keyChecked.value = true;
  if (keyError.value) {
    errors.add = ""; // the field error stands alone, no older API error next to it
    return;
  }
  const steps = draft.steps.map((step, i) => ({ ...step, number: i + 1 }));
  if (!(await attempt("add", () => POST_Sequence({ key: draft.key, steps })))) return;
  Object.assign(draft, { key: "", steps: [emptyStep()] });
  keyChecked.value = false;
}

onMounted(load);
</script>

<style scoped>
.sequence__subtitle {
  font-size: var(--fs-300);
  font-weight: 600;
}
.sequence__text {
  flex: 1 1 24rem;
}
.sequence__key {
  max-width: 24rem;
}
.sequence__number {
  line-height: var(--elem-height);
}
</style>
