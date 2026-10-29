<script setup>
import { ref, watch } from "vue";
import { GET_Categories } from "@/api/pim/api";

const props = defineProps({
  categories: { type: Array, default: () => [] },
  channelIdx: { type: String, required: true },
});

const emit = defineEmits(["update:categoryIdxs"]);

const localCategories = ref([...props.categories]);
const foundNames = new Map();

watch(
  () => props.categories,
  (val) => {
    localCategories.value = [...val];
  },
  { deep: true }
);

function removeCategory(idx) {
  localCategories.value = localCategories.value.filter((c) => c.idx !== idx);
  emitUpdate();
}

function addCategory(idx) {
  if (!idx || localCategories.value.find((c) => c.idx === idx)) return;
  localCategories.value.push({ idx, name: foundNames.get(idx) });
  emitUpdate();
}

function emitUpdate() {
  emit(
    "update:categoryIdxs",
    localCategories.value.map((c) => c.idx)
  );
}

async function fetchCategories(search) {
  const { data } = await GET_Categories(props.channelIdx, {
    search,
    page_size: 10,
  });
  return (data.results || []).map((cat) => {
    foundNames.set(cat.idx, cat.name);
    return { label: cat.name || cat.idx, value: cat.idx };
  });
}
</script>

<template>
  <div class="flex-column gap-8">
    <div class="flex flex-wrap gap-2">
      <span v-if="!localCategories.length" class="fs-200 t-muted">
        {{ $t("pim.no_categories") }}
      </span>
      <Tag
        v-for="cat in localCategories"
        :key="cat.idx"
        :label="cat.name || cat.idx"
        :to="`/pim/categories/${cat.idx}`"
        removable
        @remove="removeCategory(cat.idx)"
      />
    </div>

    <EntitySearchPicker
      :fetch-fn="fetchCategories"
      :placeholder="$t('pim.category_find')"
      @update:model-value="addCategory"
    />
  </div>
</template>
