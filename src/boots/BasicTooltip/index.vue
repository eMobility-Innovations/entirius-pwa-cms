<template>
  <span
    v-if="variant !== 'help' || hintsOn"
    ref="root"
    class="basic-tooltip"
    :class="{ 'basic-tooltip--help': variant === 'help', 'basic-tooltip--own-stop': ownTabStop }"
    :tabindex="ownTabStop ? 0 : undefined"
    :aria-describedby="ownTabStop ? bubbleId : undefined"
    @pointerenter="onPointerEnter"
    @mouseenter="onMouseEnter"
    @mouseleave="onLeave"
    @focusin="onFocusIn"
    @focusout="onLeave"
    @keydown.esc="onEscape"
    @click.capture="onClick"
  >
    <button
      v-if="variant === 'help'"
      type="button"
      class="basic-tooltip__help inline-flex jc-ct ai-ct pointer"
      :class="`basic-tooltip__help--${level}`"
      :aria-label="$t('common.help')"
      :aria-describedby="bubbleId"
      @pointerdown="onHelpPointer"
      @click="onHelpClick"
    >
      <span class="basic-tooltip__mark inline-flex jc-ct ai-ct" aria-hidden="true">?</span>
    </button>
    <slot v-else />
    <span v-show="shown" :id="bubbleId" ref="bubble" role="tooltip" class="basic-tooltip__bubble fs-200" :style="style">
      {{ text }}
    </span>
  </span>
</template>

<script>
let nextId = 0;
</script>

<script setup>
// The one tooltip (docs/ui-rules.md C4): a hint on hover and on keyboard focus, hidden again on Esc, blur and leave.
// The default slot is the trigger, and its first focusable element gets `aria-describedby`; a trigger that only holds
// a disabled control (the disabled-with-reason pattern) becomes the tab stop itself. `variant="help"` renders a `?`
// button named „Pomoc” instead of the slot: the field-hint mark (plan 60), `level` subtle (a hollow ring, the default)
// or important (filled, for a constraint, a format, a limit or a consequence); a tap toggles it on a touch screen; the
// account-menu hints switch (`useHintsOn`) removes it. `tipId` fixes the tip's id (FormField points the control's
// `aria-describedby` at it; read once at setup). `placement` top · bottom · left · right (it flips when there is no
// room); `open` forces it shown (catalogue). Replaces ToolTip, HelpTooltip and HoverMe (plan 19 deletes them).
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch } from "vue";
import { useHintsOn } from "@/composables/fieldHints";
import { FOCUSABLE } from "@/composables/useFocusTrap";
import { useFloatingPosition } from "@/composables/useFloatingPosition";

const props = defineProps({
  text: { type: String, required: true },
  placement: {
    type: String,
    default: "top",
    validator: (value) => ["top", "bottom", "left", "right"].includes(value),
  },
  variant: { type: String, default: "default", validator: (value) => ["default", "help"].includes(value) },
  open: { type: Boolean, default: false },
  level: { type: String, default: "subtle", validator: (value) => ["subtle", "important"].includes(value) },
  tipId: { type: String, default: "" },
});

nextId += 1;
const bubbleId = props.tipId || `basic-tooltip-${nextId}`;
const hintsOn = useHintsOn();
const root = ref(null);
const bubble = ref(null);
const hovered = ref(false);
const focused = ref(false);
const dismissed = ref(false);
const described = ref(null);
const ownTabStop = ref(false);
const tapped = ref(false);
let touchInput = false;

const shown = computed(() => props.open || ((hovered.value || focused.value || tapped.value) && !dismissed.value));
const anchor = computed(() => described.value ?? root.value);
const { style } = useFloatingPosition(anchor, bubble, { placement: () => props.placement, active: shown, gap: 6 });

