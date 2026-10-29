<template>
  <PageLayout class="content-list" roomy>
    <template #header>
      <PageHeader :title="$t('nav.content_list')" />
    </template>
    <template #toolbar>
      <div class="content-list__filters">
        <div v-if="buildTypes.length" class="content-list__chip-group">
          <span id="content-list-filter-label" class="content-list__label">{{ $t("builder.filters") }}</span>
          <div class="content-list__chips" role="group" aria-labelledby="content-list-filter-label">
            <FilterChip
              v-for="t in buildTypes"
              :key="`filter-${t.slug}`"
              :label="tBuildType(t.slug, t.label)"
              :active="activeFilters.includes(t.slug)"
              :aria-pressed="String(activeFilters.includes(t.slug))"
              @click="setFilter(t)"
            />
            <IconButton
              v-if="activeFilters.length"
              icon="close"
              size="sm"
              :label="$t('builder.clear_filters')"
              @click="clearFilters"
            />
          </div>
        </div>
        <div class="content-list__controls">
          <BasicInput
            v-model="search"
            :placeholder="$t('builder.search_documents')"
            icon="search"
            class="content-list__search"
            data-testid="content-list-search"
            @input="debouncedFetch(() => init({}))"
          />
          <BasicButton v-if="translatorAvailable" variant="secondary" @click="showTranslateModal = true">
            {{ $t("builder.translate_all") }}
          </BasicButton>
          <FormField v-if="availableLanguages && language" :label="$t('builder.content_language')" layout="inline">
            <BasicSelect
              class="content-list__select"
              :options="languageOptions"
              :model-value="language.toUpperCase()"
              :placeholder="$t('builder.language')"
              @update:model-value="setLanguage"
            />
          </FormField>
        </div>
      </div>
    </template>

    <template v-for="(doc, i) in visibleDocs" :key="`content_type-${doc.type ?? i}`">
      <div v-if="doc.data.length" class="doc-section mb-10">
        <div class="doc-section__header">
          {{ tBuildType(doc.type, doc.label) }}
          <CountBadge :count="doc.data.length" />
        </div>

        <DataTable
          :columns="contentColumns"
          :rows="doc.data"
          :empty-text="$t('builder.no_content_title')"
          row-key="uid"
          @row-click="(row) => navigateToEditor(row, doc.type)"
        >
          <template #cell-name="{ row }">
            <router-link
              class="data-table__name-link"
              :to="{
                name: 'Builder',
                params: { type: doc.type, uid: row.uid },
                query: { lg: language },
              }"
              @click.stop
              >{{
                row.name && row.name.length ? row.name : row.uid
              }}</router-link
            >
          </template>

          <template #cell-updated_at="{ value }">
            {{ formatDate(value) }}
          </template>

          <template #cell-status="{ row }">
            <StatusBadge
              :label="
                row.is_published ? $t('builder.published') : $t('builder.draft')
              "
              :tone="row.is_published ? 'positive' : 'info'"
            />
          </template>

          <template #cell-actions="{ row }">
            <BasicButton
              size="sm"
              variant="ghost"
              class="data-table__action-btn"
              @click="navigateToEditor(row, doc.type)"
            >
              {{ canCreate ? $t('builder.edit') : $t('builder.preview') }}
            </BasicButton>
            <IconButton
              v-if="doc.type !== 'legal-page'"
              icon="delete"
              :label="$t('builder.delete')"
              variant="danger"
              size="sm"
              class="data-table__action-btn"
              :disabled="!canCreate"
              @click="askRemove(doc.type, row.uid)"
            />
          </template>
        </DataTable>
        <div class="mv-2 ph-2" v-if="doc.pagination">
          <Pagination
            :nav_size="32"
            :page="doc.pagination.page"
            :pages="doc.pagination.pages"
            @update:page="setPagination({ page: $event, type: doc.type })"
          />
        </div>
      </div>
    </template>

    <EmptyState
      v-if="contentTypes !== null && !hasVisibleContent"
      icon="empty"
      :title="searchName ? $t('builder.no_search_results') : $t('builder.no_content_title')"
      :message="searchName ? '' : $t('builder.no_content_msg')"
    />

    <ConfirmDialog
      tone="danger"
      :open="confirmation_modal"
      :title="$t('builder.confirm_title')"
      @confirm="confirmRemove"
      @cancel="confirmation_modal = false"
    >
      <p>{{ $t("builder.confirm_msg") }}</p>
    </ConfirmDialog>

    <FloatingActions :actions="fabActions" />

    <TranslateDialog
      v-model:open="showTranslateModal"
      scope="content"
      :title="$t('builder.translate_all')"
      :summary="$t('builder.translate_all_description')"
      :languages="translateLanguages"
      :source-language="contentDBChannel.defaultLanguage || ''"
      :estimate-fn="translateFns.estimateFn"
      :submit-fn="translateFns.submitFn"
      @translated="init({})"
    />
  </PageLayout>
