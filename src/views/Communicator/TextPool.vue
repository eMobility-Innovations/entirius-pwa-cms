<template>
  <div class="pool" data-testid="text-pool">
    <ul class="pool__list">
      <li
        v-for="text in texts"
        :key="text.id"
        class="pool__item"
        :class="{ 'pool__item--inactive': !text.is_active }"
        :data-text="text.id"
        data-testid="pool-text"
      >
        <form v-if="editing === text.id" class="pool__edit" @submit.prevent="saveEdit(text)">
          <FormField :label="$t('communicator.pool.text')" required>
            <BasicTextarea v-model="draft" :rows="3" :maxlength="4000" data-testid="pool-text-input" />
          </FormField>
          <div class="flex jc-fe flex-wrap gap-3">
            <BasicButton data-testid="pool-text-cancel" @click="editing = null">{{ $t("common.cancel") }}</BasicButton>
            <BasicButton variant="primary" type="submit" :disabled="!draft.trim()" data-testid="pool-text-save">
              {{ $t("communicator.pool.save") }}
            </BasicButton>
          </div>
        </form>
        <template v-else>
          <p class="pool__body m-0" data-testid="pool-text-body">{{ text.body }}</p>
          <template v-if="text.is_active">
            <IconButton icon="edit" variant="outline" :label="$t('communicator.pool.edit')" data-testid="pool-text-edit" @click="startEdit(text)" />
            <IconButton icon="delete" variant="danger" :label="$t('communicator.pool.remove')" data-testid="pool-text-remove" @click="confirming = text" />
          </template>
          <template v-else>
            <StatusBadge tone="neutral" size="sm" :dot="false" :label="$t('communicator.pool.inactive')" />
            <BasicButton mutates size="sm" data-testid="pool-text-restore" @click="restore(text)">{{ $t("communicator.pool.restore") }}</BasicButton>
          </template>
        </template>
      </li>
    </ul>
    <p v-if="status" class="t-muted m-0" role="status" data-testid="pool-status">{{ status }}</p>
    <p v-if="error" class="t-negative m-0" role="alert" data-testid="pool-error">{{ error }}</p>
    <ConfirmDialog
      :open="Boolean(confirming)"
      :title="$t('communicator.pool.remove_title')"
      :message="confirming?.body"
      :confirm-label="$t('communicator.pool.remove')"
      :cancel-label="$t('common.cancel')"
      tone="danger"
      @confirm="remove(confirming)"
      @cancel="confirming = null"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { t } from "@/i18n";
import { DELETE_SequenceText, PATCH_SequenceText } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";

// The follow-up text pool of one sequence (UX-005, C-33): a row is the text with its edit and remove squares on the
// right; edit changes future follow-ups only (sent mail keeps its body), remove asks first. A text a thread already got is deactivated, not deleted (its usage history
// keeps a thread from getting it twice): it stays listed, dimmed, with Restore.
const props = defineProps({
  sequenceId: { type: Number, required: true },
  texts: { type: Array, required: true },
});
const emit = defineEmits(["changed"]);

const editing = ref(null);
const draft = ref("");
const confirming = ref(null);
const status = ref("");
const error = ref("");

function startEdit(text) {
  editing.value = text.id;
  draft.value = text.body;
}

async function run(call, done) {
  error.value = "";
  status.value = "";
  try {
    const response = await call();
    status.value = done(response);
    emit("changed");
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
  }
}

const saveEdit = (text) =>
  run(
    () => PATCH_SequenceText(props.sequenceId, text.id, { body: draft.value }),
    () => {
      editing.value = null;
      return t("communicator.pool.saved");
    }
  );

const restore = (text) =>
  run(() => PATCH_SequenceText(props.sequenceId, text.id, { is_active: true }), () => t("communicator.pool.restored"));

// 204 = the text was never used and is gone; 200 = it was used, so the API deactivated it instead.
function remove(text) {
  confirming.value = null;
  return run(
    () => DELETE_SequenceText(props.sequenceId, text.id),
    (response) => t(response?.status === 204 ? "communicator.pool.removed" : "communicator.pool.deactivated")
  );
}
</script>

<style scoped>
.pool__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.pool__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.pool__item--inactive .pool__body {
  opacity: 0.5;
}
.pool__body {
  flex: 1 1 16rem;
  color: var(--text-body);
  white-space: pre-line;
}
.pool__edit {
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
