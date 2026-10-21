import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockSpawn = vi.fn();
const mockSaveTemplate = vi.fn();
const mockListTemplates = vi.fn();
const notify = vi.fn();
const catalog = vi.hoisted(() => ({ fields: [], languages: [] }));
// `gate.wait`: a promise the catalog read waits for (a slow first read of the channel's catalog).
const gate = vi.hoisted(() => ({ wait: null }));
vi.mock("@/api/enrichment/api", () => ({
  POST_SpawnTask: (...a) => mockSpawn(...a),
  POST_Template: (...a) => mockSaveTemplate(...a),
  GET_Templates: (...a) => mockListTemplates(...a),
}));
vi.mock("@/views/EnrichmentReview/fieldCatalog", async (importOriginal) => ({
  ...(await importOriginal()),
  loadCatalog: async () => {
    await gate.wait;
    return { ...catalog };
  },
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    activeChannelIdx: "default-europe",
    activeChannel: { idx: "default-europe", default_language: "pl" },
    activeChannelLanguages: ["pl", "en", "de"],
  }),
}));
const health = vi.hoisted(() => ({ aiUsable: true }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => health }));
vi.mock("@/components/ConfigHealth/AiToolboxHint.vue", () => ({ default: { name: "AiToolboxHint", render: () => null } }));

import RunAiTaskDialog from "@/views/Pim/components/enrichment/RunAiTaskDialog.vue";
import AiParamsForm from "@/views/Pim/components/enrichment/AiParamsForm.vue";

const WORKERS = [
  {
    key: "pim.translate",
    label: "Translate",
    params_schema: {
      properties: {
        channel: { type: "string" },
        source_language: { type: "string", title: "Source Language" },
        target_languages: { type: "array", items: { type: "string" } },
        prompt: { type: "string", default: "" },
      },
      required: ["channel", "source_language", "target_languages"],
    },
  },
  {
    key: "pim.writer",
    label: "Writer",
    kind: "write",
    params_schema: {
      properties: {
        channel: { type: "string" },
        fields: { type: "array", items: { type: "string" } },
        languages: { type: "array", items: { type: "string" } },
        prompt: { type: "string", default: "" },
        rules: { type: "array", items: { type: "string" } },
      },
      required: ["channel", "fields", "languages"],
    },
  },
  {
    key: "pim.description",
    label: "Description",
    params_schema: {
      properties: { channel: { type: "string" }, languages: { type: "array", items: { type: "string" } } },
      required: ["channel", "languages"],
    },
  },
];

const VIDEO = {
  key: "pim.social_video",
  label: "Social video",
  kind: "video",
  params_schema: {
    properties: { channel: { type: "string" }, prompt: { type: "string", default: "" }, picture_ref: { type: "string", default: "" } },
    required: ["channel"],
  },
};

const IMAGE = {
  key: "pim.image",
  label: "Image processing",
  kind: "image",
  params_schema: {
    properties: {
      channel: { type: "string" },
      operation: { type: "string", enum: ["packshot", "lifestyle", "enhance", "instruct"] },
      preset: { type: "string", default: "" },
      prompt: { type: "string", default: "" },
      picture_ref: { type: "string", default: "" },
      n: { type: "integer", default: 1, minimum: 1, maximum: 4 },
    },
    required: ["channel", "operation"],
  },
};

const IMAGE_TEMPLATE = {
  key: "image-packshot", label: "Packshot", worker_key: "pim.image", kind: "image", position: 40, active: true,
  params: { operation: "packshot", preset: "packshot-white" }, rules: [],
};

const TEMPLATES = [
  {
    key: "meta", label: "Meta descriptions", worker_key: "pim.writer", kind: "write", position: 10, active: true,
    params: { fields: ["meta_title", "meta_description"], languages: ["*"], augment: ["seo_brief"], seo_scope: "subject" },
    rules: ["Brand first."],
  },
];

const CATALOG_FIELDS = [
  { key: "meta_title", label: "Meta title", type: "text" },
  { key: "meta_description", label: "Meta description", type: "text" },
  { key: "description", label: "Description", type: "html" },
  { key: "badge", label: "Badge", type: "multiselect", options: [{ value: "new", label: "New" }] },
];

