import { nextTick, onBeforeUnmount, ref, toValue, watch } from "vue";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";

const VIEWPORT_PADDING = 8;

// Places `floating` next to `anchor` (BasicMenu, BasicTooltip) while `active`: `position: fixed`, so no scrolling or
// clipping ancestor cuts it off; flips to the other side and shifts along it to stay in the viewport, and follows the
// anchor on scroll and resize. Returns the inline `style` for the floating element.
export function useFloatingPosition(anchor, floating, { placement, active, gap = 4 }) {
  const style = ref({ position: "fixed", left: "0px", top: "0px" });
  let stop = null;
  let unmounted = false;

  async function update() {
    const [reference, element] = [toValue(anchor), toValue(floating)];
    if (!reference || !element) return;
    const { x, y } = await computePosition(reference, element, {
      placement: toValue(placement),
      strategy: "fixed",
      middleware: [offset(gap), flip(), shift({ padding: VIEWPORT_PADDING })],
    });
    style.value = { position: "fixed", left: `${x}px`, top: `${y}px` };
  }

  function release() {
    stop?.();
    stop = null;
  }

  watch(
    () => toValue(active),
    async (on) => {
      release();
      if (!on) return;
      await nextTick();
      if (unmounted || !toValue(active)) return;
      const [reference, element] = [toValue(anchor), toValue(floating)];
      if (reference && element) stop = autoUpdate(reference, element, update);
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    unmounted = true;
    release();
  });

  return { style };
}
