import { describe, it, expect, vi } from "vitest";
import { useSwipe } from "@/composables/useSwipe";

function drag(handlers, dx, dy = 0, { pointerType = "touch", target } = {}) {
  handlers.pointerdown({ pointerType, target, clientX: 100, clientY: 100 });
  handlers.pointermove({ pointerType, clientX: 100 + dx, clientY: 100 + dy });
  handlers.pointerup({ pointerType, clientX: 100 + dx, clientY: 100 + dy });
}

describe("useSwipe", () => {
  const setup = () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    return { onLeft, onRight, ...useSwipe({ onLeft, onRight }) };
  };

  it("fires right past 80 px and left past -80 px", () => {
    const s = setup();
    drag(s.handlers, 81);
    drag(s.handlers, -90);
    expect(s.onRight).toHaveBeenCalledOnce();
    expect(s.onLeft).toHaveBeenCalledOnce();
  });

  it("ignores a short drag", () => {
    const s = setup();
    drag(s.handlers, 79);
    expect(s.onRight).not.toHaveBeenCalled();
    expect(s.offset.value).toBe(0);
  });

  it("a vertical scroll cancels the gesture", () => {
    const s = setup();
    s.handlers.pointerdown({ pointerType: "touch", clientX: 0, clientY: 0 });
    s.handlers.pointermove({ clientX: 30, clientY: 120 });
    s.handlers.pointermove({ clientX: 120, clientY: 120 });
    s.handlers.pointerup({ clientX: 120, clientY: 120 });
    expect(s.onRight).not.toHaveBeenCalled();
  });

  it("a mouse drag across the draft is a no-op", () => {
    const s = setup();
    drag(s.handlers, 200, 0, { pointerType: "mouse" });
    drag(s.handlers, -200, 0, { pointerType: "pen" });
    expect(s.onRight).not.toHaveBeenCalled();
    expect(s.onLeft).not.toHaveBeenCalled();
    expect(s.offset.value).toBe(0);
  });

  it("a touch that starts in an editable field is ignored", () => {
    const s = setup();
    const textarea = document.createElement("textarea");
    drag(s.handlers, 200, 0, { target: textarea });
    expect(s.onRight).not.toHaveBeenCalled();
  });

  it("the threshold counts at release: moving back before lifting the finger does nothing", () => {
    const s = setup();
    s.handlers.pointerdown({ pointerType: "touch", clientX: 100, clientY: 100 });
    s.handlers.pointermove({ clientX: 220, clientY: 100 });
    s.handlers.pointerup({ clientX: 130, clientY: 100 });
    expect(s.onRight).not.toHaveBeenCalled();
  });
});
