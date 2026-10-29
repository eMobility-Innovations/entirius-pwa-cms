<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('faq.groups')" />
    </template>
    <template #toolbar>
      <div class="group-list__toolbar">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="group-list__search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <div class="filter-chip-row" role="group" :aria-label="$t('faq.filters')">
          <FilterChip
            v-for="tab in filterTabs"
            :key="tab.key"
            :label="tab.label"
            :active="activeFilter === tab.key"
            @click="setFilter(tab.key)"
          />
        </div>
      </div>
    </template>

      <Loader block v-show="loading" />

      <div v-show="!loading">
        <EmptyState v-if="!groups.length" :title="$t('faq.no_groups')" />

        <draggable
          v-else
          v-model="groups"
          :disabled="readonly"
          item-key="id"
          handle=".drag-handle"
          ghost-class="bg-accent-subtle"
          :force-fallback="true"
          fallback-class="drag-ghost"
          @end="onReorder"
        >
          <template #item="{ element }">
            <div
              class="group-row flex ai-ct flex-wrap gap-5 rg-2 pointer"
              role="link"
              tabindex="0"
              @click="openGroup(element)"
              @keydown.enter="openGroup(element)"
            >
              <font-awesome-icon
                :icon="$icons.drag"
                class="drag-handle t-muted"
              />
              <span
                class="group-row__name fw-600"
                :title="element.name || element.idx"
              >
                {{ element.name || element.idx }}
              </span>
              <div class="flex ai-ct gap-2">
                <StatusBadge
                  v-if="(element.channel_ids || []).length"
                  tone="accent"
                  :dot="false"
                  :label="$t(`faq.channels_${pluralKey(element.channel_ids.length)}`, { count: element.channel_ids.length })"
                />
                <StatusBadge
                  v-else
                  tone="neutral"
                  :dot="false"
                  :label="$t('faq.global')"
                />
              </div>
              <StatusBadge tone="accent" :dot="false" :label="$t(`faq.items_${pluralKey(element.item_count || 0)}`, { count: element.item_count || 0 })" />
              <StatusBadge
                :label="element.is_active ? $t('faq.active') : $t('faq.inactive')"
                :tone="element.is_active ? 'positive' : 'negative'"
              />
            </div>
          </template>
        </draggable>
      </div>

    <template #footer>
      <Pagination
        v-if="totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>

      <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import draggable from "vuedraggable";
import { usePageReadonly } from "@/composables/useReadonly";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import {
  GET_FaqGroups,
  PATCH_FaqGroupsReorder,
} from "@/api/faq/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { pluralKey } from "@/utils/plural";

export default {
  name: "FaqGroupList",
  components: { draggable },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const { search, debouncedFetch } = useSearchDebounce();
    return { loader, notify, search, debouncedFetch, readonly: usePageReadonly() };
  },
  data() {
    return {
      groups: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 50,
      loading: false,
      activeFilter: "all",
    };
  },
  computed: {
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("faq.create_group"),
          handler: () => this.$router.push("/faq/groups/create"),
        },
      ];
    },
    filterTabs() {
      return [
        { key: "all", label: this.$t("faq.filter_all") },
        { key: "active", label: this.$t("faq.filter_active") },
        { key: "inactive", label: this.$t("faq.filter_inactive") },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchGroups();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchGroups();
  },
  methods: {
    pluralKey,
    async fetchGroups() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.activeFilter === "active") params.is_active = true;
        if (this.activeFilter === "inactive") params.is_active = false;

        const channel = process.env.VUE_APP_CHANNEL;
        const { data } = await GET_FaqGroups(channel, params);
        this.groups = data.results || [];
        this.totalCount = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    openGroup(group) {
      this.$router.push(`/faq/groups/${group.idx}`);
    },
    setFilter(key) {
      this.activeFilter = key;
      this.currentPage = 1;
      this.fetchGroups();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchGroups();
    },
    async onReorder() {
      try {
        const channel = process.env.VUE_APP_CHANNEL;
        const ordered_idxs = this.groups.map((g) => g.idx);
        await PATCH_FaqGroupsReorder(channel, { ordered_idxs });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.reorder_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.group-list__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.group-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}

.group-row {
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;

  &:hover {
    background: var(--surface-raised);
  }
}

// The name takes the row; on a phone the chips wrap under it instead of squeezing it to 0 px.
.group-row__name {
  flex: 1 1 12rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drag-handle {
  cursor: grab;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
}

</style>
