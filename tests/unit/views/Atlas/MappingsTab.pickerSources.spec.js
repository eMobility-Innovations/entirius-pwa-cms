import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/atlas/api", () => ({
  GET_MappingProfiles: vi.fn().mockResolvedValue({ data: { results: [] } }),
  POST_MappingProfile: vi.fn(),
  PATCH_MappingProfile: vi.fn().mockResolvedValue({ data: {} }),
  DELETE_MappingProfile: vi.fn(),
  POST_ValidateProfile: vi.fn(),
  GET_AttributeMappings: vi.fn().mockResolvedValue({ data: { results: [] } }),
  POST_AttributeMapping: vi.fn(),
  PATCH_AttributeMapping: vi.fn(),
  DELETE_AttributeMapping: vi.fn(),
  GET_CategoryMappings: vi.fn().mockResolvedValue({ data: { results: [] } }),
  POST_CategoryMapping: vi.fn(),
  PATCH_CategoryMapping: vi.fn(),
  DELETE_CategoryMapping: vi.fn(),
  GET_DataKeys: vi.fn().mockResolvedValue({ data: { tokens: [], data_keys: [], sample_size: 0 } }),
}));

vi.mock("@/api/pim/api", () => ({
  GET_Channels: vi.fn().mockResolvedValue({
    data: {
      results: [
        { idx: "ch-en-only", name: "EN Only", default_language: "en", languages: ["en"] },
        { idx: "ch-pl-en", name: "PL+EN", default_language: "en", languages: ["en", "pl"] },
      ],
    },
  }),
  GET_Features: vi.fn(),
  GET_FeatureSetsGlobal: vi.fn(),
}));

vi.mock("@/api/regional/api", () => ({
  GET_RegionalLanguages: vi
    .fn()
    .mockResolvedValue({ data: { results: [{ iso2: "en", name_en: "English" }, { iso2: "pl", name_en: "Polish" }] } }),
}));

const mockSpawnNotification = vi.fn();
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));

import MappingsTab from "@/views/Atlas/tabs/MappingsTab.vue";
import { GET_Features, GET_FeatureSetsGlobal } from "@/api/pim/api";

const pages = (rows, size) => async ({ page }) => ({
  data: { results: rows.slice((page - 1) * size, page * size), next: page * size < rows.length ? "n" : null },
});

describe("MappingsTab — picker sources", () => {
  it("loads every page of features and feature sets, not the first one", async () => {
    GET_Features.mockImplementation(pages(Array.from({ length: 230 }, (_, i) => ({ idx: `f${i}` })), 100));
    GET_FeatureSetsGlobal.mockImplementation(pages(Array.from({ length: 120 }, (_, i) => ({ idx: `s${i}` })), 100));
    const wrapper = mount(MappingsTab, {
      props: { supplier: { idx: "sup", name: "Sup", default_language_iso2: "en" } },
      global: { stubs: { SideDrawer: true, ChannelMultiSelect: true, BasicInput: true, FormField: true, EmptyState: true, AttributeMappingRow: true, CategoryMappingRow: true, FontAwesomeIcon: true } },
    });
    await flushPromises();
    expect(wrapper.vm.features).toHaveLength(230);
    expect(wrapper.vm.featureSets).toHaveLength(120);
    expect(GET_Features).toHaveBeenLastCalledWith({ page: 3, page_size: 100 });
  });
});
