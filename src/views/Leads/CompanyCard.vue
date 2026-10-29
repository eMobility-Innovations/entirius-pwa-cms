<template>
  <article class="card" :data-company="company.domain" data-testid="board-card">
    <!-- the name link stretches over the card (a click anywhere opens it); draggable=false leaves the drag to the card -->
    <router-link
      :to="{ name: 'LeadsThread', params: { id: company.id } }"
      class="card__name"
      draggable="false"
      data-testid="board-card-name"
    >
      {{ company.name || company.domain }}
    </router-link>
    <p class="card__domain t-muted">{{ company.domain }}</p>
    <p class="card__meta t-muted" data-testid="board-card-activity">
      {{ leadTypes.label(company.lead_type) }} · {{ lastActivity }}
    </p>
    <StatusBadge
      v-if="company.do_not_contact"
      class="card__badge"
      tone="negative"
      size="sm"
      :label="$t('leads.company.do_not_contact')"
    />
    <BasicSelect
      class="card__stage"
      :model-value="company.stage.key"
      :options="stageOptions"
      :floating-label="$t('leads.company.stage')"
      data-testid="board-card-stage"
      @update:model-value="$emit('move', company, $event)"
    />
  </article>
</template>

<script setup>
import { computed } from "vue";
import { t } from "@/i18n";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { formatDayTime } from "@/utils/leadsTime";

// Board card: the whole card opens the company through its name link; type and last activity read as
// words and one "DD.MM HH:MM" format. The stage select (floating label „Etap”) is the keyboard alternative to drag.
const leadTypes = useLeadTypesStore();
const props = defineProps({
  company: { type: Object, required: true },
  stages: { type: Array, default: () => [] },
});
defineEmits(["move"]);
const stageOptions = computed(() => props.stages.map((stage) => ({ value: stage.key, label: stage.label })));
const lastActivity = computed(() =>
  props.company.last_activity_at
    ? t("leads.board.last_activity", { time: formatDayTime(props.company.last_activity_at) })
    : t("leads.board.no_activity")
);
</script>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-base);
}
.card:hover {
  border-color: var(--accent);
}
.card__name {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  font-weight: 600;
  overflow-wrap: break-word;
}
.card__name::after {
  content: "";
  position: absolute;
  inset: 0;
}
/* Above the stretched link: the select is the card's own control. */
.card__stage {
  position: relative;
  z-index: 1;
}
.card__domain,
.card__meta {
  margin: 0;
  font-size: var(--fs-200);
  overflow-wrap: anywhere;
}
.card__badge {
  align-self: flex-start;
}
</style>
