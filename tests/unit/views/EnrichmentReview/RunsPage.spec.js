import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetTasks = vi.fn();
const mockGetTask = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/api/enrichment/api", () => ({
  GET_Tasks: (...a) => mockGetTasks(...a),
  GET_Task: (...a) => mockGetTask(...a),
  GET_Workers: () => Promise.resolve({ data: [{ key: "pim.writer", label: "Product texts" }] }),
  GET_Templates: () => Promise.resolve({ data: [{ key: "meta", label: "Meta descriptions" }] }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockNotify }),
}));

import RunsPage from "@/views/EnrichmentReview/RunsPage.vue";

const task = (over = {}) => ({
  id: 1,
  type: "assign-featureset",
  status: "open",
  counts: {},
  created_at: "2026-06-11T18:34:47Z",
  scope_spec: { mode: "gap", check: "feature_set_default", module: "pim" },
  params: { limit: 200, spawn_rule: "classify-featureset" },
  ...over,
});

const mountList = (routerMock = {}, query = {}) =>
  mount(RunsPage, {
    global: {
      mocks: {
        $route: { query, path: "/enrichment/runs" },
        $router: { push() {}, replace() {}, ...routerMock },
      },
      stubs: {
        DataTable: true,
        Pagination: true,
        TaskQueueDrawer: { name: "TaskQueueDrawer", props: ["visible", "taskId", "outcome", "progress"], template: "<div />" },
        RunProposals: { name: "RunProposals", props: ["task"], emits: ["changed"], template: "<div />" },
      },
    },
  });

