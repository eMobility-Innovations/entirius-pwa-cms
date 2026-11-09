import { describe, expect, it } from "vitest";
import {
  createQueueState, applyNext, previousSku, goBack, needsRefresh, productsCounterParams, rowsForSku,
} from "@/views/EnrichmentReview/focusQueue";

describe("Focus product queue helpers", () => {
  it("creates independent empty queue states", () => {
    const first = createQueueState();
    expect(first).toEqual({ current: null, history: [], remaining: null, reservedUntil: null });
    first.history.push("SKU-1");
    expect(createQueueState().history).toEqual([]);
  });

  it("records seen products, remaining count and reservation expiry without duplicate refresh history", () => {
    const state = createQueueState();
    const expiry = "2026-11-09T13:15:00Z";
    expect(applyNext(state, { sku: "SKU-1", remaining: 5, reserved_until: expiry })).toBe(state);
    applyNext(state, { sku: "SKU-1", remaining: 5, reserved_until: expiry });
    expect(state.history).toEqual([]);
    applyNext(state, { sku: "SKU-2", remaining: 4, reserved_until: expiry });
    expect(state).toEqual({ current: "SKU-2", history: ["SKU-1"], remaining: 4, reservedUntil: expiry });
    applyNext(state, { sku: null, remaining: 0, reserved_until: null });
    expect(state.current).toBeNull();
    expect(state.history).toEqual(["SKU-1", "SKU-2"]);
  });

  it("walks history backwards and leaves the current product unchanged at its beginning", () => {
    const state = { ...createQueueState(), current: "SKU-3", history: ["SKU-1", "SKU-2"] };
    expect(previousSku(state)).toBe("SKU-2");
    expect(goBack(state)).toBe("SKU-2");
    expect(state.current).toBe("SKU-2");
    expect(goBack(state)).toBe("SKU-1");
    expect(previousSku(state)).toBeNull();
    expect(goBack(state)).toBeNull();
    expect(state.current).toBe("SKU-1");
  });

  it("refreshes after twelve minutes with optional threshold and ISO timestamps", () => {
    const opened = Date.parse("2026-11-09T13:00:00Z");
    expect(needsRefresh(opened, opened + 12 * 60 * 1000 - 1)).toBe(false);
    expect(needsRefresh(opened, opened + 12 * 60 * 1000)).toBe(true);
    expect(needsRefresh("2026-11-09T13:00:00Z", opened + 1000, 1000)).toBe(true);
    expect(needsRefresh(null, opened)).toBe(false);
    expect(needsRefresh("invalid", opened)).toBe(false);
  });

  it("counts products using the server remaining count", () => {
    expect(productsCounterParams(7)).toEqual({ remaining: 7 });
    expect(productsCounterParams(0)).toEqual({ remaining: 0 });
  });

  it("selects only pending PIM product proposals for the requested SKU", () => {
    const product = { id: 1, subject_ref: "SKU-1", target_module: "pim", target_kind: "attribute_value", status: "pending" };
    const rows = [product, { ...product, id: 2, target_kind: "feature_set" }, { ...product, id: 3, subject_ref: "SKU-2" },
      { ...product, id: 4, target_module: "studio" }, { ...product, id: 5, status: "applied" }];
    expect(rowsForSku(rows, "SKU-1")).toEqual(rows.slice(0, 2));
    expect(rowsForSku(rows, "absent")).toEqual([]);
  });
});
