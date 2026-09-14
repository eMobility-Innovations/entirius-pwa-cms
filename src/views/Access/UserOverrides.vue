<template><RoleMatrix ref="matrix" user-only /></template>
<script setup>
import { ref, computed } from "vue";
import RoleMatrix from "./RoleMatrix.vue";
const matrix = ref(null);
const save = (...args) => matrix.value.save(...args);
const clear = (...args) => matrix.value.clear(...args);
const add = (...args) => matrix.value.add(...args);
const toggle = (...args) => matrix.value.toggle(...args);
const selected = computed(() => matrix.value?.selected);
const people = computed(() => matrix.value?.people);
defineExpose({ save, clear, add, toggle, selected, people });
</script>
