import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Workers: vi.fn(), GET_ProfileVersions: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: () => true }) }));

import ProposalDetails from "@/views/EnrichmentReview/ProposalDetails.vue";
import { clearWorkerCache } from "@/views/EnrichmentReview/workerModel";
import { clearProfileCache } from "@/views/EnrichmentReview/profileUsage";

// The menu stub shows its panel at once and emits `open` on demand.
const BasicMenu = { name: "BasicMenu", emits: ["open"], template: "<div><slot name='trigger' /><slot name='panel' /></div>" };
const stubs = { BasicMenu, IconButton: { props: ["label"], template: "<button :aria-label='label' />" } };
const PROPOSAL = { id: 7, source: "worker:pim.meta@v3", target_kind: "attribute_value", confidence: "0.9", cost_usd: "0.0040" };
const TASK = { id: 1, type: "pim.meta", params: { channel: "" }, profile_versions: [4] };
const $t = (key, params) => (params ? `${key}:${params.sections}` : key);

describe("ProposalDetails", () => {
  beforeEach(() => {
    clearWorkerCache();
    clearProfileCache();
    api.GET_Workers.mockReset();
    api.GET_ProfileVersions.mockResolvedValue({ data: [{ id: 4, data: { brand: { text: "Sofas." } } }] });
  });

  it("the ⓘ opens cost, model, worker and what came from the company profile", async () => {
    api.GET_Workers.mockResolvedValue({ data: [{ key: "pim.meta", model: "gpt-x" }] });
    const w = mount(ProposalDetails, { props: { proposal: PROPOSAL, task: TASK }, global: { stubs, mocks: { $t } } });
    expect(w.find("button").attributes("aria-label")).toBe("enrichment.review.details.title");
    w.findComponent(BasicMenu).vm.$emit("open");
    await flushPromises();
    expect(w.find("[data-testid='cost-label']").text()).toBe("<$0.01");
    expect(w.find("[data-testid='proposal-model']").text()).toBe("gpt-x");
    expect(w.find("[data-testid='proposal-source-line']").text()).toBe("pim.meta@v3 · attribute_value · 90%");
    expect(w.find("[data-testid='profile-usage-text']").text()).toBe("enrichment.profile.used:brand");
  });

  it("a worker on the toolbox default model says so; an unknown worker shows no model row", async () => {
    api.GET_Workers.mockResolvedValue({ data: [{ key: "pim.meta", model: "" }] });
    const w = mount(ProposalDetails, { props: { proposal: PROPOSAL }, global: { stubs, mocks: { $t } } });
    w.findComponent(BasicMenu).vm.$emit("open");
    await flushPromises();
    expect(w.find("[data-testid='proposal-model']").text()).toBe("enrichment.review.details.default_model");
    const other = mount(ProposalDetails, { props: { proposal: { ...PROPOSAL, source: "worker:pim.gone@v1" } }, global: { stubs, mocks: { $t } } });
    other.findComponent(BasicMenu).vm.$emit("open");
    await flushPromises();
    expect(other.find("[data-testid='proposal-model']").exists()).toBe(false);
    expect(api.GET_Workers).toHaveBeenCalledTimes(1);
  });
});
