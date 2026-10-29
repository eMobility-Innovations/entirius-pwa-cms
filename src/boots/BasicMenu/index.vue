<template>
  <span
    ref="root"
    class="basic-menu"
    :class="{ 'basic-menu--inline': inline, 'basic-menu--inline-up': inline && placement.startsWith('top') }"
    @blur="onRootBlur"
  >
    <span ref="trigger" class="basic-menu__trigger" @click.capture="onTriggerClick" @keydown="onTriggerKeydown">
      <slot name="trigger" :open="isOpen" />
    </span>
    <component :is="sheet ? SheetLayer : InPlace" :active="asSheet && expanded" @dismiss="close">
      <div
        v-show="isOpen"
        :id="menuId"
        ref="popover"
        class="basic-menu__popover flex-column"
        :class="{ 'basic-menu__popover--panel': isPanel, 'basic-menu__popover--sheet': sheet, 'basic-menu__popover--bottom': asSheet }"
        :role="isPanel ? 'dialog' : 'menu'"
        :aria-label="labelledby ? undefined : label || undefined"
        :aria-labelledby="labelledby || undefined"
        tabindex="-1"
        :style="inline || asSheet ? undefined : style"
        @keydown="onPopoverKeydown"
      >
        <slot v-if="isPanel && isOpen" name="panel" :close="close" />
        <template v-for="item in items" v-else-if="isOpen" :key="item.key">
          <div v-if="item.separator" role="separator" class="basic-menu__separator" />
          <p v-else-if="item.heading" role="presentation" class="basic-menu__heading fs-200 t-muted">{{ item.label }}</p>
          <component
            :is="isLink(item) ? 'router-link' : 'button'"
            v-else
            :to="isLink(item) ? item.to : undefined"
            :type="isLink(item) ? undefined : 'button'"
            :role="itemRole(item)"
            :aria-checked="item.checked === undefined ? undefined : String(item.checked)"
            tabindex="-1"
            class="basic-menu__item flex ai-ct gap-2 pointer"
            :class="{ 'basic-menu__item--danger': item.danger }"
            :disabled="isLink(item) ? undefined : item.disabled"
            :aria-disabled="item.disabled ? 'true' : undefined"
            :data-testid="item.testid"
            @click="choose(item, $event)"
          >
            <FontAwesomeIcon v-if="item.icon" :icon="ICONS[item.icon]" class="basic-menu__icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </component>
        </template>
      </div>
    </component>
  </span>
</template>

<script>
let nextId = 0;
// A menu that is no sheet renders its popover in place, with no wrapper element.
const InPlace = Object.assign((_, { slots }) => slots.default(), { inheritAttrs: false });
</script>

<script setup>
// Anchored popover (docs/ui-rules.md C4): an action list or a free panel next to a trigger. The `trigger` slot holds
// the control (a BasicButton or IconButton); the menu sets its `aria-haspopup`, `aria-expanded` and `aria-controls`
// and toggles on its click. `items` = [{ key, label, icon?, danger?, separator?, heading?, disabled?, to?, testid? }]
// (a `heading` is a caption above the items that follow, never focused) →
// `role="menu"`: arrows, Home / End move between items, Enter / Space choose (emits `select` with the item), Esc and
// Tab close; Esc returns focus to the trigger; a click outside closes. The `panel` slot (scope: `close`) replaces the
// list with free content, `role="dialog"` named by `label`. `placement` is a floating-ui placement. `inline` renders
// it open in the page flow (catalogue), above the trigger for a `top` placement (the drop-up state). A closed menu
// mounts neither items nor panel: a closed select holds no hidden copy of its option labels. `sheet` is for a panel
// that reads as a page of text (configuration health): a wide popover (≤ 32rem) above a phone, a full-width bottom
// sheet on one — modal there like BasicModal's: a backdrop, scroll lock and focus trap; every close (Esc, a tap on the
// backdrop, a panel link, a programmatic one) returns focus to the trigger — to the menu itself when the trigger holds
// no focusable control. Only an open phone sheet renders the backdrop layer; a menu that is no sheet is the trigger and
// the popover. An open sheet crossing the phone breakpoint (a rotation) stays open: the popover moves between the page
// and the backdrop without a remount, the trap follows. `sheet` is fixed per instance (read once at setup).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch } from "vue";
import { ICONS } from "@/boots/Icons/icons";
import { FOCUSABLE, focusableIn, useFocusTrap } from "@/composables/useFocusTrap";
import { useFloatingPosition } from "@/composables/useFloatingPosition";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { MAX_TABLET_QUERY } from "@/utils/breakpoints";
import SheetLayer from "./SheetLayer.vue";

