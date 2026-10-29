/**
 * Plan 45 — EnrichmentReview on the components: the page's Import CSV is a secondary ActionBar action, the list pager
 * is a Pagination in the PageLayout footer, a list row opens Focus on that row, Focus decides on the proposal card
 * (its one primary) and adds Previous and Skip, and the drift dialog is a BasicModal whose actions carry the proposal and the reason.
 */
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/enrichment/api", () => ({
  GET_Proposals: vi.fn(() => Promise.resolve({ data: { results: [{ id: 7 }, { id: 8 }], count: 60 } })),
  POST_AcceptProposal: vi.fn(() => Promise.resolve({ data: { status: "applied" } })),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: {} })),
  POST_BulkAcceptProposals: vi.fn(),
  POST_BulkRejectProposals: vi.fn(),
  POST_BulkUndoProposals: vi.fn(),
}));
// The run labels (useRunLabels) are not under test here.
vi.mock("@/views/EnrichmentReview/useRunLabels", () => ({ useRunLabels: () => ({ labels: {}, load: () => Promise.resolve() }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ channels: [], fetchChannels: vi.fn(), activeChannelIdx: "c1" }),
}));

import EnrichmentReview from "@/views/EnrichmentReview/index.vue";
import ListMode from "@/views/EnrichmentReview/ListMode.vue";
import FocusMode from "@/views/EnrichmentReview/FocusMode.vue";
import DriftModal from "@/views/EnrichmentReview/DriftModal.vue";

const PageLayout = { template: "<div><slot name='header' /><slot name='toolbar' /><slot /><slot name='footer' /></div>" };
const PageHeader = { template: "<header><slot name='meta' /><slot name='actions' /></header>" };
const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
const Pagination = { name: "Pagination", props: ["page", "pages", "disabled"], emits: ["update:page"], template: "<nav />" };
const BasicModal = { name: "BasicModal", props: ["open", "title", "actions"], template: "<div v-if='open'><slot /></div>" };

async function mountPage() {
  const w = mount(EnrichmentReview, {
    global: {
      stubs: { PageLayout, PageHeader, ActionBar, Pagination, ListMode: true, FocusMode: true, DriftModal: true,
        ImportCsvDialog: true, ProductPreviewDrawer: true, SegmentedControl: true, FilterChip: true,
        MobileFilterPanel: true },
    },
  });
  await flushPromises();
  return w;
}

describe("EnrichmentReview page frame", () => {
  it("offers Import CSV as a secondary action and no page primary", async () => {
    const w = await mountPage();
    const [importCsv] = w.findComponent({ name: "ActionBar" }).props("actions");
    expect([importCsv.key, importCsv.role, importCsv.testid]).toEqual(["import", "secondary", "enrichment-import-open"]);
    importCsv.onClick();
    expect(w.vm.importVisible).toBe(true);
  });

  it("pages the list through the footer Pagination", async () => {
    const w = await mountPage();
    const pager = w.findComponent({ name: "Pagination" });
    expect(pager.props()).toEqual({ page: 1, pages: 3, disabled: false });
    pager.vm.$emit("update:page", 2);
    await flushPromises();
    expect(w.vm.page).toBe(2);
  });

  // Plan 54b: no footer jump while a page loads, and no page change racing a running action.
  it("keeps the pager while the list loads and ignores it while an action runs", async () => {
    const w = await mountPage();
    w.vm.loading = true;
    await w.vm.$nextTick();
    const pager = w.findComponent({ name: "Pagination" });
    expect(pager.exists()).toBe(true);
    expect(pager.props("disabled")).toBe(true);
    w.vm.loading = false;
    w.vm.busy = true;
    await w.vm.$nextTick();
    expect(pager.props("disabled")).toBe(true);
    pager.vm.$emit("update:page", 3);
    expect(w.vm.page).toBe(1);
    w.vm.busy = false;
    await w.vm.$nextTick();
    expect(pager.props("disabled")).toBe(false);
  });

  it("has no pager in focus mode", async () => {
    const w = await mountPage();
    w.vm.mode = "focus";
    await w.vm.$nextTick();
    expect(w.findComponent({ name: "Pagination" }).exists()).toBe(false);
  });
});

describe("ListMode", () => {
  it("a clicked row opens its detail", async () => {
    const DataTable = { name: "DataTable", emits: ["row-click"], template: "<div />" };
    const row = { id: 2, status: "pending", target_locator: {} };
    const w = mount(ListMode, { props: { rows: [row], totalCount: 1 }, global: { stubs: { DataTable, Loader: true, EmptyState: true } } });
    w.findComponent({ name: "DataTable" }).vm.$emit("row-click", row);
    expect(w.emitted("row-open")[0]).toEqual([row]);
  });
});

describe("FocusMode actions", () => {
  const rows = [{ id: 1, status: "pending", target_kind: "text", target_locator: {} }];
  const ProposalPanel = { name: "ProposalPanel", props: ["proposal"], template: "<div />" };
  const mountFocus = () =>
    mount(FocusMode, {
      props: { rows, totalCount: 1 },
      global: { stubs: { ProposalPanel, ProductPreviewCard: true, BasicCard: { template: "<div><slot /></div>" } } },
    });

  it("Apply / Edit / Reject are the proposal card's (its one primary); Focus adds only Previous and Skip", () => {
    const w = mountFocus();
    expect(w.findComponent({ name: "ProposalPanel" }).props("proposal").id).toBe(1);
    expect(w.findComponent({ name: "ActionBar" }).exists()).toBe(false);
    const nav = w.findAll("nav basic-button-stub").map((b) => b.attributes("data-testid"));
    expect(nav).toEqual(["enrichment-focus-back", "enrichment-focus-skip"]);
  });
});

describe("DriftModal", () => {
  it("rejects with the typed reason and confirms the proposal", async () => {
    const proposal = { id: 5 };
    const w = mount(DriftModal, {
      props: { visible: true, proposal },
      global: { stubs: { BasicModal, DiffRenderer: true, FormField: true, BasicTextarea: true } },
    });
    w.vm.reason = "stale";
    const [cancel, reject, confirm] = w.findComponent({ name: "BasicModal" }).props("actions");
    expect([cancel.role, reject.role, confirm.role]).toEqual(["secondary", "danger", "primary"]);
    reject.onClick();
    confirm.onClick();
    cancel.onClick();
    expect(w.emitted("reject")[0]).toEqual([{ proposal, reason: "stale" }]);
    expect(w.emitted("confirm")[0]).toEqual([proposal]);
    expect(w.emitted("close")).toBeTruthy();
  });
});
