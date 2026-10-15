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
  ProposalCorrection: {
    name: "ProposalCorrection",
    props: ["proposal", "task", "selection", "editor"],
    emits: ["updated", "busy"],
    template: "<div><slot name='trail' /></div>",
  },
  ProposalDetails: { name: "ProposalDetails", props: ["proposal", "task"], template: "<i data-testid='proposal-meta' />" },
  QaCheckStatus: { name: "QaCheckStatus", props: ["proposal"], emits: ["updated", "busy"], template: "<i />" },
  FormField: { template: "<div><slot /></div>" },
  BasicRadioGroup: { name: "BasicRadioGroup", props: ["modelValue", "options", "name", "disabled"], template: "<div />" },
  BasicTextarea: true,
  BasicButton: { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" },
};
const meta = {
  id: 7, status: "pending", subject_ref: "ENT-1", subject_label: "", source: "worker:pim.meta@v1",
  target_kind: "attribute_value", target_locator: { channel: "c1", language: "pl", feature_idx: "meta_description" },
  proposed_value: { text: "Sofa" }, current_snapshot: { text: "" },
};
const PRODUCT = { name: "Orion", name_t9n: { pl: "Sofa Orion" }, url_key_t9n: { pl: "sofa-orion" } };

describe("ProposalPanel", () => {
  beforeEach(() => mockGetProduct.mockReset());

  it("the header shows what its AI call cost", () => {
    const w = mount(ProposalPanel, { props: { proposal: { ...meta, cost_usd: "0.0140" }, product: PRODUCT }, global: { stubs } });
    expect(w.find("[data-testid='proposal-cost']").text()).toBe("$0.01");
  });

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

  it("a video is named by its kind; the details sit behind the ⓘ next to the cost", () => {
    const video = { ...meta, target_kind: "video", target_locator: { channel: "c1" } };
    const $t = (key) => (key === "enrichment.review.kind.video" ? "Product video" : key);
    const task = { id: 3, profile_versions: [4] };
    const w = mount(ProposalPanel, { props: { proposal: video, task }, global: { stubs, mocks: { $t } } });
    expect(w.find("[data-testid='proposal-field']").text()).toBe("Product video");
    expect(w.find("[data-testid='proposal-language']").exists()).toBe(false);
    expect(w.findComponent({ name: "ProposalDetails" }).props()).toEqual({ proposal: video, task });
    expect(w.find("[data-testid='profile-usage']").exists()).toBe(false); // no inline note any more
  });

  it("one row of tools: Refine with AI without its own editor link, then the guidelines check", async () => {
    const w = mount(ProposalPanel, { props: { proposal: meta, product: PRODUCT }, global: { stubs } });
    const correction = w.findComponent({ name: "ProposalCorrection" });
    expect(correction.props("editor")).toBe(false);
    const check = correction.findComponent({ name: "QaCheckStatus" });
    check.vm.$emit("updated", { ...meta, standard_checked_at: "2026-10-15T10:00:00Z" });
    expect(w.emitted("updated")[0][0].standard_checked_at).toBe("2026-10-15T10:00:00Z");
    check.vm.$emit("busy", true);
    await w.vm.$nextTick();
    expect(w.findComponent({ name: "ActionBar" }).props("actions").every((a) => a.disabled)).toBe(true);
  });

  it("decisions in one row: Reject, Edit, Apply — one Edit, in place", async () => {
    const w = mount(ProposalPanel, { props: { proposal: meta, product: PRODUCT }, global: { stubs } });
    const keys = () => w.findComponent({ name: "ActionBar" }).props("actions").map((a) => a.key);
    expect(keys()).toEqual(["reject", "edit", "accept"]);
    w.findComponent({ name: "ActionBar" }).props("actions")[1].onClick();
    await w.vm.$nextTick();
    expect(w.find("[data-testid='proposal-full-editor']").exists()).toBe(true);
    expect(keys()).toEqual(["cancel", "save"]);
  });

  it("Full editor opens the long-text editor; an edited draft is saved first", async () => {
    const { PATCH_Proposal } = await import("@/api/enrichment/api");
    PATCH_Proposal.mockResolvedValue({ data: { ...meta, proposed_value: { text: "Couch" } } });
    const push = vi.fn();
    const w = mount(ProposalPanel, { props: { proposal: meta, product: PRODUCT }, global: { stubs, mocks: { $router: { push } } } });
    w.vm.startEdit();
    await w.vm.$nextTick();
    await w.vm.openFullEditor();
    expect(PATCH_Proposal).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ name: "EnrichmentProposalEditor", params: { proposalId: "7" } });
    w.vm.startEdit();
    w.vm.draft = "Couch";
    await w.vm.openFullEditor();
    expect(PATCH_Proposal).toHaveBeenCalledWith(7, { proposed_value: { text: "Couch" } });
    expect(push).toHaveBeenCalledTimes(2);
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

  describe("add or replace", () => {
    const picture = {
      ...meta, id: 41, target_kind: "picture", apply_modes: ["add", "replace"],
      target_locator: { channel: "c1", source_picture_ref: "5", operation: "packshot", variant: 1 },
      proposed_value: { op: "derived" }, current_snapshot: { url: "/media/a.png" },
    };
    const choice = (w) => w.findComponent({ name: "BasicRadioGroup" });

    it("a picture that can replace its original asks how it lands, add by default", () => {
      const w = mount(ProposalPanel, { props: { proposal: picture }, global: { stubs } });
      expect(choice(w).props("modelValue")).toBe("add");
      expect(choice(w).props("options").map((o) => o.value)).toEqual(["add", "replace"]);
      expect(w.find("[data-testid='proposal-apply-mode-hint']").exists()).toBe(false);
    });

    it("the pick is kept for the proposal and Replace says the original stays for Undo", async () => {
      const w = mount(ProposalPanel, { props: { proposal: { ...picture, id: 42 } }, global: { stubs } });
      choice(w).vm.$emit("update:modelValue", "replace");
      await flushPromises();
      expect(choice(w).props("modelValue")).toBe("replace");
      expect(w.find("[data-testid='proposal-apply-mode-hint']").exists()).toBe(true);
    });

    it("no choice for a fixed write or an applied proposal", () => {
      const fixed = mount(ProposalPanel, { props: { proposal: { ...picture, apply_modes: [] } }, global: { stubs } });
      const done = mount(ProposalPanel, { props: { proposal: { ...picture, status: "applied" } }, global: { stubs } });
      expect(choice(fixed).exists()).toBe(false);
      expect(choice(done).exists()).toBe(false);
    });
  });
});
