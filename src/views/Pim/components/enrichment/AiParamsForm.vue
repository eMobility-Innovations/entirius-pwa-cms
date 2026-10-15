<template>
  <div class="flex-column gap-4">
    <FormField v-for="field in fields" :key="field.name" :label="labelOf(field)" :required="isRequired(field, modelValue, forRun)">
      <BasicTextarea
        v-if="field.kind === 'prompt'"
        :model-value="modelValue[field.name]"
        :rows="3"
        :placeholder="$t(isRequired(field, modelValue, forRun) ? 'enrichment.ai.prompt_placeholder_required' : 'enrichment.ai.prompt_placeholder')"
        :data-testid="`ai-task-param-${field.name}`"
        @update:model-value="(value) => set(field.name, value)"
      />
      <BasicSelect
        v-else-if="field.kind === 'enum' || field.kind === 'count'"
        :model-value="modelValue[field.name]"
        :options="field.options.map((o) => ({ label: optionLabel(field, o), value: o }))"
        :data-testid="`ai-task-param-${field.name}`"
        @update:model-value="(value) => set(field.name, value)"
      />
      <BasicSelect
        v-else-if="field.kind === 'language'"
        :model-value="modelValue[field.name]"
        :options="languageOptions"
        :data-testid="`ai-task-param-${field.name}`"
        @update:model-value="(lang) => setSource(field.name, lang)"
      />
      <BasicSelect
        v-else-if="field.kind === 'fields'"
        :model-value="modelValue[field.name]"
        :options="fieldChoices"
        multiple
        searchable
        :placeholder="fieldChoices.length ? $t('enrichment.run.fields_placeholder') : $t('enrichment.run.no_fields')"
        :disabled="!fieldChoices.length"
        :data-testid="`ai-task-param-${field.name}`"
        @update:model-value="(value) => set(field.name, value)"
      />
      <div
        v-else-if="field.kind === 'languages'"
        class="flex flex-wrap gap-5"
        role="group"
        :aria-label="labelOf(field)"
        :data-testid="`ai-task-param-${field.name}`"
      >
        <BasicCheckbox
          v-if="field.allowAll"
          :model-value="isAll(field)"
          data-testid="ai-task-all-languages"
          @update:model-value="(on) => setAll(field, on)"
        >
          {{ $t("enrichment.run.all_languages") }}
        </BasicCheckbox>
        <template v-if="!isAll(field)">
          <BasicCheckbox
            v-for="lang in languages"
            :key="lang"
            :model-value="modelValue[field.name].includes(lang)"
            :disabled="lang === sourceLanguage"
            @update:model-value="(on) => toggleLanguage(field.name, lang, on)"
          >
            {{ lang.toUpperCase() }}
          </BasicCheckbox>
        </template>
      </div>
      <BasicInput
        v-else
        :model-value="modelValue[field.name]"
        :data-testid="`ai-task-param-${field.name}`"
        @update:model-value="(value) => set(field.name, value)"
      />
      <!-- The closed select says only "2 selected": the picked fields are named under it. -->
      <p
        v-if="field.kind === 'fields' && pickedFields(field).length > 1"
        class="fs-200 t-secondary m-0 mt-2"
        data-testid="ai-task-picked-fields"
      >
        {{ pickedFields(field).join(", ") }}
      </p>
    </FormField>

    <FormField v-if="researchKeys.length" :label="$t('enrichment.run.research')">
      <div class="flex-column gap-3" data-testid="ai-task-research">
        <template v-for="key in researchKeys" :key="key">
          <BasicCheckbox
            :model-value="research.augment.includes(key)"
            :data-testid="`ai-task-research-${key}`"
            @update:model-value="(on) => toggleResearch(key, on)"
          >
            {{ $t(`enrichment.run.research_${key}`) }}
          </BasicCheckbox>
          <BasicRadioGroup
            v-if="key === 'seo_brief' && research.augment.includes(key)"
            :model-value="research.seo_scope"
            :options="scopeOptions"
            name="ai-task-seo-scope"
            data-testid="ai-task-seo-scope"
            @update:model-value="(scope) => $emit('update:research', { ...research, seo_scope: scope })"
          />
        </template>
      </div>
    </FormField>
  </div>
</template>

<script>
import { ALL_LANGUAGES, isRequired, withSource } from "./aiTaskForm";

// The parameters of one AI run, shared by the run dialog and the templates editor: the fields the worker's
// params_schema asks for (aiTaskForm.buildFields) — instructions, languages ("All languages" for a writer), the
// fields to work on from the module's catalog — and the research the run may add first (SEO research, remembered per
// product or per category). `modelValue` = the param values, `research` = { augment, seo_scope }.
export default {
  name: "AiParamsForm",
  props: {
    fields: { type: Array, default: () => [] },
    modelValue: { type: Object, default: () => ({}) },
    languages: { type: Array, default: () => [] },
    fieldChoices: { type: Array, default: () => [] },
    researchKeys: { type: Array, default: () => [] },
    research: { type: Object, default: () => ({ augment: [], seo_scope: "category" }) },
    // A run (not a template): the run-only requirements apply (aiTaskForm.isRequired).
    forRun: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "update:research"],
  computed: {
    languageOptions() {
      return this.languages.map((lang) => ({ label: lang.toUpperCase(), value: lang }));
    },
    sourceLanguage() {
      const source = this.fields.find((f) => f.kind === "language");
      return source ? this.modelValue[source.name] : "";
    },
    scopeOptions() {
      return [
        { label: this.$t("enrichment.run.scope_category"), value: "category", testid: "ai-task-seo-scope-category" },
        { label: this.$t("enrichment.run.scope_subject"), value: "subject", testid: "ai-task-seo-scope-subject" },
      ];
    },
  },
  methods: {
    isRequired,
    // An enum value in plain words when the locale names it (`enrichment.ai.options.<field>.<value>`), else as is.
    optionLabel(field, option) {
      const key = `enrichment.ai.options.${field.name}.${option}`;
      const label = this.$t(key);
      return label === key ? String(option) : label;
    },
    labelOf(field) {
      const key = `enrichment.ai.params.${field.name}`;
      const label = this.$t(key);
      return label === key ? field.title : label;
    },
    pickedFields(field) {
      const picked = this.modelValue[field.name] || [];
      return this.fieldChoices.filter((choice) => picked.includes(choice.value)).map((choice) => choice.label);
    },
    set(name, value) {
      this.$emit("update:modelValue", { ...this.modelValue, [name]: value });
    },
    setSource(name, lang) {
      this.$emit("update:modelValue", withSource(this.modelValue, this.fields, name, lang));
    },
    isAll(field) {
      return field.allowAll && this.modelValue[field.name]?.includes(ALL_LANGUAGES);
    },
    // Unticking "All languages" starts from the channel's main language.
    setAll(field, on) {
      this.set(field.name, on ? [ALL_LANGUAGES] : this.languages.slice(0, 1));
    },
    toggleLanguage(name, lang, on) {
      const rest = this.modelValue[name].filter((l) => l !== lang);
      this.set(name, on ? [...rest, lang] : rest);
    },
    toggleResearch(key, on) {
      const rest = this.research.augment.filter((k) => k !== key);
      this.$emit("update:research", { ...this.research, augment: on ? [...rest, key] : rest });
    },
  },
};
</script>