// Mouse focus (a click) shows nothing: the pointer already hovers.
function isKeyboardFocus(target) {
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

function onFocusIn(event) {
  focused.value = isKeyboardFocus(event.target);
}

// The pointer event comes before the mouse events a tap emulates: a help mark ignores those, the tap toggles it.
// A pen counts as touch (no hover).
function onPointerEnter(event) {
  touchInput = event.pointerType !== "mouse";
}

function onMouseEnter() {
  if (props.variant !== "help" || !touchInput) hovered.value = true;
}

function onHelpPointer(event) {
  touchInput = event.pointerType !== "mouse";
  if (!touchInput) return;
  tapped.value = !tapped.value;
  dismissed.value = false;
}

// A click with no pointer (Enter / Space, a screen reader's activation) toggles it too.
function onHelpClick(event) {
  if (event.detail !== 0) return;
  tapped.value = !tapped.value;
  dismissed.value = false;
}

// A tap anywhere else closes a tapped hint.
function onOutsidePointer(event) {
  if (!root.value?.contains(event.target)) tapped.value = false;
}
watch(tapped, (on) => document[on ? "addEventListener" : "removeEventListener"]("pointerdown", onOutsidePointer));

// Esc hides a shown tip and stops there (a dialog around it stays open); with no tip it goes on to the dialog.
function onEscape(event) {
  if (!shown.value || props.open) return;
  event.stopPropagation();
  dismissed.value = true;
  tapped.value = false;
}

// A click on the trigger (a menu opening, an action run) hides a plain tip until the pointer leaves: it would cover
// what the click opened. Capture: an IconButton stops the click at its button.
function onClick() {
  if (props.variant !== "help") dismissed.value = true;
}

// Focus leaving the tooltip closes a tapped hint too: one opened with Enter never stays behind a Tab.
function onLeave(event) {
  if (event.type === "mouseleave") hovered.value = false;
  else if (!root.value?.contains(event.relatedTarget)) {
    focused.value = false;
    tapped.value = false;
  }
  if (!hovered.value && !focused.value && !tapped.value) dismissed.value = false;
}

// Appended to the target's own descriptions; a tip that repeats the target's name (an IconButton's label) is not
// announced twice. Re-run on every update: a changed text or label adds or removes the id.
function setDescribed(target, on) {
  const ids = (target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== bubbleId);
  if (on) ids.push(bubbleId);
  if (ids.length) target.setAttribute("aria-describedby", ids.join(" "));
  else target.removeAttribute("aria-describedby");
}

// The slot's first focusable element carries the description; with a disabled control only, the wrapper does
// (unless a parent laid the wrapper out as `display: contents`, IconButton: a box-less element is no tab stop).
function describeTrigger() {
  if (props.variant === "help" || !root.value) return;
  const target = root.value.querySelector(FOCUSABLE);
  if (described.value && described.value !== target) setDescribed(described.value, false);
  if (target) setDescribed(target, target.getAttribute("aria-label") !== props.text);
  described.value = target;
  const onlyDisabled = !target && Boolean(root.value.querySelector(":disabled, [aria-disabled='true']"));
  ownTabStop.value = onlyDisabled && getComputedStyle(root.value).display !== "contents";
}

onMounted(describeTrigger);
onUpdated(describeTrigger);
onBeforeUnmount(() => {
  if (described.value) setDescribed(described.value, false);
  document.removeEventListener("pointerdown", onOutsidePointer);
});
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/touch-target";

.basic-tooltip {
  display: inline-flex;
}

// Disabled with a reason: the disabled control swallows the pointer, so the wrapper takes the hover instead.
.basic-tooltip--own-stop :deep(:disabled) {
  pointer-events: none;
}

// The hint mark: a 16 px `?` in a 24 px hit area (40 px wide on a phone; no taller, so it never reaches the control
// under the label) that takes no extra height in the label row.
.basic-tooltip__help {
  width: var(--space-6);
  height: var(--space-6);
  margin-block: calc((var(--space-4) - var(--space-6)) / 2);
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: none;

  @include touch-target(var(--space-10), var(--space-6));
}

.basic-tooltip__mark {
  box-sizing: border-box;
  width: var(--space-4);
  height: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: var(--fs-150);
  line-height: 1;
}

.basic-tooltip__help:is(:hover, :focus-visible) .basic-tooltip__mark {
  border-color: var(--border-default);
  color: var(--text-secondary);
}

// Important: filled. The glyph is text-strong, never text-accent, on accent-subtle (docs/ui-rules.md T1); the accent
// ring carries the colour.
.basic-tooltip__help--important .basic-tooltip__mark {
  border-color: var(--accent);
  color: var(--text-strong);
  background: var(--accent-subtle);
  font-weight: 600;
}

.basic-tooltip__help--important:is(:hover, :focus-visible) .basic-tooltip__mark {
  border-color: var(--accent-hover);
  color: var(--text-strong);
}

.basic-tooltip__bubble {
  z-index: 300;
  width: max-content;
  max-width: 16rem;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-base);
  color: var(--text-inverse);
  background: var(--surface-inverse);
  box-shadow: var(--shadow-md);
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: normal;
  text-transform: none;
  white-space: normal;
  pointer-events: none;
}
</style>
