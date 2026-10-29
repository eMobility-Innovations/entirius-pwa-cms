<template>
  <DesktopOnly v-if="route.meta?.desktop">
    <router-view />
  </DesktopOnly>
  <!-- Settings and its sections: full width, one scroller, usable on a phone (wide tables scroll in their box) -->
  <div v-else-if="route.meta?.page" class="leads-page h-100 ovy-auto" data-testid="leads-page">
    <router-view />
  </div>
  <div v-else class="leads" :class="{ 'leads--detail': hasDetail, 'leads--solo': !hasInbox }" data-testid="leads-layout">
    <aside v-if="hasInbox" class="leads__inbox">
      <!-- Conversations | Companies: one nav entry, the toggle navigates between the two list routes -->
      <SegmentedControl
        v-if="hasCompanies"
        class="leads__toggle"
        :options="listOptions"
        :model-value="list"
        data-testid="leads-list-toggle"
        @update:model-value="openList"
      />
      <Inbox v-show="list === 'conversations'" />
      <Companies v-if="list === 'companies'" embedded />
    </aside>
    <section v-if="hasDetail" class="leads__detail">
      <router-view />
    </section>
    <section v-else-if="list === 'companies'" class="leads__placeholder">
      <p>{{ $t("leads.companies.pick") }}</p>
    </section>
    <section v-else-if="reviewQueue.count" class="leads__placeholder">
      <p>{{ $t("leads.inbox.pick") }}</p>
    </section>
    <!-- desktop, empty queue: the right pane says why it is empty and where the work is -->
    <section v-else class="leads__placeholder" data-testid="leads-detail-empty">
      <EmptyState
        icon="empty"
        :title="$t('leads.inbox.detail_empty_title')"
        :message="$t('leads.inbox.detail_empty')"
      >
        <router-link
          v-if="isDesktop"
          class="leads__open-board t-accent"
          :to="{ name: 'LeadsBoard' }"
          data-testid="leads-open-board"
        >
          {{ $t("leads.inbox.open_board") }}
        </router-link>
      </EmptyState>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { GET_Policy } from "@/api/communicator/api";
import { useIsDesktop } from "@/composables/useIsDesktop";
import { useLeadsReviewStore } from "@/stores/leadsReview";
import { useMuninStore } from "@/stores/munin";
import { t } from "@/i18n";
import { applyPolicy } from "@/utils/leadsTime";
import Companies from "./Companies.vue";
import DesktopOnly from "./DesktopOnly.vue";
import Inbox from "./Inbox.vue";

// Desktop-only screens (board, import, stages) take the full width.
// Mobile stacks the screens (Inbox, or the open draft/thread); >= 1024 px shows both as columns.
// The Inbox is communicator data — without that module the detail takes the whole width.
const route = useRoute();
const router = useRouter();
const munin = useMuninStore();
const reviewQueue = useLeadsReviewStore();
const isDesktop = useIsDesktop();
const hasInbox = computed(() => munin.isModuleEnabled("communicator"));
const hasCompanies = computed(() => munin.isModuleEnabled("leads"));

// The left column lists conversations or companies. The two list routes pick it; a card, a draft or a thread opened
// from a list keeps the list it came from, so the column never jumps. Without communicator there is no column: the
// company list is the detail, full width.
const LIST_ROUTES = { LeadsInbox: "conversations", LeadsCompanies: "companies" };
const list = ref(LIST_ROUTES[route.name] || "conversations");
watch(
  () => route.name,
  (name) => LIST_ROUTES[name] && (list.value = LIST_ROUTES[name])
);
const hasDetail = computed(() => !hasInbox.value || !LIST_ROUTES[route.name]);
const listOptions = computed(() => [
  { value: "conversations", label: t("leads.inbox.conversations"), testid: "leads-list-conversations" },
  { value: "companies", label: t("leads.companies.title"), testid: "leads-list-companies" },
]);
const openList = (value) => router.push({ name: value === "companies" ? "LeadsCompanies" : "LeadsInbox" });

// Times read in the channel's zone (the send policy's); without it they stay in the browser's. The same
// answer says whether today's cap is used up — what a waiting mail needs before it names an hour.
onMounted(async () => {
  if (!hasInbox.value) return;
  try {
    applyPolicy((await GET_Policy()).data);
  } catch {
    applyPolicy(null);
  }
});
</script>

<style scoped>
/* The app content column clips (overflow: hidden) — the layout is its own scroller, so long threads
   and the Review edit form stay reachable and the sticky Review actions pin to its bottom. */
.leads {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  overflow-y: auto;
}
.leads__placeholder {
  display: none;
}
.leads__toggle {
  display: flex;
  height: 44px;
  margin: var(--space-8) var(--space-8) 0;
}
.leads__toggle :deep(.segmented-control__option) {
  flex: 1;
  font-size: var(--fs-300);
}
@media (max-width: 1023px) {
  .leads--detail .leads__inbox {
    display: none;
  }
  /* A phone shows the open screen alone at the height of the view: its PageLayout scrolls, so the Review actions in
     its footer stay pinned at the bottom (Review keeps the tab bar off, meta.noBottomBar). */
  .leads--detail {
    grid-template-rows: minmax(0, 1fr);
  }
}
@media (min-width: 1024px) {
  .leads {
    grid-template-columns: 360px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
  }
  .leads--solo {
    grid-template-columns: minmax(0, 1fr);
  }
  .leads__inbox {
    border-right: 1px solid var(--border-subtle);
  }
  .leads__inbox,
  .leads__detail {
    overflow-y: auto;
  }
  .leads__placeholder {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    align-items: center;
    justify-content: center;
    padding: var(--space-10);
    color: var(--text-secondary);
    text-align: center;
  }
  .leads__placeholder p {
    margin: 0;
  }
  .leads__open-board {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    text-decoration: underline;
  }
}
</style>
