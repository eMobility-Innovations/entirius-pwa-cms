import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Workflows: vi.fn(), GET_Run: vi.fn(), GET_Languages: vi.fn(), POST_Run: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/contentDBChannel", () => ({
  useContentDBChannelStore: () => ({ channels: [{ idx: "eu", name: "Europe" }], activeChannelIdx: "eu", fetchChannelsAndLanguages: vi.fn() }),
}));

const modules = vi.hoisted(() => ({ enabled: new Set(["pim"]) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => modules.enabled.has(key) }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ channels: [{ idx: "pim" }], activeChannelIdx: "pim", fetchChannels: vi.fn() }) }));

import NewRunDialog from "@/views/EnrichmentStudio/NewRunDialog.vue";
import RunBrief from "@/views/EnrichmentStudio/RunBrief.vue";

const schema = (extra) => ({ properties: { topic: { type: "string" }, ...extra }, required: ["topic"] });
const WORKFLOWS = [
  { key: "article", label: "Article", target_module: "contentdb", inputs_schema: schema({ audience: { type: "string" } }) },
  { key: "news", label: "News", target_module: "contentdb", inputs_schema: schema() },
];
const stubs = {
  BasicModal: { props: ["open", "actions"], template: "<div v-if='open'><slot /></div>" },
  BasicSelect: true, BasicTextarea: true, ProfileGate: true,
  BasicInput: { name: "BasicInput", props: ["modelValue"], emits: ["update:modelValue"], template: "<input />" },
  FormField: { template: "<div><slot /></div>" },
  BasicCheckbox: { name: "BasicCheckbox", props: ["modelValue"], emits: ["update:modelValue"], template: "<label><slot /></label>" },
  BriefProductPicker: { name: "BriefProductPicker", props: ["modelValue"], emits: ["update:modelValue"], template: "<div />" },
};
const topicInput = (w) => w.find("[data-testid='brief-topic']").findComponent({ name: "BasicInput" });

describe("NewRunDialog", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.GET_Workflows.mockResolvedValue({ data: WORKFLOWS });
    api.GET_Languages.mockResolvedValue({ data: [] });
    modules.enabled = new Set(["pim"]);
  });

  it("a reopened dialog starts from an empty brief", async () => {
    const w = mount(NewRunDialog, { props: { open: true }, global: { stubs } });
    await flushPromises();
    topicInput(w).vm.$emit("update:modelValue", "Sofas");
    await w.setProps({ open: false });
    await w.setProps({ open: true });
    await flushPromises();
    expect(topicInput(w).props("modelValue")).toBe("");
  });

  it("a copied run's brief stays with its workflow: another workflow starts empty", async () => {
    api.GET_Run.mockResolvedValue({ data: { definition: "article", channel: "eu", inputs: { topic: "Sofas", audience: "Parents" } } });
    const w = mount(NewRunDialog, { props: { open: false }, global: { stubs } });
    await w.setProps({ open: true });
    await flushPromises();
    await w.setProps({ open: false, copyFrom: "r1" });
    await w.setProps({ open: true });
    await flushPromises();
    expect(topicInput(w).props("modelValue")).toBe("Sofas");
    w.vm.definition = "news";
    await flushPromises();
    expect(topicInput(w).props("modelValue")).toBe("");
  });
  it("opens on the workflow picked in New", async () => {
    const w = mount(NewRunDialog, { props: { open: true, initialDefinition: "news" }, global: { stubs } });
    await flushPromises();
    expect(w.vm.definition).toBe("news");
  });

  it("a cover brief: a checkbox shows the text it asks for, the product goes as its pick", async () => {
    const cover = {
      key: "article",
      label: "Article",
      target_module: "contentdb",
      inputs_schema: schema({
        cover_product: { type: "object", title: "Product on the cover", "x-picker": "pim-product" },
        cover_text_wanted: { type: "boolean", title: "Text on the cover", default: false },
        cover_text: { type: "string", title: "Cover text", maxLength: 80, "x-visible-if": "cover_text_wanted" },
      }),
    };
    api.GET_Workflows.mockResolvedValue({ data: [cover] });
    api.POST_Run.mockResolvedValue({ data: { uid: "r9" } });
    const w = mount(NewRunDialog, { props: { open: true }, global: { stubs } });
    await flushPromises();
    topicInput(w).vm.$emit("update:modelValue", "Soothers");
    await w.find("[data-testid='new-run-details']").trigger("click");
    expect(w.find("[data-testid='brief-cover_text']").exists()).toBe(false);
    w.findComponent({ name: "BasicCheckbox" }).vm.$emit("update:modelValue", true);
    await flushPromises();
    expect(w.find("[data-testid='brief-cover_text']").exists()).toBe(true);
    await w.vm.start();
    expect(w.vm.errors).toEqual({ cover_text: "required" });
    expect(api.POST_Run).not.toHaveBeenCalled();
    w.find("[data-testid='brief-cover_text']").findComponent({ name: "BasicInput" }).vm.$emit("update:modelValue", "Sleep well");
    const product = { channel: "pim", ref: "SKU-1", label: "Soother" };
    w.findComponent({ name: "BriefProductPicker" }).vm.$emit("update:modelValue", product);
    await w.vm.start();
    expect(api.POST_Run).toHaveBeenCalledWith({
      definition: "article",
      channel: "eu",
      inputs: { topic: "Soothers", cover_product: product, cover_text_wanted: true, cover_text: "Sleep well" },
    });
  });
});

describe("NewRunDialog without PIM", () => {
  it("leaves the product search out of the brief", async () => {
    modules.enabled = new Set();
    const product = { type: "object", title: "Product on the cover", "x-picker": "pim-product" };
    const article = { key: "article", label: "Article", target_module: "contentdb", inputs_schema: schema({ cover_product: product }) };
    api.GET_Workflows.mockResolvedValue({ data: [article] });
    api.GET_Languages.mockResolvedValue({ data: [] });
    const w = mount(NewRunDialog, { props: { open: true }, global: { stubs } });
    await flushPromises();
    expect(w.find("[data-testid='new-run-details']").exists()).toBe(false);
    expect(w.vm.fields.map((field) => field.key)).toEqual(["topic"]);
  });
});

describe("RunBrief", () => {
  it("shows a checked box as yes and a product as its name and SKU", () => {
    const run = {
      definition_label: "Article",
      steps: [],
      inputs: { topic: "Soothers", cover_text_wanted: true, cover_product: { channel: "pim", ref: "SKU-1", label: "Soother" } },
    };
    const w = mount(RunBrief, { props: { run }, global: { stubs: { BasicButton: true } } });
    expect(w.text()).toContain("common.yes");
    expect(w.text()).toContain("Soother (SKU-1)");
  });
});
