import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockList = vi.fn();
const mockPatch = vi.fn();
const notify = vi.fn();
const push = vi.fn();
vi.mock("@/api/enrichment/api", () => ({
  GET_Templates: (...a) => mockList(...a),
  PATCH_Template: (...a) => mockPatch(...a),
}));
vi.mock("@/views/EnrichmentReview/fieldCatalog", () => ({
  loadCatalog: async () => ({ fields: [{ key: "meta_title", label: "Meta title" }], languages: [] }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "eu" }) }));

import TemplateList from "@/views/EnrichmentTemplates/TemplateList.vue";

const DataTable = { name: "DataTable", props: ["rows", "columns"], emits: ["row-click"], template: "<div />" };
const stubs = { DataTable, PageHeader: true, FloatingActions: { name: "FloatingActions", props: ["actions"], template: "<div />" } };
const TEMPLATES = [
  { key: "tags", label: "Tags", worker_label: "Tagger", position: 20, active: false, params: { fields: [] } },
  { key: "meta", label: "Meta", worker_label: "Writer", position: 10, active: true, params: { fields: ["meta_title"] } },
];

async function mountList() {
  const w = mount(TemplateList, { global: { stubs, mocks: { $router: { push } } } });
  await flushPromises();
  return w;
}

describe("TemplateList", () => {
  beforeEach(() => {
    mockList.mockReset().mockResolvedValue({ data: TEMPLATES });
    mockPatch.mockReset().mockResolvedValue({ data: {} });
    notify.mockReset();
    push.mockReset();
  });

  it("lists the templates in Run AI order with their fields by name", async () => {
    const w = await mountList();
    expect(mockList).toHaveBeenCalledWith({ target_module: "pim" });
    const rows = w.findComponent(DataTable).props("rows");
    expect(rows.map((r) => [r.key, r.fieldsText])).toEqual([["meta", "Meta title"], ["tags", ""]]);
  });

  it("moving a template down saves the new positions", async () => {
    const w = await mountList();
    await w.vm.move(0, 1);
    expect(mockPatch.mock.calls).toEqual([["tags", { position: 10 }], ["meta", { position: 20 }]]);
    expect(w.vm.templates.map((t) => t.key)).toEqual(["tags", "meta"]);
  });

  it("a failed move says so and reloads the order", async () => {
    mockPatch.mockRejectedValue({ detail: "nope" });
    const w = await mountList();
    await w.vm.move(0, 1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("a row opens its editor; the add action a new one", async () => {
    const w = await mountList();
    w.findComponent(DataTable).vm.$emit("row-click", { key: "meta" });
    expect(push).toHaveBeenCalledWith({ name: "EnrichmentTemplateEdit", params: { key: "meta" } });
    w.findComponent({ name: "FloatingActions" }).props("actions")[0].handler();
    expect(push).toHaveBeenCalledWith({ name: "EnrichmentTemplateCreate" });
  });
});
