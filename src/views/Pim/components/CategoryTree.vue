<script setup>
import { ref, computed, reactive } from "vue";
import CategoryTreeNode from "./CategoryTreeNode.vue";

const props = defineProps({
  categories: { type: Array, required: true },
  searchQuery: { type: String, default: "" },
  channelIdx: { type: String, default: "" },
});

const emit = defineEmits(["select", "reorder"]);

const storageKey = computed(
  () => `cms_pim_category_expanded_${props.channelIdx}`
);

function saveExpanded() {
  try {
    localStorage.setItem(
      storageKey.value,
      JSON.stringify([...expandedNodes.value])
    );
  } catch {
    /* quota exceeded — ignore */
  }
}

function loadExpanded() {
  try {
    const raw = localStorage.getItem(storageKey.value);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

const expandedNodes = ref(loadExpanded());

// Drag-and-drop state
const dragState = reactive({
  draggedIdx: null,
  draggedNode: null,
  targetIdx: null,
  position: null, // 'before' | 'inside' | 'after'
});

// Build pk-to-idx map for resolving parent references
const pkToIdx = computed(() => {
  const map = {};
  props.categories.forEach((cat) => {
    map[cat.pk] = cat.idx;
  });
  return map;
});

// Build idx-to-category map
const idxToCat = computed(() => {
  const map = {};
  props.categories.forEach((cat) => {
    map[cat.idx] = cat;
  });
  return map;
});

// Build idx-to-parentIdx map
const idxToParentIdx = computed(() => {
  const map = {};
  props.categories.forEach((cat) => {
    if (cat.parent_category) {
      const parentIdx = pkToIdx.value[cat.parent_category];
      if (parentIdx) map[cat.idx] = parentIdx;
    }
  });
  return map;
});

const filteredIdxSet = computed(() => {
  if (!props.searchQuery) return null;
  const q = props.searchQuery.toLowerCase();
  const matched = new Set();

  props.categories.forEach((cat) => {
    const name =
      cat.name ||
      (cat.name_t9n &&
        (cat.name_t9n.en ||
          cat.name_t9n.EN ||
          cat.name_t9n.pl ||
          cat.name_t9n.PL)) ||
      "";
    if (name.toLowerCase().includes(q) || cat.idx.toLowerCase().includes(q)) {
      matched.add(cat.idx);
    }
  });

  // include ancestors of matched nodes
  const withAncestors = new Set(matched);
  matched.forEach((idx) => {
    let parent = idxToParentIdx.value[idx];
    while (parent) {
      withAncestors.add(parent);
      parent = idxToParentIdx.value[parent];
    }
  });

  return withAncestors;
});

const treeRoots = computed(() => {
  const visibleSet = filteredIdxSet.value;
  const source = visibleSet
    ? props.categories.filter((cat) => visibleSet.has(cat.idx))
    : props.categories;

  const childrenMap = {};
  source.forEach((cat) => {
    childrenMap[cat.idx] = [];
  });

  const roots = [];
  source.forEach((cat) => {
    const parentIdx = cat.parent_category
      ? pkToIdx.value[cat.parent_category]
      : null;
    if (parentIdx && childrenMap[parentIdx]) {
      childrenMap[parentIdx].push({ ...cat, children: childrenMap[cat.idx] });
    } else {
      roots.push({ ...cat, children: childrenMap[cat.idx] });
    }
  });

  return roots;
});

function toggleNode(idx) {
  if (expandedNodes.value.has(idx)) {
    expandedNodes.value.delete(idx);
  } else {
    expandedNodes.value.add(idx);
  }
  expandedNodes.value = new Set(expandedNodes.value);
  saveExpanded();
}

function expandAll() {
  expandedNodes.value = new Set(props.categories.map((c) => c.idx));
  saveExpanded();
}

function collapseAll() {
  expandedNodes.value = new Set();
  saveExpanded();
}

// --- Drag and Drop ---

function isDescendant(ancestorIdx, nodeIdx) {
  let current = idxToParentIdx.value[nodeIdx];
  while (current) {
    if (current === ancestorIdx) return true;
    current = idxToParentIdx.value[current];
  }
  return false;
}

function onDragStart(node) {
  dragState.draggedIdx = node.idx;
  dragState.draggedNode = node;
}

function onDragOver({ idx, position }) {
  if (!dragState.draggedIdx || idx === dragState.draggedIdx) return;
  // Prevent dropping onto own descendant
  if (isDescendant(dragState.draggedIdx, idx)) return;
  dragState.targetIdx = idx;
  dragState.position = position;
}

function onDrop({ targetIdx }) {
  if (
    !dragState.draggedIdx ||
    !targetIdx ||
    targetIdx === dragState.draggedIdx
  ) {
    clearDragState();
    return;
  }
  if (isDescendant(dragState.draggedIdx, targetIdx)) {
    clearDragState();
    return;
  }

  const targetCat = idxToCat.value[targetIdx];
  if (!targetCat) {
    clearDragState();
    return;
  }

  const position = dragState.position;
  let newParentIdx = null;
  let newPosition = 0;

  if (position === "inside") {
    // Drop as child of target
    newParentIdx = targetIdx;
    // Position after last child
    const siblings = props.categories.filter((c) => {
      const pIdx = c.parent_category ? pkToIdx.value[c.parent_category] : null;
      return pIdx === targetIdx && c.idx !== dragState.draggedIdx;
    });
    newPosition = siblings.length;
    // Expand target so user sees the dropped category
    expandedNodes.value.add(targetIdx);
    expandedNodes.value = new Set(expandedNodes.value);
    saveExpanded();
  } else {
    // Drop before/after target — same parent as target
    const targetParentIdx = idxToParentIdx.value[targetIdx] || null;
    newParentIdx = targetParentIdx;

    // Get siblings of target (same parent), excluding the dragged node
    const siblings = props.categories
      .filter((c) => {
        const pIdx = c.parent_category
          ? pkToIdx.value[c.parent_category]
          : null;
        return pIdx === targetParentIdx && c.idx !== dragState.draggedIdx;
      })
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const targetIndex = siblings.findIndex((c) => c.idx === targetIdx);
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;

    // Build reorder items for all siblings at the new position
    const reorderItems = [];
    const reordered = [...siblings];
    reordered.splice(insertIndex, 0, { idx: dragState.draggedIdx });

    reordered.forEach((item, i) => {
      reorderItems.push({
        idx: item.idx,
        parent_category_idx: newParentIdx,
        position: i,
      });
    });

    clearDragState();
    emit("reorder", reorderItems);
    return;
  }

  // 'inside' case — just move the single item
  const reorderItems = [
    {
      idx: dragState.draggedIdx,
      parent_category_idx: newParentIdx,
      position: newPosition,
    },
  ];

  clearDragState();
  emit("reorder", reorderItems);
}

function onDragEnd() {
  clearDragState();
}

function clearDragState() {
  dragState.draggedIdx = null;
  dragState.draggedNode = null;
  dragState.targetIdx = null;
  dragState.position = null;
}

defineExpose({ expandAll, collapseAll });
</script>

<template>
  <div class="category-tree">
    <div v-if="!treeRoots.length" class="t-muted fs-200 p-8">
      {{ $t("pim.no_categories") }}
    </div>
    <CategoryTreeNode
      v-for="node in treeRoots"
      :key="node.idx"
      :node="node"
      :depth="0"
      :expanded-nodes="expandedNodes"
      :is-root="true"
      :drag-state="dragState"
      @toggle="toggleNode"
      @select="(cat) => emit('select', cat)"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @drop="onDrop"
      @dragend="onDragEnd"
    />
  </div>
</template>
