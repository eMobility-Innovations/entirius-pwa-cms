import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetTasks = vi.fn();
const mockGetTask = vi.fn();
const mockGetProposals = vi.fn(() => Promise.resolve({ data: { results: [{ subject_ref: "ENT-1", subject_label: "Orion Sofa" }] } }));
const mockNotify = vi.fn();
const mockRetry = vi.fn();

vi.mock("@/api/enrichment/api", () => ({
  POST_RetryTask: (...a) => mockRetry(...a),
  GET_Tasks: (...a) => mockGetTasks(...a),
  GET_Task: (...a) => mockGetTask(...a),
  GET_Proposals: (...a) => mockGetProposals(...a),
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

// The count words this page has (the setup.js $t knows none); anything else reads as its key, as there.
const WORDS = { "enrichment.tasks.counts.proposed": "Proposed", "enrichment.tasks.counts.failed": "Failed" };
const $t = (key, params = {}) => WORDS[key] ?? (Object.keys(params).length ? `${key}::${JSON.stringify(params)}` : key);

const mountList = (routerMock = {}, query = {}, stubs = {}) =>
  mount(RunsPage, {
    global: {
      mocks: {
        $t,
        $route: { query, path: "/enrichment/runs" },
        $router: { push() {}, replace() {}, ...routerMock },
      },
      stubs: {
        DataTable: true,
        Pagination: true,
        TaskQueueDrawer: { name: "TaskQueueDrawer", props: ["visible", "taskId", "outcome", "progress"], template: "<div />" },
        RunProposals: { name: "RunProposals", props: ["task"], emits: ["changed"], template: "<div />" },
        WorkerAlerts: { name: "WorkerAlerts", template: "<div />" },
        ...stubs,
      },
    },
  });

describe("RunsPage", () => {
  beforeEach(() => {
    mockGetTasks.mockReset();
    mockGetTask.mockReset();
    mockNotify.mockReset();
    mockRetry.mockReset();
    mockGetTasks.mockResolvedValue({ data: { results: [], count: 0 } });
  });

  it("the page header raises the AI workers that need attention", async () => {
    const wrapper = mountList();
    await flushPromises();
    expect(wrapper.findComponent({ name: "WorkerAlerts" }).exists()).toBe(true);
  });

    it("loads tasks, keeps each one whole and flattens scope_spec.check", async () => {
    mockGetTasks.mockResolvedValueOnce({ data: { results: [task()], count: 1 } });

    const wrapper = mountList();
    await flushPromises();

    expect(wrapper.vm.tasks).toHaveLength(1);
    expect(wrapper.vm.tasks[0].check).toBe("feature_set_default");
    expect(wrapper.vm.tasks[0].raw).toEqual(task());
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
      visible: true, taskId: 7, outcome: "Failed: The AI provider did not answer in time", progress: "Failed: 2",
    });
    expect(wrapper.vm.queueLabel).toBe("Product texts · Started by a rule");

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

  it("names a run as it reads everywhere (runLabel): its template or worker, and what it covered", async () => {
    const wrapper = mountList();
    await flushPromises();
    const row = (raw) => ({ raw });

    expect(wrapper.vm.nameOf(row({ type: "pim.writer", params: { template: "meta" } }))).toBe("Meta descriptions");
    expect(wrapper.vm.nameOf(row({ type: "pim.writer", params: {} }))).toBe("Product texts");
    expect(wrapper.vm.scopeOf(row({ scope_spec: { refs: ["A", "B"] }, params: {} }))).toBe("2 products");
    expect(wrapper.vm.scopeOf(row({ scope_spec: {}, params: { brief: { topic: "Sofas" } } }))).toBe("Sofas");
  });

  it("a one-product run reads by its product: the name one of its proposals tells", async () => {
    const one = task({ id: 3, type: "pim.writer", scope_spec: { mode: "list", refs: ["ENT-1"] }, params: {} });
    mockGetTasks.mockResolvedValueOnce({ data: { results: [one], count: 1 } });
    const wrapper = mountList();
    await flushPromises();

    expect(mockGetProposals).toHaveBeenCalledWith({ task: 3, status: "all", page_size: 1 });
    expect(wrapper.vm.scopeOf(wrapper.vm.tasks[0])).toBe("Orion Sofa");
    wrapper.vm.openQueue(wrapper.vm.tasks[0]);
    expect(wrapper.vm.queueLabel).toBe("Product texts · Orion Sofa");
  });

  it("progress reads proposed and failed first; a count without words is left out, never shown by its key", async () => {
    const wrapper = mountList();
    await flushPromises();
    expect(wrapper.vm.formatCounts({ skipped: 2, failed: 1, proposed: 4 })).toBe("Proposed: 4, Failed: 1");
    expect(wrapper.vm.formatCounts({ skipped: 2 })).toBe("—");
    expect(wrapper.vm.formatCounts({})).toBe("—");
  });

  it("the picked run's chip names the run, never its number", async () => {
    mockGetTask.mockResolvedValue({ data: task({ id: 42, type: "pim.writer", status: "done", params: { template: "meta" } }) });
    const wrapper = mountList({}, { task: "42" });
    await flushPromises();
    const chip = wrapper.find("[data-testid='enrichment-task-single']");
    expect(chip.attributes("label")).toBe("Meta descriptions");
    expect(chip.attributes("label")).not.toContain("42");
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

  describe("Try again", () => {
    // The DataTable stub renders each row's actions cell, with IconButton as a plain button.
    const stubs = {
      DataTable: { props: ["rows"], template: "<div><div v-for='row in rows' :key='row.id'><slot name='cell-actions' :row='row' /></div></div>" },
      IconButton: { props: ["label", "disabled"], emits: ["click"], template: "<button :disabled='disabled' :title='label' @click=\"$emit('click')\" />" },
    };
    const failed = task({ id: 7, type: "pim.writer", status: "failed", counts: { failed: 2 } });
    const partly = task({ id: 8, status: "done", counts: { proposed: 1, failed: 1 }, proposal_counts: { pending: 1 } });
    const running = task({ id: 9, status: "in_progress" });
    const clean = task({ id: 10, status: "done", counts: { proposed: 2 }, proposal_counts: { pending: 2 } });
    const retryButton = (wrapper, id) => wrapper.find(`[data-testid='enrichment-task-retry-${id}']`);

    it("a failed run, or one done with failed products, has it in its row; a run going or without failures has none", async () => {
      mockGetTasks.mockResolvedValueOnce({ data: { results: [failed, partly, running, clean], count: 4 } });
      const wrapper = mountList({}, {}, stubs);
      await flushPromises();

      expect([7, 8, 9, 10].map((id) => retryButton(wrapper, id).exists())).toEqual([true, true, false, false]);
      expect(retryButton(wrapper, 7).attributes("title")).toBe("enrichment.ai.try_again");
    });

    it("retries the run once, then lists every run again with the new one on top", async () => {
      mockGetTasks
        .mockResolvedValueOnce({ data: { results: [failed], count: 1 } })
        .mockResolvedValueOnce({ data: { results: [task({ id: 11, status: "open", params: { retry_of: 7 } }), failed], count: 2 } });
      mockRetry.mockResolvedValue({ data: { id: 11, status: "open", lane: "queue" } });
      const replace = vi.fn();
      const wrapper = mountList({ replace }, { status: "failed" }, stubs);
      await flushPromises();

      await retryButton(wrapper, 7).trigger("click");
      await flushPromises();

      expect(mockRetry).toHaveBeenCalledTimes(1);
      expect(mockRetry).toHaveBeenCalledWith(7);
      expect(replace.mock.calls.at(-1)[0].query).toEqual({ status: "__all" });
      expect(mockGetTasks.mock.calls.at(-1)[0].status).toBeUndefined();
      expect(wrapper.vm.tasks.map((t) => t.id)).toEqual([11, 7]);
      expect(mockNotify).toHaveBeenCalledWith({ type: "positive", msg: "Queued — starts next." });
    });

    it("a second click while the request is out sends nothing, and the button is disabled meanwhile", async () => {
      let answer;
      mockRetry.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      mockGetTasks.mockResolvedValue({ data: { results: [failed], count: 1 } });
      const wrapper = mountList({}, {}, stubs);
      await flushPromises();

      await retryButton(wrapper, 7).trigger("click");
      expect(retryButton(wrapper, 7).attributes("disabled")).toBeDefined();
      wrapper.vm.retryTask(wrapper.vm.tasks[0]);
      expect(mockRetry).toHaveBeenCalledTimes(1);

      answer({ data: { id: 11, status: "open" } });
      await flushPromises();
      expect(mockRetry).toHaveBeenCalledTimes(1);
      expect(retryButton(wrapper, 7).attributes("disabled")).toBeUndefined();
    });

    it("a refusal toasts the API's message and leaves the list as it is", async () => {
      mockRetry.mockRejectedValue({ response: { status: 409, data: { error: "CONFLICT", message: "This task has nothing failed." } } });
      mockGetTasks.mockResolvedValue({ data: { results: [failed], count: 1 } });
      const wrapper = mountList({}, {}, stubs);
      await flushPromises();

      await retryButton(wrapper, 7).trigger("click");
      await flushPromises();

      expect(mockNotify).toHaveBeenCalledWith({ type: "negative", msg: "This task has nothing failed." });
      expect(mockGetTasks).toHaveBeenCalledTimes(1);
    });
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

    it("leaving while a refresh is on its way stops refreshing for good", async () => {
      mockGetTasks.mockResolvedValueOnce({ data: { results: [task({ status: "in_progress" })], count: 1 } });
      let answer;
      mockGetTasks.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
      const wrapper = mountList();
      await flushPromises();
      await vi.advanceTimersByTimeAsync(5000); // the refresh is on its way
      wrapper.unmount();
      answer({ data: { results: [task({ status: "in_progress" })], count: 1 } });
      await flushPromises();
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(20000);
      expect(mockGetTasks).toHaveBeenCalledTimes(2);
    });

    it("a refresh that lands after a newer filter does not undo it", async () => {
      mockGetTasks.mockResolvedValueOnce({ data: { results: [task({ status: "in_progress" })], count: 1 } });
      let lateRefresh;
      mockGetTasks.mockReturnValueOnce(new Promise((resolve) => (lateRefresh = resolve)));
      mockGetTasks.mockResolvedValueOnce({ data: { results: [task({ id: 9, status: "failed" })], count: 1 } });
      const wrapper = mountList();
      await flushPromises();
      await vi.advanceTimersByTimeAsync(5000); // the silent refresh of every run is on its way
      await wrapper.find("[data-testid='enrichment-task-status-failed']").trigger("click");
      await flushPromises();
      lateRefresh({ data: { results: [task({ status: "in_progress" }), task({ id: 2, status: "done" })], count: 2 } });
      await flushPromises();
      expect(wrapper.vm.tasks.map((t) => t.id)).toEqual([9]);
      expect(wrapper.vm.totalCount).toBe(1);
      expect(wrapper.vm.loading).toBe(false);
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
