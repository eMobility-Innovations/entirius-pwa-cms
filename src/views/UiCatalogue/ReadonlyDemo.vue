<template>
  <div class="readonly-demo flex-column gap-3">
    <BasicSwitch v-model="readonly" label="Tylko odczyt" />
    <ActionBar :actions="actions" />
    <FormField label="Nazwa"><BasicInput v-model="name" /></FormField>
    <div class="readonly-demo__fab"><FloatingActions :actions="fabActions" /></div>
  </div>
</template>

<script setup>
// The read-only mode (plan 19) on static fixtures: the switch provides the flag a PageLayout would, so the ActionBar
// keeps only its utility, the FAB is gone and the FormField disables its control. `initial` = the starting state.
import { ref } from "vue";
import { provideReadonly } from "@/composables/useReadonly";

const props = defineProps({ initial: { type: Boolean, default: false } });

const readonly = provideReadonly(ref(props.initial));
const name = ref("Koszulka bawełniana");
const noop = () => {};
const actions = [
  { key: "save", label: "Zapisz", role: "primary", onClick: noop },
  { key: "delete", label: "Usuń", role: "danger", onClick: noop },
  { key: "export", label: "Eksportuj", role: "utility", icon: "download", onClick: noop },
];
const fabActions = [{ icon: "add", label: "Dodaj stronę", handler: noop }];
</script>

<style lang="scss" scoped>
// `transform` makes the frame the containing block of the FAB's `position: fixed`.
.readonly-demo__fab {
  position: relative;
  height: 4rem;
  transform: translateZ(0);
}
</style>
