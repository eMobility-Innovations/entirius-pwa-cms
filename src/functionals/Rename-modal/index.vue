<template>
  <BasicModal
    :open="visible"
    size="sm"
    :actions="actions"
    :aria-label="$t('builder.enter_new_doc_name')"
    @update:open="onClose"
  >
    <template v-if="$slots.header" #title><slot name="header" /></template>
    <slot name="description" />
  </BasicModal>
</template>

<script>
// Copy-under-a-new-name dialog of the builder on BasicModal (plan 12): `visible`, `accept` (Copy) / `reject`
// (Cancel, close, Esc, backdrop), slots `header` and `description` (the name field).
import BasicModal from "@/boots/BasicModal/index.vue";

export default {
  name: "RenameModal",
  components: { BasicModal },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["accept", "reject"],
  computed: {
    actions() {
      return [
        { key: "cancel", label: this.$t("common.cancel"), role: "secondary", onClick: this.reject },
        { key: "copy", label: this.$t("common.copy"), role: "primary", onClick: this.accept },
      ];
    },
  },
  methods: {
    accept() {
      this.$emit("accept");
    },
    reject() {
      this.$emit("reject");
    },
    onClose(open) {
      if (!open) this.reject();
    },
  },
};
</script>
