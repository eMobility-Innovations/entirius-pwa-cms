<template>
  <div class="rule-chips flex-column gap-3" data-testid="rule-chips">
    <span class="field-label">{{ $t("enrichment.rules.title") }}</span>
    <ul v-if="rules.length" class="rule-chips__list flex flex-wrap gap-3 m-0">
      <li v-for="rule in rules" :key="rule" class="flex ai-ct gap-1" :data-testid="`rule-${rule}`">
        <Tag :label="rule" removable mutates @remove="remove(rule)" />
        <BasicMenu
          v-if="!readonly && promoteItems.length"
          :items="promoteItems"
          :label="$t('enrichment.rules.keep_menu', { rule })"
          placement="bottom-end"
          @select="(item) => $emit('promote', { rule, target: item.key })"
        >
          <template #trigger>
            <IconButton icon="more" size="sm" variant="ghost" :label="$t('enrichment.rules.keep_menu', { rule })" />
          </template>
        </BasicMenu>
      </li>
    </ul>
    <p v-else class="fs-200 t-muted m-0">{{ $t("enrichment.rules.empty") }}</p>

    <div v-if="!readonly" class="flex ai-st gap-3">
      <FormField class="fg-1" :error="error ? $t(`enrichment.rules.error.${error}`, { max: maxLength, count: maxRules }) : ''">
        <BasicInput
          v-model="draft"
          :placeholder="$t('enrichment.rules.add_placeholder')"
          :aria-label="$t('enrichment.rules.add_placeholder')"
          :disabled="busy"
          data-testid="rule-input"
          @on-key-down="add"
        />
      </FormField>
      <BasicButton mutates :disabled="busy || !draft.trim()" data-testid="rule-add" @click="add">
        {{ $t("enrichment.rules.add") }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import { useReadonly } from "@/composables/useReadonly";
import { MAX_RULE_LENGTH, MAX_RULES, addRule } from "./correction";

// The correction rules of a proposal as chips ("Never mention the price"): add, remove, and keep one for every
// later run — of this template (when the task came from one) or of this worker. `change` carries the new list,
// `promote` { rule, target: template | worker }; the caller saves.
export default {
  name: "RuleChips",
  props: {
    rules: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    hasTemplate: { type: Boolean, default: false },
    hasWorker: { type: Boolean, default: false },
  },
  emits: ["change", "promote"],
  setup() {
    return { readonly: useReadonly(), maxLength: MAX_RULE_LENGTH, maxRules: MAX_RULES };
  },
  data() {
    return { draft: "", error: "" };
  },
  computed: {
    promoteItems() {
      return [
        this.hasTemplate && { key: "template", label: this.$t("enrichment.rules.keep_template"), testid: "rule-keep-template" },
        this.hasWorker && { key: "worker", label: this.$t("enrichment.rules.keep_worker"), testid: "rule-keep-worker" },
      ].filter(Boolean);
    },
  },
  watch: {
    draft() {
      this.error = "";
    },
  },
  methods: {
    add() {
      const { rules, error } = addRule(this.rules, this.draft);
      this.error = error;
      if (error) return;
      if (rules !== this.rules) this.$emit("change", rules);
      this.draft = "";
    },
    remove(rule) {
      this.$emit("change", this.rules.filter((r) => r !== rule));
    },
  },
};
</script>

<style lang="scss" scoped>
.rule-chips__list {
  list-style: none;
  padding: 0;
}
</style>
