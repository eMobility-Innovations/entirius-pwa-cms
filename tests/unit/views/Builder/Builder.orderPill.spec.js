import { describe, it, expect, vi } from "vitest";
import Builder from "@/views/Builder/Builder.vue";

// The section order is a FloatingActions pill with a visible label (plan 18, R6/R7): the `reorder` meaning, and a
// click opens the order kit the old aux button opened.
describe("Builder — section order pill", () => {
  it("names the reorder action and opens the order kit", () => {
    const click = vi.fn();
    const vm = { $t: (key) => key, $refs: { manageOrderSetter: { $el: { click } } } };
    const pill = Builder.computed.orderPill.call(vm);

    expect(pill).toMatchObject({ icon: "reorder", label: "builder.manage_order", testid: "builder-order-pill" });
    pill.handler();
    expect(click).toHaveBeenCalledTimes(1);
  });
});
