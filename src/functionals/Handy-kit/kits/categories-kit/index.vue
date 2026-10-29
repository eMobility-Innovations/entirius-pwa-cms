<template>
  <div class="categories-kit fs-200 t-secondary flex-column fg-1 jc-sb gap-8">
    <div class="grid gap-8">
      <nav
        class="grid grid-col-2 grid-col-2-m ai-ct bg-raised pl-10 pr-10 pt-5 pb-5 t-secondary rounded-tl rounded-tr"
      >
        <p class="fw-600 fs-400 uppercase">
          {{ handyType.label ? handyType.label : $t("common.click") }}
        </p>
        <p
          class="js-fe t-secondary"
          @click="handy.open_Handykit({ typeId: false })"
        >
          <FontAwesomeIcon :icon="$icons.close" class="pointer" />
        </p>
      </nav>
      <div class="ph-8">
        <div
          :class="
            editing_category ? 'p-5 rounded bg-raised b-accent' : ''
          "
          :style="
            editing_category
              ? 'border-left: 3px solid var(--accent)'
              : ''
          "
        >
          <p
            class="mb-2"
            :class="{ 'fs-200 fw-600 t-accent': editing_category }"
          >
            {{
              editing_category
                ? $t("categories.edit_category")
                : $t("images.add_new_category")
            }}
          </p>
          <div class="flex gap-2">
            <BasicInput
              v-model="new_c"
              class="lh-base-elem w-50"
              :placeholder="$t('common.start_typing')"
            />
            <BasicButton
              v-if="editing_category"
              variant="secondary"
              class="rounded fs-200"
              @click="
                editing_category = null;
                new_c = '';
              "
            >
              {{ $t('common.cancel') }}
            </BasicButton>
            <BasicButton
              variant="primary"
              class="rounded fs-200"
              @click="
                editing_category
                  ? PUT_CATEGORY({
                      uid: editing_category.uid,
                      cat_name: new_c,
                      language: language,
                    })
                  : POST_CATEGORY({ cat_name: new_c, language: language })
              "
            >
              {{ editing_category ? $t('common.save') : $t('common.post') }}
            </BasicButton>
          </div>
        </div>
        <hr class="bb-subtle mv-8" />
        <p class="mb-2">
          {{
            ` ${
              !c || (Array.isArray && !c.length)
                ? $t("categories.select_category")
                : $t("categories.category")
            }`
          }}
        </p>
        <BasicMenu
          :key="`dropdown-${Object.values(c_to_set ?? {}).at(1)}`"
          class="w-100"
          :label="$t('categories.category')"
        >
          <template #trigger>
            <BasicButton
              variant="secondary"
              class="w-100"
              :disabled="!c || (Array.isArray && !c.length)"
            >
              {{
                !c || (Array.isArray && !c.length)
                  ? $t('categories.select_category')
                  : $t('categories.category')
              }}
            </BasicButton>
          </template>
          <template #panel>
            <div class="categories-kit__list ovy-auto">
              <div
                v-for="{ label = null, value = null } in c"
                class="ph-2 flex jc-sb ai-ct"
                @click="
                  c_to_set = { label, value };
                  if (editing_category) {
                    editing_category = null;
                    new_c = '';
                  }
                "
              >
                <span>{{ label }} </span>
                <span class="flex gap-5 ai-ct">
                  <span
                    class="t-accent pointer"
                    @click.stop="
                      editing_category = { uid: value, name: label };
                      new_c = label;
                    "
                    >{{ $t("common.edit") }}</span
                  >
                  <span
                    class="t-negative pointer"
                    @click.stop="
                      confirmation_modal = true;
                      to_delete = value;
                    "
                    >{{ $t("common.delete") }}</span
                  >
                </span>
              </div>
              <div :ref="observe_sentinel" class="categories-kit__sentinel" />
            </div>
          </template>
        </BasicMenu>
        <template v-if="c_to_set">
          <div
            class="mv-8 t-secondary bg-raised p-2 rounded b-default flex"
          >
            <div class="fg-1">
              <p class="fs-300 fw-600">{{ $t("categories.category") }}:</p>
              <p class="fs-200 mt-2">
                {{ c_to_set.label }} ({{ c_to_set.value }})
              </p>
            </div>
            <BasicButton
              variant="danger"
              class="rounded"
              @click="pass_asset({ force_unset: true })"
            >
              {{ $t('categories.unset') }}
            </BasicButton>
          </div>
        </template>
      </div>
    </div>

    <ConfirmDialog
      tone="danger"
      :open="confirmation_modal"
      @confirm="
        () => {
          DELETE_CATEGORY(to_delete);
          confirmation_modal = false;
          to_delete = null;
        }
      "
      @cancel="
        confirmation_modal = false;
        to_delete = null;
      "
      :title="$t('builder.confirm_title')"
    >
      <template #default>
        <p>{{ $t("builder.confirm_msg") }}</p>
      </template>
    </ConfirmDialog>

    <div
      class="grid grid-col-3 rtl-direction bg-raised pl-10 pr-10 pt-2 pb-2"
    >
      <BasicButton
        variant="primary"
        class="rounded w-100 jc-ct"
        :disabled="!c_to_set"
        @click="pass_asset({})"
      >
        {{ $t('common.save') }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useHandyStore } from "@/stores/handy";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { _METHOD_content } from "../../../../api/contentDB/api";

