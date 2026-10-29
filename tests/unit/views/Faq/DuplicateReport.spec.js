import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/views/Faq/duplicateSources", () => ({
  loadFaqOccurrences: vi.fn(),
  loadContentOccurrences: vi.fn(),
}));

import { AREAS } from "@/configs/areas";
import DuplicateReport from "@/views/Faq/DuplicateReport.vue";
import {
  loadFaqOccurrences,
  loadContentOccurrences,
} from "@/views/Faq/duplicateSources";

const occurrence = (source) => ({
  question: "Co to OE?",
  language: null,
  source,
  name: source,
  routes: [],
  isPublished: true,
});

// The state object stands in for the component instance (computed and methods are called against it).
const makeState = (areas, { contentdb = true } = {}) => {
  const state = {
    groups: [],
    loading: false,
    loadFailed: false,
    contentStatus: null,
    $t: (key) => key,
    notify: { spawnNotification: vi.fn() },
    munin: { isModuleEnabled: () => contentdb },
    access: { can: (area) => areas.includes(area) },
  };
  Object.defineProperty(state, "includesPages", {
    get: () => DuplicateReport.computed.includesPages.call(state),
  });
  state.loadPages = DuplicateReport.methods.loadPages.bind(state);
  return state;
};

const run = (state) => DuplicateReport.methods.load.call(state);
const both = [AREAS.CONTENT_PAGES, AREAS.CONTENT_SCHEMA];

describe("duplicate report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFaqOccurrences.mockResolvedValue([occurrence("faq")]);
    loadContentOccurrences.mockResolvedValue([occurrence("Blog")]);
  });

  it("compares content too when pages and schema can be read", async () => {
    const state = makeState(both);
    await run(state);
    expect(loadContentOccurrences).toHaveBeenCalled();
    expect(state.groups[0].occurrences).toHaveLength(2);
  });

  it("without content.schema skips the content types request and says FAQ items only", async () => {
    const state = makeState([AREAS.CONTENT_PAGES]);
    await run(state);
    expect(loadContentOccurrences).not.toHaveBeenCalled();
    expect(DuplicateReport.computed.description.call(state)).toBe(
      "faq.duplicates_description_faq_only"
    );
  });

  it("a refused (403) content half falls back to FAQ items, with the FAQ-only notice and no error toast", async () => {
    loadContentOccurrences.mockRejectedValue({ response: { status: 403 } });
    loadFaqOccurrences.mockResolvedValue([
      occurrence("faq"),
      occurrence("faq"),
    ]);
    const state = makeState(both);
    await run(state);
    expect(state.groups).toHaveLength(1);
    expect(state.notify.spawnNotification).not.toHaveBeenCalled();
    expect(DuplicateReport.computed.description.call(state)).toBe(
      "faq.duplicates_description_faq_only"
    );
  });

  it("a failed (500) content half falls back to FAQ items and says the check failed", async () => {
    loadContentOccurrences.mockRejectedValue({ response: { status: 500 } });
    loadFaqOccurrences.mockResolvedValue([occurrence("faq"), occurrence("faq")]);
    const state = makeState(both);
    await run(state);
    expect(state.groups).toHaveLength(1);
    expect(state.loadFailed).toBe(false);
    expect(DuplicateReport.computed.description.call(state)).toBe("faq.duplicates_description_content_failed");
  });

  it("a failed FAQ items load is an error state, not an empty result", async () => {
    loadFaqOccurrences.mockRejectedValue({ response: { status: 500 } });
    const state = makeState(both);
    await run(state);
    expect(state.loadFailed).toBe(true);
    expect(state.groups).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.notify.spawnNotification).toHaveBeenCalled();
  });

  it("a second load while one runs is ignored", async () => {
    const state = makeState(both);
    const first = run(state);
    await run(state);
    await first;
    expect(loadFaqOccurrences).toHaveBeenCalledTimes(1);
  });
});
