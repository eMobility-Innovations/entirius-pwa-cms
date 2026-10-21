<template>
  <div class="keywords-table flex-column gap-6" data-testid="keywords-table">
    <div class="keywords-table__summary">
      <section class="keywords-table__tile keywords-table__tile--main flex-column gap-2">
        <h3 class="keywords-table__label m-0">{{ $t("enrichment.studio.keywords.primary") }}</h3>
        <p class="keywords-table__primary m-0" data-testid="keywords-primary">{{ data.primary || "—" }}</p>
      </section>
      <section class="keywords-table__tile flex-column gap-2">
        <h3 class="keywords-table__label m-0">{{ $t("enrichment.studio.keywords.secondary") }}</h3>
        <div class="flex flex-wrap gap-2" data-testid="keywords-secondary">
          <Tag v-for="phrase in data.secondary || []" :key="phrase" :label="phrase" />
          <span v-if="!(data.secondary || []).length" class="fs-300 t-muted">{{ $t("enrichment.studio.keywords.none") }}</span>
        </div>
      </section>
      <section v-if="data.intent" class="keywords-table__tile flex-column gap-2">
        <h3 class="keywords-table__label m-0">{{ $t("enrichment.studio.keywords.intent") }}</h3>
        <div><Tag :label="intentLabel(data.intent)" /></div>
      </section>
    </div>

    <StepCallout v-if="data.serp_notes" tone="info" icon="info" :title="$t('enrichment.studio.keywords.serp')">
      <p class="keywords-table__notes m-0">{{ data.serp_notes }}</p>
    </StepCallout>

    <section class="flex-column gap-3">
      <div class="flex-column gap-1">
        <h3 class="keywords-table__section m-0">{{ $t("enrichment.studio.keywords.list_title") }}</h3>
        <p v-if="editable" class="m-0 fs-250 t-secondary">
          {{ $t("enrichment.studio.keywords.pick_hint", { max: MAX_SECONDARY }) }}
        </p>
      </div>
      <ul class="keywords-table__list m-0 p-0">
        <li v-for="row in rows" :key="row.phrase" class="keywords-table__row" :data-testid="`keyword-row-${row.phrase}`">
          <div class="keywords-table__phrase flex-column gap-1">
            <p class="keywords-table__phrase-text m-0">{{ row.phrase }}</p>
            <p class="m-0 flex ai-ct flex-wrap gap-2 fs-250 t-secondary">
              <span>{{ volumeLabel(row.volume) }}</span>
              <span v-if="row.intent" aria-hidden="true">·</span>
              <span v-if="row.intent" data-testid="keyword-intent">{{ intentInline(row.intent) }}</span>
            </p>
            <div v-if="row.serp_notes">
              <BasicButton
                size="sm"
                variant="ghost"
                :icon="open[row.phrase] ? 'collapse' : 'expand'"
                :aria-expanded="String(!!open[row.phrase])"
                data-testid="keyword-serp-toggle"
                @click="toggle(row.phrase)"
              >
                {{ $t("enrichment.studio.keywords.serp_show") }}
              </BasicButton>
              <p v-if="open[row.phrase]" class="keywords-table__serp m-0">{{ row.serp_notes }}</p>
            </div>
          </div>
          <SegmentedControl
            v-if="editable"
            class="keywords-table__use"
            :model-value="role(row.phrase) || 'skip'"
            :options="useOptions(row.phrase)"
            :disabled="busy"
            :aria-label="$t('enrichment.studio.keywords.use_label', { phrase: row.phrase })"
            @update:model-value="(value) => pick(row.phrase, value)"
          />
          <StatusBadge
            v-else-if="role(row.phrase)"
            class="keywords-table__use"
            :label="roleLabel(role(row.phrase))"
            :tone="role(row.phrase) === 'primary' ? 'accent' : 'neutral'"
            size="sm"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import { PATCH_Proposal } from "@/api/enrichment/api";
import { uiLocale } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import StepCallout from "./StepCallout.vue";
import { MAX_SECONDARY, keywordRole, keywordRows, pickKeyword } from "./studioLogic";

