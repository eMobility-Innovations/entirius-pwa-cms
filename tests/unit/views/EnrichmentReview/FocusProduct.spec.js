import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposals: vi.fn(),
  GET_Task: vi.fn(() => Promise.resolve({ data: {} })),
  PATCH_Proposal: vi.fn((id, body) => Promise.resolve({ data: { id, target_kind: "feature_set", ...body } })),
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/api/pim/api", () => ({
  GET_Product: vi.fn(),
  GET_FeatureSetsGlobal: vi.fn(() =>
    Promise.resolve({
      data: {
        results: [
          { idx: "default", name: "Default" },
          { idx: "tyres", name: "Tyres" },
          { idx: "inner_tubes", name: "Inner Tubes" },
        ],
      },
    }),
  ),
}));

import FocusProduct from "@/views/EnrichmentReview/FocusProduct.vue";

enableAutoUnmount(afterEach);

const set = { id: 1, task_id: 7, target_kind: "feature_set", proposed_value: { featureset_idx: "tyres" } };
const attribute = { id: 2, task_id: 7, target_kind: "attribute_value", proposed_value: { value: "40" } };
const Row = { name: "EnrichmentFocusAttribute", props: { proposal: Object, busy: Boolean }, template: "<div class='row' />" };
const Select = { name: "BasicSelect", props: { modelValue: String, options: Array, searchable: Boolean }, template: "<div />" };
const Button = { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" };

function serve(pending, rejected = 0) {
  api.GET_Proposals.mockImplementation(({ status }) =>
    Promise.resolve({ data: status === "pending" ? { results: pending } : { count: rejected, results: [] } }),
  );
}

async function render() {
  const wrapper = mount(FocusProduct, {
    props: { sku: "SKU-1" },
    global: {
      stubs: { FocusAttribute: Row, BasicSelect: Select, BasicButton: Button, Loader: true },
    },
  });
  await flushPromises();
  return wrapper;
}

const find = (wrapper, id) => wrapper.find(`[data-testid='${id}']`);

describe("FocusProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts the set above the attributes and names it over them", async () => {
    serve([attribute, set]);
    const wrapper = await render();
    expect(find(wrapper, "enrichment-focus-set-name").text()).toBe("Tyres");
    const html = wrapper.html();
    expect(html.indexOf("enrichment-focus-set\"")).toBeLessThan(html.indexOf("enrichment-focus-attributes"));
    expect(wrapper.findAllComponents(Row).map((row) => row.props("proposal").id)).toEqual([2]);
  });

  it("a chosen set takes over the heading and locks the attributes it will not apply", async () => {
    serve([attribute, set]);
    const wrapper = await render();
    wrapper.findComponent(Select).vm.$emit("update:modelValue", "inner_tubes");
    await flushPromises();
    expect(find(wrapper, "enrichment-focus-set-name").text()).toBe("Inner Tubes");
    expect(wrapper.findComponent(Row).props("busy")).toBe(true);
  });

  it("offers every set but Default and the AI's, searchable", async () => {
    serve([set]);
    const picker = (await render()).findComponent(Select);
    expect(picker.props("searchable")).toBe(true);
    expect(picker.props("options")).toEqual([{ value: "inner_tubes", label: "Inner Tubes" }]);
  });

  it("applies the set, then the attributes, and moves on", async () => {
    serve([attribute, set]);
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(api.POST_AcceptProposal.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(wrapper.emitted("done")).toEqual([[{ decided: true }]]);
  });

  it("a chosen set is written alone: no attribute is applied", async () => {
    serve([attribute, set]);
    const wrapper = await render();
    wrapper.findComponent(Select).vm.$emit("update:modelValue", "inner_tubes");
    await flushPromises();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(1, { proposed_value: { featureset_idx: "inner_tubes" } });
    expect(api.POST_AcceptProposal.mock.calls.map(([id]) => id)).toEqual([1]);
    expect(wrapper.emitted("done")).toEqual([[{ decided: true }]]);
  });

  it("goes back to the AI's set", async () => {
    serve([set]);
    const wrapper = await render();
    wrapper.findComponent(Select).vm.$emit("update:modelValue", "inner_tubes");
    await flushPromises();
    await find(wrapper, "enrichment-focus-keep-ai-set").trigger("click");
    await flushPromises();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });

  it("asks the page to reject the set", async () => {
    serve([set]);
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-reject-set").trigger("click");
    expect(wrapper.emitted("reject-set")).toHaveLength(1);
  });

  it("the AI's last try cannot be rejected: nothing would bring the product back", async () => {
    serve([set], 2);
    const wrapper = await render();
    expect(find(wrapper, "enrichment-focus-reject-set").exists()).toBe(false);
    expect(find(wrapper, "enrichment-focus-last-try").exists()).toBe(true);
    expect(wrapper.vm.canReject).toBe(false);
  });

  it("a rejected attribute leaves the card and Apply product keeps the rest", async () => {
    serve([set, attribute]);
    const wrapper = await render();
    wrapper.findComponent(Row).vm.$emit("reject", { proposal: attribute });
    await flushPromises();
    expect(api.POST_RejectProposal).toHaveBeenCalledWith(2, {});
    expect(wrapper.findAllComponents(Row)).toHaveLength(0);
  });

  it("a drifted proposal keeps the product on screen", async () => {
    serve([set]);
    api.POST_AcceptProposal.mockResolvedValueOnce({ data: { status: "drifted" } });
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(wrapper.emitted("done")).toBeUndefined();
  });

  it("a product with nothing pending any more moves on, undecided", async () => {
    serve([]);
    expect((await render()).emitted("done")).toEqual([[{ decided: false }]]);
  });
});