const _base_url = `/category/`;
// Pixels below the end of the list at which the next page loads.
const LOAD_MORE_THRESHOLD = 24;
export default {
  setup() {
    const notify = useNotifyStore();
    const handy = useHandyStore();
    const contentDBChannel = useContentDBChannelStore();
    return { notify, handy, contentDBChannel };
  },
  components: {},
  data() {
    return {
      loading: false,
      c: null,
      cp: null,
      new_c: "",
      editing_category: null,
      confirmation_modal: false,
      to_delete: null,
      language: null,
      c_to_set: null,
      default_c: null,
    };
  },
  computed: {
    handyType() {
      return this.handy.handyType;
    },
    defaults() {
      return this.handy.defaults;
    },
  },
  methods: {
    open_Handykit(params) {
      this.handy.open_Handykit(params);
    },
    pass_Asset(asset) {
      this.handy.pass_Asset(asset);
    },
    set_additional_data() {
      const { lg = null } = this.$route.query;
      this.language = lg || this.contentDBChannel.defaultLanguage || "en";

      const { category: default_category = null } = this.defaults;
      this.default_c = default_category;

      if (default_category && typeof default_category === "object") {
        this.c_to_set = {
          label: default_category.name,
          value: default_category.uid,
        };
      }

      if (default_category && typeof default_category === "string")
        this.GET_CATEGORY({ uid: default_category });
    },
    // The first page loads with the kit; the next one when the sentinel after the last row comes into the list's
    // view, which also covers a first page too short to scroll. The list remounts with the menu (its :key).
    observe_sentinel(el) {
      if (el === this.sentinel) return;
      this.observer?.disconnect();
      this.sentinel = el;
      if (!el) return;
      this.observer = new IntersectionObserver(([entry]) => entry.isIntersecting && this.load_more(), {
        root: el.parentElement,
        rootMargin: `0px 0px ${LOAD_MORE_THRESHOLD}px 0px`,
      });
      this.observer.observe(el);
    },
    async load_more() {
      const { page = 1, pages = 1 } = this.cp ?? {};
      if (this.loading || page >= pages) return;
      this.cp.page = page + 1;
      await this.GET_CATEGORIES({ page: page + 1, limit: this.cp.limit, language: this.language });
    },
    // After a page lands (also one that made load_more return early): a sentinel still in view loads the next one.
    // Observing again makes the observer report the current state.
    async recheck_sentinel() {
      await this.$nextTick();
      if (!this.sentinel || !this.observer) return;
      this.observer.unobserve(this.sentinel);
      this.observer.observe(this.sentinel);
    },
    async GET_CATEGORIES({ limit = 6, page = 1, language = null } = {}) {
      try {
        this.loading = true;
        const { data: response = null } = await _METHOD_content({
          method: "get",
          url: _base_url,
          params: {
            limit,
            page,
            language: language ? language.toUpperCase() : undefined,
          },
        });

        const { data = null, meta = null, pagination = null } = response ?? {};

        if (!this.c) this.c = [];

        if (!data || (Array.isArray(data) && !data.length)) return;

        const _data = data.map(({ uid = null, name = null }) => {
          return {
            label: name,
            value: uid,
          };
        });

        // A category created while the pages load comes back in a later page: keep it once.
        const known = new Set(this.c.map(({ value }) => value));
        this.c = [...this.c, ..._data.filter(({ value }) => !known.has(value))];

        if (!this.cp) this.cp = pagination;
      } catch (error) {
        console.log(error);
      } finally {
        this.loading = false;
        this.recheck_sentinel();
      }
    },
    async GET_CATEGORY({ uid }) {
      try {
        const { data: response = null } = await _METHOD_content({
          method: "get",
          url: `${_base_url}${uid}`,
        });

        const { data = null } = response ?? {};
        if (!data) return;

        const { name = null, uid: _uid = null } = data ?? {};

        this.c_to_set = {
          label: name,
          value: _uid,
        };
      } catch (error) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
      }
    },
    async POST_CATEGORY({ cat_name = "", language = "pl" }) {
      if (!cat_name.length) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("categories.empty_fields"),
          type: "negative",
        });
        return;
      }

      try {
        const payload = {
          name: cat_name,
          url_key: cat_name.split(" ").join("-"),
        };
        if (language) payload.language = language.toUpperCase();

        const { data: response = null } = await _METHOD_content({
          method: "post",
          url: _base_url,
          payload,
        });
        const { data = null } = response ?? {};
        if (!data) return;

        const { name: res_name = null, uid = null } = data ?? {};

        this.c = [
          {
            label: res_name,
            value: uid,
          },
          ...this.c,
        ];

        this.notify.spawnNotification({
          title: this.$t("notifications.success"),
          msg: this.$t("notifications.success_fun"),
          type: "positive",
        });
      } catch (error) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
      }
    },
    async PUT_CATEGORY({ uid = null, cat_name = "", language = "pl" }) {
      if (!cat_name.length) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("categories.empty_fields"),
          type: "negative",
        });
        return;
      }

      try {
        const payload = {
          name: cat_name,
          url_key: cat_name.split(" ").join("-"),
        };
        if (language) payload.language = language.toUpperCase();

        await _METHOD_content({
          method: "put",
          url: `${_base_url}${uid}/`,
          payload,
        });

        this.c = this.c.map((item) => {
          if (item.value === uid) {
            return { label: cat_name, value: uid };
          }
          return item;
        });

        if (this.c_to_set && this.c_to_set.value === uid) {
          this.c_to_set = { label: cat_name, value: uid };
        }

        this.editing_category = null;
        this.new_c = "";

        this.notify.spawnNotification({
          title: this.$t("notifications.success"),
          msg: this.$t("notifications.success_fun"),
          type: "positive",
        });
      } catch (error) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
      }
    },
    async DELETE_CATEGORY(uid) {
      try {
        const { data: response = null } = await _METHOD_content({
          method: "delete",
          url: `${_base_url}${uid}`,
        });

        // NO RESPONSE xD

        this.c = this.c.filter(({ value }) => value !== uid);
      } catch (error) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
      }
    },
    pass_asset({ force_unset = false } = {}) {
      if (force_unset) {
        this.pass_Asset(null);
        this.open_Handykit({});
        return;
      }

      const { value = null } = this.c_to_set;
      if (!value) return;
      this.pass_Asset(value);
      this.open_Handykit({});
    },
    async init() {
      this.set_additional_data();
      await this.GET_CATEGORIES({ language: this.language });
    },
  },
  created() {
    this.init();
  },
  beforeUnmount() {
    this.observer?.disconnect();
  },
};
</script>
<style lang="scss">
.categories-kit {
  .categories-kit__list {
    max-height: 10rem;
  }
}
</style>
