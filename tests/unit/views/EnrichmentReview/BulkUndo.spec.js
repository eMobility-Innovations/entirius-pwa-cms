import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/enrichment/api", () => ({
  GET_Proposals: vi.fn(() =>
    Promise.resolve({ data: { results: [], count: 0 } })
  ),
  GET_Proposal: vi.fn(() => Promise.resolve({ data: {} })),
  POST_AcceptProposal: vi.fn(() =>
    Promise.resolve({ data: { status: "applied" } })
  ),
  POST_RejectProposal: vi.fn(() => Promise.resolve({ data: {} })),
  POST_BulkAcceptProposals: vi.fn(() =>
    Promise.resolve({ data: { mode: "sync", applied: [1, 2] } })
  ),
  POST_BulkRejectProposals: vi.fn(() =>
    Promise.resolve({ data: { rejected: 0 } })
  ),
  POST_BulkUndoProposals: vi.fn(() =>
    Promise.resolve({ data: { mode: "sync", reverted: [1, 2], blocked: [3] } })
  ),
}));
const { spawnNotification } = vi.hoisted(() => ({
  spawnNotification: vi.fn(),
}));
// The run labels (useRunLabels) are not under test here.
vi.mock("@/views/EnrichmentReview/useRunLabels", () => ({ useRunLabels: () => ({ labels: {}, load: () => Promise.resolve() }) }));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    channels: [],
    fetchChannels: vi.fn(),
    activeChannelIdx: "c1",
    activeChannelLanguages: ["en"],
    allLanguages: ["en"],
  }),
}));

import * as api from "@/api/enrichment/api";
import EnrichmentReview from "@/views/EnrichmentReview/index.vue";
import ListMode from "@/views/EnrichmentReview/ListMode.vue";

const stubs = {
  SegmentedControl: true,
  BasicInput: true,
  Dropdown: true,
  FilterChip: true,
  Loader: true,
  EmptyState: true,
  DataTable: true,
  StatusBadge: true,
  DiffRenderer: true,
  FontAwesomeIcon: true,
  Teleport: true,
  FocusMode: true,
  DriftModal: true,
};

const appliedRow = {
  id: 1,
  status: "applied",
  target_kind: "text",
  proposed_value: {},
  current_snapshot: {},
  target_locator: {},
};

describe("EnrichmentReview bulk undo (etap-09)", () => {
  it("ListMode shows the undo button for applied rows and emits bulk-undo", async () => {
    const w = mount(ListMode, {
      props: { rows: [appliedRow], totalCount: 1, statusFilter: "applied" },
      global: { stubs },
    });
    const undo = w.find('[data-testid="enrichment-undo"]');
    expect(undo.exists()).toBe(true);
    await undo.trigger("click");
    expect(w.emitted("bulk-undo")).toBeTruthy();
  });

  it("ListMode hides the undo button when no applied rows", () => {
    const w = mount(ListMode, {
      props: { rows: [{ ...appliedRow, status: "pending" }], totalCount: 1 },
      global: { stubs },
    });
    expect(w.find('[data-testid="enrichment-undo"]').exists()).toBe(false);
  });

  it("bulkUndo posts the active filters and toasts reverted + blocked", async () => {
    const w = mount(EnrichmentReview, {
      global: { stubs: { ...stubs, ListMode: true } },
    });
    await flushPromises();
    w.vm.filters.target_module = "pim";
    spawnNotification.mockClear();

    await w.vm.bulkUndo();
    await flushPromises();

    expect(api.POST_BulkUndoProposals).toHaveBeenCalledWith({
      target_module: "pim",
    });
    // one positive toast (reverted) + one warning toast (blocked)
    const types = spawnNotification.mock.calls.map((c) => c[0].type);
    expect(types).toContain("positive");
    expect(types).toContain("warning");
  });
});
