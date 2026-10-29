<script>
import { usePimChannelStore } from "@/stores/pimChannel";

export default {
  name: "InheritanceField",
  props: {
    inherited: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      required: true,
    },
    overriddenLangs: {
      type: Array,
      default: () => [],
    },
    inheritedValue: {
      type: String,
      default: "",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-override"],
  setup() {
    const pimChannel = usePimChannelStore();
    return { pimChannel };
  },
  data() {
    return { confirmInherit: false };
  },
  computed: {
    isOnDefaultChannel() {
      return this.pimChannel.isDefaultChannel;
    },
    showToggle() {
      return this.inherited && !this.isOnDefaultChannel;
    },
    isInherited() {
      return !this.overriddenLangs.includes(this.language);
    },
    isReadOnly() {
      return this.showToggle && this.isInherited;
    },
  },
  methods: {
    // Override takes effect at once; going back to the inherited value drops the override, so it asks first.
    toggleOverride() {
      if (this.isInherited) this.emitToggle(true);
      else this.confirmInherit = true;
    },
    onConfirmInherit() {
      this.confirmInherit = false;
      this.emitToggle(false);
    },
    emitToggle(override) {
      this.$emit("toggle-override", { language: this.language, override });
    },
  },
};
</script>

<template>
  <div class="inheritance-field">
    <div v-if="showToggle" class="flex ai-ct gap-2 mb-1">
      <Tag
        :label="isInherited ? $t('pim.inherited') : $t('pim.overridden')"
      />
      <BasicButton
        size="sm"
        variant="ghost"
        :title="
          isInherited
            ? $t('pim.inherited_tooltip')
            : $t('pim.overridden_tooltip')
        "
        @click="toggleOverride"
      >
        {{ isInherited ? $t("pim.override") : $t("pim.inherit") }}
      </BasicButton>
    </div>
    <div :class="{ 'inheritance-field__readonly': isReadOnly }">
      <slot :readonly="isReadOnly" />
    </div>
    <div
      v-if="showToggle && isInherited && inheritedValue"
      class="inheritance-field__preview t-muted fs-200"
    >
      {{ $t("pim.default_value", { value: inheritedValue }) }}
    </div>
    <ConfirmDialog
      :open="confirmInherit"
      tone="danger"
      :title="$t('pim.inherit_confirm_title')"
      :message="$t('pim.inherit_confirm_message', { language: language.toUpperCase() })"
      :confirm-label="$t('pim.inherit')"
      @confirm="onConfirmInherit"
      @cancel="confirmInherit = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.inheritance-field {
  position: relative;
}

.inheritance-field__readonly {
  opacity: 0.6;
  pointer-events: none;
  user-select: none;
}

.inheritance-field__preview {
  margin-top: 2px;
  font-style: italic;
  font-size: var(--fs-200);
}
</style>
