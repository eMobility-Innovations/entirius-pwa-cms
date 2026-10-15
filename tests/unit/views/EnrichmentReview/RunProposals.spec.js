import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProposals = vi.fn();
const mockAccept = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Proposals: (...a) => mockGetProposals(...a),
  POST_AcceptProposal: (...a) => mockAccept(...a),
  POST_RejectProposal: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "eu" }) }));

import RunProposals from "@/views/EnrichmentReview/RunProposals.vue";

const ProductMode = {
  name: "ProductMode",
  props: ["rows", "loading", "busy"],
  emits: ["accept", "reject", "updated", "preview-product"],
  template: "<div />",
};
const stubs = {
  ProductMode,
  BatchCorrection: { name: "BatchCorrection", props: ["taskId"], template: "<div />" },
  DriftModal: true,
  ProductPreviewDrawer: { name: "ProductPreviewDrawer", props: ["visible", "sku"], template: "<div />" },
  CountBadge: true,
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
};
const proposal = (id) => ({ id, task_id: 42, status: "pending", subject_ref: `SKU-${id}` });

async function mountRun(results, count = results.length) {
  mockGetProposals.mockResolvedValue({ data: { results, count } });
  const wrapper = mount(RunProposals, { props: { task: { id: 42, status: "done" } }, global: { stubs } });
  await flushPromises();
  return wrapper;
}

describe("RunProposals", () => {
  beforeEach(() => {
    mockGetProposals.mockReset();
    mockAccept.mockReset();
  });

  it("shows the run's pending proposals as product cards, with Correct all for the run", async () => {
    const wrapper = await mountRun([proposal(1), proposal(2)]);

    expect(mockGetProposals).toHaveBeenCalledWith({ task: 42, status: "pending", page_size: 50 });
    expect(wrapper.findComponent(ProductMode).props("rows").map((p) => p.id)).toEqual([1, 2]);
    expect(wrapper.findComponent({ name: "BatchCorrection" }).props("taskId")).toBe(42);
    expect(wrapper.find("[data-testid='run-proposals-all']").exists()).toBe(false);
  });

  it("more than it shows: a link to the whole run in Proposals", async () => {
    const wrapper = await mountRun([proposal(1)], 80);
    const link = wrapper.findComponent({ name: "RouterLink" });
    expect(link.props("to")).toEqual({ name: "EnrichmentReview", query: { task: "42" } });
    expect(link.text()).toBe('enrichment.runs.show_all::{"count":80}');
  });

  it("an applied card leaves the list and the page hears its counts moved", async () => {
    mockAccept.mockResolvedValue({ data: { ...proposal(1), status: "applied" } });
    const wrapper = await mountRun([proposal(1), proposal(2)]);
    wrapper.findComponent(ProductMode).vm.$emit("accept", proposal(1));
    await flushPromises();

    expect(wrapper.findComponent(ProductMode).props("rows").map((p) => p.id)).toEqual([2]);
    expect(wrapper.emitted("changed")).toHaveLength(1);
  });

  it("a product's preview opens from its card", async () => {
    const wrapper = await mountRun([proposal(1)]);
    wrapper.findComponent(ProductMode).vm.$emit("preview-product", proposal(1));
    await flushPromises();
    expect(wrapper.findComponent({ name: "ProductPreviewDrawer" }).props()).toMatchObject({ visible: true, sku: "SKU-1" });
  });

  it("nothing left to review says so", async () => {
    const wrapper = await mountRun([]);
    expect(wrapper.find("[data-testid='run-proposals-empty']").exists()).toBe(true);
    expect(wrapper.findComponent(ProductMode).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "BatchCorrection" }).exists()).toBe(false);
  });
});
