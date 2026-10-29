<template>
  <div class="routes-kit fs-200 t-secondary flex-column gap-8">
    <nav
      class="grid grid-col-2 grid-col-2-m ai-ct bg-raised pl-10 pr-10 pt-5 pb-5 t-secondary rounded-tl rounded-tr"
    >
      <p class="fw-600 fs-400 uppercase">
        {{ handyType.label ? handyType.label : "kliknij" }}
      </p>
      <p
        class="js-fe t-secondary"
        @click="handy.open_Handykit({ typeId: false })"
      >
        <FontAwesomeIcon :icon="$icons.close" class="pointer" />
      </p>
    </nav>
    <component :is="fold" />
  </div>
</template>

<script>
import RoutesList from "./routes-list.vue";
import { useHandyStore } from "@/stores/handy";

export default {
  setup() {
    const handy = useHandyStore();
    return { handy };
  },
  data() {
    return {
      fold: "RoutesList",
    };
  },
  components: {
    RoutesList,
  },
  computed: {
    handyType() {
      return this.handy.handyType;
    },
    handyFold() {
      return this.handy.handyFold;
    },
    preventOtherTabs() {
      return this.handy.preventOtherTabs;
    },
  },
  methods: {
    open(tab) {
      if (this.preventOtherTabs) {
        return;
      }
      this.fold = tab;
    },
  },
  created() {
    if (this.handyFold) {
      this.fold = this.handyFold;
    }
  },
};
</script>

<style lang="scss" scoped></style>
