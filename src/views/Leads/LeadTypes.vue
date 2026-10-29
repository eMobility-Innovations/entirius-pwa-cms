<template>
  <PageLayout data-testid="leads-lead-types">
    <template #header>
      <PageHeader :title="$t('leads.lead_types.title')" :back="{ name: 'LeadsSettings' }" />
    </template>
    <div class="lead-types flex-column gap-8">
      <p class="t-muted m-0">{{ $t("leads.lead_types.help") }}</p>
      <div class="flex-column gap-3">
        <div
          v-for="(type, index) in types"
          :key="type.id"
          class="lead-type"
          :data-code="type.code"
          data-testid="lead-type-row"
        >
          <label class="lead-type__label">
            <span class="visually-hidden">{{ $t("leads.lead_types.label") }}</span>
            <BasicInput
              v-model="type.label"
              :maxlength="128"
              data-testid="lead-type-label"
              @on-focusout="rename(type)"
              @on-key-down="rename(type)"
            />
          </label>
          <StatusBadge class="lead-type__code" tone="neutral" size="sm" :dot="false" :label="type.code" />
          <BasicSwitch
            :model-value="type.is_active"
            :label="$t('leads.lead_types.active')"
            data-testid="lead-type-active"
            @update:model-value="save(type, { is_active: $event })"
          />
          <div class="lead-type__controls">
            <IconButton mutates
              icon="moveUp"
              variant="outline"
              :label="$t('leads.stages.up')"
              :disabled="shifting || index === 0"
              @click="shift(index, -1)"
            />
            <IconButton mutates
              icon="moveDown"
              variant="outline"
              :label="$t('leads.stages.down')"
              :disabled="shifting || index === types.length - 1"
              @click="shift(index, 1)"
            />
            <IconButton mutates
              icon="delete"
              variant="danger"
              :label="$t('leads.stages.delete')"
              data-testid="lead-type-delete"
              @click="remove(type)"
            />
          </div>
          <p v-if="errors[type.id]" class="lead-type__error t-negative m-0" data-testid="lead-type-error">
            {{ errors[type.id] }}
          </p>
        </div>
      </div>
      <p v-if="errors.order" class="t-negative m-0" data-testid="lead-type-order-error">{{ errors.order }}</p>
      <form class="flex ai-st flex-wrap gap-5" data-testid="lead-type-add" @submit.prevent="add">
        <FormField :label="$t('leads.lead_types.code')" hint-level="important" :hint="$t('leads.lead_types.code_help')" required>
          <BasicInput
            :model-value="draft.code"
            :maxlength="32"
            data-testid="lead-type-new-code"
            @update:model-value="draft.code = $event.toUpperCase()"
          />
        </FormField>
        <FormField :label="$t('leads.lead_types.label')" required :error="errors.label || ''">
          <BasicInput v-model="draft.label" :maxlength="128" data-testid="lead-type-new-label" />
        </FormField>
        <BasicButton class="lead-type__submit" variant="primary" type="submit" data-testid="lead-type-save">
          {{ $t("leads.lead_types.add") }}
        </BasicButton>
      </form>
      <p v-if="errors.add" class="t-negative m-0" data-testid="lead-type-add-error">{{ errors.add }}</p>
    </div>
  </PageLayout>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { t } from "@/i18n";
import { DELETE_LeadType, GET_LeadTypes, PATCH_LeadType, POST_LeadType } from "@/api/leads/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useLeadTypesStore } from "@/stores/leadTypes";

// Leads → Settings → Lead types (UX-004), the Stages pattern: rename inline, reorder by PATCH `order` per moved
// row, deactivate (a type in use stays on its companies), delete refused inline while companies carry the code.
// The code is fixed after create — companies and template audiences hold it.
const ORDER_STEP = 10;
const CODE_PATTERN = /^[A-Za-z0-9_]+$/;
const store = useLeadTypesStore();
const types = ref([]);
const errors = reactive({});
const draft = reactive({ code: "", label: "" });
const shifting = ref(false); // one move at a time: the PATCHes of a move run one after another
let savedLabels = {}; // id → the label the server holds: a blur without an edit sends nothing

async function load() {
  types.value = (await GET_LeadTypes()).data.results || [];
  savedLabels = Object.fromEntries(types.value.map((type) => [type.id, type.label]));
  store.load(true); // the chips, selects and labels elsewhere read the new list
}

async function attempt(key, call) {
  delete errors[key];
  try {
    await call();
    return true;
  } catch (err) {
    errors[key] = extractApiMessage(err, t("leads.review.error"));
    return false;
  }
}

async function save(type, body) {
  if (await attempt(type.id, () => PATCH_LeadType(type.id, body))) await load();
}

// The label field commits on blur and Enter, as the native change did: only a changed label is sent. It counts as
// saved while the PATCH runs (Enter then blur sends once) and is forgotten on a refusal, so blur or Enter retries —
// unless a newer label was committed meanwhile: that one stays.
async function rename(type) {
  const previous = savedLabels[type.id];
  const sent = type.label;
  if (sent === previous) return;
  savedLabels[type.id] = sent;
  if (await attempt(type.id, () => PATCH_LeadType(type.id, { label: sent }))) await load();
  else if (savedLabels[type.id] === sent) savedLabels[type.id] = previous;
}

async function shift(index, delta) {
  if (shifting.value) return;
  shifting.value = true;
  const [moved] = types.value.splice(index, 1);
  types.value.splice(index + delta, 0, moved);
  const changed = types.value.map((type, i) => ({ type, order: i * ORDER_STEP })).filter(({ type, order }) => type.order !== order);
  await attempt("order", async () => {
    for (const { type, order } of changed) await PATCH_LeadType(type.id, { order });
  });
  try {
    await load();
  } finally {
    shifting.value = false;
  }
}

async function remove(type) {
  if (await attempt(type.id, () => DELETE_LeadType(type.id))) await load();
}

async function add() {
  delete errors.add;
  delete errors.label;
  if (!CODE_PATTERN.test(draft.code)) {
    errors.add = t("leads.lead_types.code_invalid");
    return;
  }
  if (!draft.label.trim()) {
    errors.label = t("leads.lead_types.label_required");
    return;
  }
  const order = Math.max(-ORDER_STEP, ...types.value.map((type) => type.order)) + ORDER_STEP;
  if (await attempt("add", () => POST_LeadType({ code: draft.code, label: draft.label, order }))) {
    Object.assign(draft, { code: "", label: "" });
    await load();
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.lead-types {
  max-width: 900px;
}
.lead-type {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 12rem auto auto;
  align-items: center;
  gap: var(--space-5);
}
.lead-type__controls {
  display: flex;
  gap: var(--space-2);
}
.lead-type__error {
  grid-column: 1 / -1;
}
.lead-type__submit {
  margin-top: var(--space-5);
}
/* The code column has one width down the list, so the fields and controls line up whatever the code is long. */
.lead-type__code {
  justify-self: start;
}
/* Below tablet: label on its own line, the rest wraps below it */
@include max-tablet {
  .lead-type {
    grid-template-columns: 1fr auto;
  }
  .lead-type__label {
    grid-column: 1 / -1;
  }
}
</style>
