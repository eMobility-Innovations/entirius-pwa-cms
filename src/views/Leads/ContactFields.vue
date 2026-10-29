<template>
  <div class="form-grid">
    <FormField class="form-grid__wide" :label="$t('leads.contacts.email')" :error="errorOf('email')">
      <BasicInput
        v-model.trim="form.email"
        type="email"
        inputmode="email"
        autocomplete="off"
        :readonly="emailLocked"
        :data-testid="`${testid}-email`"
      />
    </FormField>
    <FormField :label="$t('leads.add.first_name')">
      <BasicInput v-model.trim="form.first_name" :maxlength="128" autocomplete="off" :data-testid="`${testid}-first-name`" />
    </FormField>
    <FormField :label="$t('leads.add.last_name')">
      <BasicInput v-model.trim="form.last_name" :maxlength="128" autocomplete="off" :data-testid="`${testid}-last-name`" />
    </FormField>
    <template v-if="full">
      <FormField :label="$t('leads.contacts.job_title')">
        <BasicInput v-model.trim="form.job_title" :maxlength="128" autocomplete="off" :data-testid="`${testid}-job-title`" />
      </FormField>
      <FormField :label="$t('leads.contacts.phone')" :error="errorOf('phone')">
        <BasicInput
          v-model.trim="form.phone"
          :maxlength="32"
          type="tel"
          inputmode="tel"
          autocomplete="off"
          :data-testid="`${testid}-phone`"
        />
      </FormField>
      <FormField :label="$t('leads.contacts.language')" :error="errorOf('language')">
        <BasicInput
          v-model.trim="form.language"
          placeholder="pl"
          :maxlength="2"
          autocomplete="off"
          :data-testid="`${testid}-language`"
        />
      </FormField>
    </template>
    <FormField :label="$t('leads.contacts.legal_basis')" hint-level="important" :hint="$t('leads.add.basis_hint')">
      <BasicSelect v-model="form.legal_basis" :options="basisOptions" :data-testid="`${testid}-basis`" />
    </FormField>
    <FormField
      v-if="form.legal_basis === 'consent' && !consentRecorded"
      :label="$t('leads.add.consent_ref')"
      required
      :error="errorOf('consent_ref')"
    >
      <BasicInput v-model.trim="form.consent_ref" :maxlength="255" autocomplete="off" :data-testid="`${testid}-consent-ref`" />
    </FormField>
    <BasicCheckbox v-if="full" v-model="form.is_primary" class="form-grid__wide" :data-testid="`${testid}-primary`">
      {{ $t("leads.contacts.primary") }}
    </BasicCheckbox>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { t } from "@/i18n";
import { legalBasisLabel } from "@/utils/leadsLabels";

// The contact part of every contact form (add lead, Contacts tab): one set of fields and one legal-basis rule.
// Legal basis stays optional as in the import — the outreach gate refuses a contact without one; `consent` asks
// where it was given, which the API requires. `form` is the parent's reactive object, edited in place.
defineProps({
  form: { type: Object, required: true },
  errorOf: { type: Function, required: true }, // field name → message ("" when none)
  testid: { type: String, required: true },
  full: { type: Boolean, default: false }, // + job title, phone, language, primary
  emailLocked: { type: Boolean, default: false }, // the email is set once, then immutable
  consentRecorded: { type: Boolean, default: false }, // the saved basis is already consent — no new reference asked
});
const BASES = ["legitimate_interest", "consent", "contract"];
const basisOptions = computed(() => [
  { value: "", label: t("leads.add.basis_none") },
  ...BASES.map((basis) => ({ value: basis, label: legalBasisLabel(basis) })),
]);
</script>
