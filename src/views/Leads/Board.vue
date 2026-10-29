<template>
  <PageLayout data-testid="leads-board">
    <template #header>
      <PageHeader :title="$t('leads.board.title')" />
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-5 rg-3">
        <!-- the label names the field and carries the test id: a page object fills it through the label -->
        <label class="board__search" data-testid="board-search">
          <span class="visually-hidden">{{ $t("leads.board.search") }}</span>
          <BasicInput
            v-model="search"
            type="search"
            icon="search"
            :placeholder="$t('leads.board.search')"
            @on-key-down="load()"
          />
        </label>
        <div class="filter-chip-row" role="group" :aria-label="$t('leads.board.filters')">
          <FilterChip
            v-for="type in leadTypes.active"
            :key="type.code"
            :label="type.label"
            :active="filters.lead_type === type.code"
            :data-testid="`board-filter-type-${type.code}`"
            @click="setFilter('lead_type', filters.lead_type === type.code ? '' : type.code)"
          />
          <FilterChip
            :label="$t('leads.board.has_reply')"
            :active="filters.has_reply"
            data-testid="board-filter-reply"
            @click="setFilter('has_reply', !filters.has_reply)"
          />
          <FilterChip
            :label="$t('leads.company.do_not_contact')"
            :active="filters.do_not_contact"
            data-testid="board-filter-dnc"
            @click="setFilter('do_not_contact', !filters.do_not_contact)"
          />
        </div>
        <!-- columns past the right edge: announced at the toolbar's end, never over a column header (C-17) -->
        <BasicButton v-if="moreRight" class="ml-auto" data-testid="board-scroll-right" @click="scrollRight">
          {{ $t("leads.board.more_stages") }}
        </BasicButton>
      </div>
    </template>
    <div ref="boardEl" class="board" data-testid="board-columns" @scroll="measure">
      <BoardColumn
        v-for="stage in stages"
        :key="stage.key"
        :stage="stage"
        :stages="stages"
        :cards="columns[stage.key]?.cards || []"
        :count="columns[stage.key]?.count || 0"
        :has-more="Boolean(columns[stage.key]?.next)"
        :rules="rulesByStage[stage.id] || []"
        @move="move"
        @more="loadColumn(stage.key, columns[stage.key].page + 1)"
      />
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { t } from "@/i18n";
import { GET_Companies, GET_Rules, GET_Stages, POST_Transition } from "@/api/leads/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useLeadTypesStore } from "@/stores/leadTypes";
import { useNotifyStore } from "@/stores/notify";
import BoardColumn from "./BoardColumn.vue";

// Chips = the channel's active lead types in their order (configuration: a type no company uses still shows).
const leadTypes = useLeadTypesStore();
const notify = useNotifyStore();
const stages = ref([]);
const rules = ref([]);
const columns = reactive({});
const search = ref("");
const filters = reactive({ lead_type: "", has_reply: false, do_not_contact: false });

// Rules come from `GET rules/` (the stages payload carries none), grouped per stage for the column badge.
const rulesByStage = computed(() =>
  rules.value.filter((rule) => rule.is_active).reduce((acc, rule) => {
    (acc[rule.stage_id] ||= []).push(rule);
    return acc;
  }, {})
);

// Filters are server-side so counts and paging match; a cleared filter is omitted (a blank boolean is a 400).
function activeFilters() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
}

// Every full reload starts a new run; a column response from an older run (a slower, earlier filter) is dropped.
let latestRun = 0;

async function loadColumn(key, page = 1) {
  const run = latestRun;
  const params = { stage: key, search: search.value, sort: "-last_activity_at", page, ...activeFilters() };
  const { data } = await GET_Companies(params);
  if (run !== latestRun) return;
  const previous = page > 1 ? columns[key].cards : [];
  columns[key] = { cards: [...previous, ...data.results], count: data.count, next: data.next, page };
}

function loadColumns() {
  latestRun += 1;
  return Promise.all(stages.value.map((stage) => loadColumn(stage.key)));
}

function setFilter(name, value) {
  filters[name] = value;
  return loadColumns();
}

async function load() {
  const [stageRes, ruleRes] = await Promise.all([GET_Stages(), GET_Rules(), leadTypes.load()]);
  stages.value = stageRes.data.results;
  rules.value = ruleRes.data.results || [];
  await loadColumns();
}

function relocate(company, fromKey, toKey) {
  const from = columns[fromKey].cards;
  const index = from.findIndex((card) => card.id === company.id);
  if (index >= 0) from.splice(index, 1);
  if (!columns[toKey].cards.some((card) => card.id === company.id)) columns[toKey].cards.unshift(company);
}

// Drag (already moved by vuedraggable) or the card's stage select; a refused move snaps back with the API message.
async function move(company, stageKey, dragged) {
  const fromKey = company.stage.key;
  if (fromKey === stageKey) return;
  if (!dragged) relocate(company, fromKey, stageKey);
  try {
    const { data } = await POST_Transition(company.id, stageKey);
    company.stage = data.stage;
    columns[fromKey].count -= 1;
    columns[stageKey].count += 1;
  } catch (err) {
    relocate(company, stageKey, fromKey);
    notify.spawnNotification({ msg: extractApiMessage(err, t("leads.board.move_failed")), type: "negative" });
  }
}

// Columns past the right edge are announced by a button on that edge, never left to a scrollbar that may not show.
const boardEl = ref(null);
const moreRight = ref(false);
const COLUMN_STEP_PX = 260;

function measure() {
  const el = boardEl.value;
  moreRight.value = Boolean(el) && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scrollRight() {
  boardEl.value?.scrollBy({ left: COLUMN_STEP_PX, behavior: "smooth" });
}

onMounted(async () => {
  window.addEventListener("resize", measure);
  await load();
  await nextTick();
  measure();
});
onBeforeUnmount(() => window.removeEventListener("resize", measure));
</script>

<style scoped>
.board__search {
  flex: 0 1 20rem;
  min-width: 12rem;
}
.board {
  display: flex;
  padding-bottom: var(--space-5);
  gap: var(--space-8);
  align-items: flex-start;
  overflow-x: auto;
}
</style>
