import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProduct = vi.fn();
vi.mock("@/api/enrichment/api", () => ({ PATCH_Proposal: vi.fn(), GET_StagedFile: vi.fn() }));
vi.mock("@/api/pim/api", () => ({
  GET_Product: (...a) => mockGetProduct(...a),
  GET_Features: () => Promise.resolve({ data: { results: [{ idx: "meta_description", name: "Meta description" }] } }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "c1" }) }));

import ProposalPanel from "@/views/EnrichmentReview/ProposalPanel.vue";

const DiffRenderer = { name: "DiffRenderer", props: ["targetKind", "rules", "snippet", "wide", "subjectLabel"], template: "<div />" };
const stubs = {
  DiffRenderer,
  ActionBar: { name: "ActionBar", props: ["actions"], template: "<div />" },
  Tag: { props: ["label"], template: "<i>{{ label }}</i>" },
  BasicTooltip: { props: ["text"], template: "<span><slot /></span>" },
  ProposalCorrection: { name: "ProposalCorrection", props: ["proposal", "task", "selection"], emits: ["updated", "busy"], template: "<div />" },
};
const meta = {
  id: 7, status: "pending", subject_ref: "ENT-1", subject_label: "", source: "worker:pim.meta@v1",
  target_kind: "attribute_value", target_locator: { channel: "c1", language: "pl", feature_idx: "meta_description" },
  proposed_value: { text: "Sofa" }, current_snapshot: { text: "" },
};
const PRODUCT = { name: "Orion", name_t9n: { pl: "Sofa Orion" }, url_key_t9n: { pl: "sofa-orion" } };

describe("ProposalPanel", () => {
  beforeEach(() => mockGetProduct.mockReset());

  it("a meta description gets its length target and a search preview from the product on screen", async () => {
    const w = mount(ProposalPanel, { props: { proposal: meta, product: PRODUCT }, global: { stubs } });
    await flushPromises();
    expect(w.find("[data-testid='proposal-field']").text()).toBe("Meta description");
    expect(w.findComponent(DiffRenderer).props()).toMatchObject({
      rules: { min: 120, max: 155, snippet: true },
      snippet: { title: "Sofa Orion", url: "/sofa-orion" },
    });
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  it("without the product on screen it fetches it for the preview", async () => {
    mockGetProduct.mockResolvedValue({ data: PRODUCT });
    const w = mount(ProposalPanel, { props: { proposal: meta }, global: { stubs } });
    await flushPromises();
    expect(mockGetProduct).toHaveBeenCalledWith("c1", "ENT-1");
    expect(w.findComponent(DiffRenderer).props("snippet")).toEqual({ title: "Sofa Orion", url: "/sofa-orion" });
  });

  it("a video is named by its kind; the worker hides behind the info icon", () => {
    const video = { ...meta, target_kind: "video", target_locator: { channel: "c1" } };
    const $t = (key) => (key === "enrichment.review.kind.video" ? "Product video" : key);
    const w = mount(ProposalPanel, { props: { proposal: video }, global: { stubs, mocks: { $t } } });
    expect(w.find("[data-testid='proposal-field']").text()).toBe("Product video");
    expect(w.find("[data-testid='proposal-language']").exists()).toBe(false);
    expect(w.find("[data-testid='proposal-meta']").attributes("aria-label")).toBe("pim.meta@v1 · video");
  });

  it("a pending text carries the correction tools; their new value and busy state reach the card", async () => {
    const w = mount(ProposalPanel, { props: { proposal: meta, product: PRODUCT }, global: { stubs } });
    const correction = w.findComponent({ name: "ProposalCorrection" });
    expect(correction.props("proposal")).toEqual(meta);
    correction.vm.$emit("updated", { ...meta, proposed_value: { text: "Couch" } });
    expect(w.emitted("updated")[0][0].proposed_value).toEqual({ text: "Couch" });
    correction.vm.$emit("busy", true);
    await w.vm.$nextTick();
    const actions = w.findComponent({ name: "ActionBar" }).props("actions");
    expect(actions.every((a) => a.disabled)).toBe(true);
  });

  it("a selection scopes the correction only when it occurs once in the proposed text", async () => {
    const proposal = { ...meta, proposed_value: { text: "A red sofa" }, current_snapshot: { text: "A blue sofa" } };
    const w = mount(ProposalPanel, { props: { proposal, product: PRODUCT }, global: { stubs } });
    const select = (text) => {
      const node = w.find("[data-testid='proposal-view']").element;
      vi.spyOn(window, "getSelection").mockReturnValue({ anchorNode: node, toString: () => text });
      return w.find("[data-testid='proposal-view']").trigger("mouseup");
    };
    const scope = () => w.findComponent({ name: "ProposalCorrection" }).props("selection");
    await select("red sofa");
    expect(scope()).toBe("red sofa");
    await select("blue red sofa"); // crosses the removed word of the changes view
    expect(scope()).toBe("");
    await select("red");
    await w.setProps({ proposal: { ...proposal, proposed_value: { text: "A red couch" } } });
    expect(scope()).toBe("");
    vi.restoreAllMocks();
  });

  it("an applied proposal or a media one has no correction tools", () => {
    const applied = mount(ProposalPanel, { props: { proposal: { ...meta, status: "applied" }, product: PRODUCT }, global: { stubs } });
    expect(applied.findComponent({ name: "ProposalCorrection" }).exists()).toBe(false);
    const video = { ...meta, target_kind: "video", proposed_value: { duration_s: 5 }, target_locator: { channel: "c1" } };
    const media = mount(ProposalPanel, { props: { proposal: video }, global: { stubs } });
    expect(media.findComponent({ name: "ProposalCorrection" }).exists()).toBe(false);
  });
});
