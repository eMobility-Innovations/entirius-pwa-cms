import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetDuplicates = vi.fn();
const mockSpawnNotification = vi.fn();
const mockIsPanelEnabled = vi.fn();

vi.mock("@/api/atlas/api", () => ({
  GET_Duplicates: (...args) => mockGetDuplicates(...args),
  POST_MergeByEan: vi.fn(),
}));

vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockSpawnNotification }),
}));

vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isPanelEnabled: mockIsPanelEnabled }),
}));

vi.mock("@/views/Atlas/components/MergeConfirmationModal.vue", () => ({
  default: {
    name: "MergeConfirmationModal",
    props: ["winnerSku", "loserSku"],
    emits: ["confirmed", "cancelled"],
    template:
      "<div class='stub-modal' :data-winner='winnerSku' :data-loser='loserSku'></div>",
  },
}));

import Duplicates from "@/views/Atlas/Duplicates.vue";
import DataTable from "@/boots/DataTable/index.vue";

function makeGroup(overrides = {}) {
  return {
    ean: "5900000012345",
    realproducts: [
      {
        sku: "FT-A",
        ean: "5900000012345",
        weight: "0.150",
        sources: [{ idx: "ft", name: "Nordwind", is_primary: true }],
      },
      {
        sku: "KH-B",
        ean: "5900000012345",
        weight: "0.155",
        sources: [{ idx: "kh", name: "Acme Tools", is_primary: false }],
      },
    ],
    suggestion: "merge",
    suggestion_detail: "Max weight diff 3.3% within 10% tolerance",
    ...overrides,
  };
}

const globalStubs = {
  StatusBadge: {
    name: "StatusBadge",
    props: ["label", "variant"],
    template: "<span class='stub-badge' :data-variant='variant'>{{ label }}</span>",
  },
  EmptyState: {
    name: "EmptyState",
    props: ["title"],
    template: "<div class='stub-empty' :data-title='title'></div>",
  },
  Loader: true,
  FontAwesomeIcon: true,
};

describe("Duplicates.vue", () => {
  beforeEach(() => {
    mockGetDuplicates.mockReset();
    mockSpawnNotification.mockReset();
    mockIsPanelEnabled.mockReset();
    mockIsPanelEnabled.mockReturnValue(true);
  });

  function mountView() {
    return mount(Duplicates, {
      global: {
        // The real DataTable: the merge buttons live in its row cells.
        components: { DataTable },
        stubs: globalStubs,
        mocks: { $router: { push: vi.fn() } },
      },
    });
  }

  it("renders one group per EAN with suggestion badge", async () => {
    mockGetDuplicates.mockResolvedValue({
      data: { results: [makeGroup()], count: 1 },
    });
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.vm.groups).toHaveLength(1);
    const badges = wrapper.findAll("[data-testid='duplicates-suggestion-5900000012345']");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("opens merge modal with correct winner+loser when Merge to is clicked", async () => {
    mockGetDuplicates.mockResolvedValue({
      data: { results: [makeGroup()], count: 1 },
    });
    const wrapper = mountView();
    await flushPromises();
    // Click the first merge button: "Merge KH-B to FT-A" appears in row KH-B
    const mergeBtn = wrapper.find("[data-testid='duplicates-merge-KH-B-to-FT-A']");
    expect(mergeBtn.exists()).toBe(true);
    await mergeBtn.trigger("click");
    expect(wrapper.vm.mergeModal.visible).toBe(true);
    expect(wrapper.vm.mergeModal.winnerSku).toBe("FT-A");
    expect(wrapper.vm.mergeModal.loserSku).toBe("KH-B");
  });

  it("refetches groups after successful merge", async () => {
    mockGetDuplicates.mockResolvedValue({
      data: { results: [makeGroup()], count: 1 },
    });
    const wrapper = mountView();
    await flushPromises();
    mockGetDuplicates.mockClear();
    wrapper.vm.onMergeConfirmed({
      winner_sku: "FT-A",
      loser_sku: "KH-B",
      links_redirected: 1,
    });
    await flushPromises();
    expect(mockSpawnNotification).toHaveBeenCalled();
    expect(mockGetDuplicates).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.mergeModal.visible).toBe(false);
  });
});