const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: "" },
  // The id of an element that names the popover (a FormField label); wins over `label`.
  labelledby: { type: String, default: "" },
  placement: { type: String, default: "bottom-start" },
  inline: { type: Boolean, default: false },
  sheet: { type: Boolean, default: false },
});
const emit = defineEmits(["select", "open", "close"]);

nextId += 1;
const menuId = `basic-menu-${nextId}`;
const slots = useSlots();
const root = ref(null);
const trigger = ref(null);
const popover = ref(null);
const expanded = ref(false);

const isOpen = computed(() => props.inline || expanded.value);
// Only a sheet listens to the viewport: every BasicSelect is a BasicMenu. `sheet` is fixed per instance.
const isPhone = props.sheet ? useMediaQuery(MAX_TABLET_QUERY) : ref(false);
const asSheet = computed(() => props.sheet && isPhone.value && !props.inline);
const isPanel = computed(() => Boolean(slots.panel));
const triggerControl = () => trigger.value?.querySelector(FOCUSABLE) ?? trigger.value;
const anchor = computed(() => (expanded.value ? triggerControl() : null));
const { style } = useFloatingPosition(anchor, popover, {
  placement: () => props.placement,
  active: computed(() => expanded.value && !props.inline && !asSheet.value),
});

// The popover is the trap's container (tabindex -1): a sheet with no tab stop inside keeps focus on it. The menu owns
// the trap's only activation path (post flush: the popover is already on the backdrop).
const trap = useFocusTrap(popover, { onEscape: () => close({ returnFocus: true }) });
watch(
  () => expanded.value && asSheet.value,
  (on) => (on ? trapSheet() : trap.deactivate()),
  { flush: "post" }
);

const ITEM_SELECTOR = ':is([role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]):not([aria-disabled="true"])';
const itemRole = (item) => {
  if (item.checked === undefined) return "menuitem";
  return item.checkbox ? "menuitemcheckbox" : "menuitemradio";
};

// A disabled `to` item renders as a button: a disabled router-link would still navigate.
const isLink = (item) => Boolean(item.to) && !item.disabled;
const enabledItems = () => [...(popover.value?.querySelectorAll(ITEM_SELECTOR) ?? [])];

function focusFirst() {
  const target = isPanel.value ? focusableIn(popover.value)[0] ?? popover.value : enabledItems()[0];
  target?.focus();
}

async function openMenu() {
  expanded.value = true;
  emit("open");
  await nextTick();
  focusFirst();
}

// The trap returns focus to the element focused when it activates: the trigger, before focus moves in. A trigger with
// no focusable control (none, or a disabled one) leaves the menu itself as the opener, never <body>: focusable only
// until focus leaves it for anywhere but the sheet (the trap brings it back there on close).
function trapSheet() {
  focusOpener();
  trap.activate();
}

function focusOpener() {
  const control = trigger.value.querySelector(FOCUSABLE);
  control?.focus();
  if (control && document.activeElement === control) return;
  root.value.tabIndex = -1;
  root.value.focus();
}

function onRootBlur(event) {
  if (!popover.value?.contains(event.relatedTarget)) root.value.removeAttribute("tabindex");
}

function close({ returnFocus = false } = {}) {
  if (!expanded.value) return;
  expanded.value = false;
  emit("close");
  // A sheet's trap hands focus back to the trigger on every close, once it has lifted `inert` from the page.
  if (returnFocus && !asSheet.value) triggerControl()?.focus();
}

function onTriggerClick() {
  if (props.inline) return;
  if (expanded.value) close();
  else openMenu();
}

