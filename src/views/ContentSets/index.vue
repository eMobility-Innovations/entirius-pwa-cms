<template>
  <PageLayout class="fs-200 t-secondary fg-1 relative">
    <template #header>
      <PageHeader :title="$t('content_sets.title')" />
    </template>
    <template v-if="!isSingleLanguage" #toolbar>
      <div class="content-sets__toolbar">
        <div class="filter-chip-row" role="group" :aria-label="$t('content_sets.filters')">
          <FilterChip
            v-for="dt in docTypes"
            :key="dt.value"
            :label="$t(`config_option.${dt.value}`)"
            :active="type === dt.value"
            @click="switchType(dt.value)"
          />
        </div>
        <SegmentedControl
          v-model="mode"
          :options="[
            { value: 'list', label: $t('content_sets.list') },
            { value: 'edit', label: $t('content_sets.edit_mode') },
          ]"
        />
      </div>
    </template>
      <div
        v-if="isSingleLanguage"
        class="flex ai-ct jc-ct gap-5 p-12 t-muted"
        style="min-height: 14rem; flex-direction: column"
      >
        <p class="fs-400 fw-600 t-secondary">
          {{ $t("content_sets.single_language_title") }}
        </p>
        <p class="fs-200 t-muted ta-ct" style="max-width: 30rem">
          {{ $t("content_sets.single_language_msg") }}
        </p>
      </div>
      <template v-else>
        <div v-if="DOCS && mode === 'list'">
          <div class="grid grid-col-3 gap-10">
            <div
              v-for="(lang_value, lang, lang_index) in DOCS"
              :key="`single-doc-lang-${lang_index}`"
            >
              <div class="flex jc-sb ai-ct">
                <div>
                  <p class="t-secondary">{{ lang }}</p>
                </div>
                <Pagination
                  class="fs-200"
                  v-if="DOCS_pagination && DOCS_pagination[lang]"
                  :nav_size="32"
                  :page="DOCS_pagination[lang].page"
                  :pages="DOCS_pagination[lang].pages"
                  @update:page="SET_Page({ language: lang, page: $event })"
                />
              </div>
              <ReadonlyOff>
                <BasicInput
                  :modelValue="langSearch[lang] || ''"
                  @update:modelValue="(val) => onLangSearch(lang, val)"
                  icon="search"
                  :placeholder="$t('content_sets.search_placeholder')"
                  class="mt-2"
                />
              </ReadonlyOff>
              <div
                class="rounded fs-200 t-secondary mt-2 grid gap-5 doc-list"
                :class="{ 'doc-list--loading': langLoading[lang] }"
              >
                <template
                  v-if="
                    Object.keys(lang_value[DOCS_pagination[lang]['page']])
                      .length
                  "
                >
                  <div
                    class="doc-tile"
                    role="button"
                    :tabindex="page_value.content_set ? -1 : 0"
                    :aria-disabled="page_value.content_set ? 'true' : undefined"
                    :aria-pressed="String(!!isDocSelected(lang, doc_index))"
                    :class="[
                      {
                        'doc-tile--linked':
                          page_value.content_set &&
                          !isDocSelected(lang, doc_index),
                      },
                      {
                        'doc-tile--selected': isDocSelected(lang, doc_index),
                      },
                    ]"
                    v-for="(page_value, doc_index, page_index) in lang_value[
                      DOCS_pagination[lang]['page']
                    ]"
                    :key="`single-doc-page-${page_index}-${lang}`"
                    @click="pickDoc(lang, doc_index, page_value)"
                    @keydown.enter.prevent="pickDoc(lang, doc_index, page_value)"
                    @keydown.space.prevent="pickDoc(lang, doc_index, page_value)"
                  >
                    <div class="flex jc-sb ai-st gap-2">
                      <p class="fw-600 fs-300 lc-1">
                        {{ page_value.name ?? $t("content_sets.no_name") }}
                      </p>
                      <StatusBadge
                        v-if="page_value.content_set && !isDocSelected(lang, doc_index)"
                        :label="$t('content_sets.linked')"
                        tone="negative"
                        size="sm"
                        :dot="false"
                      />
                    </div>
                    <p class="fs-200 t-muted lc-1 mt-1">
                      /{{ page_value.routes && page_value.routes.length
                        ? page_value.routes.at(0)
                        : $t("content_sets.not_set") }}
                    </p>
                  </div>
                </template>
                <EmptyState v-else size="sm" :title="$t('content_sets.no_docs')" />
              </div>
            </div>
          </div>
          <p class="fs-200 t-muted mt-8 mb-2">
            {{ $t("content_sets.instruction") }}
          </p>
          <div class="flex jc-fe gap-2">
            <BasicTooltip
              v-if="!hasEnoughSelections"
              :text="$t('content_sets.clear_set_tip')"
            >
              <BasicButton
                variant="secondary"
                :disabled="true"
              >
                {{ $t('content_sets.clear_set') }}
              </BasicButton>
            </BasicTooltip>
            <BasicButton
              v-else
              variant="secondary"
              @click="selected_set_members = null"
            >
              {{ $t('content_sets.clear_set') }}
            </BasicButton>
            <BasicTooltip
              v-if="!hasEnoughSelections"
              :text="$t('content_sets.set_ready_tip')"
            >
              <BasicButton
                variant="primary"
                :disabled="true"
              >
                {{ $t('content_sets.set_ready') }}
              </BasicButton>
            </BasicTooltip>
            <BasicButton
              v-else
              variant="primary"
              @click="
                MODIFY_Set({
                  url: `/content-sets/${edit ? edit : ''}`,
                  method: edit ? 'put' : 'post',
                })
              "
            >
              {{ $t('content_sets.set_ready') }}
            </BasicButton>
          </div>
        </div>
        <div v-if="sets && mode === 'edit'" class="grid gap-5">
          <EmptyState v-if="!sets.length" :title="$t('content_sets.no_sets')" />
          <BasicCard
            v-for="({ uid, members }, i) in sets"
            :key="`set-${uid}`"
          >
            <div class="flex jc-sb ai-ct">
              <div class="flex flex-wrap ai-ct gap-2 fg-1" style="min-width: 0">
                <span
                  v-for="({ name, language }, m_index) in members"
                  :key="`member-${uid}-${m_index}`"
                  class="content-sets__member"
                  >{{ name || $t("content_sets.no_name") }}
                  <span class="t-muted">({{ language }})</span></span
                >
              </div>
              <IconButton
                icon="delete"
                variant="danger"
                size="sm"
                :label="$t('common.delete')"
                @click="DELETE_Set({ url: `/content-sets/${uid}`, uid })"
              />
            </div>
            <p class="fs-200 t-muted mt-1 lc-1">{{ uid }}</p>
          </BasicCard>
        </div>
      </template>
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useLoaderStore } from "@/stores/loader";
import { useUserStore } from "@/stores/user";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { _METHOD_content } from "@/api/contentDB/api";
import hidden_config from "@/../__client/configs/__hidden_config";
import { ReadonlyOff } from "@/composables/useReadonly";
export default {
  components: { ReadonlyOff },
  setup() {
    const notify = useNotifyStore();
    const loader = useLoaderStore();
    const userStore = useUserStore();
    const contentDBChannel = useContentDBChannelStore();
    return { notify, loader, userStore, contentDBChannel };
  },
  data() {
    return {
      type: null,
      sets: null,
      sets_pagination: null,
      DOCS: null,
      DOCS_pagination: null,
      selected_set_members: null,
      edit: null,
      mode: "list",
      langSearch: {},
      langLoading: {},
      _langSearchTimers: {},
    };
  },
  computed: {
    user() {
      return this.userStore.user;
    },
    languages() {
      return this.contentDBChannel.languages;
    },
    isSingleLanguage() {
      return this.contentDBChannel.availableLanguages.length <= 1;
    },
    hasEnoughSelections() {
      return Object.keys(this.selected_set_members ?? {}).length >= 2;
    },
    docTypes() {
      const doc_type = hidden_config.find((c) => c.prop === "doc_type");
      if (!doc_type) return [];
      return Object.values(doc_type._for.section_configs);
    },
  },
  async created() {
    this.init();
    try {
      this.loader.loaderStart();
      await this.contentDBChannel.fetchChannelsAndLanguages();
      await this.GET_sets({ url: "/content-sets/", method: "get" });
      await this.SET_DOCS({ _languages: [...this.languages] });
    } finally {
      this.loader.loaderFinish();
    }
  },
  methods: {
    init() {
      const { query = {} } = this.$route;
      const { type = null } = query;

      const _type = !type ? "static-page" : type;
      if (!type) this.$router.replace({ query: { type: _type } });
      this.type = _type;
    },
    async switchType(newType) {
      if (newType === this.type) return;
      this.type = newType;
      this.selected_set_members = null;
      this.langSearch = {};
      this.langLoading = {};
      this.DOCS = null;
      this.DOCS_pagination = null;
      this.$router.replace({ query: { ...this.$route.query, type: newType } });
      try {
        this.loader.loaderStart();
        await this.SET_DOCS({ _languages: [...this.languages] });
      } finally {
        this.loader.loaderFinish();
      }
    },
    onLangSearch(lang, value) {
      this.langSearch = { ...this.langSearch, [lang]: value };
      clearTimeout(this._langSearchTimers[lang]);
      this._langSearchTimers[lang] = setTimeout(async () => {
        this.langLoading = { ...this.langLoading, [lang]: true };
        try {
          await this.SET_DOCS_single({ iso2: lang, page: 1 });
        } finally {
          this.langLoading = { ...this.langLoading, [lang]: false };
        }
      }, 350);
    },
    async GET_sets({ url = null, method = null, limit = 6, page = 1 }) {
      if (![url, method, limit, page]) {
        console.log("NO GET FOR YA!");
        return;
      }
      try {
        const { data: response, meta } = await _METHOD_content({
          url,
          method,
          params: { limit, page },
        });
        const { data = [], pagination = {} } = response;
        this.sets = data;
        this.sets_pagination = pagination;
      } catch (error) {}
    },
    async SET_DOCS({ _languages = null, page = 1 }) {
      if (!_languages) return;
      const request = async ({ iso2 = null, iso3 = null }) => {
        const searchVal = this.langSearch[iso2];
        const { data: response, meta = null } = await _METHOD_content({
          url: `/content/${this.type}/`,
          method: "get",
          params: {
            language: iso2,
            page,
            exclude_in_content_set: true,
            ...(searchVal ? { name: searchVal } : {}),
          },
        });
        const { data, pagination } = response;

        const model = {
          pagination: {
            [iso2]: pagination,
          },
          docs: { [iso2]: { [page]: { ...data } } },
        };
        return model;
      };

      const promises = _languages.map(request);
      const response = await Promise.all(promises);
      let _DOCS = {};
      let _DOCS_pagination = {};
      response.forEach((res, index) => {
        const { docs, pagination } = res;
        _DOCS = { ..._DOCS, ...docs };
        _DOCS_pagination = { ..._DOCS_pagination, ...pagination };
      });
      this.DOCS = _DOCS;
      this.DOCS_pagination = _DOCS_pagination;
    },
    async SET_DOCS_single({ iso2, page = 1 }) {
      const searchVal = this.langSearch[iso2];
      const { data: response } = await _METHOD_content({
        url: `/content/${this.type}/`,
        method: "get",
        params: {
          language: iso2,
          page,
          exclude_in_content_set: true,
          ...(searchVal ? { name: searchVal } : {}),
        },
      });
      const { data, pagination } = response;
      this.DOCS = { ...this.DOCS, [iso2]: { [page]: { ...data } } };
      this.DOCS_pagination = { ...this.DOCS_pagination, [iso2]: pagination };
    },
    async SET_Page({ language = "PL", page = 1 }) {
      let _DOCS = this.DOCS ?? {};
      let _DOCS_pagination = this.DOCS_pagination ?? {};

      if (_DOCS[language][page]) {
        _DOCS_pagination[language] = { ..._DOCS_pagination[language], page };
        _DOCS_pagination = _DOCS_pagination;
        return;
      }

      const { data: response, meta = null } = await _METHOD_content({
        url: `/content/${this.type}/`,
        method: "get",
        params: {
          language,
          page,
          ...(this.langSearch[language] ? { name: this.langSearch[language] } : {}),
        },
      });
      const { data, pagination } = response;
      _DOCS[language][page] = { ...data };
      _DOCS_pagination[language] = { ..._DOCS_pagination[language], page };

      this.DOCS = _DOCS;

      this.DOCS_pagination = _DOCS_pagination;
    },
    async MODIFY_Set({ url = null, method = null, payload }) {
      if (
        !this.selected_set_members ||
        Object.keys(this.selected_set_members).length < 2
      )
        return;
      const _payload = Object.entries(this.selected_set_members).reduce(
        (arr, [lang, doc]) => {
          const entries = Object.entries({ ...doc });
          const [page, index] = entries.at(0);

          const { uid, language, name } = this.DOCS[lang][page][index];

          arr.push({ draft: uid, language, name });
          return arr;
        },
        []
      );

      try {
        const { data: response, meta = null } = await _METHOD_content({
          url,
          method,
          payload: { members: _payload },
        });
        const { data } = response;

        this.notify.spawnNotification({
          title: this.$t("notifications.success"),
          msg: this.$t("notifications.success_fun"),
          type: "informative",
        });

        if (method === "post") {
          const { uid = null, members = [] } = data;

          const sets = this.sets ?? [];
          this.sets = [...sets, data];
          this.selected_set_members = null;
        }
        await this.SET_DOCS({ _languages: [...this.languages] });
      } catch (error) {
        console.log(error);
      }
    },
    async DELETE_Set({ url = null, method = "delete", uid = null }) {
      try {
        const { data: response, meta = null } = await _METHOD_content({
          url,
          method,
        });
        const { data } = response;
        this.sets = this.sets.filter(({ uid: _uid = null }) => {
          return _uid !== uid;
        });
        await this.SET_DOCS({ _languages: [...this.languages] });
        this.notify.spawnNotification({
          title: this.$t("notifications.success"),
          msg: this.$t("notifications.deleted"),
          type: "informative",
        });
      } catch (error) {
        console.log(error);
      }
    },
    isDocSelected(lang, doc_index) {
      return (
        this.selected_set_members &&
        this.selected_set_members[lang] &&
        this.selected_set_members[lang][
          this.DOCS_pagination[lang]["page"]
        ] === doc_index
      );
    },
    pickDoc(lang, doc_index, doc) {
      if (doc.content_set) return;
      this.bind_set({ lang, page: this.DOCS_pagination[lang].page, doc_index });
    },
    bind_set({ lang = null, page = null, doc_index = null }) {
      const _candidates = this.selected_set_members
        ? { ...this.selected_set_members }
        : {};
      _candidates[lang] = {};
      _candidates[lang][page] = doc_index;
      this.selected_set_members = { ..._candidates };
    },
  },
};
</script>

<style lang="scss">
.doc-list {
  transition: opacity 0.15s ease;
  &--loading {
    opacity: 0.4;
    pointer-events: none;
  }
}
.doc-tile {
  padding: var(--space-3) var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  &:hover:not(.doc-tile--linked) {
    border-color: var(--accent);
  }
  &--linked {
    background: var(--surface-raised);
    cursor: default;
    .fw-600 { color: var(--text-muted); }
  }
  &--selected {
    background: var(--accent-fill);
    border-color: var(--accent);
    .fw-600, .fs-200 { color: var(--text-on-accent-fill); }
  }
}
.content-sets__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
}
.content-sets__member {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-250);
  color: var(--text-body);
  &:not(:last-child)::after {
    content: "+";
    margin: 0 var(--space-1);
    color: var(--text-muted);
  }
}
</style>
