import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { get, post, cookieGet } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), cookieGet: vi.fn() }));
vi.mock("@/api/enrichment/client", () => ({ enrichmentApi: { get, post } }));
vi.mock("universal-cookie", () => ({ default: class { get(...args) { return cookieGet(...args); } } }));

import {
  getReviewProduct, sendBack, getMissing, fillMissing,
  POST_ReviewNext, POST_ReviewRelease, POST_ReviewSkip, GET_ReviewSkipped,
  POST_ReviewUnskip, GET_ReviewCounts, releaseOnLeave,
} from "@/api/integrator/review";

const enrichmentApi = { get, post };

const REVIEW = "/api/integrator/v1/review";

describe("integrator review API", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("requests the current reservation or advances after a SKU", async () => {
    const response = { data: { sku: "SKU-1", remaining: 4 } };
    post.mockResolvedValue(response);
    expect(await POST_ReviewNext()).toBe(response);
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/next/`, {});
    await POST_ReviewNext("SKU-1");
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/next/`, { after: "SKU-1" });
  });

  it("releases a reservation and returns a skipped product to the queue", async () => {
    await POST_ReviewRelease("SKU-1");
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/release/`, { sku: "SKU-1" });
    await POST_ReviewUnskip("SKU-1");
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/unskip/`, { sku: "SKU-1" });
  });

  it("skips with an optional trimmed note, omitting blank notes", async () => {
    await POST_ReviewSkip("SKU-1", " Waiting for photos ");
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/skip/`, { sku: "SKU-1", note: "Waiting for photos" });
    await POST_ReviewSkip("SKU-1", "  ");
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/skip/`, { sku: "SKU-1" });
    await POST_ReviewSkip("SKU-1");
    expect(post).toHaveBeenLastCalledWith(`${REVIEW}/skip/`, { sku: "SKU-1" });
  });

  it("lists skipped products with paging and fetches product counts", async () => {
    const params = { page: 2 };
    await GET_ReviewSkipped(params);
    expect(get).toHaveBeenLastCalledWith(`${REVIEW}/skipped/`, { params });
    await GET_ReviewCounts();
    expect(get).toHaveBeenLastCalledWith(`${REVIEW}/counts/`);
  });

  it("releases on leave through the enrichment client with the fetch adapter and keepalive", async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 204 });
    vi.stubGlobal("fetch", fetch);
    post.mockResolvedValue({});
    await releaseOnLeave("SKU-1");
    expect(post).toHaveBeenCalledWith(`${REVIEW}/release/`, { sku: "SKU-1" }, { adapter: "fetch", fetchOptions: { keepalive: true } });
    expect(fetch).not.toHaveBeenCalled();
    expect(cookieGet).not.toHaveBeenCalled();
  });

  it("ignores navigation release failures and avoids empty releases", async () => {
    post.mockRejectedValueOnce(new Error("document closed"));
    await expect(releaseOnLeave("SKU-1")).resolves.toBeUndefined();
    post.mockClear();
    await releaseOnLeave(null);
    await releaseOnLeave("");
    expect(post).not.toHaveBeenCalled();
  });

  it("gets the product review using the authenticated enrichment client", async () => {
    const response = { data: { sku: "A/B", rounds_used: 1 } };
    enrichmentApi.get.mockResolvedValueOnce(response);
    expect(await getReviewProduct("A/B")).toBe(response);
    expect(enrichmentApi.get).toHaveBeenCalledWith("/api/integrator/v1/review/product/A%2FB/");
  });

  it("sends a product back with an optional reason", async () => {
    const response = { data: { n: 1, state: "waiting_ai" } };
    enrichmentApi.post.mockResolvedValueOnce(response);
    const body = { sku: "SKU-1", reason: "Check the weight" };
    expect(await sendBack(body)).toBe(response);
    expect(enrichmentApi.post).toHaveBeenCalledWith("/api/integrator/v1/review/send-back/", body);
    await sendBack({ sku: "SKU-1" });
    expect(enrichmentApi.post).toHaveBeenLastCalledWith("/api/integrator/v1/review/send-back/", { sku: "SKU-1" });
  });

  it("gets missing attributes for the encoded SKU", async () => {
    const response = { data: [{ feature_idx: "weight", kind: "number" }] };
    enrichmentApi.get.mockResolvedValueOnce(response);
    expect(await getMissing("A/B")).toBe(response);
    expect(enrichmentApi.get).toHaveBeenCalledWith("/api/integrator/v1/review/missing/A%2FB/");
  });

  it("fills one missing attribute with the contract body", async () => {
    const response = { data: { id: 42 } };
    enrichmentApi.post.mockResolvedValueOnce(response);
    const body = { sku: "SKU-1", feature_idx: "weight", value: "12" };
    expect(await fillMissing(body)).toBe(response);
    expect(enrichmentApi.post).toHaveBeenCalledWith("/api/integrator/v1/review/fill/", body);
  });
});
