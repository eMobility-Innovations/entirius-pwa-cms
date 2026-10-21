import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { ACCESS_STORE, ReadonlyArea, useReadonly } from "@/composables/useReadonly";

const mockAccept = vi.fn();
const mockReject = vi.fn();
const mockRetry = vi.fn();
const notify = vi.fn();
const ai = vi.hoisted(() => ({}));
vi.mock("@/api/enrichment/api", () => ({
  POST_AcceptProposal: (...a) => mockAccept(...a),
  POST_RejectProposal: (...a) => mockReject(...a),
  POST_RetryTask: (...a) => mockRetry(...a),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/views/Pim/components/enrichment/useProductAi", () => ({ useProductAi: () => ai }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "eu" }) }));
vi.mock("@/components/ConfigHealth/AiToolboxHint.vue", () => ({ default: { name: "AiToolboxHint", render: () => null } }));

import ProductAiResults from "@/views/Pim/components/enrichment/ProductAiResults.vue";

const proposal = (id, over = {}) => ({ id, task_id: 5, status: "pending", target_locator: { feature_idx: "meta_description" }, ...over });

const stubs = {
  SideDrawer: { name: "SideDrawer", props: ["visible", "title"], template: "<div v-if='visible'><slot /></div>" },
  ProposalPanel: { name: "ProposalPanel", props: ["proposal", "task", "product"], template: "<div />" },
  AiTaskList: {
    name: "AiTaskList",
    props: ["tasks", "workers", "templates", "selected", "retrying", "usable"],
    emits: ["select", "retry"],
    template: "<div />",
  },
  DriftModal: { name: "DriftModal", props: ["visible", "proposal"], template: "<div />" },
  IconButton: { name: "IconButton", props: ["icon", "label"], template: "<button :aria-label='label' />" },
  BasicButton: { props: ["disabled"], template: "<button :disabled='disabled'><slot /></button>" },
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
  ProfileGate: { name: "ProfileGate", props: ["channel"], template: "<div />" },
  BatchCorrection: { name: "BatchCorrection", props: ["taskId"], emits: ["queued"], template: "<div />" },
};

const TEMPLATES = [
  { key: "meta", label: "Meta descriptions", worker_key: "pim.writer", position: 10 },
  { key: "tags", label: "Tag the product", worker_key: "pim.tagger", position: 20 },
];

function mountResults({ proposals = [], tasks = [], running = false, usable = true, templates = TEMPLATES, allTemplates = TEMPLATES } = {}) {
  Object.assign(ai, {
    proposals: ref(proposals),
    tasks: ref(tasks),
    loading: ref(false),
    running: ref(running),
    refresh: vi.fn(),
    track: vi.fn(),
    syncTasks: vi.fn(),
  });
  return mount(ProductAiResults, {
    props: {
      sku: "ENT-1", product: { sku: "ENT-1" }, usable,
      workers: [{ key: "pim.meta_description", label: "Write meta description" }],
      templates,
      allTemplates,
    },
    global: { stubs },
  });
}

describe("ProductAiResults", () => {
  beforeEach(() => {
    mockAccept.mockReset();
    mockReject.mockReset();
    mockRetry.mockReset();
    notify.mockReset();
  });

  it("one Enricher icon: the pending count as a badge, a pulsing dot while a task runs", () => {
    const w = mountResults({ proposals: [proposal(1), proposal(2)], tasks: [{ id: 5, status: "in_progress" }], running: true });
    const trigger = w.findComponent({ name: "IconButton" });
    expect(trigger.props("icon")).toBe("enrich");
    expect(trigger.props("label")).toContain("enrichment.ai.trigger");
    expect(w.find("[data-testid='ai-results-count']").text()).toBe("2");
    expect(w.find("[data-testid='ai-results-running']").exists()).toBe(true);
  });

  it("a task waiting in the queue shows a still dot and says Queued, not the running pulse", () => {
    const w = mountResults({ tasks: [{ id: 5, status: "open", queued_ahead: 1 }], running: true });
    expect(w.find("[data-testid='ai-results-queued']").exists()).toBe(true);
    expect(w.find("[data-testid='ai-results-running']").exists()).toBe(false);
    expect(w.findComponent({ name: "IconButton" }).props("label")).toContain("enrichment.ai.outcome.queued");
  });

  it("a product with nothing waiting shows the bare icon; a failed latest run a warning dot", () => {
    const idle = mountResults();
    expect(idle.find("[data-testid='ai-results']").exists()).toBe(true);
    expect(idle.find("[data-testid='ai-results-count']").exists()).toBe(false);
    const failed = mountResults({ tasks: [{ id: 3, type: "pim.translate", status: "failed", errors: [] }] });
    expect(failed.find("[data-testid='ai-results-failed']").exists()).toBe(true);
  });

  it("Run AI lists the templates in order, then Custom…; a click closes the drawer and asks the page to run it", async () => {
    const w = mountResults();
    await w.find("[data-testid='ai-results']").trigger("click");
    const labels = w.findAll("[data-testid^='ai-template-'], [data-testid='ai-run-custom']").map((b) => b.text());
    expect(labels).toEqual(["Meta descriptions", "Tag the product", "enrichment.run.custom"]);
    await w.find("[data-testid='ai-template-tags']").trigger("click");
    expect(w.emitted("run")[0]).toEqual(["tags"]);
    expect(w.find("[data-testid='ai-results-drawer']").exists()).toBe(false);
  });

  it("Custom… asks for a run without a template", async () => {
    const w = mountResults({ templates: [] });
    await w.find("[data-testid='ai-results']").trigger("click");
    await w.find("[data-testid='ai-run-custom']").trigger("click");
    expect(w.emitted("run")[0]).toEqual([""]);
  });

  it("with the toolbox unusable the run buttons are disabled under the hint", async () => {
    const w = mountResults({ usable: false });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.find("[data-testid='ai-template-meta']").attributes("disabled")).toBeDefined();
    expect(w.find("[data-testid='ai-run-custom']").attributes("disabled")).toBeDefined();
    expect(w.findComponent({ name: "AiToolboxHint" }).exists()).toBe(true);
  });

  it("the drawer hands the tasks to the task list and each proposal, with its task and the product, to a card", async () => {
    const tasks = [{ id: 5, type: "pim.meta_description", status: "done" }];
    const w = mountResults({ proposals: [proposal(1)], tasks });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.findComponent({ name: "AiTaskList" }).props("tasks")).toEqual(tasks);
    expect(w.findComponent({ name: "ProposalPanel" }).props()).toMatchObject({
      proposal: proposal(1), task: tasks[0], product: { sku: "ENT-1" },
    });
  });

  it("picking a task shows only its proposals, with a way back", async () => {
    const w = mountResults({ proposals: [proposal(1), proposal(2, { task_id: 6 })], tasks: [{ id: 6, type: "pim.meta_description" }] });
    await w.find("[data-testid='ai-results']").trigger("click");
    w.findComponent({ name: "AiTaskList" }).vm.$emit("select", 6);
    await flushPromises();
    expect(w.findAllComponents({ name: "ProposalPanel" }).map((c) => c.props("proposal").id)).toEqual([2]);
    expect(w.find("[data-testid='ai-results-filter']").text()).toContain("Write meta description");
  });

  it("a task is named from every template, also one this Run AI menu does not offer", async () => {
    const outline = { key: "outline", label: "Article outline", worker_key: "article.outline", position: 30 };
    const allTemplates = [...TEMPLATES, outline];
    const tasks = [{ id: 6, type: "article.outline", params: { template: "outline" } }];
    const w = mountResults({ proposals: [proposal(2, { task_id: 6 })], tasks, allTemplates });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.findComponent({ name: "AiTaskList" }).props("templates")).toEqual(allTemplates);
    w.findComponent({ name: "AiTaskList" }).vm.$emit("select", 6);
    await flushPromises();
    expect(w.find("[data-testid='ai-results-filter']").text()).toContain("Article outline");
  });

  it("Apply all applies each shown proposal and leaves a drifted one for its re-confirm", async () => {
    mockAccept
      .mockResolvedValueOnce({ data: proposal(1, { status: "applied" }) })
      .mockResolvedValueOnce({ data: proposal(2, { status: "drifted" }) });
    const w = mountResults({ proposals: [proposal(1), proposal(2)] });
    await w.find("[data-testid='ai-results']").trigger("click");
    await w.find("[data-testid='ai-results-apply-all']").trigger("click");
    await flushPromises();

    expect(mockAccept.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(ai.proposals.value.map((p) => [p.id, p.status])).toEqual([[2, "drifted"]]);
    expect(w.emitted("applied")).toHaveLength(1);
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ type: "warning" }));
  });

  it("accept drops the proposal and emits it as applied", async () => {
    const applied = proposal(1, { status: "applied" });
    mockAccept.mockResolvedValue({ data: applied });
    const w = mountResults({ proposals: [proposal(1), proposal(2)] });
    await w.vm.accept(proposal(1));

    expect(mockAccept).toHaveBeenCalledWith(1);
    expect(ai.proposals.value.map((p) => p.id)).toEqual([2]);
    expect(w.emitted("applied")[0][0]).toEqual(applied);
    expect(ai.syncTasks).toHaveBeenCalled(); // the task rows recount what is left to review
  });

  it("a drifted accept opens the drift modal; confirming writes through", async () => {
    const drifted = proposal(1, { status: "drifted" });
    mockAccept.mockResolvedValueOnce({ data: drifted }).mockResolvedValueOnce({ data: proposal(1, { status: "applied" }) });
    const w = mountResults({ proposals: [proposal(1)] });
    await w.vm.accept(proposal(1));
    await flushPromises();
    expect(w.findComponent({ name: "DriftModal" }).props("proposal")).toEqual(drifted);
    expect(w.emitted("applied")).toBeUndefined();

    await w.vm.confirmDrift(drifted);
    expect(w.vm.drifted).toBeNull();
    expect(w.emitted("applied")).toHaveLength(1);
  });

  it("reject drops the proposal; a failed action is toasted and keeps it", async () => {
    mockReject.mockResolvedValueOnce({}).mockRejectedValueOnce({ detail: "boom" });
    const w = mountResults({ proposals: [proposal(1), proposal(2)] });
    await w.vm.reject({ proposal: proposal(1), reason: "" });
    expect(ai.proposals.value.map((p) => p.id)).toEqual([2]);

    await w.vm.reject({ proposal: proposal(2), reason: "off" });
    expect(mockReject).toHaveBeenLastCalledWith(2, { reason: "off" });
    expect(ai.proposals.value.map((p) => p.id)).toEqual([2]);
    expect(notify).toHaveBeenLastCalledWith(expect.objectContaining({ type: "negative" }));
  });

  it("a run the page just started (track) is watched and the drawer opens on it", async () => {
    const w = mountResults({ proposals: [proposal(1), proposal(2, { task_id: 9 })], tasks: [{ id: 9, status: "in_progress" }], running: true });
    w.vm.track({ id: 9 });
    await flushPromises();

    expect(ai.track).toHaveBeenCalledWith({ id: 9 });
    expect(w.find("[data-testid='ai-results-drawer']").exists()).toBe(true);
    expect(w.findComponent({ name: "AiTaskList" }).props("selected")).toBe(9);
    expect(w.findAllComponents({ name: "ProposalPanel" }).map((c) => c.props("proposal").id)).toEqual([2]);
  });

  it("a picked task offers Correct all for its pending proposals", async () => {
    const w = mountResults({ proposals: [proposal(1, { task_id: 6 }), proposal(2, { task_id: 6 }), proposal(3)], tasks: [{ id: 6 }] });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.findComponent({ name: "BatchCorrection" }).exists()).toBe(false);
    w.findComponent({ name: "AiTaskList" }).vm.$emit("select", 6);
    await w.vm.$nextTick();
    const batch = w.findComponent({ name: "BatchCorrection" });
    expect(batch.props()).toEqual({ taskId: 6 });
    batch.vm.$emit("queued", 2);
    expect(ai.refresh).toHaveBeenCalled();
  });

  it("the drawer links onwards: the templates, the review queue and the channel's profile warning", async () => {
    const w = mountResults({ proposals: [proposal(1)] });
    await w.find("[data-testid='ai-results']").trigger("click");
    expect(w.find("[data-testid='ai-results-templates']").exists()).toBe(true);
    expect(w.find("[data-testid='ai-results-review']").exists()).toBe(true);
    expect(w.findComponent({ name: "ProfileGate" }).props("channel")).toBe("eu");
  });

  describe("Try again on a failed task", () => {
    const failed = { id: 5, type: "pim.meta_description", status: "failed", errors: [{ code: "UPSTREAM_TIMEOUT" }] };
    const retried = { id: 12, type: "pim.meta_description", status: "open", lane: "queue", queued_ahead: 0, params: { retry_of: 5 } };
    const openList = async (opts = {}) => {
      const w = mountResults({ tasks: [failed], ...opts });
      await w.find("[data-testid='ai-results']").trigger("click");
      return { w, list: w.findComponent({ name: "AiTaskList" }) };
    };

    it("retries the task once and watches the new one like a run started from a template; the drawer shows it", async () => {
      mockRetry.mockResolvedValue({ data: retried });
      const { w, list } = await openList();
      list.vm.$emit("retry", failed);
      await flushPromises();

      expect(mockRetry).toHaveBeenCalledTimes(1);
      expect(mockRetry).toHaveBeenCalledWith(5);
      expect(ai.track).toHaveBeenCalledTimes(1);
      expect(ai.track).toHaveBeenCalledWith(retried);
      expect(list.props("selected")).toBe(12);
      expect(w.find("[data-testid='ai-results-drawer']").exists()).toBe(true);
      expect(notify).toHaveBeenCalledWith({ type: "positive", msg: "Queued — starts next." });
      expect(list.props("retrying")).toEqual([]);
    });

    it("a second click while the request is out sends nothing; the list is told which task is on its way", async () => {
      let answer;
      mockRetry.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      const { list } = await openList();
      list.vm.$emit("retry", failed);
      list.vm.$emit("retry", failed);
      await flushPromises();
      expect(list.props("retrying")).toEqual([5]);
      expect(mockRetry).toHaveBeenCalledTimes(1);

      answer({ data: retried });
      await flushPromises();
      expect(mockRetry).toHaveBeenCalledTimes(1);
      expect(ai.track).toHaveBeenCalledTimes(1);
      expect(list.props("retrying")).toEqual([]);
    });

    it("a refusal toasts the API's message and tracks nothing", async () => {
      mockRetry.mockRejectedValue({ response: { status: 409, data: { error: "CONFLICT", message: "This task has nothing failed." } } });
      const { list } = await openList();
      list.vm.$emit("retry", failed);
      await flushPromises();

      expect(notify).toHaveBeenCalledWith({ type: "negative", msg: "This task has nothing failed." });
      expect(ai.track).not.toHaveBeenCalled();
      expect(list.props("selected")).toBeNull();
      expect(list.props("retrying")).toEqual([]);
    });

    it("the list is told whether the AI toolbox can take a run", async () => {
      expect((await openList()).list.props("usable")).toBe(true);
      expect((await openList({ usable: false })).list.props("usable")).toBe(false);
    });
  });

  describe("enrichment access", () => {
    // The page wraps the AI in <ReadonlyArea area="enrichment.proposals">: Run and Apply follow that area alone.
    // A `mutates` button hides on a read-only region, as BasicButton does (readonly.spec).
    const ReadonlyAwareButton = defineComponent({
      props: { disabled: Boolean, mutates: Boolean },
      setup: () => ({ readonly: useReadonly() }),
      template: "<button v-if='!(mutates && readonly)' :disabled='disabled'><slot /></button>",
    });
    function mountInArea(level, tasks = []) {
      Object.assign(ai, {
        proposals: ref([proposal(1), proposal(2)]), tasks: ref(tasks), loading: ref(false), running: ref(false),
        refresh: vi.fn(), track: vi.fn(), syncTasks: vi.fn(),
      });
      const access = { available: true, can: (_area, wanted) => level === "write" || wanted === "read" };
      const props = { sku: "ENT-1", product: { sku: "ENT-1" }, usable: true, workers: [{ key: "pim.writer" }], templates: TEMPLATES };
      return mount(ReadonlyArea, {
        props: { area: "enrichment.proposals" },
        slots: { default: () => h(ProductAiResults, props) },
        global: { stubs: { ...stubs, AiTaskList: false, BasicButton: ReadonlyAwareButton }, provide: { [ACCESS_STORE]: access } },
      });
    }

    it("read-only: the drawer shows the proposals but no Run, Custom or Apply all", async () => {
      const w = mountInArea("read");
      await w.find("[data-testid='ai-results']").trigger("click");
      expect(w.find("[data-testid='ai-results-drawer']").exists()).toBe(true);
      expect(w.find("[data-testid^='ai-template-']").exists()).toBe(false);
      expect(w.find("[data-testid='ai-run-custom']").exists()).toBe(false);
      expect(w.find("[data-testid='ai-results-apply-all']").exists()).toBe(false);
    });

    it("write: Run, Custom and Apply all are offered", async () => {
      const w = mountInArea("write");
      await w.find("[data-testid='ai-results']").trigger("click");
      expect(w.find("[data-testid='ai-template-meta']").exists()).toBe(true);
      expect(w.find("[data-testid='ai-run-custom']").exists()).toBe(true);
      expect(w.find("[data-testid='ai-results-apply-all']").exists()).toBe(true);
    });

    describe("Try again", () => {
      const failed = { id: 5, type: "pim.writer", status: "failed", created_at: new Date().toISOString(), counts: {}, errors: [] };

      it("read-only: a failed task shows in the list but offers no Try again", async () => {
        const w = mountInArea("read", [failed]);
        await w.find("[data-testid='ai-results']").trigger("click");
        expect(w.find("[data-testid='ai-task-5']").exists()).toBe(true);
        expect(w.find("[data-testid='ai-task-retry-5']").exists()).toBe(false);
      });

      it("write: Try again retries the failed task through the whole chain, row to API to the watched new task", async () => {
        mockRetry.mockResolvedValue({ data: { id: 12, status: "open" } });
        const w = mountInArea("write", [failed]);
        await w.find("[data-testid='ai-results']").trigger("click");
        await w.find("[data-testid='ai-task-retry-5']").trigger("click");
        await flushPromises();
        expect(mockRetry).toHaveBeenCalledWith(5);
        expect(ai.track).toHaveBeenCalledWith({ id: 12, status: "open" });
      });
    });
  });
});
