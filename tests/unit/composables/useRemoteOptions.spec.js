import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAllPages, useRemoteOptions } from "@/composables/useRemoteOptions";

const row = (i) => ({ idx: `c${i}`, name: `Cat ${i}` });
const toOption = (r) => ({ value: r.idx, label: r.name, description: r.idx });
const flush = async () => {
  await vi.advanceTimersByTimeAsync(350);
};

function make(overrides = {}) {
  const pages = { 1: { results: [row(1), row(2)], next: "n" }, 2: { results: [row(3)], next: null } };
  const fetchPage = vi.fn(async ({ page }) => pages[page] || { results: [], next: null });
  const resolveOne = vi.fn(async (idx) => ({ value: idx, label: `Resolved ${idx}` }));
  return { fetchPage, resolveOne, src: useRemoteOptions({ fetchPage, toOption, resolveOne, ...overrides }) };
}

describe("useRemoteOptions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("loads page 1 and offers load more while there is a next page", async () => {
    const { src } = make();
    await src.load();
    expect(src.options.map((o) => o.value)).toEqual(["c1", "c2"]);
    expect(src.moreLabel).not.toBe("");
  });

  it("appends the next page and drops the more row at the end", async () => {
    const { src, fetchPage } = make();
    await src.load();
    await src.loadMore();
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 2, page_size: 50 });
    expect(src.options.map((o) => o.value)).toEqual(["c1", "c2", "c3"]);
    expect(src.moreLabel).toBe("");
  });

  it("searches on the server, debounced, from page 1", async () => {
    const { src, fetchPage } = make();
    await src.load();
    src.onSearch("  ca ");
    src.onSearch("cat");
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await flush();
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenLastCalledWith({ search: "cat", page: 1, page_size: 50 });
  });

  it("ignores a stale response", async () => {
    let release;
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValueOnce({ results: [row(9)], next: null });
    const src = useRemoteOptions({ fetchPage, toOption });
    const first = src.load();
    await src.load();
    release({ results: [row(1)], next: null });
    await first;
    expect(src.options.map((o) => o.value)).toEqual(["c9"]);
  });

  it("keeps the label of a chosen value that is not on the loaded page", async () => {
    const { src, resolveOne } = make();
    await src.load();
    await src.track(["c77", "c1"]);
    expect(resolveOne).toHaveBeenCalledTimes(1);
    expect(src.options.map((o) => o.label)).toEqual(["Resolved c77", "Cat 1", "Cat 2"]);
  });

  it("falls back to the value when it cannot be resolved", async () => {
    const { src } = make({ resolveOne: vi.fn().mockRejectedValue(new Error("404")) });
    await src.track("gone");
    expect(src.options).toEqual([{ value: "gone", label: "gone" }]);
  });

  it("keeps a chosen option from an earlier search page", async () => {
    const { src } = make();
    await src.load();
    await src.track("c1");
    src.onSearch("zzz");
    await flush();
    expect(src.options.map((o) => o.value)).toContain("c1");
  });

  it("reload clears the options and resolves the chosen values again", async () => {
    const { src, resolveOne } = make();
    await src.track("c5");
    await src.reload();
    expect(resolveOne).toHaveBeenCalledTimes(2);
    expect(src.options[0].label).toBe("Resolved c5");
  });
});

describe("fetchAllPages", () => {
  it("follows next until the last page", async () => {
    const fetchPage = vi.fn(async ({ page }) => ({ results: [page], next: page < 3 ? "n" : null }));
    expect(await fetchAllPages(fetchPage)).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 3, page_size: 100 });
  });

  it("stops at maxPages", async () => {
    const fetchPage = vi.fn(async () => ({ results: [0], next: "n" }));
    expect(await fetchAllPages(fetchPage, { maxPages: 4 })).toHaveLength(4);
  });
});
