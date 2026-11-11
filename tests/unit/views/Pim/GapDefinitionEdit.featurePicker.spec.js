import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => ({
  GET_Features: vi.fn(),
  GET_Feature: vi.fn(),
  GET_GapDefinition: vi.fn(),
  POST_GapDefinition: vi.fn(),
  PATCH_GapDefinition: vi.fn(),
  DELETE_GapDefinition: vi.fn(),
}));
vi.mock("@/api/pim/api", () => api);
vi.mock("@/stores/quality", () => ({ useQualityStore: () => ({ available: true, probe: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ channels: [], activeChannelIdx: "eu" }) }));

import GapDefinitionEdit from "@/views/Pim/GapDefinitionEdit.vue";

const Probe = { name: "BasicSelect", props: { options: Array, modelValue: String, moreLabel: String, remoteSearch: Boolean }, template: "<div />" };
const stubs = {
  PageLayout: { template: "<div><slot name='header' /><slot /></div>" },
  PageHeader: true,
  PimChannelSelect: true,
  BasicCard: { template: "<div><slot /></div>" },
  FormField: { template: "<div><slot /></div>" },
  BasicInput: true,
  BasicSwitch: true,
  BasicTextarea: true,
  ChannelMultiSelect: true,
  ConfirmDialog: true,
  BasicSelect: Probe,
};
const mountEdit = () =>
  mount(GapDefinitionEdit, {
    global: { stubs, mocks: { $route: { params: {}, query: {} }, $router: { push: vi.fn(), replace: vi.fn() } } },
  });
const featureSelect = (w) => w.findAllComponents({ name: "BasicSelect" }).find((s) => s.props("remoteSearch"));

describe("GapDefinitionEdit feature picker", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Object.values(api).forEach((fn) => fn.mockReset());
    api.GET_Features.mockResolvedValue({ data: { results: [{ idx: "color", name: "Color" }], next: "p2" } });
  });

  it("loads one page of features with a load-more row and searches on the server", async () => {
    const w = mountEdit();
    await flushPromises();
    expect(api.GET_Features).toHaveBeenCalledWith({ page: 1, page_size: 50 }, undefined);
    expect(featureSelect(w).props("options").map((o) => o.value)).toEqual(["color"]);
    expect(featureSelect(w).props("moreLabel")).not.toBe("");
  });

  it("labels a saved feature that is not on the loaded page", async () => {
    api.GET_Feature.mockResolvedValue({ data: { idx: "deep", name: "Deep feature" } });
    const w = mountEdit();
    await flushPromises();
    w.vm.paramFeatureIdx = "deep";
    await flushPromises();
    expect(api.GET_Feature).toHaveBeenCalledWith("deep");
    expect(featureSelect(w).props("options").map((o) => o.label)).toContain("deep — Deep feature");
  });
});
