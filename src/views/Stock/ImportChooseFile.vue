<template>
  <div class="flex ai-ct wrap gap-3">
    <BasicButton
      :id="attrs.id"
      :aria-labelledby="labelledBy"
      :aria-describedby="attrs['aria-describedby']"
      @click="fileInput?.click()"
    >
      {{ t("stock.import_choose_file") }}
    </BasicButton>
    <span class="fs-300 t-secondary">{{ fileName || t("stock.import_no_file") }}</span>
    <input
      ref="fileInput"
      type="file"
      accept=".csv"
      hidden
      @change="onChange"
    />
  </div>
</template>

<script setup>
// A real child of the FormField (plan 38 review): only a component instance rendered inside FormField's slot can
// inject its FORM_FIELD context, so the "Choose file" button (the actual interactive control) lives here rather
// than inline in ImportCSVModal — the hidden input is picked, never labelled. The button claims the field's id (the
// label's `for`) and is named by the field label followed by its own visible text (WCAG 2.5.3 label in name).
import { computed, ref } from "vue"
import { t } from "@/i18n"
import { useControlAttrs } from "@/boots/FormField/useControlAttrs"

defineProps({
  fileName: { type: String, default: "" },
})
const emit = defineEmits(["select"])

const { field, attrs } = useControlAttrs()
const labelledBy = computed(() => [field.labelId?.value, attrs.value.id].filter(Boolean).join(" "))
const fileInput = ref(null)

// Cleared after each pick, so picking the same file again (after an import) still fires `change`.
function onChange(event) {
  emit("select", event.target.files[0] || null)
  event.target.value = ""
}
</script>