const stubs = {
  BasicModal: { name: "BasicModal", props: ["open", "actions"], template: "<div><slot /></div>" },
  BasicSelect: true,
  BasicTextarea: true,
  BasicCheckbox: true,
  BasicRadioGroup: true,
  FormField: { template: "<div><slot /></div>" },
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
  TaskTargetPicker: { name: "TaskTargetPicker", props: ["modelValue"], template: "<div />" },
  PicturePicker: { name: "PicturePicker", props: ["modelValue", "module", "channel", "subjectRef", "label", "preferred"], template: "<div />" },
  QaCheckToggle: { name: "QaCheckToggle", props: ["modelValue", "disabled"], template: "<div data-testid='qa-check-toggle' />" },
};

async function openDialog(props = {}) {
  const w = mount(RunAiTaskDialog, {
    props: { open: false, workers: WORKERS, initialWorker: "pim.translate", skus: ["A", "B"], ...props },
    global: { stubs },
  });
  await w.setProps({ open: true });
  await flushPromises();
  return w;
}

const form = (w) => w.findComponent(AiParamsForm);

describe("RunAiTaskDialog", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockSaveTemplate.mockReset();
    notify.mockReset();
    health.aiUsable = true;
    Object.assign(catalog, { fields: [], languages: [] });
    gate.wait = null;
  });

  describe("guidelines check", () => {
    it("a text task offers the per-run check; untouched it leaves the Settings default", async () => {
      const w = await openDialog({ initialWorker: "pim.writer" });
      expect(w.find("[data-testid='qa-check-toggle']").exists()).toBe(true);
      expect(w.vm.params).not.toHaveProperty("qa_check");
    });

    it("the run's own choice rides in the task params", async () => {
      const w = await openDialog({ initialWorker: "pim.writer" });
      w.findComponent({ name: "QaCheckToggle" }).vm.$emit("update:modelValue", false);
      expect(w.vm.params.qa_check).toBe(false);
    });

    it("a task that writes no text has no check", async () => {
      const w = await openDialog({ initialWorker: "pim.translate" });
      expect(w.find("[data-testid='qa-check-toggle']").exists()).toBe(false);
      expect(w.vm.params).not.toHaveProperty("qa_check");
    });
  });

  it("the form waits for the channel's catalog: nothing can be picked, then reset, before it is in", async () => {
    let release;
    gate.wait = new Promise((resolve) => (release = resolve));
    Object.assign(catalog, { languages: ["en", "pl"] });
    const w = await openDialog({ initialWorker: "pim.description" });
    expect(w.find("[data-testid='ai-task-loading']").exists()).toBe(true);
    expect(form(w).exists()).toBe(false);
    expect(w.vm.actions.find((a) => a.key === "queue").disabled).toBe(true);
    release();
    await flushPromises();
    expect(w.find("[data-testid='ai-task-loading']").exists()).toBe(false);
    expect(form(w).props("modelValue").languages).toEqual(["en", "pl"]);
    expect(w.vm.actions.find((a) => a.key === "queue").disabled).toBe(false);
  });

  it("a double tap on Run now sends one run", async () => {
    let answer;
    mockSpawn.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const ModalWithActions = {
      name: "BasicModal",
      props: ["open", "actions"],
      template: "<div><slot /><button v-for='a in actions' :key='a.key' :data-testid='a.testid' :disabled='a.disabled || a.loading' @click='a.onClick'>{{ a.label }}</button></div>",
    };
    const w = mount(RunAiTaskDialog, {
      props: { open: false, workers: WORKERS, initialWorker: "pim.description", skus: ["A"], background: true },
      global: { stubs: { ...stubs, BasicModal: ModalWithActions } },
    });
    await w.setProps({ open: true });
    await flushPromises();
    await w.find("[data-testid='ai-task-run-now']").trigger("click");
    await w.find("[data-testid='ai-task-run-now']").trigger("click");
    answer({ data: { id: 1, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
    await flushPromises();
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("generates the form from the picked worker with channel defaults", async () => {
    const w = await openDialog();
    expect(w.vm.fields.map((f) => f.name)).toEqual(["source_language", "target_languages", "prompt"]);
    expect(w.vm.values).toEqual({ source_language: "pl", target_languages: ["en", "de"], prompt: "" });
  });

  it("a custom run without a preset worker picks none: Run waits for the operator's choice", async () => {
    const w = await openDialog({ initialWorker: "" });
    expect(w.vm.workerKey).toBe("");
    expect(w.vm.actions.filter((a) => ["now", "queue"].includes(a.key)).every((a) => a.disabled)).toBe(true);
    const single = await openDialog({ initialWorker: "", workers: WORKERS.slice(0, 1) });
    expect(single.vm.workerKey).toBe(WORKERS[0].key);
  });

  it("switching the worker rebuilds the form", async () => {
    const w = await openDialog();
    w.vm.workerKey = "pim.description";
    await flushPromises();
    expect(w.vm.values).toEqual({ languages: ["pl", "en", "de"] });
  });

  it("a new source language drops out of the targets", async () => {
    const w = await openDialog();
    form(w).findComponent("[data-testid='ai-task-param-source_language']").vm.$emit("update:modelValue", "en");
    expect(w.vm.values.target_languages).toEqual(["de"]);
  });

  it("runs one task over the SKUs and shows one link: the run on Runs, where its proposals show once it is done", async () => {
    mockSpawn.mockResolvedValue({ data: { id: 42, status: "open" } });
    const w = await openDialog();
    w.findComponent("[data-testid='ai-task-param-prompt']").vm.$emit("update:modelValue", "Formal tone");
    await w.vm.run();
    await flushPromises();

    expect(mockSpawn).toHaveBeenCalledWith({
      type: "pim.translate",
      params: { source_language: "pl", target_languages: ["en", "de"], prompt: "Formal tone", channel: "default-europe" },
      scope_spec: { mode: "list", module: "pim", channel: "default-europe", refs: ["A", "B"] },
      lane: "queue",
    });
    expect(w.emitted("created")[0][0].id).toBe(42);
    const links = w.findAllComponents({ name: "RouterLink" });
    expect(links.map((link) => link.props("to"))).toEqual([{ name: "EnrichmentRuns", query: { task: "42" } }]);
  });

  it("in the background mode it closes at once with a toast instead of the task link", async () => {
    mockSpawn.mockResolvedValue({ data: { id: 43, status: "open" } });
    const w = await openDialog({ background: true });
    await w.vm.run();
    await flushPromises();

    expect(w.emitted("created")[0][0].id).toBe(43);
    expect(w.emitted("close")).toHaveLength(1);
    expect(w.vm.createdTask).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "positive" }));
  });

  it("cannot run while the AI toolbox is unusable or a required field is empty", async () => {
    const w = await openDialog();
    w.vm.values = { ...w.vm.values, target_languages: [] };
    expect(w.vm.canRun).toBe(false);
    w.vm.values = { ...w.vm.values, target_languages: ["en"] };
    expect(w.vm.canRun).toBe(true);
    health.aiUsable = false;
    const blocked = await openDialog();
    expect(blocked.vm.canRun).toBe(false);
  });

  it("a 400 keeps the dialog open; another error closes it", async () => {
    mockSpawn.mockRejectedValueOnce(Object.defineProperty({ detail: "bad" }, "httpStatus", { value: 400 }));
    const w = await openDialog();
    await w.vm.run();
    expect(w.emitted("close")).toBeUndefined();
    mockSpawn.mockRejectedValueOnce({ detail: "boom" });
    await w.vm.run();
    expect(w.emitted("close")).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("a template presets its worker, fields, languages and research; the run names it", async () => {
    Object.assign(catalog, { fields: CATALOG_FIELDS, languages: ["pl", "en"] });
    mockSpawn.mockResolvedValue({ data: { id: 7 } });
    const w = await openDialog({ templates: TEMPLATES, initialTemplate: "meta", initialWorker: "" });

    expect(w.find("[data-testid='ai-task-worker']").exists()).toBe(false);
    expect(w.vm.values).toEqual({ fields: ["meta_title", "meta_description"], languages: ["*"], prompt: "" });
    expect(w.vm.research).toEqual({ augment: ["seo_brief"], seo_scope: "subject" });
    // A writer picks among the text fields only.
    expect(w.vm.fieldChoices.map((o) => o.value)).toEqual(["meta_title", "meta_description", "description"]);

    await w.vm.run();
    expect(mockSpawn).toHaveBeenCalledWith({
      type: "pim.writer",
      template: "meta",
      params: {
        fields: ["meta_title", "meta_description"], languages: ["*"], prompt: "",
        augment: ["seo_brief"], seo_scope: "subject", channel: "default-europe",
      },
      scope_spec: { mode: "list", module: "pim", channel: "default-europe", refs: ["A", "B"] },
      lane: "queue",
    });
  });

  it("Custom… asks for the worker; a writer starts on All languages with no field picked", async () => {
    Object.assign(catalog, { fields: CATALOG_FIELDS, languages: ["pl", "en"] });
    const w = await openDialog({ templates: TEMPLATES, initialTemplate: "", initialWorker: "pim.writer" });
    expect(w.find("[data-testid='ai-task-worker']").exists()).toBe(true);
    expect(w.vm.templateOptions.map((o) => o.value)).toEqual(["meta", ""]);
    expect(w.vm.values).toEqual({ fields: [], languages: ["*"], prompt: "" });
    expect(w.vm.canRun).toBe(false);
    form(w).vm.$emit("update:modelValue", { ...w.vm.values, fields: ["description"] });
    expect(w.vm.canRun).toBe(true);
    // Unticked research is sent as such, so a run can switch a template's preset off.
    expect(w.vm.params.augment).toEqual([]);
  });

  it("research shows only for kinds that take it", async () => {
    const translate = await openDialog();
    expect(translate.vm.researchKeys).toEqual([]);
    expect(translate.vm.params.augment).toBeUndefined();
    const writer = await openDialog({ initialWorker: "pim.writer" });
    expect(writer.vm.researchKeys).toEqual(["seo_brief"]);
  });

  it("Save as template keeps the run (no channel) and its template's rules under a key unique among all templates", async () => {
    mockSaveTemplate.mockResolvedValue({ data: { key: "my-meta-2" } });
    // A hidden template (not offered in the dialog) already holds the key the name makes.
    mockListTemplates.mockResolvedValue({ data: [...TEMPLATES, { key: "my-meta", position: 30, active: false }] });
    const w = await openDialog({ templates: TEMPLATES, initialTemplate: "meta", initialWorker: "" });
    w.vm.startSaving();
    w.vm.templateLabel = "My meta";
    await w.vm.saveTemplate();

    expect(mockListTemplates).toHaveBeenCalledWith();
    expect(mockSaveTemplate).toHaveBeenCalledWith({
      key: "my-meta-2",
      label: "My meta",
      worker_key: "pim.writer",
      params: { fields: ["meta_title", "meta_description"], languages: ["*"], prompt: "", augment: ["seo_brief"], seo_scope: "subject" },
      rules: ["Brand first."],
      position: 40,
      active: true,
    });
    expect(w.emitted("template-saved")[0][0]).toEqual({ key: "my-meta-2" });
    expect(w.vm.saving).toBe(false);
  });

  describe("lanes", () => {
    const action = (w, key) => w.vm.actions.find((a) => a.key === key);
    const conflict = (message) => Object.defineProperty({ error: "ALREADY_RUNNING", message }, "httpStatus", { value: 409 });

    it("one product: Run now is the primary, Add to queue beside it", async () => {
      const w = await openDialog({ skus: ["A"] });
      expect(action(w, "now")).toMatchObject({ role: "primary", testid: "ai-task-run-now", disabled: false });
      expect(action(w, "queue")).toMatchObject({ role: "secondary", testid: "ai-task-add-to-queue" });
      expect(w.find("[data-testid='ai-task-now-cap']").exists()).toBe(false);
    });

    it("a phone shows only the scope's primary action", async () => {
      const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: vi.fn() });
      try {
        const one = await openDialog({ skus: ["A"] });
        expect(action(one, "queue")).toBeUndefined();
        expect(action(one, "now").role).toBe("primary");
        const many = await openDialog({ skus: ["A", "B"] });
        expect(action(many, "now")).toBeUndefined();
        expect(action(many, "queue").role).toBe("primary");
      } finally {
        matchMedia.mockRestore();
      }
    });

    it("a selection: Add to queue is the primary", async () => {
      const w = await openDialog({ skus: ["A", "B", "C"] });
      expect(action(w, "queue").role).toBe("primary");
      expect(action(w, "now").role).toBe("secondary");
    });

    it("over 20 products Run now is off and the cap is said inline", async () => {
      const skus = Array.from({ length: 21 }, (_, i) => `S${i}`);
      const w = await openDialog({ skus });
      expect(action(w, "now").disabled).toBe(true);
      expect(action(w, "queue").disabled).toBe(false);
      expect(w.find("[data-testid='ai-task-now-cap']").text()).toContain("enrichment.ai.lane.now_cap");
    });

    it("each action sends its lane", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 1, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await openDialog({ skus: ["A", "B"], background: true });
      await action(w, "now").onClick();
      expect(mockSpawn.mock.calls[0][0].lane).toBe("now");
      await w.setProps({ open: false });
      await w.setProps({ open: true });
      await flushPromises();
      await action(w, "queue").onClick();
      expect(mockSpawn.mock.calls[1][0].lane).toBe("queue");
    });

    it("the toast says the run is queued and how many products were skipped", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 2, lane: "queue", queued_ahead: 2, skipped_in_flight: ["B"] } });
      const w = await openDialog({ background: true });
      await w.vm.run("queue");
      expect(notify).toHaveBeenCalledWith({
        type: "informative", msg: "Queued — 2 runs ahead. 1 product skipped, already running.",
      });
    });

    it("the same run already going (409) is a calm note with the server's words, not a failure", async () => {
      mockSpawn.mockRejectedValue(conflict("This run is already in progress for this item. Wait for it to finish."));
      const w = await openDialog({ skus: ["A"] });
      await w.vm.run("now");
      expect(notify).toHaveBeenCalledWith({
        type: "informative", msg: "This run is already in progress for this item. Wait for it to finish.",
      });
      expect(w.emitted("close")).toHaveLength(1);
    });

    it("the cap refusal (400) shows the server's description and keeps the dialog open", async () => {
      const description = "Run now takes at most 20 items at a time. Add this run to the queue instead.";
      const refusal = { error: "VALIDATION_ERROR", message: "Request validation failed.", details: [{ field: null, description }] };
      mockSpawn.mockRejectedValue(Object.defineProperty(refusal, "httpStatus", { value: 400 }));
      const w = await openDialog({ skus: ["A"] });
      await w.vm.run("now");
      expect(notify).toHaveBeenCalledWith({ type: "negative", msg: description });
      expect(w.emitted("close")).toBeUndefined();
    });
  });
  describe("Studio: products picked in the dialog", () => {
    const action = (w, key) => w.vm.actions.find((a) => a.key === key);
    const pick = async (w, target) => {
      w.findComponent({ name: "TaskTargetPicker" }).vm.$emit("update:modelValue", { skus: [], filters: null, count: 0, pending: false, ...target });
      await flushPromises();
    };
    const studio = () => openDialog({ skus: [], pickTargets: true, initialWorker: "pim.description" });
    it("nothing picked or still checking: nothing runs", async () => {
      const w = await studio();
      expect(action(w, "queue").disabled).toBe(true);
      await pick(w, { skus: ["A"], count: 1, pending: true });
      expect(action(w, "now").disabled).toBe(true);
    });

    it("the recognised SKUs run as a list; one product runs now", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 5, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await studio();
      await pick(w, { skus: ["A"], count: 1 });
      expect(action(w, "now")).toMatchObject({ role: "primary", disabled: false });
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0]).toMatchObject({
        lane: "now", scope_spec: { mode: "list", module: "pim", channel: "default-europe", refs: ["A"] },
      });
    });

    it("over 20 recognised SKUs: Add to queue only", async () => {
      const w = await studio();
      const skus = Array.from({ length: 21 }, (_, i) => `S${i}`);
      await pick(w, { skus, count: 21 });
      expect(action(w, "queue").role).toBe("primary");
      expect(action(w, "now").disabled).toBe(true);
    });

    it("a big category is a filter scope, queued", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 6, lane: "queue", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await studio();
      await pick(w, { filters: { category_idx: "sofas" }, count: 120 });
      expect(action(w, "queue")).toMatchObject({ role: "primary", disabled: false });
      expect(action(w, "now").disabled).toBe(true);
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0]).toMatchObject({
        lane: "queue",
        scope_spec: { mode: "filter", module: "pim", channel: "default-europe", filters: { category_idx: "sofas" } },
      });
      expect(mockSpawn.mock.calls[0][0].scope_spec.refs).toBeUndefined();
    });

    it("a reopened dialog forgets the products picked before", async () => {
      const w = await studio();
      await pick(w, { skus: ["A"], count: 1 });
      await w.setProps({ open: false });
      await w.setProps({ open: true });
      await flushPromises();
      expect(w.vm.runCount).toBe(0);
    });
  });

  describe("video: which picture it animates", () => {
    const video = (props = {}) => openDialog({ workers: [...WORKERS, VIDEO], initialWorker: VIDEO.key, ...props });
    const picker = (w) => w.findComponent({ name: "PicturePicker" });
    const runAction = (w) => w.vm.actions.find((a) => a.key === "now");

    it("one product: a required picture choice that rides in the run, never in the form", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 7, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await video({ skus: ["A"] });
      expect(picker(w).props()).toMatchObject({ subjectRef: "A", channel: "default-europe", label: "enrichment.ai.picture.video_label" });
      expect(w.vm.fields.map((f) => f.name)).toEqual(["prompt"]);
      expect(runAction(w).disabled).toBe(true);
      picker(w).vm.$emit("update:modelValue", "12");
      await flushPromises();
      expect(runAction(w).disabled).toBe(false);
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0].params).toEqual({ prompt: "", channel: "default-europe", picture_ref: "12" });
      expect(w.vm.params).not.toHaveProperty("picture_ref");
    });

    it("several products: no choice, a note that each uses its main picture", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 8, lane: "queue", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await video({ skus: ["A", "B"] });
      expect(picker(w).exists()).toBe(false);
      expect(w.find("[data-testid='ai-task-main-pictures']").text()).toBe("enrichment.ai.picture.several_video");
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0].params).not.toHaveProperty("picture_ref");
    });

    it("other workers ask for no picture", async () => {
      const w = await openDialog({ skus: ["A"] });
      expect(picker(w).exists()).toBe(false);
      expect(w.find("[data-testid='ai-task-main-pictures']").exists()).toBe(false);
    });

    it("Studio: one picked product asks for its picture", async () => {
      const w = await video({ skus: [], pickTargets: true });
      expect(picker(w).exists()).toBe(false);
      w.findComponent({ name: "TaskTargetPicker" }).vm.$emit("update:modelValue", { skus: ["S1"], filters: null, count: 1, pending: false });
      await flushPromises();
      expect(picker(w).props("subjectRef")).toBe("S1");
    });
  });

  describe("image: which picture, what to do, how many variants", () => {
    const image = (props = {}) => openDialog({ workers: [...WORKERS, IMAGE], initialWorker: IMAGE.key, ...props });
    const picker = (w) => w.findComponent({ name: "PicturePicker" });
    const runAction = (w) => w.vm.actions.find((a) => a.key === "now");

    it("one product: the picture to process, the operation and the variants; the preset stays out of the form", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 9, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await image({ skus: ["A"] });
      expect(picker(w).props("label")).toBe("enrichment.ai.picture.image_label");
      expect(w.vm.fields.map((f) => [f.name, f.kind])).toEqual([["operation", "enum"], ["prompt", "prompt"], ["n", "count"]]);
      picker(w).vm.$emit("update:modelValue", "5");
      form(w).vm.$emit("update:modelValue", { ...w.vm.values, n: 3 });
      await flushPromises();
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0].params).toEqual({
        operation: "packshot", prompt: "", n: 3, channel: "default-europe", picture_ref: "5",
      });
    });

    it("a custom instruction waits for its instruction", async () => {
      const w = await image({ skus: ["A"] });
      picker(w).vm.$emit("update:modelValue", "5");
      form(w).vm.$emit("update:modelValue", { ...w.vm.values, operation: "instruct" });
      await flushPromises();
      expect(runAction(w).disabled).toBe(true);
      form(w).vm.$emit("update:modelValue", { ...w.vm.values, prompt: "Remove the shadow." });
      await flushPromises();
      expect(runAction(w).disabled).toBe(false);
    });

    it("several products: each uses its main picture", async () => {
      const w = await image({ skus: ["A", "B"] });
      expect(picker(w).exists()).toBe(false);
      expect(w.find("[data-testid='ai-task-main-pictures']").text()).toBe("enrichment.ai.picture.several_image");
    });

    it("saved as a new template, a run keeps the preset of the template it started from", async () => {
      mockListTemplates.mockResolvedValue({ data: [IMAGE_TEMPLATE] });
      mockSaveTemplate.mockResolvedValue({ data: { key: "mine" } });
      const w = await image({ skus: ["A"], templates: [IMAGE_TEMPLATE], initialTemplate: IMAGE_TEMPLATE.key });
      w.vm.templateLabel = "Mine";
      await w.vm.saveTemplate();
      expect(mockSaveTemplate.mock.calls[0][0].params).toMatchObject({ operation: "packshot", preset: "packshot-white" });
    });

    it("a template that sets the operation is that operation: the form asks only for the instruction and variants", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 9, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await image({ skus: ["A"], templates: [IMAGE_TEMPLATE], initialTemplate: IMAGE_TEMPLATE.key });
      expect(form(w).props("fields").map((f) => f.name)).toEqual(["prompt", "n"]);
      picker(w).vm.$emit("update:modelValue", "5");
      await flushPromises();
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0]).toMatchObject({ template: "image-packshot", params: { operation: "packshot" } });
      Object.assign(w.vm, { templateKey: "", workerKey: IMAGE.key });
      await flushPromises();
      expect(w.vm.formFields.map((f) => f.name)).toContain("operation"); // the run is sent: the form gave way to its link
    });

    it("started on one gallery picture: the action names the dialog, its template and operation are fixed", async () => {
      mockSpawn.mockResolvedValue({ data: { id: 9, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await image({ skus: ["A"], templates: [IMAGE_TEMPLATE], initialTemplate: IMAGE_TEMPLATE.key, initialPicture: "12" });
      expect(w.findComponent({ name: "BasicModal" }).attributes("title")).toBe("Packshot");
      expect(w.find("[data-testid='ai-task-template']").exists()).toBe(false);
      expect(picker(w).props("preferred")).toBe("12");
      expect(form(w).props("fields").map((f) => f.name)).toEqual(["prompt", "n"]);
      picker(w).vm.$emit("update:modelValue", "12");
      await flushPromises();
      await w.vm.run();
      expect(mockSpawn.mock.calls[0][0]).toMatchObject({
        template: "image-packshot", params: { operation: "packshot", picture_ref: "12" },
      });
    });
  });

  describe("gallery images (module contentdb)", () => {
    const GALLERY_IMAGE = { ...IMAGE, key: "contentdb.image" };
    const gallery = (props = {}) =>
      openDialog({
        workers: [GALLERY_IMAGE], initialWorker: GALLERY_IMAGE.key, module: "contentdb", subjectChannel: "gallery",
        skus: ["image:u-1", "image:u-2"], ...props,
      });

    it("sends the contentdb scope on the gallery channel, with image wording and no PIM catalog", async () => {
      catalog.fields = CATALOG_FIELDS;
      mockSpawn.mockResolvedValue({ data: { id: 9, lane: "now", queued_ahead: 0, skipped_in_flight: [] } });
      const w = await gallery();
      expect(w.vm.catalog.fields).toEqual([]);
      expect(w.vm.summary).toBe(`enrichment.ai.gallery.summary_few::${JSON.stringify({ count: 2 })}`);
      expect(w.find("[data-testid='ai-task-main-pictures']").exists()).toBe(false);
      await w.vm.run();
      const body = mockSpawn.mock.calls[0][0];
      expect(body.scope_spec).toEqual({ mode: "list", refs: ["image:u-1", "image:u-2"], module: "contentdb", channel: "gallery" });
      expect(body.params.channel).toBe("gallery");
    });

    it("one image: the picker lists that image's own picture through the contentdb module", async () => {
      const w = await gallery({ skus: ["image:u-1"] });
      const picker = w.findComponent({ name: "PicturePicker" });
      expect(picker.props()).toMatchObject({ module: "contentdb", channel: "gallery", subjectRef: "image:u-1" });
    });
  });
});
