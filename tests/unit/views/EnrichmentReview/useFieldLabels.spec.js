import { beforeEach, describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";

const pages = {
  1: { results: [{ idx: "speed", name: "Speed" }], next: "page-2" },
  2: { results: [{ idx: "capacity", name: "Capacity" }], next: null },
};

vi.mock("@/api/pim/api", () => ({
  GET_Features: vi.fn(({ page }) => Promise.resolve({ data: pages[page] })),
}));

async function labels() {
  vi.resetModules();
  const { useFieldLabels } = await import("@/views/EnrichmentReview/useFieldLabels");
  const composable = useFieldLabels();
  await flushPromises();
  return composable;
}

describe("useFieldLabels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names a feature past the first page of the catalogue", async () => {
    const { fieldLabel } = await labels();
    expect(fieldLabel("speed")).toBe("Speed");
    expect(fieldLabel("capacity")).toBe("Capacity");
  });

  it("heads a feature-set proposal in words", async () => {
    const { proposalField } = await labels();
    expect(proposalField({ target_kind: "feature_set", target_locator: {} })).toBe("Feature set");
  });
});
