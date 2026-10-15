import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, RouterLinkStub, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: { status: "rejected" } })),
  GET_Task: vi.fn(() => Promise.resolve({ data: { id: 4, params: { brief: { topic: "Securing a sofa" } } } })),
}));
vi.mock("@/api/enrichment/api", () => api);
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

enableAutoUnmount(afterEach);

const ProposalPanel = {
  name: "ProposalPanel",
  props: ["proposal", "task", "busy", "wide"],
  emits: ["accept", "reject", "updated"],
  template: "<div class='panel' />",
};
const BasicButton = { props: ["type"], emits: ["click"], template: "<button :type='type || \"button\"' @click=\"$emit('click')\"><slot /></button>" };
const stubs = {
  ProposalPanel,
  BasicButton,
  StudioStepPreview: { name: "StudioStepPreview", props: ["proposal"], template: "<div class='studio-preview' />" },
  BasicCard: { template: "<div><slot /></div>" },
  RouterLink: RouterLinkStub,
  ProductPreviewCard: true,
};

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    status: "pending",
    target_kind: "text",
    subject_ref: `SKU-${i + 1}`,
    proposed_value: { text: `p${i}` },
    current_snapshot: { text: `c${i}` },
    target_locator: { feature_idx: "description", language: "en" },
  }));
}

const studioRow = (extra = {}) => ({
  id: 9, status: "pending", task_id: 4, target_kind: "artifact", subject_ref: "run:a763", subject_label: "",
  target_locator: { step: "keywords" }, proposed_value: { data: { primary: "sofa", candidates: [] } }, current_snapshot: {},
  ...extra,
});

function build(props = {}) {
  return mount(FocusMode, {
    props: { rows: rows(3), loading: false, page: 1, pageSize: 25, totalCount: 3, statusFilter: "pending", ...props },
    attachTo: document.body,
    global: { stubs },
  });
}

const key = (w, k, target = document.body) => w.vm.onKey({ key: k, target, preventDefault() {} });
const panel = (w) => w.findComponent({ name: "ProposalPanel" });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockClear());
});

describe("FocusMode heading", () => {
  it("a product reads by its name and SKU", () => {
    const w = build({ rows: [{ ...rows(1)[0], subject_ref: "ENT-S001", subject_label: "Orion lamp" }] });
    expect(w.get("[data-testid='enrichment-focus-subject']").text()).toBe("Orion lamp · ENT-S001");
  });

  it("a Studio step reads by its run's topic and step, never its run id", async () => {
    const w = build({ rows: [studioRow()] });
    await flushPromises();
    const title = w.get("[data-testid='enrichment-focus-subject']").text();
    expect(api.GET_Task).toHaveBeenCalledWith(4);
    expect(title).toContain("enrichment.review.focus.studio_title");
    expect(title).toContain("Securing a sofa");
    expect(title).not.toContain("run:");
  });

  it("a Studio step without a known topic reads as a Studio article with its step", async () => {
    api.GET_Task.mockRejectedValueOnce(new Error("gone"));
    const w = build({ rows: [studioRow()] });
    await flushPromises();
    const title = w.get("[data-testid='enrichment-focus-subject']").text();
    expect(title).toContain("enrichment.review.focus.studio_untitled");
    expect(title).not.toContain("run:");
  });

  it("the counter says how many are left to review on a review filter, a plain position elsewhere", () => {
    expect(build().get("[data-testid='enrichment-focus-progress']").text())
      .toBe('enrichment.review.focus.progress::{"index":1,"total":3}');
    expect(build({ statusFilter: "applied" }).get("[data-testid='enrichment-focus-progress']").text())
      .toBe('enrichment.review.progress::{"index":1,"total":3}');
  });

  it("the keyboard hint is the plain wording", () => {
    expect(build().get("[data-testid='enrichment-focus-keys']").text()).toBe("enrichment.review.focus.shortcuts");
  });
});

