<template>
  <div class="handy-kit" @click.self="requestClose">
    <div
      class="handy-kit-core fs-300 t-body flex flex-column b-default rounded"
    >
      <div class="handy-kit-body flex-column fg-1 ov-h bg-base">
        <component :is="handyType.id" class="fg-1 ovy-auto" ref="activeKit" />
      </div>
      <Transition name="loader-fade"><Loader v-if="handyLoading" overlay contained /></Transition>
    </div>
    <Teleport to="body">
      <ConfirmDialog
        :open="showUnsavedConfirm"
        @cancel="showUnsavedConfirm = false"
        @discard="forceClose"
        @confirm="saveAndClose"
        :title="$t('unsaved.title')"
        :message="$t('unsaved.message')"
        :confirm-label="$t('unsaved.save_and_leave')"
        :discard-label="$t('unsaved.discard')"
      />
    </Teleport>
  </div>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useHandyStore } from "@/stores/handy";

import ImagesKit from "./kits/images-kit/images-kit.vue";
import ConfigsKit from "./kits/configs-kit/index.vue";
import OrderKit from "./kits/order-kit/index.vue";
import RoutesKit from "./kits/routes-kit/routes-kit.vue";
import MetaKit from "./kits/meta-kit/meta-kit.vue";
import AttrsKit from "./kits/attrs-kit/attrs-kit.vue";
import ContentRoleKit from "./kits/content-role-kit/content-role-kit.vue";
import CategoriesKit from "./kits/categories-kit/index.vue";
export default {
  setup() {
    const loader = useLoaderStore();
    const handy = useHandyStore();
    return { loader, handy };
  },
  data() {
    return {
      showUnsavedConfirm: false,
    };
  },
  computed: {
    handyType() {
      return this.handy.handyType;
    },
    handyLoading() {
      return this.loader.handyLoading;
    },
  },
  methods: {
    requestClose() {
      if (this.handy.isDirty) {
        this.showUnsavedConfirm = true;
        return;
      }
      this.closeDrawer();
    },
    closeDrawer() {
      this.showUnsavedConfirm = false;
      this.handy.open_Handykit(false);
    },
    forceClose() {
      this.handy.isDirty = false;
      this.closeDrawer();
    },
    saveAndClose() {
      this.showUnsavedConfirm = false;
      const kit = this.$refs.activeKit;
      if (kit && typeof kit.pass_asset === "function") {
        kit.pass_asset({});
      } else {
        this.forceClose();
      }
    },
  },
  components: {
    ImagesKit,
    OrderKit,
    ConfigsKit,
    RoutesKit,
    MetaKit,
    AttrsKit,
    CategoriesKit,
    ContentRoleKit,
  },
};
</script>

<style lang="scss">
.handy-kit {
  position: fixed;
  bottom: 0;
  top: 0;
  right: 0;
  left: 0;
  background-color: var(--overlay-handy);
  z-index: 100;
  cursor: pointer;

  .handy-kit-core {
    height: 100vh;
    width: 50rem;
    position: absolute;
    right: 0;
    top: 0;
    cursor: default;
    @media only screen and (max-width: 768px) {
      width: 100%;
    }
  }

}
</style>
