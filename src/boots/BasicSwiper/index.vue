<template>
  <div>
    <!-- Slider main container -->
    <div :class="['swiper', uid_class]" :id="uid_class">
      <!-- Additional required wrapper -->
      <div class="swiper-wrapper">
        <slot />
      </div>
    </div>
  </div>
</template>
<script>
import Swiper from "swiper";
import { Navigation, Pagination, Scrollbar } from "swiper/modules";

export default {
  props: {
    uid_class: {
      type: String,
      default: "basic-swiper",
    },
    options: {
      type: Object,
      default: () => {
        return {
          speed: 400,
          spaceBetween: 5,
          //autoHeight: true,
          slidesPerView: 2,
        };
      },
    },
  },
  data() {
    return {
      swiper_instance: null,
    };
  },
  methods: {
    init() {
      try {
        const swiper = new Swiper(`.${this.uid_class}`, {
          // configure Swiper to use modules
          modules: [Navigation, Pagination, Scrollbar],
          ...this.options,
          //   navigation: {
          //     nextEl: ".swiper-button-next",
          //     prevEl: ".swiper-button-prev",
          //   },
          //   pagination: {
          //     el: ".swiper-pagination",
          //   },
          scrollbar: {
            el: ".swiper-scrollbar",
            //draggable: true,
            hide: true,
          },
          on: {
            reachEnd: () => this.$emit("on_last"),
          },
        });
        this.swiper_instance = swiper;

        //if (swiper.isEnd) this.$emit("on_last");
      } catch (error) {
        console.log("swiper init failed ", error);
      }
    },
  },
  mounted() {
    this.init();
  },
  beforeUnmount() {
    if (this.swiper_instance) {
      this.swiper_instance.destroy();
    }
  },
};
</script>

<style lang="scss">
:root {
  --swiper-scrollbar-border-radius: 10px;
  --swiper-scrollbar-top: auto;
  --swiper-scrollbar-bottom: 0px;
  --swiper-scrollbar-left: auto;
  --swiper-scrollbar-right: 4px;
  --swiper-scrollbar-sides-offset: 0%;
  --swiper-scrollbar-bg-color: var(--border-subtle);
  --swiper-scrollbar-drag-bg-color: var(--border-strong);
  --swiper-scrollbar-size: 3px;
}
</style>
