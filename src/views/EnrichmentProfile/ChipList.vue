<template>
  <div class="chip-list flex-column gap-2" :data-testid="testid">
    <ul v-if="modelValue.length" class="chip-list__items m-0 flex flex-wrap gap-2">
      <li v-for="(item, index) in modelValue" :key="`${index}:${item}`">
        <Tag :label="item" removable mutates @remove="remove(index)" />
      </li>
    </ul>
    <BasicInput
      v-model="draft"
      :placeholder="$t('enrichment.profile.add_item')"
      :maxlength="500"
      :data-testid="`${testid}-input`"
      @on-key-down="add"
      @on-focusout="add"
    />
  </div>
</template>

<script>
// A list of short lines as chips: Enter (or leaving the field) adds the typed line, a chip's close removes it.
// Duplicates and blank lines are ignored.
export default {
  name: "ChipList",
  props: {
    modelValue: { type: Array, default: () => [] },
    testid: { type: String, default: "chip-list" },
  },
  emits: ["update:modelValue"],
  data() {
    return { draft: "" };
  },
  methods: {
    add() {
      const text = this.draft.trim();
      this.draft = "";
      if (!text || this.modelValue.includes(text)) return;
      this.$emit("update:modelValue", [...this.modelValue, text]);
    },
    remove(index) {
      this.$emit("update:modelValue", this.modelValue.filter((_, i) => i !== index));
    },
  },
};
</script>

<style lang="scss" scoped>
.chip-list__items {
  padding: 0;
  list-style: none;

  // A long chip wraps to the card's width (the Tag's ellipsis needs a bounded item), so its remove stays in reach.
  > li {
    min-width: 0;
    max-width: 100%;
  }
}
</style>
