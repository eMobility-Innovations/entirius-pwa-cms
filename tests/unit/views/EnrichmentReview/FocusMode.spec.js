import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/enrichment/api", () => ({
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: { status: "rejected" } })),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/api/pim/api", () => ({
  GET_Features: () => Promise.resolve({ data: { results: [{ idx: "description", name: "Description" }] } }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "escootersclinic" }),
}));

import FocusMode from "@/views/EnrichmentReview/FocusMode.vue";
import { POST_AcceptProposal } from "@/api/enrichment/api";

const stubs = {
  Loader: true,
  EmptyState: true,
  DiffRenderer: true,
  FontAwesomeIcon: true,
  ProductPreviewCard: true,
};

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    target_kind: "text",
    proposed_value: { text: `p${i}` },
    current_snapshot: { text: `c${i}` },
    target_locator: { feature_idx: "description", language: "en" },
  }));
}

function build(props = {}) {
  return mount(FocusMode, {
    props: { rows: rows(3), loading: false, page: 1, pageSize: 25, totalCount: 3, ...props },
    global: { stubs },
  });
}

describe("FocusMode wording", () => {
  it("the header names the field and language, never module, kind or worker keys", async () => {
    const w = build({ rows: [{ ...rows(1)[0], target_module: "pim", target_kind: "attribute_value", source: "worker:pim.writer@v1" }] });
    await flushPromises();
    const text = w.text();
    expect(text).toContain("Description · EN");
    expect(text).not.toMatch(/attribute_value|pim\.writer|description ·/);
  });

  it("the header names the product and its SKU", () => {
    const w = build({ rows: [{ ...rows(1)[0], subject_ref: "ENT-S001", subject_label: "Orion lamp" }] });
    expect(w.get("[data-testid='enrichment-focus-subject']").text()).toBe("Orion lamp · ENT-S001");
  });

  it("the primary action is Apply, like everywhere else", () => {
    expect(build().vm.actions.find((a) => a.key === "accept").label).toBe("enrichment.review.apply");
  });
});

describe("FocusMode navigation", () => {
  beforeEach(() => POST_AcceptProposal.mockClear());

  it("shows progress as global index of total", () => {
    const w = build();
    expect(w.get('[data-testid="enrichment-focus-progress"]').text()).toContain('"index":1');
  });

  it("skip advances to the next proposal without an API call", async () => {
    const w = build();
    w.vm.skip();
    await flushPromises();
    expect(w.vm.localIndex).toBe(1);
    expect(POST_AcceptProposal).not.toHaveBeenCalled();
  });

  it("accept calls the API and advances on success", async () => {
    const w = build();
    await w.vm.accept();
    await flushPromises();
    expect(POST_AcceptProposal).toHaveBeenCalledWith(1);
    expect(w.vm.localIndex).toBe(1);
  });

  it("emits need-more at the end of a non-final page", async () => {
    const w = build({ totalCount: 50 }); // more pages exist
    w.vm.localIndex = 2; // last of loaded 3
    w.vm.skip();
    expect(w.emitted("need-more")).toBeTruthy();
  });

  it("emits exit at the very end of the filtered set", async () => {
    const w = build({ totalCount: 3 });
    w.vm.localIndex = 2;
    w.vm.skip();
    expect(w.emitted("exit")).toBeTruthy();
  });

  it("drift response re-renders in place and does not advance", async () => {
    POST_AcceptProposal.mockResolvedValueOnce({ data: { id: 1, status: "drifted", target_kind: "text", proposed_value: { text: "p0" }, current_snapshot: { text: "moved" } } });
    const w = build();
    await w.vm.accept();
    await flushPromises();
    expect(w.vm.driftMode).toBe(true);
    expect(w.vm.localIndex).toBe(0);
    expect(w.vm.current.current_snapshot.text).toBe("moved");
  });

  it("ignores keyboard shortcuts while typing in a textarea", () => {
    const w = build();
    const spy = vi.spyOn(w.vm, "accept");
    w.vm.onKey({ key: "a", target: { tagName: "TEXTAREA" }, preventDefault() {} });
    expect(spy).not.toHaveBeenCalled();
  });
});
