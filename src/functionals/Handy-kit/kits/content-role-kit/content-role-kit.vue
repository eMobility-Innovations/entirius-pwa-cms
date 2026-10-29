<template>
  <div class="fs-200 t-secondary flex-column gap-8 jc-sb">
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
    <div class="fg-1">
      <Loader v-if="loading" />
      <template v-if="!loading && !setted_contents.length">
        <p class="t-accent">No setted other docs - can proceed.</p>
      </template>
      <div
        class="p-1 b-subtle bg-hover rounded pointer flex jc-sb ai-ct mb-5"
        @click="selected_contents = [doc_uid]"
      >
        <p>{{ doc_uid }}</p>
        <div class="flex gap-1">
          <span class="ph-1 bg-accent-fill t-on-accent-fill rounded fs-200"
            >current doc.</span
          >
          <span
            v-if="selected_contents.includes(doc_uid)"
            class="ph-1 bg-accent-subtle t-strong rounded mr-1 fs-200"
            >selected</span
          >
        </div>
      </div>
      <template v-if="!loading && setted_contents.length">
        <!-- <p class="t-accent mt-2">List of setted contents.</p> -->
        <p class="mb-1">
          Seems like at least one document is already in preview mode.
        </p>
        <p class="fs-200 t-negative mb-2">
          Warning: any other than selected documents will become unpublished.
        </p>
        <div
          v-for="({ uid }, index) in setted_contents"
          class="p-1 b-subtle rounded pointer flex jc-sb ai-ct mb-1"
          :class="{ 'b-default': selected_contents.includes(uid) }"
          @click="selected_contents = [uid]"
        >
          <p>{{ uid }}</p>
          <div class="flex gap-1">
            <span
              v-if="doc_uid === uid"
              class="ph-1 bg-accent-fill t-on-accent-fill rounded fs-200"
              >Current</span
            >
            <span class="ph-1 bg-accent-fill t-on-accent-fill rounded fs-200"
              >setted</span
            >
            <span
              v-if="selected_contents.includes(uid)"
              class="ph-1 bg-accent-subtle t-strong rounded mr-1 fs-200"
              >selected</span
            >
          </div>
        </div>
      </template>
    </div>
    <div class="grid grid-col-3 gap-2 rtl-direction">
      <BasicButton
        variant="primary"
        class="rounded fs-200 w-100 jc-ct"
        :disabled="!selected_contents && !selected_contents.length"
        @click="on_Save"
      >
        {{ $t('common.save') }}
      </BasicButton>
      <BasicButton
        variant="danger"
        class="rounded fs-200 w-100 jc-ct"
        @click="() => {}"
      >
        {{ $t('common.cancel') }}
      </BasicButton>
    </div>
  </div>
</template>
<script>
import { useNotifyStore } from "@/stores/notify";
import { useHandyStore } from "@/stores/handy";
import { _METHOD_content } from "@/api/contentDB/api";
export default {
  setup() {
    const notify = useNotifyStore();
    const handy = useHandyStore();
    return { notify, handy };
  },
  data() {
    return {
      setted_contents: [],
      loading: true,
      role: null,
      doc_uid: null,
      init_doc: null,
      content_type: null,
      type: null,
      language: null,
      //
      selected_contents: [],
    };
  },
  computed: {
    handyType() {
      return this.handy.handyType;
    },
    defaults() {
      return this.handy.defaults;
    },
    options() {
      return this.handy.options;
    },
  },
  methods: {
    open_Handykit(params) {
      this.handy.open_Handykit(params);
    },
    pass_Asset(asset) {
      this.handy.pass_Asset(asset);
    },
    async init() {
      const {
        doc_uid = null,
        doc = null,
        content_type = null,
        type = null,
        language = null,
      } = this.defaults;
      const { role = null } = this.options;

      if (!doc_uid) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
        this.open_Handykit({});
        return;
      }

      if (role === "set_preview") this.role = "preview";
      if (role === "set_home") this.role = "home";
      this.content_type = content_type;
      this.type = type;
      this.doc_uid = doc_uid;
      this.init_doc = doc;
      this.language = language.toLowerCase();
      this.selected_contents.push(doc_uid);
      // fire my laser!
      try {
        const { data: response } = await _METHOD_content({
          method: "get",
          url: `/${content_type}/${type}/`,
          params: { routes: [`${this.role}-${this.language}`] },
        });
        const { data } = response;
        this.setted_contents = data;
      } catch (error) {
        console.log("Ooopsie...");
        console.log(error);
      }

      this.loading = false;
    },
    async on_Save() {
      const _selected = [...this.selected_contents];
      const _setted_contents = [...this.setted_contents].reduce(
        (o, { uid, ...rest }) => {
          o[uid] = {
            uid,
            ...rest,
          };
          return o;
        },
        {}
      );

      const _to_remove = Object.keys(_setted_contents).filter(
        (uid) => !_selected.includes(uid)
      );

      if (_to_remove.length) {
        try {
          const draft_promises = _to_remove.map((uid) => {
            const doc = _setted_contents[uid];
            doc.routes = doc.routes.filter(
              (route) => route !== `${this.role}-${this.language}`
            );

            return _METHOD_content({
              method: "put",
              url: `/${this.content_type}/${this.type}/${uid}/`,
              payload: doc,
            });
          });
          const _p_to_remove = _to_remove.map((uid) => {
            const { is_published = false } = _setted_contents[uid];
            if (is_published) return uid;
          });

          const published_promises = _p_to_remove.map((uid) => {
            const doc = _setted_contents[uid];
            doc.routes = doc.routes.filter(
              (route) => route !== `${this.role}-${this.language}`
            );

            return _METHOD_content({
              method: "delete",
              url: `/${this.content_type}/${this.type}/${uid}/published/?all=true`,
            });
          });

          const d_response = await Promise.allSettled(draft_promises);
          const p_response = await Promise.allSettled(published_promises);
          this.notify.spawnNotification({
            title: this.$t("notifications.success"),
            msg: this.$t("notifications.success_fun"),
            type: "informative",
          });
        } catch (error) {
          console.log("error");
          this.notify.spawnNotification({
            title: this.$t("notifications.error"),
            msg: this.$t("notifications.save_error"),
            type: "negative",
          });
          console.log(error);
          return;
        }
      }

      const draf_promises = _selected.map((uid, index) => {
        const { routes, ...rest } = _setted_contents[uid] || this.init_doc;

        return _METHOD_content({
          method: "put",
          url: `/${this.content_type}/${this.type}/${uid}/`,
          payload: {
            ...rest,
            routes: [`${this.role}-${this.language}`],
          },
        });
      });
      const publish_promises = _selected.map((uid, index) => {
        const { routes, ...rest } = _setted_contents[uid] || this.init_doc;

        return _METHOD_content({
          method: "post",
          url: `/${this.content_type}/${this.type}/${uid}/published/`,
          payload: {
            ...rest,
            routes: [`${this.role}-${this.language}`],
          },
        });
      });
      this.pass_Asset([`${this.role}-${this.language}`]);
      this.open_Handykit({});
    },
  },
  created() {
    this.init();
  },
};
</script>
