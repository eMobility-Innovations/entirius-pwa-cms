<template>
  <div class="rule-chips flex-column gap-3" data-testid="rule-chips">
    <div v-if="collapsible" class="flex ai-ct gap-2 rg-1 flex-wrap">
      <BasicButton
        class="rule-chips__toggle"
        size="sm"
        variant="ghost"
        :icon="expanded ? 'collapse' : 'expand'"
        :aria-expanded="String(expanded)"
        data-testid="rules-toggle"
        @click="expanded = !expanded"
      >
        {{ $t("enrichment.rules.title") }}
        <CountBadge v-if="rules.length" :count="rules.length" class="ml-2" />
      </BasicButton>
    </div>
    <span v-else class="rule-chips__title">{{ $t("enrichment.rules.title") }}</span>

    <template v-if="expanded || !collapsible">
      <p v-if="rules.length" class="fs-200 t-muted m-0">{{ $t("enrichment.rules.lead") }}</p>
      <ul v-if="rules.length" class="rule-chips__list flex-column m-0">
        <li v-for="rule in rules" :key="rule" class="rule-chips__rule flex ai-ct gap-3" :data-testid="`rule-${rule}`">
          <span class="rule-chips__text">{{ rule }}</span>
          <BasicMenu
            v-if="!readonly && promoteItems.length"
            :items="promoteItems"
            :label="$t('enrichment.rules.keep_menu', { rule })"
            placement="bottom-end"
            @select="(item) => $emit('promote', { rule, target: item.key })"
          >
            <template #trigger>
              <BasicButton size="sm" variant="ghost" :title="$t('enrichment.rules.keep_menu', { rule })">
                {{ $t("enrichment.rules.keep") }}
              </BasicButton>
            </template>
          </BasicMenu>
          <IconButton
            icon="close"
            size="sm"
            mutates
            :label="`${$t('common.delete')}: ${rule}`"
            :disabled="busy"
            @click="remove(rule)"
          />
        </li>
      </ul>
      <p v-else-if="!adding" class="fs-200 t-muted m-0">{{ $t("enrichment.rules.empty") }}</p>

      <template v-if="!readonly">
        <div v-if="adding" class="flex ai-st gap-3">
          <FormField class="fg-1" :error="error ? $t(`enrichment.rules.error.${error}`, { max: maxLength, count: maxRules }) : ''">
            <BasicInput
              ref="input"
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
        <BasicButton
          v-else
          class="rule-chips__new"
          size="sm"
          variant="ghost"
          icon="add"
          mutates
          :disabled="busy"
          data-testid="rule-new"
          @click="adding = true"
        >
          {{ $t("enrichment.rules.add") }}
        </BasicButton>
      </template>
    </template>
  </div>
</template>

<script>
import { useReadonly } from "@/composables/useReadonly";
import { MAX_RULE_LENGTH, MAX_RULES, addRule } from "./correction";

// The rules of a proposal ("Never mention the price"), one per line: add, remove, and "Always" — keep one for every
// later run of this template (when the task came from one) or of this kind of AI run. `collapsible` folds them behind
// a "Rules (n)" row; "Add rule" opens the input. `change` carries the new list, `promote` { rule, target: template |
// worker }; the caller saves.
export default {
  name: "RuleChips",
  props: {
    rules: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    hasTemplate: { type: Boolean, default: false },
    hasWorker: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: true },
  },
  emits: ["change", "promote"],
  setup() {
    return { readonly: useReadonly(), maxLength: MAX_RULE_LENGTH, maxRules: MAX_RULES };
  },
  data() {
    return { draft: "", error: "", adding: false, expanded: false };
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
      this.adding = false;
    },
    remove(rule) {
      this.$emit("change", this.rules.filter((r) => r !== rule));
    },
  },
};
</script>

<style lang="scss" scoped>
.rule-chips__toggle {
  margin-left: calc(-1 * var(--space-3));
}
.rule-chips__title {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
.rule-chips__list {
  list-style: none;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}
.rule-chips__rule {
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);

  & + & {
    border-top: 1px solid var(--border-subtle);
  }
}
.rule-chips__text {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-300);
  color: var(--text-body);
  word-break: break-word;
}
.rule-chips__new {
  align-self: flex-start;
}
</style>
