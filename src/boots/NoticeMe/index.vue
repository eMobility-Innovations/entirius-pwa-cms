<template>
  <div :class="{ 'notice-me': active }">
    <svg v-if="active">
      <rect
        x="0"
        y="0"
        ry="5"
        width="100%"
        height="100%"
        fill="none"
        :class="stroke_color_class"
      />
    </svg>
    <slot></slot>
  </div>
</template>

<script>
export default {
  props: {
    stroke_color_class: {
      type: String,
      default: "t-positive",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
};
</script>
<style lang="scss" scoped>
@keyframes notice-me-cubick-bezier {
  50% {
    transition: cubic-bezier(0.19, 1, 0.22, 1);
    stroke-width: 1;
    stroke-dasharray: 200, 100;
    stroke-dashoffset: 0;
  }
}

.notice-me {
  position: relative;
  //z-index: -1;
  svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  rect {
    fill: none;
    stroke: currentColor; // the colour comes from the t-* class in stroke_color_class
    stroke-width: 1;
    stroke-dasharray: 0, 0;

    animation: notice-me-cubick-bezier 6s ease-in infinite;
  }
}
</style>
