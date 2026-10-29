<template>
  <div class="flex-column gap-8 jc-sb relative h-100">
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
      <p class="fs-200 mv-8 t-secondary fw-600">
        {{ $t("order.drag_to_reorder") }}
      </p>
      <draggable
        v-model="order"
        v-if="order && order.length"
        ghost-class="bg-accent-fill"
        handle=".handle-button"
        :item-key="(el) => el"
        class="grid grid-col-1 gap-2"
      >
        <template #item="{ element: uid }">
          <div
            class="handle-button rounded b-default bg-base fs-200 t-secondary p-2 pointer"
          >
            <p class="fs-200 fw-600 t-body">
              {{
                inserts[uid]?.core_type
                  ? formatCoreType(inserts[uid].core_type)
                  : ""
              }}
            </p>
            <p v-if="inserts[uid]?.title" class="fs-200 t-secondary mt-1 lc-1">
              {{ inserts[uid].title }}
            </p>
            <p
              v-else-if="inserts[uid]?.sku || inserts[uid]?.product_sku"
              class="fs-200 t-accent mt-1"
            >
              SKU: {{ inserts[uid]?.sku || inserts[uid]?.product_sku }}
            </p>
            <p class="fs-200 t-muted mt-1">{{ uid.substring(0, 8) }}</p>
          </div>
        </template>
      </draggable>
    </div>

    <div
      class="grid grid-col-3 rtl-direction bg-raised pl-10 pr-10 pt-2 pb-2 w-100"
      style="bottom: 0"
    >
      <BasicButton
        variant="primary"
        class="rounded fs-200 w-100 jc-ct"
        @click="pass_asset"
      >
        {{ $t('common.save') }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useHandyStore } from "@/stores/handy";
import draggable from "vuedraggable";
export default {
  setup() {
    const notify = useNotifyStore();
    const handy = useHandyStore();
    return { notify, handy };
  },
  data() {
    return {
      inserts: null,
      order: null,
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
    formatCoreType(coreType) {
      return coreType
        .replace(/^(section|tile)-/, "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    },
    init() {
      if (!Object.keys(this.defaults).length) return;
      const { order, inserts } = this.defaults;
      this.order = order;
      this.inserts = inserts;
    },
    pass_asset(section) {
      this.pass_Asset(this.order);
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
  },
  components: {
    draggable,
  },
};
</script>
