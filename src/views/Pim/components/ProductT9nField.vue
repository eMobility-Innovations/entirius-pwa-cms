<template>
  <FormField :label="`${label} (${language.toUpperCase()})`">
    <div class="flex ai-st gap-3">
      <div class="flex-1 min-w-0">
        <InheritanceField
          v-if="inheritance"
          :inherited="inheritance.inherited"
          :language="language"
          :overridden-langs="inheritance.overriddenLangs"
          :inherited-value="inheritance.inheritedValue"
          @toggle-override="$emit('toggle-override', $event)"
        >
          <template #default="{ readonly }">
            <component
              :is="control.is"
              v-bind="control.attrs"
              :model-value="modelValue"
              :disabled="readonly"
              @update:model-value="$emit('update:modelValue', $event)"
            />
          </template>
        </InheritanceField>
        <component
          :is="control.is"
          v-else
          v-bind="control.attrs"
          :model-value="modelValue"
          @update:model-value="$emit('update:modelValue', $event)"
        />
      </div>
      <IconButton
        v-if="translatable"
        icon="translate"
        variant="outline"
        :label="`${$t('pim.translations')}: ${label}`"
        @click="$emit('translate')"
      />
    </div>
  </FormField>
</template>

<script setup>
// One translatable product field in the default language (ProductDetail): the control, its inheritance state on a
// non-default channel (`inheritance` = { inherited, overriddenLangs, inheritedValue }, null on the default channel)
// and the per-field translations action.
import InheritanceField from "./InheritanceField.vue";

defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, required: true },
  language: { type: String, required: true },
  control: { type: Object, required: true },
  inheritance: { type: Object, default: null },
  translatable: { type: Boolean, default: false },
});
defineEmits(["update:modelValue", "toggle-override", "translate"]);
</script>
