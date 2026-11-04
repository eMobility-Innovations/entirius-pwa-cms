import { describe, it, expect, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetsGlobal: vi.fn(() =>
    Promise.resolve({ data: { results: [{ idx: "default", name: "Default" }, { idx: "tyres", name: "Tyres" }] } }),
  ),
}));

import FeatureSetChange from "@/views/EnrichmentReview/FeatureSetChange.vue";
import DiffRenderer from "@/views/EnrichmentReview/DiffRenderer.vue";

const text = (wrapper, id) => wrapper.find(`[data-testid="${id}"]`).text();

describe("FeatureSetChange", () => {
  it("names the current and the proposed set instead of showing JSON", async () => {
    const wrapper = mount(FeatureSetChange, {
      props: { current: { featureset_idx: "default" }, proposed: { featureset_idx: "tyres" } },
    });
    await flushPromises();
    expect(text(wrapper, "feature-set-now")).toBe("Default");
    expect(text(wrapper, "feature-set-proposed")).toBe("Tyres");
  });

  it("falls back to the idx for a set the list does not know, and a dash for none", async () => {
    const wrapper = mount(FeatureSetChange, { props: { current: null, proposed: { featureset_idx: "new_set" } } });
    await flushPromises();
    expect(text(wrapper, "feature-set-now")).toBe("—");
    expect(text(wrapper, "feature-set-proposed")).toBe("new_set");
  });

  it("is what DiffRenderer shows for target_kind feature_set", async () => {
    const wrapper = mount(DiffRenderer, {
      props: { targetKind: "feature_set", current: { featureset_idx: "default" }, proposed: { featureset_idx: "tyres" } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="feature-set-change"]').exists()).toBe(true);
  });
});
