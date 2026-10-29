<template>
  <PageLayout data-testid="leads-stages">
    <template #header>
      <PageHeader :title="$t('leads.stages.title')" :back="{ name: 'LeadsSettings' }" />
    </template>
    <div class="flex-column gap-8">
      <p class="t-muted m-0" data-testid="stages-help">{{ $t("leads.stages.help") }}</p>
      <draggable
        :list="stages"
        :disabled="readonly"
        item-key="id"
        handle=".stage__handle"
        class="flex-column gap-3"
        @end="saveOrder"
      >
        <template #item="{ element, index }">
          <div class="stage" :data-stage="element.key" data-testid="stage-row">
            <FontAwesomeIcon :icon="$icons.drag" class="stage__handle" />
            <label>
              <span class="visually-hidden">{{ $t("leads.stages.label") }}</span>
              <BasicInput
                v-model="element.label"
                :maxlength="128"
                data-testid="stage-label"
                @on-focusout="rename(element)"
                @on-key-down="rename(element)"
              />
            </label>
            <span class="stage__tags">
              <StatusBadge
                tone="neutral"
                size="sm"
                :dot="false"
                :label="`${element.key} · ${stageKindLabel(element.kind)}`"
                :title="$t('leads.stages.key_help')"
              />
              <StatusBadge
                v-if="rulesByStage[element.id]"
                tone="info"
                size="sm"
                :dot="false"
                :label="rulesLabel(rulesByStage[element.id])"
                :title="rulesText(rulesByStage[element.id])"
                data-testid="stage-rules"
              />
            </span>
            <div class="stage__controls">
              <IconButton mutates
                icon="moveUp"
                variant="outline"
                :label="$t('leads.stages.up')"
                :disabled="index === 0"
                @click="shift(index, -1)"
              />
              <IconButton mutates
                icon="moveDown"
                variant="outline"
                :label="$t('leads.stages.down')"
                :disabled="index === stages.length - 1"
                @click="shift(index, 1)"
              />
              <IconButton
                icon="delete"
                variant="danger"
                :label="$t('leads.stages.delete')"
                data-testid="stage-delete"
                @click="askDelete(element)"
              />
            </div>
            <p v-if="errors[element.id]" class="stage__error t-negative m-0" data-testid="stage-error">
              {{ errors[element.id] }}
            </p>
          </div>
        </template>
      </draggable>
      <form class="flex ai-st flex-wrap gap-5" data-testid="stage-add" @submit.prevent="add">
        <FormField :label="$t('leads.stages.key')" hint-level="important" :hint="$t('leads.stages.key_help')" required>
          <BasicInput v-model="draft.key" :maxlength="64" data-testid="stage-new-key" />
        </FormField>
        <FormField
          :label="$t('leads.stages.label')"
          :hint="$t('leads.stages.label_help')"
          required
          :error="errors.label || ''"
        >
          <BasicInput v-model="draft.label" :maxlength="128" data-testid="stage-new-label" />
        </FormField>
        <BasicButton class="stage__submit" variant="primary" type="submit" data-testid="stage-save">
          {{ $t("leads.stages.add") }}
        </BasicButton>
      </form>
      <p v-if="errors.add" class="t-negative m-0" data-testid="stage-add-error">{{ errors.add }}</p>
    </div>
    <!-- the test ids are the stages page object's contract (test package cms_pages/stages.py) -->
    <ConfirmDialog
      :open="Boolean(confirming)"
      :title="$t('leads.stages.delete_title')"
      :message="confirming?.message"
      :confirm-label="$t('leads.stages.delete')"
      :cancel-label="$t('leads.review.cancel')"
      tone="danger"
      data-testid="confirm-sheet"
      confirm-testid="confirm-ok"
      @confirm="remove(confirming.stage)"
      @cancel="confirming = null"
    />
  </PageLayout>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import draggable from "vuedraggable";
import { t } from "@/i18n";
import { DELETE_Stage, GET_Companies, GET_Rules, GET_Stages, PATCH_Stage, POST_Stage } from "@/api/leads/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { usePageReadonly } from "@/composables/useReadonly";
import { stageKindLabel } from "@/utils/leadsLabels";
import { pluralKey } from "@/utils/plural";

// Stages admin: order by drag or up/down (PATCH `order` per moved stage), rename inline, delete with the 409 inline (L-18).
const ORDER_STEP = 10;
const KEY_PATTERN = /^[-a-zA-Z0-9_]+$/;
const notify = useNotifyStore();
const readonly = usePageReadonly();
const stages = ref([]);
const errors = reactive({});
const draft = reactive({ key: "", label: "" });
const confirming = ref(null); // { stage, message } while the delete sheet is open
const rulesByStage = ref({});
let savedLabels = {}; // id → the label the server holds: a blur without an edit sends nothing

