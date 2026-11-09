import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, RouterLinkStub, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: { status: "rejected" } })),
  GET_Task: vi.fn(() => Promise.resolve({ data: { id: 4, params: { brief: { topic: "Securing a sofa" } } } })),
  GET_Proposals: vi.fn(() => Promise.resolve({ data: { results: [], count: 0 } })),
}));
vi.mock("@/api/enrichment/api", () => api);
const queueApi = vi.hoisted(() => ({
  POST_ReviewNext: vi.fn(), POST_ReviewSkip: vi.fn(), releaseOnLeave: vi.fn(),
  getReviewProduct: vi.fn(), sendBack: vi.fn(), getMissing: vi.fn(), fillMissing: vi.fn(),
}));
vi.mock("@/api/integrator/review", () => queueApi);
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/api/pim/api", () => ({
  GET_Features: () => Promise.resolve({ data: { results: [{ idx: "description", name: "Description" }] } }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "escootersclinic", channels: ["escootersclinic"] }),
}));

vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: () => true }) }));
vi.mock("@/views/EnrichmentReview/useRunLabels", () => ({
  useRunLabels: () => ({ labels: {}, load: vi.fn() }),
}));

import FocusMode from "@/views/EnrichmentReview/FocusMode.vue";
import ReviewPage from "@/views/EnrichmentReview/index.vue";

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
  api.GET_Proposals.mockReset().mockResolvedValue({ data: { results: [], count: 0 } });
  queueApi.POST_ReviewNext.mockReset().mockResolvedValue({ data: { sku: "A", remaining: 7, reserved_until: "2026-11-09T13:00:00Z" } });
  queueApi.POST_ReviewSkip.mockReset().mockResolvedValue({ data: {} });
  queueApi.releaseOnLeave.mockClear();
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
    expect(w.find("[data-testid='enrichment-focus-send-back-form']").exists()).toBe(false);
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