describe("FocusMode — Studio steps are decided in the Studio", () => {
  it("shows the step read-only with a link to its run and step, no card, no Apply", async () => {
    const w = build({ rows: [studioRow()] });
    await flushPromises();
    expect(panel(w).exists()).toBe(false);
    expect(w.findComponent({ name: "StudioStepPreview" }).props("proposal").id).toBe(9);
    expect(w.findComponent(RouterLinkStub).props("to")).toEqual({
      name: "EnrichmentStudioRun", params: { uid: "a763" }, query: { step: "keywords" },
    });
    expect(w.get("[data-testid='enrichment-focus-skip']").text()).toBe("enrichment.review.focus.next");
    expect(w.get("[data-testid='enrichment-focus-keys']").text()).toBe("enrichment.review.focus.shortcuts_move");
  });

  it("A and R do nothing on a Studio step; S still moves on", async () => {
    const w = build({ rows: [studioRow(), studioRow({ id: 10 })], totalCount: 2 });
    key(w, "a");
    key(w, "r");
    await flushPromises();
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    expect(w.find("[data-testid='enrichment-focus-reject-form']").exists()).toBe(false);
    key(w, "s");
    expect(w.vm.localIndex).toBe(1);
  });
});

describe("FocusMode — only pending proposals get decisions", () => {
  it("a decided proposal goes to the card as it is and takes no keyboard Apply", async () => {
    const w = build({ rows: [{ ...rows(1)[0], status: "applied" }], statusFilter: "applied" });
    expect(panel(w).props("proposal").status).toBe("applied");
    key(w, "a");
    await flushPromises();
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    expect(w.get("[data-testid='enrichment-focus-skip']").text()).toBe("enrichment.review.focus.next");
  });

  it("Apply on the card applies and moves on; going back shows it applied", async () => {
    const w = build();
    panel(w).vm.$emit("accept", w.vm.current);
    await flushPromises();
    expect(api.POST_AcceptProposal).toHaveBeenCalledWith(1);
    expect(w.vm.localIndex).toBe(1);
    key(w, "ArrowLeft");
    await flushPromises();
    expect(panel(w).props("proposal").status).toBe("applied");
    key(w, "a");
    expect(api.POST_AcceptProposal).toHaveBeenCalledTimes(1);
  });

  it("a drifted answer stays in place with the new value and the re-confirm banner", async () => {
    api.POST_AcceptProposal.mockResolvedValueOnce({ data: { id: 1, status: "drifted", current_snapshot: { text: "moved" } } });
    const w = build();
    key(w, "a");
    await flushPromises();
    expect(w.vm.localIndex).toBe(0);
    expect(panel(w).props("proposal")).toMatchObject({ status: "drifted", current_snapshot: { text: "moved" } });
    expect(w.find("[data-testid='enrichment-focus-drift']").exists()).toBe(true);
  });
});

describe("FocusMode — reject asks for its reason in place", () => {
  it("no reason box until Reject; Enter (submit) rejects with the reason and moves on", async () => {
    const w = build();
    expect(w.find("[data-testid='enrichment-focus-reject-form']").exists()).toBe(false);
    panel(w).vm.$emit("reject", { proposal: w.vm.current, reason: "" });
    await flushPromises();
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
    w.vm.reason = " off-brand ";
    await w.get("[data-testid='enrichment-focus-reject-form']").trigger("submit");
    await flushPromises();
    expect(api.POST_RejectProposal).toHaveBeenCalledWith(1, { reason: "off-brand" });
    expect(w.vm.localIndex).toBe(1);
    expect(w.find("[data-testid='enrichment-focus-reject-form']").exists()).toBe(false);
  });

  it("R opens it, Esc closes it without rejecting", async () => {
    const w = build();
    key(w, "r");
    await flushPromises();
    const form = w.get("[data-testid='enrichment-focus-reject-form']");
    await form.trigger("keydown", { key: "Escape" });
    expect(w.find("[data-testid='enrichment-focus-reject-form']").exists()).toBe(false);
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
    expect(w.vm.localIndex).toBe(0);
  });

  it("shortcuts wait while the reason box is open or the operator types", () => {
    const w = build();
    key(w, "a", { tagName: "TEXTAREA" });
    key(w, "a", { tagName: "INPUT" });
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    w.vm.rejecting = true;
    key(w, "s");
    expect(w.vm.localIndex).toBe(0);
  });
});

describe("FocusMode navigation", () => {
  it("skip advances without an API call", () => {
    const w = build();
    w.vm.skip();
    expect(w.vm.localIndex).toBe(1);
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
  });

  it("emits need-more at the end of a non-final page", () => {
    const w = build({ totalCount: 50 });
    w.vm.localIndex = 2;
    w.vm.skip();
    expect(w.emitted("need-more")).toBeTruthy();
  });

  it("emits exit at the very end of the filtered set", () => {
    const w = build({ totalCount: 3 });
    w.vm.localIndex = 2;
    w.vm.skip();
    expect(w.emitted("exit")).toBeTruthy();
  });
});
