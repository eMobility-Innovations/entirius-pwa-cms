import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProposals = vi.fn(() => Promise.resolve({ data: { results: [{ id: 7, status: "pending" }], count: 3 } }));
vi.mock("@/api/enrichment/api", () => ({ GET_Proposals: (...a) => mockGetProposals(...a) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ channels: [{}], fetchChannels: vi.fn(), activeChannelIdx: "c1" }),
}));

import EnrichmentReview from "@/views/EnrichmentReview/index.vue";

const ListMode = { name: "ListMode", props: ["rows", "bulk", "totalCount"], template: "<div />" };
const BatchCorrection = { name: "BatchCorrection", props: ["taskId"], emits: ["queued"], template: "<div />" };
const RunCorrections = { name: "RunCorrections", props: ["rows"], emits: ["queued"], template: "<div />" };
const BasicButton = { emits: ["click"], template: "<button @click=\"$emit('click')\"><slot /></button>" };
const replace = vi.fn();

async function mountPage(query) {
  const w = mount(EnrichmentReview, {
    global: {
      stubs: { PageLayout: { template: "<div><slot name='toolbar' /><slot /></div>" }, PageHeader: true, ListMode,
        BatchCorrection, RunCorrections, BasicButton, DriftModal: true, ImportCsvDialog: true, ProductPreviewDrawer: true,
        MobileFilterPanel: true, SideDrawer: true },
      mocks: { $route: { path: "/enrichment", query }, $router: { replace, push: vi.fn() } },
    },
  });
  await flushPromises();
  return w;
}

describe("EnrichmentReview filtered by task", () => {
  it("lists the task's proposals with Correct all and no bulk accept beyond the task", async () => {
    mockGetProposals.mockClear();
    const w = await mountPage({ task: "12" });
    expect(mockGetProposals.mock.calls[0][0]).toMatchObject({ task: "12", status: "pending" });
    expect(w.findComponent({ name: "ListMode" }).props("bulk")).toBe(false);
    expect(w.findComponent({ name: "BatchCorrection" }).props()).toEqual({ taskId: 12 });
  });

  it("Show all drops the task filter", async () => {
    const w = await mountPage({ task: "12" });
    mockGetProposals.mockClear();
    await w.find("[data-testid='enrichment-task-filter-clear']").trigger("click");
    await flushPromises();
    expect(mockGetProposals.mock.calls[0][0].task).toBeUndefined();
    expect(w.find("[data-testid='enrichment-task-filter']").exists()).toBe(false);
    expect(w.findComponent({ name: "ListMode" }).props("bulk")).toBe(true);
  });

  it("without a task there is no task line; the pending list offers Correct all per run", async () => {
    const w = await mountPage({});
    expect(w.findComponent({ name: "BatchCorrection" }).exists()).toBe(false);
    expect(w.findComponent({ name: "RunCorrections" }).props("rows")).toEqual([{ id: 7, status: "pending" }]);
  });

  it("a task reached with every status still offers Correct all", async () => {
    const w = await mountPage({ task: "12", status: "__all" });
    expect(w.findComponent({ name: "BatchCorrection" }).props()).toEqual({ taskId: 12 });
    expect(w.findComponent({ name: "RunCorrections" }).exists()).toBe(false);
  });

  it("another status chip than pending has no Correct all", async () => {
    const w = await mountPage({ status: "applied" });
    expect(w.findComponent({ name: "RunCorrections" }).exists()).toBe(false);
  });

  it("the All status chip asks the server for every status, not the pending default", async () => {
    mockGetProposals.mockClear();
    await mountPage({ status: "__all" });
    expect(mockGetProposals.mock.calls[0][0].status).toBe("all");
  });
});
