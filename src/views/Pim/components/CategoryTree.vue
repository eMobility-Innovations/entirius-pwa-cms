<script setup>
import { reactive } from "vue";
import CategoryTreeNode from "./CategoryTreeNode.vue";

// Renders the rows of useCategoryTree (a flat list: nodes, "show more" rows, retry rows) and runs the drag state.
const props = defineProps({
  rows: { type: Array, required: true },
  highlightIdx: { type: String, default: null },
  busy: { type: Boolean, default: false },
  canDrop: { type: Function, required: true },
});

const emit = defineEmits([
  "toggle",
  "select",
  "add-child",
  "load-more",
  "reorder",
]);

const dragState = reactive({
  draggedIdx: null,
  targetIdx: null,
  position: null, // 'before' | 'inside' | 'after'
});

function onDragStart(node) {
  dragState.draggedIdx = node.idx;
}

function onDragOver({ idx, position }) {
  if (!dragState.draggedIdx || !props.canDrop(dragState.draggedIdx, idx)) return;
  dragState.targetIdx = idx;
  dragState.position = position;
}

function onDrop({ targetIdx }) {
  const { draggedIdx, position } = dragState;
  clearDragState();
  if (!draggedIdx || !position || !props.canDrop(draggedIdx, targetIdx)) return;
  emit("reorder", { draggedIdx, targetIdx, position });
}

function clearDragState() {
  dragState.draggedIdx = null;
  dragState.targetIdx = null;
  dragState.position = null;
}

const indent = (depth) => ({ paddingLeft: `${depth * 24 + 12}px` });
</script>

<template>
  <div class="category-tree" :aria-busy="busy" :class="{ 'category-tree--busy': busy }">
    <template v-for="row in rows" :key="row.key">
      <CategoryTreeNode
        v-if="row.type === 'node'"
        :node="row.item"
        :depth="row.depth"
        :expanded="row.expanded"
        :leaf="row.leaf"
        :loading="row.loading"
        :is-root="row.isRoot"
        :highlighted="highlightIdx === row.item.idx"
        :drag-state="dragState"
        @toggle="(node) => emit('toggle', node)"
        @select="(cat) => emit('select', cat)"
        @add-child="(cat) => emit('add-child', cat)"
        @dragstart="onDragStart"
        @dragover="onDragOver"
        @drop="onDrop"
        @dragend="clearDragState"
      />
      <div
        v-else
        class="category-tree__more"
        :style="indent(row.depth)"
      >
        <template v-if="row.type === 'error'">
          <span class="t-negative fs-200">{{ $t("pim.category_level_error") }}</span>
          <BasicButton variant="secondary" size="sm" @click="emit('load-more', row.levelKey)">
            {{ $t("pim.category_retry") }}
          </BasicButton>
        </template>
        <BasicButton
          v-else
          variant="secondary"
          size="sm"
          :disabled="row.loading"
          @click="emit('load-more', row.levelKey)"
        >
          {{ $t("pim.category_show_more", { loaded: row.loaded, count: row.count }) }}
        </BasicButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.category-tree--busy {
  opacity: 0.6;
  pointer-events: none;
}

.category-tree__more {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-2);
  padding-right: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}
</style>
