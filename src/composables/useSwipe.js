import { ref } from "vue";

// Horizontal touch swipe: past `threshold` px at release → onRight / onLeft. A mostly vertical move is a
// scroll and cancels the gesture. Touch only — a mouse drag selects text and never acts; a gesture that starts
// in an editable field or inside selected text is ignored. Every swipe has a visible button in the caller.
export const SWIPE_THRESHOLD = 80;
const SCROLL_SLOP = 10;

function startsInTextWork(event) {
  if (event.target?.closest?.("input, textarea, select, [contenteditable]")) return true;
  const selection = window.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && event.target && selection.containsNode?.(event.target, true));
}

export function useSwipe({ onLeft, onRight, threshold = SWIPE_THRESHOLD }) {
  const offset = ref(0);
  let start = null;

  function onPointerDown(event) {
    if (event.pointerType !== "touch" || startsInTextWork(event)) return;
    start = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event) {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) > SCROLL_SLOP && Math.abs(dy) > Math.abs(dx)) return cancel();
    offset.value = dx;
  }

  function onPointerUp(event) {
    if (!start) return;
    const dx = (event.clientX ?? start.x) - start.x;
    cancel();
    if (dx >= threshold) onRight();
    else if (dx <= -threshold) onLeft();
  }

  function cancel() {
    start = null;
    offset.value = 0;
  }

  const handlers = { pointerdown: onPointerDown, pointermove: onPointerMove, pointerup: onPointerUp, pointercancel: cancel };
  return { offset, handlers };
}
