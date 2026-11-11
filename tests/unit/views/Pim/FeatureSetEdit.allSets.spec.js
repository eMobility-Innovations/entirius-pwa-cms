import { describe, it, expect, vi } from "vitest";

const api = vi.hoisted(() => ({ GET_FeatureSetsGlobal: vi.fn() }));
vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetsGlobal: api.GET_FeatureSetsGlobal,
  ...Object.fromEntries(
    "GET_FeatureSetGlobal PATCH_FeatureSet DELETE_FeatureSet GET_FeatureSetFeaturesGlobal POST_FeatureSetFeatures DELETE_FeatureSetFeatures PATCH_FeatureSetFeaturesReorder GET_AttributesGroups POST_AttributesGroup PATCH_AttributesGroup PATCH_FeatureSetFeature"
      .split(" ")
      .map((name) => [name, vi.fn()])
  ),
}));

import FeatureSetEdit from "@/views/Pim/FeatureSetEdit.vue";

describe("FeatureSetEdit.fetchAllSets", () => {
  it("reads every page: the default-set check must see all feature sets", async () => {
    api.GET_FeatureSetsGlobal.mockImplementation(async ({ page }) => ({
      data: { results: [{ idx: `s${page}`, is_default: page === 2 }], next: page < 2 ? "n" : null },
    }));
    const ctx = { allSets: [] };
    await FeatureSetEdit.methods.fetchAllSets.call(ctx);
    expect(ctx.allSets.map((s) => s.idx)).toEqual(["s1", "s2"]);
    expect(api.GET_FeatureSetsGlobal).toHaveBeenLastCalledWith({ page: 2, page_size: 100 });
  });
});
