import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";

const BasicTooltip = { name: "BasicTooltip", props: ["text"], template: "<span><slot /></span>" };
const mountCost = (props) => mount(CostLabel, { props, global: { stubs: { BasicTooltip } } });

describe("CostLabel", () => {
  it("a known cost reads as dollars, no tooltip", () => {
    const w = mountCost({ cost: "0.0400" });
    expect(w.text()).toBe("$0.04");
    expect(w.findComponent(BasicTooltip).exists()).toBe(false);
  });

  it("an unknown cost is a dash that says why", () => {
    const w = mountCost({ cost: null });
    expect(w.text()).toBe("—");
    expect(w.findComponent(BasicTooltip).props("text")).toBe("enrichment.cost.unknown");
  });

  it("a sum with a missing part says the total is higher", () => {
    const w = mountCost({ cost: "0.1", partial: true });
    expect(w.text()).toBe("$0.10");
    expect(w.findComponent(BasicTooltip).props("text")).toBe("enrichment.cost.partial");
  });

  it("nothing paid reads as free, not as $0.00", () => {
    const w = mountCost({ cost: "0.0000" });
    expect(w.text()).toBe("enrichment.cost.free");
    expect(w.findComponent(BasicTooltip).exists()).toBe(false);
  });
});