const ROLE_KEYS = { primary: "as_primary", secondary: "as_secondary", skip: "as_skip" };

// The search-phrases step: the main and supporting phrases the AI chose and the intent, what ranks today, then every
// candidate stacked — phrase, monthly searches, intent, what ranks for it (on demand) — with Main · Supporting · Skip.
// A pick saves the step's value at once (a manual version). The main phrase changes by picking another one.
export default {
  name: "KeywordsTable",
  components: { StepCallout },
  props: {
    proposal: { type: Object, required: true },
  },
  // `busy`: a pick is saving — the step's Approve waits for it.
  emits: ["updated", "busy"],
  setup() {
    return { notify: useNotifyStore(), MAX_SECONDARY };
  },
  data() {
    return { busy: false, open: {} };
  },
  computed: {
    data() {
      return this.proposal.proposed_value?.data || {};
    },
    rows() {
      return keywordRows(this.data);
    },
    editable() {
      return this.proposal.status === "pending";
    },
    supportingFull() {
      return (this.data.secondary || []).length >= MAX_SECONDARY;
    },
  },
  watch: {
    busy(on) {
      this.$emit("busy", on);
    },
  },
  methods: {
    role(phrase) {
      return keywordRole(this.data, phrase);
    },
    roleLabel(role) {
      return this.$t(`enrichment.studio.keywords.${ROLE_KEYS[role]}`);
    },
    // The main phrase is left only by picking another one; a full supporting set takes no more.
    useOptions(phrase) {
      const role = this.role(phrase);
      const off = { primary: false, secondary: role === "primary" || (!role && this.supportingFull), skip: role === "primary" };
      return Object.keys(ROLE_KEYS).map((value) => ({
        value,
        label: this.roleLabel(value),
        disabled: off[value],
        testid: `keyword-${value}`,
      }));
    },
    intentLabel(intent) {
      if (!intent) return "—";
      const path = `enrichment.studio.keywords.intents.${intent}`;
      const label = this.$t(path);
      return label === path ? intent : label;
    },
    // In the meta line the intent is named as a property ("Intent: learning"), never a bare verb phrase that reads
    // like an action next to the "What ranks today" toggle.
    intentInline(intent) {
      const label = this.intentLabel(intent).toLocaleLowerCase(uiLocale());
      return this.$t("enrichment.studio.keywords.intent_inline", { intent: label });
    },
    volumeLabel(volume) {
      if (volume == null) return this.$t("enrichment.studio.keywords.volume_none");
      return this.$t("enrichment.studio.keywords.volume_count", { count: Number(volume).toLocaleString(uiLocale()) });
    },
    toggle(phrase) {
      this.open = { ...this.open, [phrase]: !this.open[phrase] };
    },
    async pick(phrase, role) {
      const next = pickKeyword(this.data, phrase, role);
      if (next === this.data) return;
      this.busy = true;
      try {
        const value = { ...this.proposal.proposed_value, data: next };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: value });
        this.$emit("updated", data);
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.keywords-table__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-3);
}
.keywords-table__tile {
  min-width: 0;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.keywords-table__tile--main {
  grid-column: 1 / -1;
}
.keywords-table__label {
  font-size: var(--fs-250);
  font-weight: 600;
  color: var(--text-secondary);
}
.keywords-table__primary {
  font-size: var(--fs-400);
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.keywords-table__section {
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
// The notes are written as short lines: a newline stays a line break, stray runs of spaces collapse.
.keywords-table__notes,
.keywords-table__serp {
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.keywords-table__serp {
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-250);
  color: var(--text-secondary);
}
.keywords-table__list {
  list-style: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.keywords-table__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-4);

  & + & {
    border-top: 1px solid var(--border-subtle);
  }
}
.keywords-table__phrase {
  flex: 1 1 16rem;
  min-width: 0;
}
.keywords-table__phrase-text {
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.keywords-table__use {
  flex: none;
}

// A phone stacks the control under the phrase, full width.
@include max-tablet {
  .keywords-table__summary {
    grid-template-columns: minmax(0, 1fr);
  }
  .keywords-table__use {
    flex-basis: 100%;
  }
}
</style>
