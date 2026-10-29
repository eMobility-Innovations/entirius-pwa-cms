import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Workers: vi.fn(), GET_Template: vi.fn(), GET_Templates: vi.fn(),
  POST_Template: vi.fn(), PATCH_Template: vi.fn(), DELETE_Template: vi.fn(),
}));
const notify = vi.fn();
const push = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/views/EnrichmentReview/fieldCatalog", async (importOriginal) => ({
  ...(await importOriginal()),
  loadCatalog: async () => ({
    fields: [{ key: "meta_title", label: "Meta title", type: "text" }, { key: "badge", label: "Badge", type: "select" }],
    languages: ["pl", "en"],
  }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "eu" }) }));

import TemplateEdit from "@/views/EnrichmentTemplates/TemplateEdit.vue";

const WRITER = {
  key: "pim.writer", label: "Writer", kind: "write",
  params_schema: {
    properties: {
      channel: { type: "string" }, fields: { type: "array", items: { type: "string" } },
      languages: { type: "array", items: { type: "string" } }, prompt: { type: "string", default: "" },
    },
    required: ["channel", "fields", "languages"],
  },
};
const STORED = {
  key: "meta", label: "Meta", worker_key: "pim.writer", worker_label: "Writer", kind: "write", position: 10, active: true,
  params: { fields: ["meta_title"], languages: ["*"], prompt: "Short.", augment: ["seo_brief"], seo_scope: "category" },
  rules: ["Brand first.", "No prices."],
};
const stubs = {
  PageHeader: { template: "<div><slot name='actions' /></div>" },
  ActionBar: { template: "<div><slot /></div>" },
  IconButton: true, BasicSelect: true, BasicTextarea: true, BasicSwitch: true,
  ConfirmDialog: { name: "ConfirmDialog", props: ["open", "title"], emits: ["confirm", "discard", "cancel"], template: "<div />" },
  AiParamsForm: { name: "AiParamsForm", props: ["fields", "modelValue", "fieldChoices", "research", "researchKeys"], template: "<div />" },
};

async function mountEdit(key = "") {
  const w = mount(TemplateEdit, {
    global: { stubs, mocks: { $route: { params: key ? { key } : {}, query: {} }, $router: { push } } },
  });
  await flushPromises();
  return w;
}

describe("TemplateEdit", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.GET_Workers.mockResolvedValue({ data: [WRITER] });
    api.GET_Template.mockResolvedValue({ data: STORED });
    api.GET_Templates.mockResolvedValue({ data: [STORED] });
    api.POST_Template.mockResolvedValue({ data: {} });
    api.PATCH_Template.mockResolvedValue({ data: {} });
    api.DELETE_Template.mockResolvedValue({});
    notify.mockReset();
    push.mockReset();
  });

  it("loads a template into the run form: its params, research and rules one per line", async () => {
    const w = await mountEdit("meta");
    expect(w.vm.values).toEqual({ fields: ["meta_title"], languages: ["*"], prompt: "Short." });
    expect(w.vm.research).toEqual({ augment: ["seo_brief"], seo_scope: "category" });
    expect(w.vm.form.rules).toBe("Brand first.\nNo prices.");
    expect(w.findComponent({ name: "AiParamsForm" }).props("fieldChoices").map((o) => o.value)).toEqual(["meta_title"]);
  });

  it("saves the changes and goes back to the list", async () => {
    const vm = (await mountEdit("meta")).vm.$.proxy;
    vm.form.rules = "Brand first.\n";
    vm.form.active = false;
    await vm.save();
    expect(api.PATCH_Template).toHaveBeenCalledWith("meta", {
      label: "Meta",
      worker_key: "pim.writer",
      params: { fields: ["meta_title"], languages: ["*"], prompt: "Short.", augment: ["seo_brief"], seo_scope: "category" },
      rules: ["Brand first."],
      active: false,
    });
    expect(push).toHaveBeenCalledWith({ name: "EnrichmentTemplates" });
  });

  it("a new template gets a key from its name and the last position", async () => {
    const w = await mountEdit();
    // The instance proxy: writes through it are reactive (the wrapper's vm reads the raw data of a setup() component).
    const vm = w.vm.$.proxy;
    vm.form.label = "Meta";
    vm.form.worker_key = "pim.writer";
    await flushPromises();
    expect(vm.values).toEqual({ fields: [], languages: ["*"], prompt: "" });
    expect(vm.canSave).toBe(false);
    vm.values = { ...vm.values, fields: ["meta_title"] };
    expect(vm.canSave).toBe(true);
    await vm.save();
    expect(api.POST_Template).toHaveBeenCalledWith({
      key: "meta-2", label: "Meta", worker_key: "pim.writer", position: 20, rules: [], active: true,
      params: { fields: ["meta_title"], languages: ["*"], prompt: "", augment: [] },
    });
  });

  it("a refused save says why and stays", async () => {
    api.PATCH_Template.mockRejectedValue({ detail: "params invalid" });
    const w = await mountEdit("meta");
    await w.vm.save();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
    expect(push).not.toHaveBeenCalled();
  });

  it("deletes after the confirmation", async () => {
    const w = await mountEdit("meta");
    await w.vm.remove();
    expect(api.DELETE_Template).toHaveBeenCalledWith("meta");
    expect(push).toHaveBeenCalledWith({ name: "EnrichmentTemplates" });
  });

  it("a template that is gone shows a way back to the list, no form and no Delete", async () => {
    api.GET_Template.mockRejectedValue({ response: { status: 404 } });
    const w = await mountEdit("old-key");
    expect(w.find("[data-testid='template-missing']").exists()).toBe(true);
    expect(w.find("[data-testid='template-delete']").exists()).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it("a new template names what still stops Save", async () => {
    const w = await mountEdit();
    expect(w.vm.unfilled).toContain(w.vm.$t("enrichment.templates.name"));
    expect(w.find("[data-testid='template-unfilled']").exists()).toBe(true);
  });

  describe("leaving", () => {
    const leaveDialog = (w) => w.findAllComponents({ name: "ConfirmDialog" }).find((d) => d.props("title") === "unsaved.title");

    it("an untouched template leaves without asking", async () => {
      const w = await mountEdit("meta");
      const next = vi.fn();
      TemplateEdit.beforeRouteLeave.call(w.vm, {}, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("an edited one asks first; Save and leave saves, then leaves (not to the list)", async () => {
      const w = await mountEdit("meta");
      w.vm.$.proxy.form.rules = "Brand first.";
      await w.vm.$nextTick();
      const next = vi.fn();
      TemplateEdit.beforeRouteLeave.call(w.vm, {}, {}, next);
      await w.vm.$nextTick();
      expect(next).not.toHaveBeenCalled();
      expect(leaveDialog(w).props("open")).toBe(true);
      leaveDialog(w).vm.$emit("confirm");
      await flushPromises();
      expect(api.PATCH_Template).toHaveBeenCalledWith("meta", expect.objectContaining({ rules: ["Brand first."] }));
      expect(next).toHaveBeenCalledWith();
      expect(push).not.toHaveBeenCalled();
    });

    it("a save from the page leaves for the list without asking", async () => {
      const w = await mountEdit("meta");
      w.vm.$.proxy.form.rules = "Brand first.";
      await w.vm.$nextTick();
      await w.vm.$.proxy.save();
      expect(push).toHaveBeenCalledWith({ name: "EnrichmentTemplates" });
      const next = vi.fn();
      TemplateEdit.beforeRouteLeave.call(w.vm, {}, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
