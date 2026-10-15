import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Workflows: vi.fn(), GET_Run: vi.fn(), GET_Languages: vi.fn(), POST_Run: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/contentDBChannel", () => ({
  useContentDBChannelStore: () => ({ channels: [{ idx: "eu", name: "Europe" }], activeChannelIdx: "eu", fetchChannelsAndLanguages: vi.fn() }),
}));

import NewRunDialog from "@/views/EnrichmentStudio/NewRunDialog.vue";

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
};
const topicInput = (w) => w.find("[data-testid='brief-topic']").findComponent({ name: "BasicInput" });

describe("NewRunDialog", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.GET_Workflows.mockResolvedValue({ data: WORKFLOWS });
    api.GET_Languages.mockResolvedValue({ data: [] });
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
});
