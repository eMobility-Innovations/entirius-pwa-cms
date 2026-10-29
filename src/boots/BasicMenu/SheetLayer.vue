<template>
  <Teleport to="body" :disabled="!active">
    <div
      :class="active ? 'basic-menu__backdrop' : 'basic-menu__layer'"
      @pointerdown.self="pressed = true"
      @click.self="onClick"
    >
      <slot />
    </div>
  </Teleport>
</template>

<script setup>
// BasicMenu's phone sheet backdrop (teleported to <body>, like BasicModal's) while `active`. Inactive, the layer stays
// in the menu as a box-less wrapper: an open menu crossing the phone breakpoint moves its popover, never remounts it
// (the panel keeps its state). `dismiss` fires on a click that also started on the backdrop: closing on the press
// would let the tap's click land on the page under the finger.
defineProps({ active: { type: Boolean, default: false } });
const emit = defineEmits(["dismiss"]);
let pressed = false;

function onClick() {
  if (pressed) emit("dismiss");
  pressed = false;
}
</script>

<style lang="scss" scoped>
.basic-menu__layer {
  display: contents;
}

.basic-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--overlay-backdrop);
}
</style>