async function load() {
  stages.value = (await GET_Stages()).data.results;
  savedLabels = Object.fromEntries(stages.value.map((stage) => [stage.id, stage.label]));
}

// The rules the Board badges, shown here too (the stages payload carries none).
async function loadRules() {
  const rules = ((await GET_Rules()).data.results || []).filter((rule) => rule.is_active);
  rulesByStage.value = rules.reduce((acc, rule) => ({ ...acc, [rule.stage_id]: [...(acc[rule.stage_id] || []), rule] }), {});
}

const rulesText = (rules) => rules.map((rule) => `${rule.action} ${rule.template_key}`).join("\n");
const rulesLabel = (rules) => t(`leads.board.rules_${pluralKey(rules.length)}`, { count: rules.length });

// The question names how many companies the stage holds — a stage that holds any cannot be deleted. A failed
// count is never read as zero: the question says the count is unknown.
async function askDelete(stage) {
  const count = await GET_Companies({ stage: stage.key, page_size: 1 }).then(({ data }) => data.count || 0, () => null);
  confirming.value = { stage, message: t(deleteQuestionKey(count), { label: stage.label, count }) };
}

function deleteQuestionKey(count) {
  if (count === null) return "leads.stages.delete_uncounted";
  return count ? `leads.stages.delete_busy_${pluralKey(count)}` : "leads.stages.delete_confirm";
}

async function attempt(errorKey, call) {
  delete errors[errorKey];
  try {
    await call();
    return true;
  } catch (err) {
    errors[errorKey] = extractApiMessage(err, t("leads.review.error"));
    return false;
  }
}

// Renumbers in steps of 10, one PATCH at a time; the first refusal stops the run and reloads the server order.
async function saveOrder() {
  const moved = stages.value
    .map((stage, index) => ({ stage, order: index * ORDER_STEP }))
    .filter(({ stage, order }) => stage.order !== order);
  try {
    for (const { stage, order } of moved) await PATCH_Stage(stage.id, { order });
  } catch (err) {
    notify.spawnNotification({ msg: extractApiMessage(err, t("leads.stages.order_failed")), type: "negative" });
  }
  await load();
}

function shift(index, delta) {
  const [stage] = stages.value.splice(index, 1);
  stages.value.splice(index + delta, 0, stage);
  return saveOrder();
}

// The label field commits on blur and Enter, as the native change did: only a changed label is sent. It counts as
// saved while the PATCH runs (Enter then blur sends once) and is forgotten on a refusal, so blur or Enter retries —
// unless a newer label was committed meanwhile: that one stays.
async function rename(stage) {
  const previous = savedLabels[stage.id];
  const sent = stage.label;
  if (sent === previous) return;
  savedLabels[stage.id] = sent;
  if (await attempt(stage.id, () => PATCH_Stage(stage.id, { label: sent }))) return;
  if (savedLabels[stage.id] === sent) savedLabels[stage.id] = previous;
}

async function remove(stage) {
  confirming.value = null;
  if (await attempt(stage.id, () => DELETE_Stage(stage.id))) await load();
}

async function add() {
  delete errors.add;
  delete errors.label;
  if (!KEY_PATTERN.test(draft.key)) {
    errors.add = t("leads.stages.key_invalid");
    return;
  }
  if (!draft.label.trim()) {
    errors.label = t("leads.stages.label_required");
    return;
  }
  const order = Math.max(-ORDER_STEP, ...stages.value.map((stage) => stage.order)) + ORDER_STEP;
  if (await attempt("add", () => POST_Stage({ key: draft.key, label: draft.label, order }))) {
    Object.assign(draft, { key: "", label: "" });
    await load();
  }
}

onMounted(() => Promise.all([load(), loadRules().catch(() => {})]));
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

/* A grid, not a flex row: the controls line up down the list whatever the key tag is long. */
.stage {
  display: grid;
  grid-template-columns: auto minmax(8rem, 1fr) minmax(0, 20rem) auto;
  align-items: center;
  gap: var(--space-5);
}
.stage__handle {
  cursor: grab;
}
.stage__tags {
  display: flex;
  gap: var(--space-2);
  min-width: 0;
}
.stage__submit {
  margin-top: var(--space-5);
}
.stage__controls {
  display: flex;
  gap: var(--space-5);
}
.stage__error {
  grid-column: 1 / -1;
}
/* Below tablet (as in LeadTypes): name beside the handle, then the tags, then the controls, right-aligned */
@include max-tablet {
  .stage {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: var(--space-2);
  }
  .stage__tags,
  .stage__controls {
    grid-column: 2;
  }
  .stage__tags {
    flex-wrap: wrap;
  }
  .stage__controls {
    justify-content: flex-end;
  }
}
</style>
