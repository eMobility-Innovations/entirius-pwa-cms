/**
 * A list row opens its detail (the full proposal card) in a side panel; Focus mode, picked from the mode switch,
 * starts at the top, so a keyboard shortcut never acts on a stale row.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposals: vi.fn(({ page }) => {
    const results = Array.from({ length: 7 }, (_, i) => ({ id: page * 10 + i + 1, status: "pending", target_locator: {} }));
    return Promise.resolve({ data: { results, count: 60 } });
  }),
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(),
  POST_BulkAcceptProposals: vi.fn(),
  POST_BulkRejectProposals: vi.fn(),
  POST_BulkUndoProposals: vi.fn(),
  GET_Task: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/api/enrichment/api", () => api);
// The run labels (useRunLabels) are not under test here.
vi.mock("@/views/EnrichmentReview/useRunLabels", () => ({ useRunLabels: () => ({ labels: {}, load: () => Promise.resolve() }) }));
// The field names and the product of a card are not under test here.
vi.mock("@/api/pim/api", () => ({
  GET_Features: () => Promise.resolve({ data: { results: [] } }),
  GET_Product: () => Promise.resolve({ data: {} }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ channels: [], fetchChannels: vi.fn(), activeChannelIdx: "c1" }),
}));

import EnrichmentReview from "@/views/EnrichmentReview/index.vue";
import FocusMode from "@/views/EnrichmentReview/FocusMode.vue";

// FocusMode listens on window: a test that fails before its end must not leave its listener behind.
enableAutoUnmount(afterEach);

const DataTable = { name: "DataTable", props: ["rows"], emits: ["row-click"], template: "<div />" };
const Pagination = { name: "Pagination", props: ["page", "pages"], emits: ["update:page"], template: "<nav />" };
const PageLayout = { template: "<div><slot name='header' /><slot /><slot name='footer' /></div>" };

async function mountPage() {
  const w = mount(EnrichmentReview, {
    attachTo: document.body,
    global: {
      // The view loads FocusMode lazily; the stub hands it the real component synchronously.
      stubs: { FocusMode, PageLayout, PageHeader: true, DataTable, Pagination, ActionBar: true, DiffRenderer: true,
        ProductPreviewCard: true, FormField: true, BasicTextarea: true, BulkActionBar: true, BulkUndo: true,
        DriftModal: true, ImportCsvDialog: true, ProductPreviewDrawer: true, MobileFilterPanel: true,
        SideDrawer: { props: ["visible"], template: "<div v-if='visible'><slot /></div>" },
        ProposalPanel: { name: "ProposalPanel", props: ["proposal", "task", "busy"], emits: ["accept", "reject", "updated"], template: "<div />" } },
    },
  });
  await flushPromises();
  return w;
}

async function clickRow(w, index) {
  const table = w.findComponent(DataTable);
  table.vm.$emit("row-click", table.props("rows")[index]);
  await flushPromises();
}

async function setMode(w, mode) {
  w.vm.mode = mode;
  await flushPromises();
}

async function pressAccept() {
  api.POST_AcceptProposal.mockClear();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
  await flushPromises();
  return api.POST_AcceptProposal.mock.calls[0][0];
}

describe("EnrichmentReview — list row detail", () => {
  it("a row click opens that proposal's card in the side panel; Apply there accepts it and closes the panel", async () => {
    const w = await mountPage();
    await clickRow(w, 5);
    const panel = w.findComponent({ name: "ProposalPanel" });
    expect(panel.props("proposal").id).toBe(16);

    panel.vm.$emit("accept", panel.props("proposal"));
    await flushPromises();
    expect(api.POST_AcceptProposal).toHaveBeenLastCalledWith(16);
    expect(w.findComponent({ name: "ProposalPanel" }).exists()).toBe(false);
  });

  it("Focus mode starts at the first row", async () => {
    const w = await mountPage();
    await setMode(w, "focus");
    expect(await pressAccept()).toBe(11);
  });

  it("under the All chip Focus walks the pending set only; leaving it lists every status again", async () => {
    const w = await mountPage();
    await w.vm.onFilterChange("status", "__all");
    await flushPromises();
    expect(api.GET_Proposals).toHaveBeenLastCalledWith(expect.objectContaining({ status: "all" }));
    await setMode(w, "focus");
    expect(api.GET_Proposals).toHaveBeenLastCalledWith(expect.objectContaining({ status: "pending", page: 1 }));
    await setMode(w, "list");
    expect(api.GET_Proposals).toHaveBeenLastCalledWith(expect.objectContaining({ status: "all" }));
  });
});
