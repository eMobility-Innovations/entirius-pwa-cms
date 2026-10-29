<template>
  <div class="flex-column gap-8 jc-sb h-100 fs-200 t-body">
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
    <div class="fg-1 pl-10 pr-10 ovy-auto pb-10">
      <div class="grid gap-2 mt-5">
        <div>
          <BasicSwitch
            class="rtl-direction"
            :label="index === 'Index' ? 'Index' : 'No-index'"
            :model-value="index === 'Index'"
            @update:model-value="(on) => (index = on ? 'Index' : 'No-index')"
          />
        </div>
        <div>
          <BasicSwitch
            class="rtl-direction"
            :label="follow === 'Follow' ? 'Follow' : 'No-follow'"
            :model-value="follow === 'Follow'"
            @update:model-value="(on) => (follow = on ? 'Follow' : 'No-follow')"
          />
        </div>
        <div class="mt-10">
          <FormField :label="`${$t('meta.meta_title')} - ${title.length}/60`">
            <BasicInput
              class="bg-base lh-base-elem"
              v-model="title"
            />
          </FormField>
        </div>
        <div class="mt-5">
          <span class="block fs-200 mb-1">{{
            `${$t("meta.meta_description")} - ${description.length}/160`
          }}</span>
          <BasicTextarea class="size-sm bg-base" v-model="description" />
        </div>
        <div class="mt-8">
          <FormField :label="`${$t('meta.og_title')} - ${og_title.length}/60`">
            <BasicInput
              class="bg-base lh-base-elem"
              v-model="og_title"
            />
          </FormField>
        </div>
        <div class="mt-5">
          <span class="block fs-200 mb-1">{{
            `${$t("meta.og_description")} - ${og_description.length}/160`
          }}</span>
          <BasicTextarea
            class="size-sm bg-base"
            v-model="og_description"
          />
        </div>
      </div>
      <div class="mt-5">
        <span class="block fs-200 mb-1">{{ $t("meta.og_image") }}</span>
        <div class="grid grid-col-6 gap-2" v-if="pictures">
          <div
            class="pointer ov-h relative b-accent rounded grid-square shadow-down"
            :class="{ 'b-negative': !og_image.length }"
          >
            <div v-if="!og_image.length" class="flex jc-ct ai-ct h-100">
              <span class="fs-200">empty</span>
            </div>
            <div v-else class="relative w-100 h-100">
              <div
                class="meta-kit__remove absolute bg-base rounded-lg ov-h t-negative"
              >
                <IconButton
                  icon="close"
                  variant="danger"
                  size="sm"
                  :label="$t('common.delete')"
                  @click="og_image = ''"
                />
              </div>
              <img class="absolute absolute-ct" :src="og_image" alt="" />
            </div>
          </div>
          <div
            class="pointer relative b-subtle p-2 rounded grid-square"
            v-for="(p, i) in pictures[c_page]"
            @click="
              () => {
                og_image = p.image;
              }
            "
          >
            <BasicTooltip
              :text="p.meta && p.meta.fileName ? p.meta.fileName : 'No title'"
              class="absolute absolute-ct w-100 h-100"
            >
              <!-- <p>{{ image.set }}</p> -->
              <BasicImage
                class="absolute absolute-ct w-100"
                :set="p.set"
                :higher_rez="false"
                :ommit_media_query="true"
                :key="p.uid"
              />
            </BasicTooltip>
          </div>
        </div>
        <div class="flex jc-sb mt-5">
          <BasicSelect
            :floating-label="$t('common.sort_by')"
            :options="[
              { label: $t('common.oldest_first'), value: 'created_at' },
              { label: $t('common.newest_first'), value: '-created_at' },
            ]"
            :model-value="sort_by"
            @update:model-value="
              ($event) => {
                pictures = null;
                m_pages = 1;
                c_page = 1;
                sort_by = $event;
                GET_GALLERY({
                  method: 'get',
                  url: '/images/',
                  params: { page: c_page, limit: limit, sort: $event },
                });
              }
            "
          />
          <Pagination
            v-if="pagination"
            :nav_size="32"
            :page="c_page"
            :pages="pagination.pages"
            @update:page="
              GET_GALLERY({
                method: 'get',
                url: '/images/',
                params: { page: $event, limit: limit },
              })
            "
          />
        </div>
      </div>
    </div>
    <div
      class="grid grid-col-3 rtl-direction bg-raised pl-10 pr-10 pt-2 pb-2"
    >
      <BasicButton
        variant="primary"
        class="rounded fs-200 w-100 jc-ct"
        @click="
          pass_asset({
            index,
            follow,
            title,
            og_image,
            og_title,
            description,
            og_description,
          })
        "
      >
        {{ $t('common.save') }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useHandyStore } from "@/stores/handy";
//import { GET_Images } from "@/api/contentDB/api";
import { _METHOD_content } from "@/api/contentDB/api";

// import Pagination from "@/components/Chunks/Pagination.vue";
export default {
  setup() {
    const notify = useNotifyStore();
    const handy = useHandyStore();
    return { notify, handy };
  },
  data() {
    return {
      index: "Index",
      follow: "Follow",
      title: "",
      og_image: "",
      og_title: "",
      description: "",
      og_description: "",
      //
      show_gallery: false,
      pictures: null,
      pagination: null,
      c_page: 1,
      m_pages: 1,
      limit: 5,
      sort_by: "created_at",
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
  created() {
    this.init();
  },
  methods: {
    open_Handykit(params) {
      this.handy.open_Handykit(params);
    },
    pass_Asset(asset) {
      this.handy.pass_Asset(asset);
    },
    init() {
      const { meta } = this.defaults ?? {};
      if (meta) {
        Object.entries(meta).forEach(([key, value]) => {
          this[key] = value;
        });
      }

      // temp
      this.GET_GALLERY({
        method: "get",
        url: "/images/",
        params: { page: this.c_page, limit: this.limit, sort: this.sort_by },
      });
    },
    pass_asset({
      index = null,
      follow = null,
      title = null,
      og_image = null,
      og_title = null,
      description = null,
      og_description = null,
    }) {
      const _config = {
        index,
        follow,
        title,
        og_image,
        og_title,
        description,
        og_description,
      };
      // ----
      this.pass_Asset(_config);
      this.notify.spawnNotification({
        title: this.$t("notifications.success"),
        msg: this.$t("notifications.success_fun"),
        type: "informative",
      });
      this.open_Handykit({});
    },
    async GET_GALLERY({ method = "get", url = null, params = {}, ...options }) {
      const { page = 1 } = params;
      if (this.pictures && this.pictures[page]) {
        this.c_page = page;
        return;
      }

      try {
        const { data: resposne } = await _METHOD_content({
          method,
          url,
          params,
          ...options,
        });
        const { data = [], pagination = {} } = resposne;

        const { page = null, pages = null } = pagination;
        this.c_page = page;
        if (!this.pictures) this.pictures = {};
        this.pictures[page] = data;
        this.pagination = pagination;
      } catch (error) {
        console.log("error");
        console.log(error);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.meta-kit__remove {
  top: var(--space-1);
  right: var(--space-1);
  z-index: 2;
}
</style>
