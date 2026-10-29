// Mocks the HTTP client, not the API wrappers: a wrapper that drops page/limit would loop on page 1.
import { describe, it, expect, vi } from "vitest";

// Backend StandardPagination: page_size 6 by default, `limit` param, max 100.
const TYPES = Array.from({ length: 8 }, (_, i) => ({ slug: `t${i}`, label: `T${i}` }));
function paginate(rows, params = {}) {
  const limit = Math.min(Number(params.limit) || 6, 100);
  const page = Number(params.page) || 1;
  return { data: { data: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, pages: Math.ceil(rows.length / limit), records: rows.length } } };
}
vi.mock("@/api/contentDB/client", () => ({
  api: {
    get: vi.fn(async (url, cfg = {}) => {
      if (url.endsWith("/content-types/")) return paginate(TYPES, cfg.params);
      const slug = url.split("/").filter(Boolean).pop();
      return paginate([{ uid: `u-${slug}`, name: slug, language: "pl", routes: [], is_published: true,
        content: { sections: { a: { faq_items: [{ question: `Unique ${slug}?`, answer: "x" }] } } } }], cfg.params);
    }),
  },
}));
vi.mock("@/api/faq/api", () => ({ GET_FaqItems: vi.fn() }));

import { loadContentOccurrences } from "@/views/Faq/duplicateSources";
import { findDuplicates } from "@/utils/faqDuplicates";

describe("content types over the real client", () => {
  it("reads 8 content types (page size 6) once each, so unique questions are no duplicates", async () => {
    const occ = await loadContentOccurrences("shop");
    expect(occ).toHaveLength(8);
    expect(findDuplicates(occ)).toHaveLength(0);
  });
});
