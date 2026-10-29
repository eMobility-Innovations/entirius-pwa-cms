import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetTask = vi.fn();
const mockGetProduct = vi.fn();
const mockPatch = vi.fn();
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Task: (...a) => mockGetTask(...a),
  PATCH_Proposal: (...a) => mockPatch(...a),
  GET_StagedFile: vi.fn(),
}));
vi.mock("@/api/pim/api", () => ({
  GET_Product: (...a) => mockGetProduct(...a),
  GET_Features: () =>
    Promise.resolve({ data: { results: [{ idx: "description", name: "Description", name_t9n: { en: "Product description" } }] } }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "c1" }) }));

import ProductMode from "@/views/EnrichmentReview/ProductMode.vue";
import ProposalPanel from "@/views/EnrichmentReview/ProposalPanel.vue";

const row = (over = {}) => ({
  id: 1,
  task_id: 9,
  status: "pending",
  subject_ref: "SKU-1",
  subject_label: "Chair",
  target_kind: "attribute_value",
  target_locator: { channel: "c1", language: "pl", feature_idx: "description" },
  proposed_value: { text: "Krzesło dębowe" },
  current_snapshot: { text: "Krzesło" },
  source: "worker:pim.translate@v2",
  confidence: null,
  ...over,
});

const ROWS = [
  row({ id: 1 }),
  row({ id: 2, target_locator: { channel: "c1", language: "de", feature_idx: "description" } }),
  row({ id: 3, subject_ref: "SKU-2", subject_label: "Table", task_id: 10 }),
];

const stubs = {
  BasicCard: { props: ["title"], template: "<section><h3>{{ title }}</h3><slot name='actions' /><slot /></section>" },
  Tag: { name: "Tag", props: ["label"], template: "<i>{{ label }}</i>" },
  BasicTooltip: { props: ["text"], template: "<span><slot /></span>" },
  ActionBar: { name: "ActionBar", props: ["actions"], template: "<div />" },
  DiffRenderer: true,
  BasicTextarea: true,
};

describe("ProductMode", () => {
  beforeEach(() => {
    mockGetTask.mockReset();
    mockGetProduct.mockReset();
    mockPatch.mockReset();
    mockGetTask.mockImplementation((id) =>
      Promise.resolve({ data: { id, params: { channel: "c1", source_language: "en", target_languages: ["pl", "de"] } } })
    );
    mockGetProduct.mockResolvedValue({ data: { description_t9n: { en: "Oak chair" } } });
  });

  it("groups by product, one stacked card per field and language under its PIM name, loading each task once", async () => {
    const w = mount(ProductMode, { props: { rows: ROWS }, global: { stubs } });
    await flushPromises();

    const groups = w.findAll("[data-testid='enrichment-product-group']");
    expect(groups).toHaveLength(2);
    const cards = groups[0].findAllComponents(ProposalPanel);
    expect(cards.map((c) => c.find("[data-testid='proposal-field']").text())).toEqual(["Product description", "Product description"]);
    expect(cards.map((c) => c.find("[data-testid='proposal-language']").text())).toEqual(["PL", "DE"]);
    expect(mockGetTask.mock.calls.map(([id]) => id)).toEqual([9, 10]);
  });

  it("the panel shows worker@version and the source-language text of a translation", async () => {
    const w = mount(ProductMode, { props: { rows: ROWS.slice(0, 1) }, global: { stubs } });
    await flushPromises();

    expect(w.findComponent({ name: "ProposalDetails" }).vm.source).toContain("pim.translate@v2");
    expect(mockGetProduct).toHaveBeenCalledWith("c1", "SKU-1");
    expect(w.find("[data-testid='proposal-source']").text()).toContain("Oak chair");
  });

  it("edit before accept: PATCHes the proposed text and hands the updated proposal up", async () => {
    const updated = row({ proposed_value: { text: "Krzesło z dębu" } });
    mockPatch.mockResolvedValue({ data: updated });
    const w = mount(ProductMode, { props: { rows: ROWS.slice(0, 1) }, global: { stubs } });
    await flushPromises();

    const panel = w.findComponent(ProposalPanel);
    panel.vm.startEdit();
    expect(panel.vm.draft).toBe("Krzesło dębowe");
    panel.vm.draft = "Krzesło z dębu";
    await panel.vm.saveEdit();

    expect(mockPatch).toHaveBeenCalledWith(1, { proposed_value: { text: "Krzesło z dębu" } });
    expect(w.emitted("updated")[0][0]).toEqual(updated);
    expect(panel.vm.editing).toBe(false);
  });

  it("accept and reject go up to the review page", async () => {
    const w = mount(ProductMode, { props: { rows: ROWS.slice(0, 1) }, global: { stubs } });
    await flushPromises();
    const actions = w.findComponent({ name: "ActionBar" }).props("actions");
    expect(actions.map((a) => [a.key, a.role])).toEqual([["reject", "danger"], ["edit", "secondary"], ["accept", "primary"]]);
    expect(actions.find((a) => a.key === "accept").label).toBe("enrichment.review.apply");
    actions.find((a) => a.key === "accept").onClick();
    actions.find((a) => a.key === "reject").onClick();
    expect(w.emitted("accept")[0][0].id).toBe(1);
    expect(w.emitted("reject")[0][0]).toEqual({ proposal: expect.objectContaining({ id: 1 }), reason: "" });
  });

  it("no translation source for a task without a source language", async () => {
    mockGetTask.mockResolvedValue({ data: { id: 9, params: { channel: "c1", languages: ["pl"] } } });
    const w = mount(ProductMode, { props: { rows: ROWS.slice(0, 1) }, global: { stubs } });
    await flushPromises();
    expect(w.find("[data-testid='proposal-source']").exists()).toBe(false);
    expect(mockGetProduct).not.toHaveBeenCalled();
  });

  it("each card in the same language shows its own field's source text", async () => {
    const short = row({ id: 4, target_locator: { channel: "c1", language: "de", feature_idx: "short_description" } });
    const desc = row({ id: 2, target_locator: { channel: "c1", language: "de", feature_idx: "description" } });
    mockGetProduct.mockResolvedValue({ data: { description_t9n: { en: "Oak chair" }, short_description_t9n: { en: "Short text" } } });
    const w = mount(ProductMode, { props: { rows: [desc, short] }, global: { stubs } });
    await flushPromises();

    const sources = w.findAll("[data-testid='proposal-source']").map((n) => n.text());
    expect(sources[0]).toContain("Oak chair");
    expect(sources[1]).toContain("Short text");
  });
});
