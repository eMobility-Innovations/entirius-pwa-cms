import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposals: vi.fn(),
  GET_ProposalRevisions: vi.fn(),
  GET_Task: vi.fn(() => Promise.resolve({ data: {} })),
  PATCH_Proposal: vi.fn((id, body) => Promise.resolve({ data: { id, target_kind: "feature_set", ...body } })),
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/api/enrichment/api", () => api);
const review = vi.hoisted(() => ({ getReviewProduct: vi.fn(), getMissing: vi.fn(), fillMissing: vi.fn(), sendBack: vi.fn() }));
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/api/integrator/review", () => review);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
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
import FocusMissingRow from "@/views/EnrichmentReview/FocusMissingRow.vue";

enableAutoUnmount(afterEach);

const set = { id: 1, task_id: 7, target_kind: "feature_set", proposed_value: { featureset_idx: "tyres" } };
const attribute = { id: 2, task_id: 7, target_kind: "attribute_value", proposed_value: { value: "40" } };
const Row = { name: "EnrichmentFocusAttribute", props: { proposal: Object, busy: Boolean }, template: "<div class='row' />" };
const Select = { name: "BasicSelect", props: { modelValue: String, options: Array, searchable: Boolean }, template: "<div />" };
const Button = { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" };

function serve(pending, state = {}) {
  review.getReviewProduct.mockResolvedValue({ data: { rounds_used: 0, rounds_left: 3, has_unsent_edits: false, waiting_ai: false, rounds: [], ...state } });
  review.getMissing.mockResolvedValue({ data: [] });
  review.sendBack.mockResolvedValue({ data: {} });
  api.GET_Proposals.mockImplementation(({ status }) =>
    Promise.resolve({ data: status === "pending" ? { results: pending } : { count: 0, results: [] } }),
  );
}

async function render() {
  const wrapper = mount(FocusProduct, {
    props: { sku: "SKU-1" },
    global: {
      stubs: { FocusAttribute: Row, BasicSelect: Select, BasicButton: Button, FormField: { template: "<label><slot /></label>" }, Loader: true },
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

  it("saves a chosen set without applying it and offers send back only", async () => {
    serve([attribute, set]);
    const wrapper = await render();
    wrapper.findComponent(Select).vm.$emit("update:modelValue", "inner_tubes");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(1, { proposed_value: { featureset_idx: "inner_tubes" } });
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(false);
    expect(find(wrapper, "enrichment-focus-send-back").exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/reject/i);
  });

  it("restores the saved AI set and Apply when the choice is undone", async () => {
    serve([set]);
    const wrapper = await render();
    wrapper.findComponent(Select).vm.$emit("update:modelValue", "inner_tubes");
    await flushPromises();
    await find(wrapper, "enrichment-focus-keep-ai-set").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenLastCalledWith(1, { proposed_value: { featureset_idx: "tyres" } });
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(true);
  });

  it("asks the page for the product reason form, then sends and advances", async () => {
    serve([set], { has_unsent_edits: true });
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-send-back").trigger("click");
    expect(wrapper.emitted("send-back")).toHaveLength(1);
    await wrapper.setProps({ locked: true });
    await wrapper.vm.sendBack("Check the set");
    expect(review.sendBack).toHaveBeenCalledWith({ sku: "SKU-1", reason: "Check the set" });
    expect(wrapper.emitted("done")).toEqual([[{ decided: true }]]);
  });

  it.each([false, true])("after three rounds offers Apply only, even with edits=%s", async (has_unsent_edits) => {
    serve([set], { rounds_used: 3, rounds_left: 0, has_unsent_edits });
    const wrapper = await render();
    expect(find(wrapper, "enrichment-focus-send-back").exists()).toBe(false);
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(true);
  });

  it("a saved attribute edit retains the row and switches to Send back", async () => {
    serve([set, attribute]);
    const wrapper = await render();
    wrapper.findComponent(Row).vm.$emit("updated", { ...attribute, proposed_value: { value: "42" } });
    await flushPromises();
    expect(wrapper.findAllComponents(Row)).toHaveLength(1);
    expect(find(wrapper, "enrichment-focus-send-back").exists()).toBe(true);
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(false);
    wrapper.findComponent(Row).vm.$emit("updated", attribute);
    await flushPromises();
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(true);
  });

  it("without edits offers Apply only", async () => {
    serve([set]);
    const wrapper = await render();
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(true);
    expect(find(wrapper, "enrichment-focus-send-back").exists()).toBe(false);
  });

  it("marks a sent-back product and whether the AI answered", async () => {
    serve([set], { rounds_used: 2, waiting_ai: false });
    const wrapper = await render();
    expect(find(wrapper, "enrichment-focus-rounds").text()).toContain('sent_back::{"n":2}');
    expect(find(wrapper, "enrichment-focus-rounds").text()).toContain("ai_answered");
  });

  it("renders missing inputs and saving one counts as a correction", async () => {
    serve([set]);
    review.getMissing.mockResolvedValue({ data: [{ feature_idx: "width", name: "Width", unit: "mm", kind: "text", options: [] }] });
    review.fillMissing.mockResolvedValue({ data: attribute });
    const wrapper = await render();
    wrapper.findComponent(FocusMissingRow).vm.$emit("fill", "40");
    await flushPromises();
    expect(review.fillMissing).toHaveBeenCalledWith({ sku: "SKU-1", feature_idx: "width", value: "40" });
    expect(find(wrapper, "enrichment-focus-send-back").exists()).toBe(true);
    expect(find(wrapper, "enrichment-focus-apply").exists()).toBe(false);
  });

  it.each([409, 400])("reloads with a clear conflict message for HTTP %s", async (status) => {
    serve([set]);
    api.POST_AcceptProposal.mockRejectedValueOnce({ response: { status, data: { detail: "proposal changed meanwhile" } } });
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(notify).toHaveBeenCalledWith({ type: "warning", msg: "enrichment.review.focus.decided_elsewhere" });
    expect(review.getReviewProduct).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("done")).toBeUndefined();
  });

  it.each([409, 400])("reloads for an unwrapped HTTP %s conflict", async (httpStatus) => {
    serve([set]);
    const error = { detail: httpStatus === 400 ? "proposal changed meanwhile" : "Already decided" };
    Object.defineProperty(error, "httpStatus", { value: httpStatus });
    api.POST_AcceptProposal.mockRejectedValueOnce(error);
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(notify).toHaveBeenCalledWith({ type: "warning", msg: "enrichment.review.focus.decided_elsewhere" });
    expect(review.getReviewProduct).toHaveBeenCalledTimes(2);
  });

  it("blocks decisions while an attribute save is running", async () => {
    serve([attribute]);
    const wrapper = await render();
    const row = wrapper.findComponent(Row);
    row.vm.$emit("saving", true);
    await flushPromises();
    expect(find(wrapper, "enrichment-focus-apply").attributes("disabled")).toBeDefined();
    await wrapper.vm.apply();
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    row.vm.$emit("updated", { ...attribute, proposed_value: { value: "42" } });
    await flushPromises();
    expect(find(wrapper, "enrichment-focus-send-back").attributes("disabled")).toBeDefined();
    await wrapper.vm.sendBack();
    expect(review.sendBack).not.toHaveBeenCalled();
    row.vm.$emit("saving", false);
    await flushPromises();
    await wrapper.vm.sendBack();
    expect(review.sendBack).toHaveBeenCalledWith({ sku: "SKU-1" });
  });

  it("at the round limit restores the person's value before applying", async () => {
    serve([attribute], { rounds_used: 3, rounds_left: 0, rounds: [{ n: 3, items: [{ proposal_id: 2, value: { value: "40" }, ecom_value: { value: "42" } }] }] });
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(2, { proposed_value: { value: "42" } });
    expect(api.POST_AcceptProposal).toHaveBeenCalledWith(2);
  });

  it("at the round limit preserves each saved human edit while restoring other AI answers", async () => {
    const other = { ...attribute, id: 3, proposed_value: { value: "50" } };
    serve([attribute, other], {
      rounds_used: 3,
      rounds_left: 0,
      has_unsent_edits: true,
      rounds: [{ n: 3, items: [
        { proposal_id: 2, value: { value: "40" }, ecom_value: { value: "42" } },
        { proposal_id: 3, value: { value: "50" }, ecom_value: { value: "52" } },
      ] }],
    });
    api.GET_ProposalRevisions.mockImplementation((id) => Promise.resolve({ data: [
      { author_kind: "ai", value: { value: "old" } },
      { author_kind: id === 2 ? "user" : "ai", value: id === 2 ? attribute.proposed_value : other.proposed_value },
    ] }));
    const wrapper = await render();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(api.GET_ProposalRevisions.mock.calls.map(([id]) => id)).toEqual([2, 3]);
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(3, { proposed_value: { value: "52" } });
    expect(api.POST_AcceptProposal.mock.calls.map(([id]) => id)).toEqual([2, 3]);
  });

  it("at the round limit preserves a new edit made in this card", async () => {
    serve([attribute], { rounds_used: 3, rounds_left: 0, rounds: [{ n: 3, items: [{ proposal_id: 2, value: { value: "40" }, ecom_value: { value: "42" } }] }] });
    const wrapper = await render();
    wrapper.findComponent(Row).vm.$emit("updated", { ...attribute, proposed_value: { value: "44" } });
    await flushPromises();
    await find(wrapper, "enrichment-focus-apply").trigger("click");
    await flushPromises();
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
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
