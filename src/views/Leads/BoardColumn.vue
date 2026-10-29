<template>
  <section class="column" :data-stage="stage.key" data-testid="board-column">
    <header class="column__head">
      <strong>{{ stage.label }}</strong>
      <CountBadge :count="count" data-testid="board-column-count" />
      <StatusBadge
        v-if="rules.length"
        tone="info"
        size="sm"
        :dot="false"
        :label="$t(`leads.board.rules_${pluralKey(rules.length)}`, { count: rules.length })"
        :title="rulesTooltip"
        data-testid="board-column-rules"
      />
    </header>
    <draggable
      :list="cards"
      :disabled="readonly"
      group="board"
      item-key="id"
      class="column__cards"
      @change="onChange"
    >
      <template #item="{ element }">
        <CompanyCard :company="element" :stages="stages" @move="forwardMove" />
      </template>
    </draggable>
    <BasicButton v-if="hasMore" size="sm" data-testid="board-column-more" @click="$emit('more')">
      {{ $t("leads.board.more") }}
    </BasicButton>
  </section>
</template>

<script setup>
import { computed } from "vue";
import draggable from "vuedraggable";
import { useReadonly } from "@/composables/useReadonly";
import { pluralKey } from "@/utils/plural";
import CompanyCard from "./CompanyCard.vue";

const props = defineProps({
  stage: { type: Object, required: true },
  stages: { type: Array, default: () => [] },
  cards: { type: Array, default: () => [] },
  count: { type: Number, default: 0 },
  hasMore: { type: Boolean, default: false },
  rules: { type: Array, default: () => [] },
});
const emit = defineEmits(["move", "more"]);
// The board page's read-only mode: a viewer moves no card (the card's stage select follows it on its own).
const readonly = useReadonly();

const rulesTooltip = computed(() =>
  props.rules.map((rule) => `${rule.action} ${rule.template_key} · ${rule.contact_strategy}`).join("\n")
);

// vuedraggable already put the card into this column's list; the board confirms or snaps it back.
function onChange(event) {
  if (event.added) emit("move", event.added.element, props.stage.key, true);
}

function forwardMove(company, stageKey) {
  emit("move", company, stageKey, false);
}
</script>

<style scoped>
.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 240px;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.column__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.column__cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-height: 80px;
}
</style>