</template>

<script>
import {
  GET_Content,
  DELETE_Content,
  GET_ContentTypes,
} from "../../api/contentDB/api";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useUserStore } from "@/stores/user";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { useMuninStore } from "@/stores/munin";
import { useAccessStore } from "@/stores/access";
import { AREAS } from "@/configs/areas";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import config_options from "@/../__client/configs/__config_options";

const section_options = (value, look_for = null) => {
  if (!config_options[value]) return "no_options";
  if (look_for) return config_options[value][look_for];
  return config_options[value];
};

import TranslateDialog from "@/components/TranslateDialog/index.vue";
import { contentTranslateFns } from "./translateFns";
import { formatDate } from "@/utils/format";
export default {
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const userStore = useUserStore();
    const contentDBChannel = useContentDBChannelStore();
    const munin = useMuninStore();
    const access = useAccessStore();
    return { loader, notify, userStore, contentDBChannel, munin, access, ...useSearchDebounce() };
  },
  data() {
    return {
      confirmation_modal: false,
      showTranslateModal: false,
      to_remove: null,
      // ----------
      config_options,
      // ----------
      content_type: null,
      docs: [],
      activeFilters: [],
      docsFilters: [],
      contentTypesListActive: false,
      contentTypes: null,
      language: null,
    };
  },
  computed: {
    translatorAvailable() {
      return this.munin.isModuleInstalled("contentdb_translator");
    },
    translateLanguages() {
      return this.contentDBChannel.availableLanguages.map((lang) => ({ label: lang.toUpperCase(), value: lang }));
    },
    translateFns() {
      return contentTranslateFns(this.contentDBChannel.activeChannel?.idx || "");
    },
    user() {
      return this.userStore.user;
    },
    // django-access decides when it is there; without it, the contentdb content-permissions (today's logic).
    canCreate() {
      if (this.access.available) return this.access.can(AREAS.CONTENT_PAGES, "write");
      return Boolean(this.user?.buildTypes?.some((type) => type.actions?.includes("create")));
    },
    availableLanguages() {
      return this.contentDBChannel.languages;
    },
    languageOptions() {
      return (this.availableLanguages || []).map((val) => ({ label: `${val.iso2}`, value: val.iso2 }));
    },
    buildTypes() {
      return (this.user?.buildTypes || []).filter((bt) => bt._for === this.content_type);
    },
    // The document name the lists are narrowed to (the API matches a part of the name, any case).
    searchName() {
      return this.search.trim();
    },
    visibleDocs() {
      if (!this.activeFilters.length) return this.docs;
      return this.docs.filter((doc) => this.activeFilters.includes(doc.type));
    },
    fabActions() {
      return this.buildTypes.map((bt) => {
        const config_max = this.section_options(bt.slug, "max_self");
        // Paired by type: the build types and the loaded groups come from two lists in different orders.
        const doc_count = this.docs.find((doc) => doc.type === bt.slug)?.count ?? 0;
        const is_disabled =
          !bt.actions.includes("create") || doc_count >= config_max;
        return {
          icon: "add",
          label: this.tBuildType(bt.slug, bt.label),
          handler: () => this.create_new(bt),
          disabled: is_disabled,
        };
      });
    },
    contentColumns() {
      return [
        {
          key: "name",
          label: this.$t("builder.name"),
          width: "1fr",
          truncate: true,
          title: (row) => row.name || row.uid,
        },
        {
          key: "updated_at",
          label: this.$t("builder.edit_date"),
          width: "160px",
          priority: 2,
        },
        {
          key: "status",
          label: this.$t("builder.status"),
          width: "110px",
          align: "center",
        },
        { key: "actions", label: "", align: "right", actions: true },
      ];
    },
    hasVisibleContent() {
      return this.visibleDocs.some((doc) => doc.data && doc.data.length > 0);
    },
  },
  methods: {
    formatDate,
    setLanguage(value) {
      if (value.toLowerCase() === this.language) return;
      this.$router.replace({ query: { lg: value.toLowerCase() } }).catch(() => {});
      this.init({ language: value });
    },
    // The clear button disappears with the filters: focus moves to the first chip instead of the page body.
    async clearFilters() {
      this.activeFilters = [];
      await this.$nextTick();
      this.$el.querySelector(".content-list__chips .filter-chip")?.focus();
    },
    askRemove(type, uid) {
      this.to_remove = [type, uid];
      this.confirmation_modal = true;
    },
    confirmRemove() {
      this.removeDoc(this.to_remove[0], this.to_remove[1]);
      this.confirmation_modal = false;
    },
    navigateToEditor(row, type) {
      this.$router.push({
        name: "Builder",
        params: { type, uid: row.uid },
        query: { lg: this.language },
      });
    },
    async setPagination({ page, type, limit }) {
      try {
        this.loader.loaderStart();
        const {
          data: { data = [], meta = {}, pagination = {} },
        } = await GET_Content({
          type: type,
          page: page,
          limit: limit,
          ...(this.searchName ? { name: this.searchName } : {}),
        });

        this.docs = this.docs.map((doc) => {
          return doc.type === type ? { ...doc, data, pagination } : doc;
        });
      } catch ({ response }) {
        console.log(response);
      } finally {
        this.loader.loaderFinish();
      }
    },
    async removeDoc(type, uid) {
      const docs = this.docs;
      const idx = docs.findIndex((cat) => cat.type === type);
      try {
        this.loader.loaderStart();
        const res = await DELETE_Content({
          CDB_TYPE: this.content_type,
          type: type,
          uid: uid,
        });
        //if (!res) throw new Error();

        docs[idx].data = docs[idx].data.filter((entry) => entry.uid !== uid);
        this.notify.spawnNotification({
          msg: this.$t("notifications.doc_deleted"),
          type: "informative",
        });
        docs[idx]["count"] = docs[idx]["count"] - 1;
      } catch ({ response }) {
        console.log(response);
        this.notify.spawnNotification({
          msg: this.$t("notifications.error"),
          type: "negative",
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    setFilter({ slug = null, label = null }) {
      this.activeFilters.indexOf(slug) === -1
        ? this.activeFilters.push(slug)
        : (this.activeFilters = this.activeFilters.filter(
            (filter) => filter !== slug
          ));
    },
    async init({ language = null, _content_type = null }) {
      let { lg = null } = this.$route.query;
      let { content_type = null } = this.$route.params;

      lg = !language ? lg : language;
      content_type = !_content_type ? content_type : _content_type;

      if (!lg) {
        lg = this.contentDBChannel.defaultLanguage;
        this.$router
          .replace({ query: { ...this.$route.query, lg } })
          .catch(() => {});
      }

      this.language = lg;
      this.content_type = content_type;
      //this.language = lg;

      try {
        this.loader.loaderStart();

        const {
          data: { data: contentTypes = [], meta: contentMeta = {} },
        } = await GET_ContentTypes({ CDB_TYPE: content_type });

        this.contentTypes = contentTypes;
      } catch ({ response }) {
        console.log("err ---------------------------------");
        console.log(response);
        console.log("err ---------------------------------");
      }

      // ------
      // ------
      // ------
      if (Array.isArray(this.contentTypes) && !this.contentTypes.length) {
        this.docs = [];
      }
      if (this.contentTypes && this.contentTypes.length) {
        const promises = this.contentTypes.map((type) => {
          return GET_Content({
            CDB_TYPE: content_type,
            type: type.slug,
            language: lg ? lg.toUpperCase() : null,
            ...(this.searchName ? { name: this.searchName } : {}),
          });
        });

        const response = await Promise.allSettled(promises);
        const model = response.reduce((arr, res) => {
          const { status = null, value = {} } = res;
          if (status === "rejected") return arr;

          const { data = {} } = value;
          const {
            data: content = [],
            content_type = null,
            pagination = null,
          } = data;

          arr.push({
            data: content,
            // A search narrows the rows, not the number of documents a type holds (the FAB's create cap reads it).
            count: (this.searchName && this.docs.find((doc) => doc.type === content_type)?.count) || content.length,
            pagination,
            type: content_type,
            label: this.contentTypes.find((type) => type.slug === content_type)
              .label,
          });

          return arr;
        }, []);

        this.docs = model;
      }

      this.loader.loaderFinish();
    },
    create_new(type) {
      const { slug = null, _limit = null, _for = "content" } = type;
      // limitation for layout extender

      this.$router.push({
        name: "Builder",
        params: { type: slug },
        query: { lg: this.language },
      });
      return;
      const { data = [] } = this.docs.find((d) => d.type === slug);
      if (_for === "layout-extender" && data.length === _limit) {
        this.notify.spawnNotification({
          msg: this.$t("builder.doc_limit_reached"),
          type: "negative",
        });
        return;
      }
    },
    section_options(...value) {
      return section_options(...value);
    },
    tBuildType(slug, fallback) {
      const key = "config_option." + slug;
      const val = this.$t(key);
      return val !== key ? val : fallback;
    },
  },
  async created() {
    await this.contentDBChannel.fetchChannelsAndLanguages();
    await this.init({});
  },
  beforeRouteUpdate(to, from, next) {
    const { params = {}, query = {} } = to;
    const { content_type = null } = params;
    const { lg = null } = query;
    this.init({ _content_type: content_type, language: lg });
    next();
  },
  components: {
    TranslateDialog,
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// Filters row (Figma S4): "Filtry:" and the type chips left, the language select right; a phone stacks the label,
// scrolls the chips sideways in one row and puts the labelled select under them (S5).
.content-list__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
}

.content-list__chip-group,
.content-list__chips,
.content-list__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.content-list__chips {
  flex-wrap: wrap;
}

.content-list__label {
  font-size: var(--fs-200);
  font-weight: 500;
  color: var(--text-muted);
}

.content-list__controls {
  gap: var(--space-3);
}

.content-list__select {
  width: 180px;
}

.content-list__search {
  width: 220px;
}

@include max-tablet {
  .content-list__chip-group,
  .content-list__controls {
    flex: 1 0 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .content-list__chip-group {
    flex-wrap: nowrap;
  }

  .content-list__search {
    width: 100%;
  }

  // The chips' 36 px touch area stays inside the scroll box.
  .content-list__chips {
    flex-wrap: nowrap;
    max-width: 100%;
    overflow-x: auto;
    padding-block: var(--space-1);
  }
}

.doc-section {
  border-radius: var(--radius-base);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}
.doc-section__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  background-color: var(--surface-base);
  border-bottom: 1px solid var(--border-subtle);
}
.data-table__name-link {
  display: block;
  min-width: 0;
  color: var(--text-body);
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    color: var(--text-accent);
  }
}
</style>
