<script setup>
import { computed } from "vue";

// One row of the category tree (or of the flat search result list: `flat`). The tree is a flat list of rows,
// so a row never renders its children; depth only indents it.
const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  expanded: { type: Boolean, default: false },
  leaf: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  isRoot: { type: Boolean, default: false },
  flat: { type: Boolean, default: false },
  highlighted: { type: Boolean, default: false },
  dragState: { type: Object, default: null },
});

const emit = defineEmits([
  "toggle",
  "select",
  "add-child",
  "show-in-tree",
  "dragstart",
  "dragover",
  "drop",
  "dragend",
]);

const isDraggable = computed(() => !props.isRoot && !props.flat);
const showToggle = computed(() => !props.flat && !props.leaf);
const displayName = computed(
  () =>
    props.node.name ||
    (props.node.name_t9n &&
      (props.node.name_t9n.en ||
        props.node.name_t9n.EN ||
        props.node.name_t9n.pl ||
        props.node.name_t9n.PL)) ||
    props.node.idx
);

const dropIndicator = computed(() => {
  if (!props.dragState || props.dragState.targetIdx !== props.node.idx)
    return null;
  return props.dragState.position;
});

function onRowClick() {
  if (showToggle.value) emit("toggle", props.node);
}

function onDragStart(e) {
  if (!isDraggable.value) return;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", props.node.idx);
  emit("dragstart", props.node);
}

function onDragOver(e) {
  if (props.flat) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const third = rect.height / 3;

  let position;
  if (y < third) {
    position = "before";
  } else if (y > third * 2) {
    position = "after";
  } else {
    position = "inside";
  }

  // Root nodes only accept 'inside' drops — prevent creating new root categories
  if (props.isRoot && position !== "inside") {
    position = "inside";
  }

  emit("dragover", { idx: props.node.idx, position });
}

function onDrop(e) {
  if (props.flat) return;
  e.preventDefault();
  emit("drop", { targetIdx: props.node.idx });
}

function onDragEnd() {
  emit("dragend");
}
</script>

<template>
  <div class="tree-node" :data-idx="node.idx">
    <div
      class="tree-node__row"
      :class="{
        'tree-node__row--drop-before': dropIndicator === 'before',
        'tree-node__row--drop-inside': dropIndicator === 'inside',
        'tree-node__row--drop-after': dropIndicator === 'after',
        'tree-node__row--dragging':
          dragState && dragState.draggedIdx === node.idx,
        'tree-node__row--highlight': highlighted,
        'tree-node__row--flat': flat,
      }"
      :style="{ '--depth': depth }"
      :draggable="isDraggable"
      @click="onRowClick"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @drop="onDrop"
      @dragend="onDragEnd"
    >
      <font-awesome-icon
        v-if="isDraggable"
        :icon="$icons.drag"
        class="tree-node__drag-handle t-muted"
        aria-hidden="true"
      />
      <span v-if="loading" class="tree-node__toggle t-muted" role="status">
        <font-awesome-icon :icon="$icons.running" spin />
        <span class="visually-hidden">{{ $t("pim.category_loading_children") }}</span>
      </span>
      <IconButton
        v-else-if="showToggle"
        :icon="expanded ? 'collapse' : 'expand'"
        :label="$t(expanded ? 'pim.collapse_group' : 'pim.expand_group', { name: displayName })"
        :aria-expanded="String(expanded)"
        size="sm"
        @click="emit('toggle', node)"
      />
      <span v-else class="tree-node__toggle" />
      <span class="tree-node__icon t-muted"
        ><font-awesome-icon :icon="$icons.category"
      /></span>
      <span class="tree-node__name" :title="displayName">{{ displayName }}</span>
      <span v-if="flat" class="tree-node__idx t-muted fs-200">{{ node.idx }}</span>
      <StatusBadge
        v-if="isRoot"
        tone="accent"
        size="sm"
        :dot="false"
        :label="$t('pim.root_badge')"
        class="tree-node__root-badge"
      />
      <StatusBadge tone="neutral" :dot="false" :label="node.product_count || 0" class="tree-node__count" />
      <StatusBadge
        v-if="flat"
        :tone="node.is_active ? 'positive' : 'negative'"
        size="sm"
        :label="node.is_active ? $t('pim.active') : $t('pim.inactive')"
      />
      <span
        v-else
        class="tree-node__status"
        :class="
          node.is_active
            ? 'tree-node__status--active'
            : 'tree-node__status--inactive'
        "
      />
      <!-- The slot stays when the category is in the menu, so the meta lines up across rows. -->
      <span
        class="tree-node__hidden t-muted"
        :title="node.is_in_menu ? undefined : $t('pim.hidden_from_menu')"
      >
        <font-awesome-icon v-if="!node.is_in_menu" :icon="$icons.hide" />
      </span>
      <BasicButton
        v-if="flat"
        variant="secondary"
        size="sm"
        @click="emit('show-in-tree', node)"
      >
        {{ $t("pim.category_show_in_tree") }}
      </BasicButton>
      <IconButton
        v-else
        icon="add"
        :label="$t('pim.add_subcategory_to', { name: displayName })"
        size="sm"
        @click="emit('add-child', node)"
      />
      <BasicButton variant="ghost" size="sm" @click="emit('select', node)">
        {{ $t("common.edit") }}
      </BasicButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.tree-node__row {
  --tree-indent: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-left: calc(var(--depth, 0) * var(--tree-indent) + var(--space-3));
  padding-top: var(--space-2);
  padding-right: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s;
  position: relative;

  &:hover {
    background: var(--surface-base);
  }
}

// On a phone a level indents by one step less and a search hit wraps: name on its own line, meta below.
@include max-tablet {
  .tree-node__row {
    --tree-indent: var(--space-3);
  }

  .tree-node__row--flat {
    flex-wrap: wrap;
  }

  .tree-node__row--flat .tree-node__idx {
    flex: 1;
    max-width: none;
  }

  .tree-node__row--flat .tree-node__name {
    flex-basis: calc(100% - var(--space-10));
  }
}

// A category below the root is dragged by its row; the toggle button expands it (a click on the row does too).
.tree-node__row[draggable="true"] {
  cursor: grab;
}

.tree-node__row--dragging {
  opacity: 0.4;
}

.tree-node__row--drop-before {
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent-fill);
  }
}

.tree-node__row--drop-after {
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent-fill);
  }
}

.tree-node__row--highlight {
  background: var(--accent-subtle);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.tree-node__idx {
  flex-shrink: 0;
  max-width: 30%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node__row--drop-inside {
  background: var(--accent-subtle);
}

.tree-node__drag-handle {
  flex-shrink: 0;
}

// The toggle's place in a row without children, so the names line up.
.tree-node__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  flex-shrink: 0;
}

.tree-node__icon {
  flex-shrink: 0;
  font-size: var(--fs-300);
}

.tree-node__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

// Fixed-width meta so the count, status dot and menu flag line up between rows.
.tree-node__count {
  min-width: 2.5em;
  justify-content: center;
}

.tree-node__hidden {
  width: 1.25em;
  text-align: center;
  flex-shrink: 0;
  font-size: var(--fs-200);
  opacity: 0.7;
}

.tree-node__root-badge {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tree-node__status {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.tree-node__status--active {
  background: var(--positive-fill);
}

.tree-node__status--inactive {
  background: var(--negative-fill);
}
</style>
