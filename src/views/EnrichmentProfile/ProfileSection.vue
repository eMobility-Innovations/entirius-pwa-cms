<template>
  <BasicCard :title="name(`sections.${section.key}`, section.key)" :data-testid="`profile-section-${section.key}`">
    <template v-if="status" #actions>
      <StatusBadge
        v-if="usesCompany"
        :label="$t('enrichment.profile.from_company')"
        tone="neutral"
        :data-testid="`profile-section-status-${section.key}`"
      />
      <StatusBadge
        v-else
        :label="status.complete ? $t('enrichment.profile.complete') : $t('enrichment.profile.incomplete')"
        :tone="status.complete ? 'positive' : 'warning'"
        :data-testid="`profile-section-status-${section.key}`"
      />
    </template>
    <div class="flex-column gap-6">
      <!-- A channel section left empty uses the company's: show what that is, so the empty editor is no contradiction. -->
      <div v-if="usesCompany" class="profile-section__inherited flex-column gap-2" :data-testid="`profile-section-inherited-${section.key}`">
        <span class="fs-200 fw-600 t-secondary">{{ $t("enrichment.profile.inherited_label") }}</span>
        <p class="profile-section__inherited-text m-0 fs-300">{{ inheritedText }}</p>
      </div>
      <p v-if="status && !status.complete" class="m-0 fs-300 t-secondary" :data-testid="`profile-section-minimum-${section.key}`">
        {{ name(`minimum.${section.key}`, status.minimum) }}
      </p>

      <template v-if="section.kind === 'group'">
        <FormField v-for="field in section.fields" :key="field.key" :label="name(`fields.${field.key}`, field.key)" :error="fieldError(field)">
          <ProfileField
            :field="field"
            :section="field.key"
            :model-value="value[field.key]"
            :errors="errorsOf(field.key)"
            :testid="`profile-${section.key}-${field.key}`"
            @update:model-value="(v) => setField(field.key, v)"
          />
        </FormField>
      </template>
      <ProfileField
        v-else
        :field="section"
        :section="section.key"
        :model-value="modelValue"
        :errors="errors"
        :testid="`profile-${section.key}`"
        @update:model-value="(v) => $emit('update:modelValue', v)"
      />

      <ul v-if="looseErrors.length" class="profile-section__errors m-0 flex-column gap-1" role="alert" :data-testid="`profile-section-errors-${section.key}`">
        <li v-for="error in looseErrors" :key="error.path">{{ error.path }}: {{ error.message }}</li>
      </ul>
    </div>
  </BasicCard>
</template>

<script>
import ProfileField from "./ProfileField.vue";
import { errorsInside, isBlankValue, readableText, shownInline } from "./profileLogic";

const INHERITED_CUT = 600;

// One profile section as a card: its name, how complete it is (and the minimum it misses), and its fields as the
// profile's schema describes them. `errors` are the API's, keyed by the path inside the section.
export default {
  name: "ProfileSection",
  components: { ProfileField },
  props: {
    section: { type: Object, required: true },
    modelValue: { type: [Object, Array], default: null },
    status: { type: Object, default: null },
    errors: { type: Object, default: () => ({}) },
    // The whole company's value of this section, in a channel scope (null in the company scope).
    inherited: { type: [Object, Array, String], default: null },
  },
  emits: ["update:modelValue"],
  computed: {
    value() {
      return this.modelValue || {};
    },
    usesCompany() {
      return this.inherited != null && isBlankValue(this.modelValue) && !isBlankValue(this.inherited);
    },
    inheritedText() {
      const text = readableText(this.inherited, { label: (key) => this.name(`fields.${key}`, this.name(`columns.${key}`, key)) });
      return text.length > INHERITED_CUT ? `${text.slice(0, INHERITED_CUT - 1).trimEnd()}…` : text;
    },
    // Errors no control shows: a chip, a nested key, a key the form has no field for.
    looseErrors() {
      return Object.entries(this.errors)
        .filter(([path]) => !shownInline(this.section, path))
        .map(([path, message]) => ({ path: path || this.section.key, message }));
    },
  },
  methods: {
    name(path, fallback) {
      const key = `enrichment.profile.${path}`;
      const text = this.$t(key);
      return text === key ? fallback : text;
    },
    errorsOf(key) {
      return errorsInside(this.errors, key);
    },
    fieldError(field) {
      return this.errors[field.key] || "";
    },
    setField(key, fieldValue) {
      this.$emit("update:modelValue", { ...this.value, [key]: fieldValue });
    },
  },
};
</script>

<style lang="scss" scoped>
.profile-section__inherited {
  padding: var(--space-4);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
}
.profile-section__inherited-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--text-body);
}
.profile-section__errors {
  padding-left: var(--space-5);
  font-size: var(--fs-300);
  color: var(--negative);
}
</style>