describe("RunsPage", () => {
  beforeEach(() => {
    mockGetTasks.mockReset();
    mockGetTask.mockReset();
    mockNotify.mockReset();
    mockGetTasks.mockResolvedValue({ data: { results: [], count: 0 } });
  });

  it("loads tasks and flattens scope_spec.check + params.spawn_rule", async () => {
    mockGetTasks.mockResolvedValueOnce({ data: { results: [task()], count: 1 } });

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.tasks).toHaveLength(1);
    expect(wrapper.vm.tasks[0].check).toBe("feature_set_default");
    expect(wrapper.vm.tasks[0].rule).toBe("classify-featureset");
    expect(wrapper.vm.totalCount).toBe(1);
  });

  it("a task waiting in the queue reads as Queued with the runs ahead of it", async () => {
    mockGetTasks.mockResolvedValueOnce({ data: { results: [task({ queued_ahead: 2 }), task({ id: 2, queued_ahead: null })], count: 2 } });

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.isQueued(wrapper.vm.tasks[0])).toBe(true);
    expect(wrapper.vm.isQueued(wrapper.vm.tasks[1])).toBe(false);
    expect(wrapper.vm.queuedText(2)).toBe('enrichment.tasks.ahead_few::{"count":2}');
    expect(wrapper.vm.queuedText(0)).toBe("enrichment.tasks.starts_next");
  });

  it("falls back to em-dash when nested fields are missing", async () => {
    mockGetTasks.mockResolvedValueOnce({
      data: { results: [task({ scope_spec: {}, params: {} })], count: 1 },
    });

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.tasks[0].check).toBe("—");
    expect(wrapper.vm.tasks[0].rule).toBe("—");
  });

  it("initial fetch lists every task (no status param)", async () => {
    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.statusFilter).toBe("__all");
    expect(mockGetTasks.mock.calls.at(-1)[0].status).toBeUndefined();
  });

  it("status filter change requests that status and syncs the route", async () => {
    const replace = vi.fn();
    const wrapper = mountList({ replace });
    await flushPromises();

    wrapper.vm.onFilterChange("done");
    await flushPromises();

    expect(mockGetTasks.mock.calls.at(-1)[0].status).toBe("done");
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ status: "done" }) })
    );
  });

  it("__all filter omits the status param", async () => {
    const wrapper = mountList();
    await flushPromises();

    wrapper.vm.onFilterChange("__all");
    await flushPromises();

    expect(mockGetTasks.mock.calls.at(-1)[0].status).toBeUndefined();
  });

  it("a click on a run still going or failed opens its drawer, with what it came to in plain words", async () => {
    const failed = task({ id: 7, type: "pim.writer", status: "failed", errors: [{ code: "UPSTREAM_TIMEOUT" }], counts: { failed: 2 } });
    mockGetTasks.mockResolvedValueOnce({ data: { results: [failed, task({ id: 8, status: "in_progress" })], count: 2 } });
    const replace = vi.fn();
    const wrapper = mountList({ replace });
    await flushPromises();

    wrapper.vm.onRowClick(wrapper.vm.tasks[0]);
    await flushPromises();
    const drawer = wrapper.findComponent({ name: "TaskQueueDrawer" });
    expect(drawer.props()).toMatchObject({
      visible: true, taskId: 7, outcome: "Failed: The AI provider did not answer in time", progress: "failed: 2",
    });
    expect(wrapper.vm.queueLabel).toBe("Product texts");

    wrapper.vm.onRowClick(wrapper.vm.tasks[1]);
    expect(wrapper.vm.queueTaskId).toBe(8);
    expect(replace).not.toHaveBeenCalled();
  });

  it("a click on a finished run picks it in place (?task): the list narrows to it, its proposals show below", async () => {
    const done = task({ id: 42, status: "done", counts: { proposed: 3 } });
    mockGetTasks.mockResolvedValueOnce({ data: { results: [task({ id: 41, status: "failed" }), done], count: 2 } });
    mockGetTask.mockResolvedValue({ data: done });
    const replace = vi.fn();
    const wrapper = mountList({ replace });
    await flushPromises();
    expect(wrapper.findComponent({ name: "RunProposals" }).exists()).toBe(false);

    wrapper.vm.onRowClick(wrapper.vm.tasks[1]);
    await flushPromises();

    expect(replace).toHaveBeenCalledWith({ path: "/enrichment/runs", query: { task: "42" } });
    expect(mockGetTask).toHaveBeenCalledWith("42");
    expect(wrapper.vm.tasks.map((t) => t.id)).toEqual([42]);
    expect(wrapper.vm.queueVisible).toBe(false);
    const proposals = wrapper.findComponent({ name: "RunProposals" });
    expect(proposals.props("task")).toEqual(done);

    // A reviewed card re-reads the run quietly.
    proposals.vm.$emit("changed");
    await flushPromises();
    expect(mockGetTask).toHaveBeenCalledTimes(2);
  });

  it("a picked run still going says its proposals come when it finishes", async () => {
    mockGetTask.mockResolvedValue({ data: task({ id: 5, status: "in_progress" }) });
    const wrapper = mountList({}, { task: "5" });
    await flushPromises();

    expect(wrapper.find("[data-testid='enrichment-task-running']").text()).toBe("enrichment.ai.results_running");
    expect(wrapper.findComponent({ name: "RunProposals" }).exists()).toBe(false);
    wrapper.unmount();
  });

  it("names a task in plain words: its template, its worker, its Studio step, never its key", async () => {
    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.nameOf({ type: "pim.writer", template: "meta" })).toBe("Meta descriptions");
    expect(wrapper.vm.nameOf({ type: "pim.writer", template: "" })).toBe("Product texts");
    // The test $t has no step names: an unknown step reads as a plain "AI task", never "article.outline".
    expect(wrapper.vm.nameOf({ type: "article.outline", step: "outline" })).toBe("enrichment.tasks.generic");
    expect(wrapper.vm.scopeOf({ topic: "", products: 2, rule: "—" })).toBe('enrichment.tasks.products_few::{"count":2}');
    expect(wrapper.vm.scopeOf({ topic: "Sofas", products: 1, rule: "—" })).toBe("Sofas");
  });

  it("progress reads proposed and failed first (a count without a label keeps its key)", async () => {
    const wrapper = mountList();
    await flushPromises();
    expect(wrapper.vm.formatCounts({ skipped: 2, failed: 1, proposed: 4 })).toBe("proposed: 4, failed: 1, skipped: 2");
    expect(wrapper.vm.formatCounts({})).toBe("—");
  });

  it("?task=<id> shows that one task and clears it when a status is picked", async () => {
    mockGetTask.mockResolvedValue({ data: task({ id: 42, status: "done" }) });
    const replace = vi.fn();
    const wrapper = mountList({ replace }, { task: "42", status: "__all" });
    await flushPromises();

    expect(mockGetTask).toHaveBeenCalledWith("42");
    expect(wrapper.vm.tasks.map((t) => t.id)).toEqual([42]);

    wrapper.vm.onFilterChange("open");
    await flushPromises();
    expect(wrapper.vm.taskFilter).toBe("");
    expect(replace.mock.calls.at(-1)[0].query).toEqual({ status: "open" });
  });

  describe("auto-refresh", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("refreshes while a task is in progress, stops when it is done", async () => {
      mockGetTasks
        .mockResolvedValueOnce({ data: { results: [task({ status: "in_progress", counts: { proposed: 1 } })], count: 1 } })
        .mockResolvedValueOnce({ data: { results: [task({ status: "done", counts: { proposed: 3 } })], count: 1 } });
      const wrapper = mountList();
      await flushPromises();
      expect(mockGetTasks).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      await flushPromises();
      expect(mockGetTasks).toHaveBeenCalledTimes(2);
      expect(wrapper.vm.tasks[0].counts).toEqual({ proposed: 3 });

      await vi.advanceTimersByTimeAsync(10000);
      expect(mockGetTasks).toHaveBeenCalledTimes(2);
    });

    it("stops on unmount", async () => {
      mockGetTasks.mockResolvedValue({ data: { results: [task({ status: "in_progress" })], count: 1 } });
      const wrapper = mountList();
      await flushPromises();
      wrapper.unmount();
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockGetTasks).toHaveBeenCalledTimes(1);
    });
  });
});
