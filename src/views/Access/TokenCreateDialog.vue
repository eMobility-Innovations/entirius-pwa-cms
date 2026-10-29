<template>
  <BasicModal
    :open="open"
    :title="$t('access.tokens.create')"
    size="md"
    :persistent="busy"
    :actions="actions"
    data-testid="token-create-dialog"
    @update:open="(next) => !next && close()"
  >
    <div class="flex-column gap-4">
      <FormField :label="$t('access.tokens.name')" :error="formErrors.getFieldError('name')?.msg || ''">
        <BasicInput v-model="form.name" :maxlength="128" autocomplete="off" data-testid="token-name" />
      </FormField>
      <FormField
        v-for="group in groups"
        :key="group.key"
        :label="$t(`access.tokens.groups.${group.key}`)"
        :hint="$t(`access.tokens.groups.${group.key}_hint`)"
        :error="group.key === PUBLISHABLE ? formErrors.getFieldError('scopes')?.msg || '' : ''"
      >
        <div class="flex-column gap-2" :data-testid="`token-scopes-${group.key}`">
          <BasicCheckbox
            v-for="scope in group.scopes"
            :key="scope.key"
            :model-value="form.scopes.includes(scope.key)"
            :disabled="blocked === group.key"
            :data-testid="`token-scope-${scope.key}`"
            @update:model-value="(on) => toggleScope(scope.key, on)"
          >
            {{ scopeLabel(scope) }}
          </BasicCheckbox>
        </div>
      </FormField>
      <FormField :label="$t('access.tokens.channel')" :hint="$t('access.tokens.channel_hint')">
        <BasicSelect
          v-model="form.channel_idx"
          :options="channels"
          :placeholder="$t('access.tokens.every_channel')"
          clearable
          data-testid="token-channel"
        />
      </FormField>
      <ExpiryField v-model="form.date" v-model:pending="datePending" :error="expiryError()" />
      <p v-if="rotationDays" class="m-0 t-muted fs-200" data-testid="token-rotation-hint">
        {{ $t("access.tokens.rotation_hint", { days: rotationDays }) }}
      </p>
    </div>
  </BasicModal>
</template>

<script setup>
// New token (access plan 22): name, scopes in two groups — publishable ("reaches browsers") and secret
// ("server-to-server only"); ticking one group disables the other, a token never mixes them — an optional channel pin,
// and the expiry ("No expiry" by default for every token, D31; the hint names the catalogue's `token_rotation_days`).
// `submit` is the page's call.
import { computed, reactive, ref } from "vue";
import { t } from "@/i18n";
import ExpiryField from "./ExpiryField.vue";
import { useTokenDialog } from "./useTokenDialog";
import { PUBLISHABLE, SECRET, blockedGroup, expiryInstant, expiryIssue, scopeGroup } from "./tokens";

const props = defineProps({
  open: { type: Boolean, default: false },
  scopes: { type: Array, default: () => [] },
  channels: { type: Array, default: () => [] },
  rotationDays: { type: Number, default: 0 },
  submit: { type: Function, required: true },
});
const emit = defineEmits(["update:open"]);

const form = reactive({ name: "", scopes: [], channel_idx: null, date: "" });
const datePending = ref(false);
const close = () => emit("update:open", false);
const { formErrors, busy, expiryError, setExpiryIssue, run } = useTokenDialog(close, ["name", "scopes", "expires_at"]);

const groups = computed(() =>
  [PUBLISHABLE, SECRET].map((key) => ({ key, scopes: props.scopes.filter((s) => scopeGroup(s.key, props.scopes) === key) }))
);
const blocked = computed(() => blockedGroup(form.scopes, props.scopes));

// The catalogue's English label unless the UI language has the scope.
function scopeLabel(scope) {
  const key = `access.scopes.${scope.key}`;
  const label = t(key);
  return label === key ? scope.label : label;
}

function toggleScope(key, on) {
  form.scopes = on ? [...form.scopes, key] : form.scopes.filter((k) => k !== key);
  formErrors.clearErrors();
}

function validate() {
  formErrors.clearErrors();
  if (!form.scopes.length) formErrors.errors.scopes = { status: "error", msg: t("access.tokens.scopes_required") };
  const issue = expiryIssue({ date: form.date, pending: datePending.value });
  if (issue) setExpiryIssue(issue);
  return !formErrors.hasErrors.value;
}

function payload() {
  return {
    name: form.name,
    scopes: form.scopes,
    channel_idx: form.channel_idx || null,
    expires_at: expiryInstant(form.date),
  };
}

function save() {
  if (validate()) run(props.submit, payload());
}

const actions = computed(() => [
  { key: "cancel", role: "secondary", label: t("common.cancel"), onClick: close, disabled: busy.value },
  { key: "create", role: "primary", label: t("access.tokens.create"), onClick: save, loading: busy.value, testid: "token-create-save" },
]);
</script>
