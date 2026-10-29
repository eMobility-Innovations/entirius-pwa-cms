<template>
  <section class="failed-units flex-column gap-3" data-testid="queue-failed-units">
    <h3 class="m-0 fs-300 fw-600 t-strong">{{ $t("enrichment.queue.failed_title") }}</h3>
    <ul class="failed-units__list flex-column gap-3 m-0 p-0 fs-300">
      <li v-for="unit in units" :key="unit.id" class="failed-units__item flex-column gap-1" :data-testid="`queue-failed-${unit.id}`">
        <span class="fw-600 t-strong">{{ productsOf(unit) }}</span>
        <span class="t-body">{{ errorOf(unit) }}</span>
        <span class="flex ai-ct gap-3 fs-200 t-muted">
          <span v-if="unit.attempts">{{ triesText(unit.attempts) }}</span>
          <BasicButton
            v-if="unit.events?.length"
            variant="ghost"
            size="sm"
            :mutates="false"
            :aria-expanded="String(isOpen(unit))"
            :data-testid="`queue-failed-details-${unit.id}`"
            @click="toggle(unit)"
          >
            {{ isOpen(unit) ? $t("enrichment.queue.hide_details") : $t("enrichment.queue.details") }}
          </BasicButton>
        </span>
        <ol v-if="isOpen(unit)" class="failed-units__events flex-column gap-1 m-0 fs-200 t-secondary">
          <li v-for="(event, i) in unit.events" :key="i">
            <span class="t-muted">{{ formatDate(event.at) }}</span>
            · {{ eventName(event.event) }}
            <span v-if="event.attempt" class="t-muted">· {{ $t("enrichment.queue.event_try", { number: event.attempt }) }}</span>
          </li>
        </ol>
      </li>
    </ul>
    <p v-if="total > units.length" class="m-0 fs-200 t-muted" data-testid="queue-failed-more">
      {{ $t("enrichment.queue.failed_more", { shown: units.length, count: total }) }}
    </p>
  </section>
</template>

<script>
import { formatDate } from "@/utils/format";
import { productName } from "./runLabel";
import { eventName, triesText, unitError } from "./workQueue";

// The failed batches of a run (the latest few the API keeps): their products, why in plain words, and on demand the
// batch's last queue events — when and what happened, never a key.
export default {
  name: "FailedUnits",
  props: {
    units: { type: Array, default: () => [] },
    // Every failed batch of the run; more than listed → "the latest N of M".
    total: { type: Number, default: 0 },
  },
  setup() {
    return { formatDate, eventName, triesText };
  },
  data() {
    return { open: {} };
  },
  methods: {
    productsOf(unit) {
      return (unit.subject_refs || []).map(productName).join(", ");
    },
    errorOf(unit) {
      return unitError(unit.error);
    },
    isOpen(unit) {
      return !!this.open[unit.id];
    },
    toggle(unit) {
      this.open = { ...this.open, [unit.id]: !this.open[unit.id] };
    },
  },
};
</script>

<style lang="scss" scoped>
.failed-units__list {
  list-style: none;
}
.failed-units__item {
  padding: var(--space-4);
  border-left: 3px solid var(--negative);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  overflow-wrap: anywhere;
}
.failed-units__events {
  padding-left: var(--space-6);
}
</style>
