<template>
  <section class="earlier" data-testid="earlier-threads">
    <div class="earlier__head flex ai-ct flex-wrap gap-3">
      <BasicButton variant="ghost" :aria-expanded="String(open)" data-testid="earlier-toggle" @click="open = !open">
        {{ $t("leads.thread.earlier", { count }) }}
        <FontAwesomeIcon :icon="open ? $icons.collapse : $icons.expand" class="ml-2" />
      </BasicButton>
      <StatusBadge
        v-if="pendingCount"
        tone="negative"
        :label="$t('leads.thread.earlier_optout', { count: pendingCount })"
        data-testid="earlier-optout-badge"
      />
    </div>
    <div v-if="open" class="earlier__list">
      <ThreadGroup
        v-for="thread in allThreads"
        :key="thread.id"
        :thread="thread"
        :pending="pendingThreads.has(thread.id)"
        :holds-reply="thread.id === openThreadId"
        :waiting="waitingOf(waiting, thread.id)"
        @changed="$emit('changed')"
      />
      <BasicButton v-if="hasMore" class="as-s" :disabled="loading" data-testid="earlier-more" @click="loadMore">
        {{ $t("leads.thread.earlier_more") }}
      </BasicButton>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { GET_Threads } from "@/api/communicator/api";
import { waitingOf } from "@/utils/leadsThread";
import ThreadGroup from "./ThreadGroup.vue";

// Every thread older than the newest one, behind one expander; further pages load like the list.
const props = defineProps({
  subjectRef: { type: String, required: true },
  threads: { type: Array, default: () => [] }, // older threads of the first list page
  count: { type: Number, default: 0 },
  next: { type: Boolean, default: false },
  pageSize: { type: Number, required: true },
  pendingThreads: { type: Set, default: () => new Set() }, // thread ids with an undecided opt-out
  waiting: { type: Array, default: () => [] },
  openThreadId: { type: Number, default: null }, // the thread holding a reply — expanded and opened on arrival
});
defineEmits(["changed"]);

const open = ref(false);
const loading = ref(false);
const extra = ref([]);
const page = ref(1);
const extraNext = ref(null);

const allThreads = computed(() => [...props.threads, ...extra.value]);
const hasMore = computed(() => (extraNext.value === null ? props.next : extraNext.value));
const pendingCount = computed(() => allThreads.value.filter((thread) => props.pendingThreads.has(thread.id)).length);

// The list arrives after this component is created — a reply thread expands the section whenever it shows up.
watch(() => props.openThreadId, (id) => id && (open.value = true), { immediate: true });

async function loadMore() {
  loading.value = true;
  try {
    const params = { subject_ref: props.subjectRef, page: page.value + 1, page_size: props.pageSize };
    const { data } = await GET_Threads(params);
    extra.value = [...extra.value, ...(data.results || [])];
    extraNext.value = Boolean(data.next);
    page.value += 1;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.earlier {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}
.earlier__head {
  padding: var(--space-2) var(--space-5);
}
.earlier__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: 0 var(--space-8) var(--space-8);
}
@media (max-width: 1023px) {
  .earlier__list {
    padding: 0 var(--space-5) var(--space-5);
  }
}
</style>
