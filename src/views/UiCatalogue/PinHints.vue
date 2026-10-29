<template>
  <slot />
</template>

<script setup>
// Catalogue cells with field hints pinned on or off: the subtree ignores the account-menu hints switch, so a hint cell
// renders the same for every reviewer and the "hints off" cells show the switch's effect.
import { provide, ref } from "vue";
import { FIELD_HINTS } from "@/composables/fieldHints";

const props = defineProps({ on: { type: Boolean, required: true } });

provide(FIELD_HINTS, ref(props.on));
</script>