describe("FocusMode — send back asks for its reason in place", () => {
  it("no reason box until send back; Enter submits the reason and moves on", async () => {
    const w = build();
    expect(w.find("[data-testid='enrichment-focus-send-back-form']").exists()).toBe(false);
    panel(w).vm.$emit("reject", { proposal: w.vm.current, reason: "" });
    await flushPromises();
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
    w.vm.reason = " off-brand ";
    await w.get("[data-testid='enrichment-focus-send-back-form']").trigger("submit");
    await flushPromises();
    expect(api.POST_RejectProposal).toHaveBeenCalledWith(1, { reason: "off-brand" });
    expect(w.vm.localIndex).toBe(1);
    expect(w.find("[data-testid='enrichment-focus-send-back-form']").exists()).toBe(false);
  });

  it("R opens it, Esc closes it without sendingBack", async () => {
    const w = build();
    key(w, "r");
    await flushPromises();
    const form = w.get("[data-testid='enrichment-focus-send-back-form']");
    await form.trigger("keydown", { key: "Escape" });
    expect(w.find("[data-testid='enrichment-focus-send-back-form']").exists()).toBe(false);
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
    expect(w.vm.localIndex).toBe(0);
  });

  it("shortcuts wait while the reason box is open or the operator types", () => {
    const w = build();
    key(w, "a", { tagName: "TEXTAREA" });
    key(w, "a", { tagName: "INPUT" });
    expect(api.POST_AcceptProposal).not.toHaveBeenCalled();
    w.vm.sendingBack = true;
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

describe("FocusMode product steps", () => {
  const FocusProduct = {
    name: "EnrichmentFocusProduct",
    props: ["sku", "locked"],
    emits: ["done", "send-back"],
    data: () => ({ canSendBack: true, setProposal: { id: 11 } }),
    methods: { apply: vi.fn(), sendBack: vi.fn(function () { this.$emit("done", { decided: true }); }) },
    template: "<div class='product' />",
  };
  const product = (id, sku, kind = "attribute_value") => ({
    id,
    status: "pending",
    target_module: "pim",
    target_kind: kind,
    subject_ref: sku,
    target_locator: { channel: "escootersclinic" },
  });
  const render = (props) =>
    mount(FocusMode, {
      props: { pageSize: 3, totalCount: 3, ...props },
      global: { stubs: { ...stubs, FocusProduct }, mocks: { $icons: {} } },
    });
  const sku = (w) => w.findComponent(FocusProduct).props("sku");

  it("opens the server queue and counts products rather than proposal rows", async () => {
    const w = render({ rows: [product(11, "A", "feature_set"), product(12, "A"), product(13, "B")] });
    await flushPromises();
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledWith(undefined);
    expect(sku(w)).toBe("A");
    expect(w.get("[data-testid='enrichment-focus-progress']").text())
      .toBe('enrichment.review.focus.products_remaining::{"remaining":7}');
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    w.findComponent(FocusProduct).vm.$emit("done", { decided: true });
    await flushPromises();
    expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith("A");
    expect(sku(w)).toBe("B");
  });

  it("skip asks for an optional note, then skips on the server before advancing", async () => {
    const w = render({ rows: [product(11, "A")] });
    await flushPromises();
    key(w, "s");
    await flushPromises();
    expect(queueApi.POST_ReviewSkip).not.toHaveBeenCalled();
    expect(w.find("[data-testid='enrichment-focus-skip-form']").exists()).toBe(true);
    w.vm.skipNote = " Waiting for photos ";
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    await w.vm.confirmSkip();
    expect(queueApi.POST_ReviewSkip).toHaveBeenCalledWith("A", "Waiting for photos");
    expect(queueApi.POST_ReviewSkip.mock.invocationCallOrder[0]).toBeLessThan(queueApi.POST_ReviewNext.mock.invocationCallOrder[1]);
    expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith("A");
    expect(sku(w)).toBe("B");
  });

  it("cancel keeps the current product and a blank note stays optional", async () => {
    const w = render({ rows: [product(11, "A")] });
    await flushPromises();
    w.vm.skip();
    w.vm.skipNote = "discard";
    w.vm.cancelSkip();
    expect(queueApi.POST_ReviewSkip).not.toHaveBeenCalled();
    expect(w.vm.skipNote).toBe("");
    expect(sku(w)).toBe("A");
    w.vm.skip();
    await w.vm.confirmSkip();
    expect(queueApi.POST_ReviewSkip).toHaveBeenCalledWith("A", "");
  });

  it("sends the whole product back with the reason and moves on", async () => {
    const w = render({ rows: [product(11, "A", "feature_set"), product(13, "B")] });
    await flushPromises();
    key(w, "r");
    await flushPromises();
    w.vm.reason = "not a tyre";
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    await w.vm.sendBack();
    await flushPromises();
    expect(FocusProduct.methods.sendBack).toHaveBeenCalledWith("not a tyre");
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
    expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith("A");
    expect(sku(w)).toBe("B");
  });

  it("ArrowLeft walks SKUs seen this session and asks the parent for their rows", async () => {
    const w = render({ rows: [product(11, "A")] });
    await flushPromises();
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    await w.vm.productDone({ decided: true });
    key(w, "ArrowLeft");
    await flushPromises();
    expect(sku(w)).toBe("A");
    expect(w.emitted("need-sku").map(([value]) => value)).toEqual(["A", "B", "A"]);
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(2);
    w.unmount();
    expect(queueApi.releaseOnLeave).toHaveBeenCalledWith("B");
  });

  it("refreshing while browsing history keeps the displayed SKU and releases the held reservation", async () => {
    const w = render({ rows: [product(11, "A")] });
    await flushPromises();
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    await w.vm.productDone({ decided: true });
    w.vm.back();
    w.vm.openedAt = Date.now() - 12 * 60 * 1000;
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    await w.vm.refreshReservation();
    await flushPromises();
    expect(sku(w)).toBe("A");
    expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith(undefined);
    w.unmount();
    expect(queueApi.releaseOnLeave).toHaveBeenCalledWith("B");
  });

  it("the product send-back event submits the reason and advances the queue", async () => {
    const w = render({ rows: [product(11, "A", "feature_set"), product(13, "B")] });
    await flushPromises();
    w.findComponent(FocusProduct).vm.$emit("send-back");
    await flushPromises();
    w.vm.reason = "not a tyre";
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    await w.vm.sendBack();
    await flushPromises();
    expect(FocusProduct.methods.sendBack).toHaveBeenCalledWith("not a tyre");
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
    expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith("A");

    expect(sku(w)).toBe("B");
  });

  it("keeps the product and reason when send-back fails", async () => {
    const w = render({ rows: [product(11, "A", "feature_set")] });
    await flushPromises();
    key(w, "r");
    w.vm.reason = "Keep for retry";
    FocusProduct.methods.sendBack.mockRejectedValueOnce(new Error("send-back failed"));
    await w.vm.sendBack();
    await flushPromises();
    expect(FocusProduct.methods.sendBack).toHaveBeenCalledWith("Keep for retry");
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(1);
    expect(sku(w)).toBe("A");
    expect(w.vm.sendingBack).toBe(true);
    expect(w.vm.reason).toBe("Keep for retry");
    expect(w.vm.acting).toBe(false);
    expect(api.POST_RejectProposal).not.toHaveBeenCalled();
  });

  it("does not open the send-back form without product edits", async () => {
    const w = render({ rows: [product(11, "A", "feature_set")] });
    await flushPromises();
    w.findComponent(FocusProduct).vm.canSendBack = false;
    w.vm.startSendBack();
    expect(w.vm.sendingBack).toBe(false);

  });

  it("refreshes a reservation after twelve minutes without passing after", async () => {
    vi.useFakeTimers();
    try {
      const w = render({ rows: [product(11, "A")] });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
      await flushPromises();
      expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(2);
      expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith(undefined);
      expect(w.vm.queue.history).toEqual([]);
      w.unmount();
      await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
      expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("advances after a successful skip even when reservation refresh is still in flight", async () => {
    const w = render({ rows: [product(11, "A")] });
    await flushPromises();
    let finishSkip;
    let finishRefresh;
    queueApi.POST_ReviewSkip.mockReturnValueOnce(new Promise((resolve) => { finishSkip = resolve; }));
    queueApi.POST_ReviewNext.mockReturnValueOnce(new Promise((resolve) => { finishRefresh = resolve; }));
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
    w.vm.skip();
    const skipping = w.vm.confirmSkip();
    w.vm.openedAt = Date.now() - 12 * 60 * 1000;
    const refreshing = w.vm.refreshReservation();
    finishSkip({ data: {} });
    await flushPromises();
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(2);
    finishRefresh({ data: { sku: "A", remaining: 7 } });
    await Promise.all([skipping, refreshing]);
    await flushPromises();
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(3);
    expect(queueApi.POST_ReviewNext).toHaveBeenLastCalledWith("A");
    expect(sku(w)).toBe("B");
  });

  it.each(["skip", "send-back"])("reservation refresh preserves a typed %s note", async (kind) => {
    vi.useFakeTimers();
    try {
      const w = render({ rows: [product(11, "A")] });
      await flushPromises();
      if (kind === "skip") {
        w.vm.skip();
        w.vm.skipNote = "Waiting for photos";
      } else {
        w.vm.startSendBack();
        w.vm.reason = "Not this product";
      }
      await vi.advanceTimersByTimeAsync(12 * 60 * 1000);
      await flushPromises();
      expect(w.vm[kind === "skip" ? "skipping" : "sendingBack"]).toBe(true);
      expect(w.vm[kind === "skip" ? "skipNote" : "reason"])
        .toBe(kind === "skip" ? "Waiting for photos" : "Not this product");
      w.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["pagehide", "beforeunload", "unmount", "exit"])("releases on %s", async (event) => {
    const w = render({ rows: [product(11, "A")] });
    await flushPromises();
    if (event === "unmount") w.unmount();
    else if (event === "exit") w.vm.exit();
    else window.dispatchEvent(new Event(event));
    expect(queueApi.releaseOnLeave).toHaveBeenCalledWith("A");
    if (event !== "unmount") w.unmount();
  });

  it("releases a response that arrives after leaving", async () => {
    let respond;
    queueApi.POST_ReviewNext.mockReturnValueOnce(new Promise((resolve) => { respond = resolve; }));
    const w = render({ rows: [product(11, "A")] });
    w.unmount();
    respond({ data: { sku: "B", remaining: 6 } });
    await flushPromises();
    expect(queueApi.releaseOnLeave).toHaveBeenCalledWith("B");
  });

  it("falls back to the unchanged Studio walk when the queue is empty", async () => {
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: null, remaining: 0 } });
    const w = render({ rows: [product(11, "A"), studioRow(), studioRow({ id: 10 })] });
    await flushPromises();
    expect(w.findComponent(FocusProduct).exists()).toBe(false);
    expect(w.vm.current.id).toBe(9);
    key(w, "s");
    expect(w.vm.current.id).toBe(10);
  });

  it("continues paging for non-PIM proposals when the product queue is exhausted", async () => {
    queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: null, remaining: 0 } });
    const w = render({ rows: [product(11, "A")], pageSize: 1, totalCount: 3 });
    await flushPromises();
    expect(w.emitted("need-more")).toEqual([[{ decided: false }]]);
    await w.setProps({ loading: true });
    await w.setProps({ rows: [product(12, "B")], page: 2 });
    await w.setProps({ loading: false });
    expect(w.emitted("need-more")).toHaveLength(2);
    await w.setProps({ loading: true });
    await w.setProps({ rows: [studioRow()], page: 3 });
    await w.setProps({ loading: false });
    expect(w.vm.current.id).toBe(9);
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(1);
  });

  it("history navigation preserves the held reservation refresh deadline", async () => {
    vi.useFakeTimers();
    try {
      const w = render({ rows: [product(11, "A")] });
      await flushPromises();
      queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
      await w.vm.productDone({ decided: true });
      const openedAt = w.vm.openedAt;
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
      w.vm.back();
      expect(w.vm.openedAt).toBe(openedAt);
      queueApi.POST_ReviewNext.mockResolvedValueOnce({ data: { sku: "B", remaining: 6 } });
      await vi.advanceTimersByTimeAsync(60 * 1000);
      await flushPromises();
      expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(3);
      expect(sku(w)).toBe("A");
      w.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("changing the page module filter releases PIM Focus and opens the new Studio scope", async () => {
    api.GET_Proposals.mockResolvedValue({ data: { results: [product(11, "A")], count: 1 } });
    const w = mount(ReviewPage, {
      global: {
        mocks: { $route: { query: { mode: "focus" }, path: "/enrichment/review", name: "EnrichmentReview" } },
        stubs: {
          ...stubs, FocusMode, FocusProduct,
          PageLayout: { template: "<div><slot name='header' /><slot name='toolbar' /><slot /></div>" },
          PageHeader: { template: "<div><slot name='meta' /><slot name='actions' /><slot name='tabs' /></div>" },
          ActionBar: true, RouteTabs: true, MobileFilterPanel: { template: "<div><slot /></div>" },
          SegmentedControl: true, BasicSelect: true, ListMode: true, ProductMode: true,
          DriftModal: true, ImportCsvDialog: true, ProductPreviewDrawer: true,
          BatchCorrection: true, RunCorrections: true, ConfirmDialog: true, SideDrawer: true,
        },
      },
    });
    await flushPromises();
    expect(w.findComponent(FocusMode).vm.queue.current).toBe("A");
    let finishScope;
    api.GET_Proposals.mockReturnValueOnce(new Promise((resolve) => { finishScope = resolve; }));
    w.getComponent("[data-testid='enrichment-module-filter']").vm.$emit("update:modelValue", "studio");
    await w.vm.$nextTick();
    expect(w.findComponent(FocusMode).exists()).toBe(false);
    expect(queueApi.releaseOnLeave).toHaveBeenCalledWith("A");
    finishScope({ data: { results: [studioRow(), studioRow({ id: 10 })], count: 2 } });
    await flushPromises();
    const focus = w.findComponent(FocusMode);
    expect(focus.vm.queueEnabled).toBe(false);
    expect(focus.vm.current.id).toBe(9);
    key(focus, "s");
    expect(focus.vm.current.id).toBe(10);
    expect(queueApi.POST_ReviewNext).toHaveBeenCalledTimes(1);
  });

  it("opens an explicitly selected skipped SKU without reserving a different product", async () => {
    const w = render({ rows: [], startSku: "SKIPPED" });
    await flushPromises();
    expect(sku(w)).toBe("SKIPPED");
    expect(queueApi.POST_ReviewNext).not.toHaveBeenCalled();
    expect(w.emitted("need-sku")).toEqual([["SKIPPED"]]);
    expect(w.get("[data-testid='enrichment-focus-progress']").text()).toBe("");
    expect(w.vm.refreshTimer).toBe(null);
    w.vm.openedAt = Date.now() - 12 * 60 * 1000;
    await w.vm.refreshReservation();
    expect(queueApi.POST_ReviewNext).not.toHaveBeenCalled();
  });
});
