<template>
  <BasicCard :title="$t('communicator.policy.title')" data-testid="settings-policy">
    <form class="flex-column gap-4" @submit.prevent="save">
      <p class="t-muted m-0">{{ $t("communicator.policy.zone", { timezone: meta.timezone, country: meta.country }) }}</p>
      <BasicCheckbox v-model="form.business_days_only">{{ $t("communicator.policy.business_days") }}</BasicCheckbox>
      <BasicCheckbox v-model="form.spread">{{ $t("communicator.policy.spread") }}</BasicCheckbox>
      <FormField class="policy__cap" :label="$t('communicator.policy.daily_cap')" required>
        <NumberInput v-model.number="form.daily_cap" :min="0" :max="10000" data-testid="policy-cap" />
      </FormField>
      <div v-for="(window, i) in form.windows" :key="i" class="flex ai-fe flex-wrap gap-5" data-testid="policy-window">
        <FormField :label="$t('communicator.policy.window_start')" :error="timeError(window.start_time)" required>
          <BasicInput v-model="window.start_time" :placeholder="$t('communicator.policy.time_format')" data-testid="policy-window-start" />
        </FormField>
        <FormField :label="$t('communicator.policy.window_end')" :error="timeError(window.end_time)" required>
          <BasicInput v-model="window.end_time" :placeholder="$t('communicator.policy.time_format')" data-testid="policy-window-end" />
        </FormField>
        <IconButton icon="delete" variant="danger" :label="$t('communicator.policy.remove_window')" @click="form.windows.splice(i, 1)" />
      </div>
      <p v-if="error" class="t-negative m-0" role="alert" data-testid="policy-error">{{ error }}</p>
      <div class="flex jc-fe flex-wrap gap-3">
        <BasicButton @click="form.windows.push({ start_time: '08:00', end_time: '17:00' })">
          {{ $t("communicator.policy.add_window") }}
        </BasicButton>
        <BasicButton variant="primary" type="submit" data-testid="policy-save">{{ $t("communicator.template.save") }}</BasicButton>
      </div>
    </form>
  </BasicCard>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { t } from "@/i18n";
import { GET_Policy, PUT_Policy } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";

// Send policy: weekday/holiday skip, daily cap, hour windows in the channel timezone (read-only zone + country).
const notify = useNotifyStore();
const form = reactive({ business_days_only: true, spread: true, daily_cap: 10, windows: [] });
const meta = reactive({ timezone: "", country: "" });
const error = ref("");
// Set by a save the hours refused: from then on every failing start/end field carries its own error.
const timesChecked = ref(false);

const hhmm = (value) => (value || "").slice(0, 5);

// A text field, not `type="time"`: the browser's time picker follows the OS locale and may show "08:00 AM", while
// the panel reads 24 h everywhere. The format is checked here, before the save.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const badWindow = (w) => !TIME.test(w.start_time) || !TIME.test(w.end_time);
const timeError = (value) => (timesChecked.value && !TIME.test(value) ? t("communicator.policy.time_invalid") : "");

function apply(data) {
  Object.assign(form, {
    business_days_only: data.business_days_only,
    spread: data.spread,
    daily_cap: data.daily_cap,
    windows: data.windows.map((w) => ({ start_time: hhmm(w.start_time), end_time: hhmm(w.end_time) })),
  });
  Object.assign(meta, { timezone: data.timezone, country: data.country });
}

async function save() {
  error.value = "";
  timesChecked.value = form.windows.some(badWindow);
  if (timesChecked.value) return;
  try {
    const windows = form.windows.map((w, order) => ({ ...w, order }));
    apply((await PUT_Policy({ ...form, windows })).data);
    notify.spawnNotification({ msg: t("communicator.template.saved") });
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
  }
}

onMounted(async () => {
  try {
    apply((await GET_Policy()).data);
  } catch {
    // 404: the channel has no policy yet — the defaults above create one on save.
  }
});
</script>

<style scoped>
.policy__cap {
  max-width: 12rem;
}
</style>
