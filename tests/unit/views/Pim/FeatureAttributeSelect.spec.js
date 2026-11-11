import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Attributes: vi.fn() }));
vi.mock("@/api/pim/api", () => api);

vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannel: { default_language: "pl" } }) }));

import FeatureAttributeSelect from "@/views/Pim/components/FeatureAttributeSelect.vue";

const stubs = { BasicSelect: { name: "BasicSelect", props: ["options", "modelValue", "moreLabel"], template: "<div />" } };

describe("FeatureAttributeSelect", () => {
  beforeEach(() => {
    api.GET_Attributes.mockReset().mockResolvedValue({
      data: { results: [{ idx: "nike", name: "Nike" }], next: "p2" },
    });
  });

  it("pages the values of one feature, All first", async () => {
    const w = mount(FeatureAttributeSelect, { props: { featureIdx: "brand", name: "Brand" }, global: { stubs } });
    await flushPromises();
    expect(api.GET_Attributes).toHaveBeenCalledWith({ feature_idx: "brand", page: 1, page_size: 50 });
    const select = w.findComponent({ name: "BasicSelect" });
    expect(select.props("options").map((o) => o.value)).toEqual([null, "nike"]);
    expect(select.props("moreLabel")).not.toBe("");
  });

  it("labels the chosen value that is beyond the first page", async () => {
    api.GET_Attributes.mockImplementation(async (params) => ({
      data: { results: params.search === "zeta" ? [{ idx: "zeta", name: "Zeta" }] : [{ idx: "nike", name: "Nike" }], next: null },
    }));
    const w = mount(FeatureAttributeSelect, { props: { featureIdx: "brand", name: "Brand", modelValue: "zeta" }, global: { stubs } });
    await flushPromises();
    const labels = w.findComponent({ name: "BasicSelect" }).props("options").map((o) => o.label);
    expect(labels).toContain("zeta — Zeta");
  });

  it("labels a value in the channel language, the default name as the fallback", async () => {
    api.GET_Attributes.mockResolvedValue({
      data: {
        results: [
          { idx: "red", name: "Red", name_t9n: { en: "Red", pl: "Czerwony" } },
          { idx: "blue", name: "Blue", name_t9n: { en: "Blue" } },
        ],
        next: null,
      },
    });
    const w = mount(FeatureAttributeSelect, { props: { featureIdx: "color", name: "Color" }, global: { stubs } });
    await flushPromises();
    const labels = w.findComponent({ name: "BasicSelect" }).props("options").map((o) => o.label);
    expect(labels.slice(1)).toEqual(["red — Czerwony", "blue — Blue"]);
  });
});
