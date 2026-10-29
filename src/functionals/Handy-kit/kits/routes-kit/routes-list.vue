<template>
  <div class="flex-column gap-8 jc-sb fg-1">
    <div class="fg-1 pl-10 pr-10 ovy-auto pb-10 h-100">
      <div>
        <p class="t-secondary" v-if="type === 'static-page'">
          {{ $t("routes.paths_for_doc") }}
        </p>
        <p class="t-secondary" v-else-if="type === 'blog-post'">
          {{ $t("routes.linked_paths") }}
        </p>
        <p class="t-secondary" v-else>{{ $t("routes.linked_paths") }}</p>

        <hr class="mv-2" />
        <div class="flex gap-2">
          <div class="fg-1">
            <div class="flex ai-ct gap-1">
              <BasicSelect
                :floating-label="`${$t('routes.list_of_paths')} (${routes.length})`"
                class="fg-1"
                :options="routes"
                :model-value="shown_route"
                :aria-invalid="error ? 'true' : undefined"
                @update:model-value="
                  ($event) => {
                    picked_route = $event;
                    const { draft = null, url = null, label = null } = $event;
                    if (mode) CLOSE_form();
                    error = false;
                    if (draft) error = true;

                    if (['static-page', 'blog-post'].includes(type)) {
                      selected = [{ label, value: { draft, url, label } }];
                      return;
                    }

                    if (!selected) selected = [];

                    if (selected.some(({ value }) => value.url === url)) return;

                    selected.push({ label, value: { draft, url, label } });
                  }
                "
              />
            </div>
            <!-- Edit and delete act on their own row, never on the route picked above. The rows follow a filter and
                 stop at MANAGE_LIMIT; a route in use by this document can be edited, not deleted. -->
            <FormField v-if="routes.length" class="mt-5" :label="$t('routes.filter')">
              <BasicInput v-model="manage_filter" icon="search" />
            </FormField>
            <ul v-if="managed_routes.length" class="routes-manage mt-2 flex-column gap-1">
              <li v-for="route in managed_routes" :key="route.value.url" class="flex ai-ct gap-1">
                <span class="fg-1 lc-1" :title="route.value.url">{{ route.label }}</span>
                <IconButton
                  size="sm"
                  icon="edit"
                  :label="`${$t('common.edit')}: ${route.label}`"
                  @click="ENTER_edit_mode({ ...route.value })"
                />
                <IconButton
                  v-if="!in_use(route.value.url)"
                  size="sm"
                  icon="delete"
                  variant="danger"
                  :label="`${$t('common.delete')}: ${route.label}`"
                  @click="
                    confirmation_modal = true;
                    to_delete = route.value.url;
                  "
                />
              </li>
            </ul>
            <p v-if="managed_more" class="fs-200 t-muted mt-2">{{ $t("routes.more", { count: managed_more }) }}</p>
            <template v-if="!['static-page', 'blog-post'].includes(type)">
              <p class="mt-8 mb-5">
                {{ $t("routes.multi_route_info") }}
              </p>
              <div class="flex ai-ct gap-1">
                <BasicSelect
                  :floating-label="`${$t('routes.setted_routes')} (${selected ? selected.length : 0})`"
                  v-model="picked_setted"
                  class="fg-1"
                  :disabled="!selected"
                  :options="!selected ? [] : selected"
                />
                <IconButton
                  v-if="picked_setted"
                  icon="close"
                  variant="danger"
                  :label="$t('categories.unset')"
                  @click="
                    selected = selected.filter(
                      ({ label, value }) => value.url !== picked_setted.url
                    );
                    picked_setted = null;
                  "
                />
              </div>
            </template>
          </div>
          <BasicButton
            style="min-width: 5.5rem"
            :class="{ 'jc-ct': mode }"
            variant="secondary"
            class="as-s rounded"
            @click="
              () => {
                error = null;
                !mode ? (mode = 'add') : CLOSE_form();
              }
            "
          >
            {{ !mode ? $t('routes.set_new') : $t('common.close') }}
          </BasicButton>
        </div>
        <hr class="mv-2" />

        <p class="fs-200 t-secondary" v-if="type === 'static-page'">
          {{ $t("routes.static_page_help") }}
        </p>
        <p class="fs-200 t-secondary" v-else-if="type === 'blog-post'">
          {{ $t("routes.blog_post_help") }}
        </p>
        <p class="fs-200 t-secondary" v-else>
          {{ $t("routes.product_help") }}
        </p>

        <hr class="mv-2" />

        <div
          v-if="mode"
          class="mb-8 p-5 rounded"
          :class="
            mode === 'edit'
              ? 'bg-raised b-accent'
              : 'bg-base b-default'
          "
          :style="
            mode === 'edit' ? 'border-left: 3px solid var(--accent)' : ''
          "
          :key="force_refresh"
        >
          <div class="grid grid-col-2 gap-2">
            <FormField :label="$t('routes.route_value')">
              <BasicInput
                class="rounded bg-base lh-base-elem"
                v-model="route_label"
              />
            </FormField>
            <FormField :label="'URL'">
              <BasicInput
                class="rounded bg-base lh-base-elem"
                v-model="route_url"
              />
            </FormField>
          </div>

          <hr class="mv-2" />
          <div class="flex jc-fe gap-2">
            <BasicButton
              v-if="mode === 'edit'"
              variant="secondary"
              class="rounded"
              @click="CLOSE_form"
            >
              {{ $t('common.cancel') }}
            </BasicButton>
            <BasicButton
              variant="primary"
              class="rounded"
              @click="SET_route({ label: route_label, url: route_url })"
            >
              {{ mode === 'edit' ? $t('common.save') : $t('routes.add_route') }}
            </BasicButton>
          </div>
        </div>
      </div>
    </div>
    <ConfirmDialog
      tone="danger"
      :open="confirmation_modal"
      @confirm="
        () => {
          DELETE_Route({ url: to_delete });
          picked_route = null;
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
        @click="pass_asset(selected)"
        :disabled="!selected"
      >
        {{ $t('common.save') }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import { _METHOD_content } from "@/api/contentDB/api";
import { useNotifyStore } from "@/stores/notify";
import { useHandyStore } from "@/stores/handy";

const MANAGE_LIMIT = 10;

export default {
  setup() {
    const notify = useNotifyStore();
    const handy = useHandyStore();
    return { notify, handy };
  },
  components: {},
  data() {
    return {
      routes: [],
      type: null,
      route_payload: null,
      mode: null,
      // -------------------------------
      route_label: "",
      route_url: "",
      editing_route: null,
      confirmation_modal: false,
      to_delete: null,
      selected: null,
      // The route the list shows and the set route picked for unset.
      picked_route: null,
      picked_setted: null,
      manage_filter: "",
      error: null,
      force_refresh: 1,
    };
  },
  computed: {
    handyType() {
      return this.handy.handyType;
    },
    defaults() {
      return this.handy.defaults;
    },
    matching_routes() {
      const query = this.manage_filter.trim().toLowerCase();
      if (!query) return this.routes;
      return this.routes.filter(({ label, value }) => `${label} ${value.url}`.toLowerCase().includes(query));
    },
    managed_routes() {
      return this.matching_routes.slice(0, MANAGE_LIMIT);
    },
    managed_more() {
      return Math.max(this.matching_routes.length - MANAGE_LIMIT, 0);
    },
    shown_route() {
      if (this.picked_route) return this.picked_route;
      return Array.isArray(this.selected) && this.selected.at(0) ? this.selected.at(0).value : null;
    },
  },
  methods: {
    in_use(url) {
      return Array.isArray(this.selected) && this.selected.some(({ value }) => value.url === url);
    },
    open_Handykit(params) {
      this.handy.open_Handykit(params);
    },
    pass_Asset(asset) {
      this.handy.pass_Asset(asset);
    },
    init() {
      const { type = null, routes = null } = this.defaults;
      if (!type) return;
      this.type = type;
      this.route_payload = routes;
      this.selected = !routes
        ? null
        : routes.map((url) => ({
            label: url,
            value: {
              url,
              draft: null,
              label: url,
            },
            description: this.$t("routes.in_use"),
          }));
    },
    sortRoutes() {
      this.routes.sort((a, b) => {
        if (!this.route_payload) return 0;

        const aInPayload = this.route_payload.includes(a.value.url);
        const bInPayload = this.route_payload.includes(b.value.url);
        if (aInPayload && !bInPayload) return -1;
        if (!aInPayload && bInPayload) return 1;
        return 0;
      });
    },
    async GET_Navigation({ type = null }) {
      if (!type) return;

      try {
        this.loading = true;
        const { data: response } = await _METHOD_content({
          url: "/routes/",
          method: "get",
          type,
        });
        const data = response?.results ?? response?.data ?? null;

        if (!data) return;
        this.routes = data.map(
          ({ url = null, label = null, placement = null, draft = null }) => {
            const model = {
              label,
              value: {
                url,
                draft,
                label,
              },
            };

            return model;
          }
        );

        this.sortRoutes();
      } catch (error) {
        console.log("GET  NAV ERROR", error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          type: "negative",
          timeout: "2500",
        });
      } finally {
        this.loading = false;
      }
    },
    async DELETE_Route({ url = null }) {
      if (!url) return;
      try {
        this.loading = true;
        const { data: response, meta } = await _METHOD_content({
          url: `/routes/${url.replace(/^\//, '')}`,
          method: "delete",
        });
        this.notify.spawnNotification({
          title: this.$t("notifications.deleted"),
          type: "informative",
          timeout: "2500",
        });
        this.routes = this.routes.filter(({ value }) => {
          const { url: _url = null } = value;
          return _url !== url;
        });
      } catch (error) {
        console.log("DELETE  NAV ERROR", error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          type: "negative",
          timeout: "2500",
        });
      } finally {
        this.loading = false;
      }
    },
    ENTER_edit_mode({ url = null, label = null }) {
      this.mode = "edit";
      this.editing_route = url;
      this.route_label = label || "";
      this.route_url = url || "";
      this.error = null;
    },
    CLOSE_form() {
      this.mode = null;
      this.editing_route = null;
      this.route_label = "";
      this.route_url = "";
      this.error = null;
    },
    async SET_route({ label = null, url = null }) {
      if (!label || !url) {
        this.notify.spawnNotification({
          title: this.$t("categories.empty_fields"),
          type: "negative",
          timeout: "2500",
        });
        return;
      }

      const isEdit = this.mode === "edit";

      try {
        this.loading = true;
        const { data: response, meta } = await _METHOD_content({
          url: isEdit ? `/routes/${this.editing_route.replace(/^\//, '')}/` : `/routes/`,
          method: isEdit ? "put" : "post",
          payload: {
            label,
            url,
          },
        });
        this.notify.spawnNotification({
          title: this.$t("notifications.success"),
          type: "informative",
          timeout: "2500",
        });

        if (isEdit) {
          this.picked_route = null;
          this.routes = this.routes.map((route) => {
            if (route.value.url === this.editing_route) {
              return {
                label,
                value: { url, draft: route.value.draft, label },
              };
            }
            return route;
          });

          if (this.selected && Array.isArray(this.selected)) {
            this.selected = this.selected.map((s) => {
              if (s.value?.url === this.editing_route) {
                return {
                  label,
                  value: { url, draft: s.value.draft, label },
                  description: this.$t("routes.in_use"),
                };
              }
              return s;
            });
          }
        } else {
          this.routes = [
            {
              label,
              value: { url, draft: null, label },
            },
            ...this.routes,
          ];
        }

        this.CLOSE_form();
        this.force_refresh += this.force_refresh;
      } catch (error) {
        console.log("SET ROUTE ERROR", error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          type: "negative",
          timeout: "2500",
        });
      } finally {
        this.loading = false;
      }
    },
    // TO REMOVE ---------------
    // TO REMOVE ---------------
    // TO REMOVE ---------------
    // TO REMOVE ---------------
    pass_asset(routes) {
      let route = routes.map(({ label = null, value = null }) => {
        if (!value) return;
        const { url = null } = value;
        return url;
      });

      this.pass_Asset(route);
      this.notify.spawnNotification({
        title: this.$t("notifications.success"),
        msg: this.$t("notifications.success_fun"),
        type: "informative",
      });
      this.open_Handykit({});
    },
  },
  created() {
    this.init();
    this.GET_Navigation({ type: this.type });
    // const { type = "static-page" } = this.$route.query;
    // this.routes =
    //   this.defaults && this.defaults.routes ? this.defaults.routes : [];
    // this.getStaticsRoutes({ type });
    // this.type = type;
  },
};
</script>
