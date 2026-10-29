import { describe, it, expect, vi, beforeEach } from "vitest";

const getRequired = vi.fn();
vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetRequiredFeatures: (...args) => getRequired(...args),
}));

import {
  usePimCapabilities,
  loadRequiredFeatures,
  noteFeatureList,
  resetPimCapabilities,
} from "@/composables/usePimCapabilities";

const notFound = () => ({ response: { status: 404, data: {} } });

describe("usePimCapabilities", () => {
  beforeEach(() => {
    resetPimCapabilities();
    getRequired.mockReset();
  });

  it("new PIM: the probe answers, the capability turns on", async () => {
    getRequired.mockResolvedValue({ data: [{ feature: { idx: "name" }, source: "system" }] });
    const caps = usePimCapabilities();
    expect(caps.requiredPerFeatureSet.value).toBe(false);
    const data = await loadRequiredFeatures("outdoor");
    expect(data).toHaveLength(1);
    expect(caps.requiredPerFeatureSet.value).toBe(true);
  });

  it("legacy PIM: a 404 turns it off for the session and is never asked again", async () => {
    getRequired.mockRejectedValue(notFound());
    expect(await loadRequiredFeatures("outdoor")).toBeNull();
    expect(await loadRequiredFeatures("outdoor")).toBeNull();
    expect(getRequired).toHaveBeenCalledTimes(1);
    expect(usePimCapabilities().requiredPerFeatureSet.value).toBe(false);
  });

  it("a network failure is not a verdict: asked again next time", async () => {
    getRequired.mockRejectedValueOnce(new Error("Network Error"));
    expect(await loadRequiredFeatures("outdoor")).toBeNull();
    getRequired.mockResolvedValueOnce({ data: [] });
    await loadRequiredFeatures("outdoor");
    expect(usePimCapabilities().requiredPerFeatureSet.value).toBe(true);
  });

  it("no feature set, no request", async () => {
    expect(await loadRequiredFeatures("")).toBeNull();
    expect(getRequired).not.toHaveBeenCalled();
  });

  it("a features list with is_required_override marks the new PIM, without it the legacy one", () => {
    const caps = usePimCapabilities();
    noteFeatureList([]);
    expect(caps.requiredPerFeatureSet.value).toBe(false);
    noteFeatureList([{ feature: { idx: "a" }, is_required_override: null }]);
    expect(caps.requiredPerFeatureSet.value).toBe(true);
    resetPimCapabilities();
    noteFeatureList([{ feature: { idx: "a" } }]);
    expect(caps.requiredPerFeatureSet.value).toBe(false);
    noteFeatureList([{ feature: { idx: "a" }, is_required_override: true }]);
    expect(caps.requiredPerFeatureSet.value).toBe(false);
  });
});