function onTriggerKeydown(event) {
  if (expanded.value && event.key === "Escape") {
    event.stopPropagation();
    close({ returnFocus: true });
    return;
  }
  if (props.inline || expanded.value || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  openMenu();
}

function choose(item, event) {
  if (item.disabled) {
    event.preventDefault();
    return;
  }
  emit("select", item);
  close({ returnFocus: !item.to });
}

// Arrows wrap around, Home / End jump; the list keeps one item focused at a time (tabindex -1 on every item).
function moveFocus(key) {
  const items = enabledItems();
  const at = items.indexOf(document.activeElement);
  // Nothing focused yet: Down starts at the first item, Up at the last.
  const up = at < 0 ? items.length - 1 : at - 1;
  const next = { ArrowDown: at + 1, ArrowUp: up, Home: 0, End: items.length - 1 }[key];
  items.at(next % items.length)?.focus();
}

function onPopoverKeydown(event) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close({ returnFocus: true });
  } else if (event.key === "Tab" && !asSheet.value) {
    close();
  } else if (!isPanel.value && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    moveFocus(event.key);
  } else if (!isPanel.value && event.key === " " && event.target.matches("a")) {
    event.preventDefault();
    event.target.click();
  }
}

function onDocumentPointer(event) {
  if (asSheet.value) return;
  const inside = [root.value, popover.value].some((el) => el?.contains(event.target));
  if (expanded.value && !inside) close();
}

// The trigger control is slot content: its ARIA state is set on the element itself.
function syncTriggerAria() {
  const control = triggerControl();
  if (!control || control === trigger.value) return;
  control.setAttribute("aria-haspopup", isPanel.value ? "dialog" : "menu");
  control.setAttribute("aria-expanded", String(isOpen.value));
  control.setAttribute("aria-controls", menuId);
}

// An async trigger (the global boots load lazily) renders after the menu mounts, a disabled one is enabled later:
// sync again when it appears or changes.
let triggerObserver = null;
watch(isOpen, syncTriggerAria, { flush: "post" });
onMounted(() => {
  syncTriggerAria();
  triggerObserver = new MutationObserver(syncTriggerAria);
  // `disabled` too: a control that mounts disabled is no FOCUSABLE until it is enabled.
  triggerObserver.observe(trigger.value, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
  document.addEventListener("pointerdown", onDocumentPointer);
});
onBeforeUnmount(() => {
  triggerObserver?.disconnect();
  document.removeEventListener("pointerdown", onDocumentPointer);
});

defineExpose({ open: openMenu, close });
</script>

<style lang="scss" scoped>
.basic-menu {
  position: relative;
  display: inline-flex;
}

.basic-menu--inline {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

// In the page flow the list stacks like content: a real menu opened next to it stays on top.
.basic-menu--inline .basic-menu__popover {
  z-index: auto;
}

.basic-menu--inline-up {
  flex-direction: column-reverse;
}

.basic-menu__trigger {
  display: inline-flex;
}

.basic-menu__popover {
  z-index: 200;
  min-width: 12rem;
  max-width: min(22rem, calc(100vw - var(--space-4)));
  padding: var(--space-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.basic-menu__popover--panel {
  padding: var(--space-4);
}

.basic-menu__popover--sheet {
  max-width: min(32rem, calc(100vw - var(--space-4)));
}

// The phone sheet: pinned to the bottom edge at full width over the backdrop.
.basic-menu__popover--bottom {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  max-width: none;
  max-height: 85vh;
  overflow-y: auto;
  border-bottom: none;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.basic-menu__item {
  width: 100%;
  min-height: var(--elem-height);
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-base);
  color: var(--text-body);
  background: none;
  font-size: var(--fs-300);
  text-align: left;
  text-decoration: none;
  white-space: nowrap;

  &:hover:not([aria-disabled="true"]),
  &:focus-visible {
    background: var(--surface-hover);
  }

  &[aria-disabled="true"] {
    color: var(--text-muted);
    cursor: not-allowed;
  }
}

.basic-menu__item--danger {
  color: var(--negative);
}

.basic-menu__icon {
  width: var(--space-4);
  color: var(--text-secondary);
}

.basic-menu__item--danger .basic-menu__icon {
  color: inherit;
}

.basic-menu__heading {
  padding: var(--space-1) var(--space-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.basic-menu__separator {
  height: 1px;
  margin: var(--space-1) 0;
  background: var(--border-subtle);
}
</style>
