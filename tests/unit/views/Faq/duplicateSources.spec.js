import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/faq/api", () => ({ GET_FaqItems: vi.fn() }));
vi.mock("@/api/contentDB/api", () => ({ GET_Content: vi.fn(), GET_ContentTypes: vi.fn() }));

import { GET_FaqItems } from "@/api/faq/api";
import { GET_Content, GET_ContentTypes } from "@/api/contentDB/api";
import { loadFaqOccurrences, loadContentOccurrences } from "@/views/Faq/duplicateSources";

const faqSection = (question) => ({ core_type: "section-faq", faq_items: [{ question, answer: "…" }] });

describe("duplicate sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads every page of the channel's FAQ items, each question with a link to its item", async () => {
    GET_FaqItems.mockResolvedValueOnce({
      data: { next: "page=2", results: [{ id: 1, question: "Co to OE?", is_active: true, translations: [] }] },
    }).mockResolvedValueOnce({
      data: { next: null, results: [{ id: 2, question: "Co to ABS?", is_active: false, translations: [] }] },
    });

    const occurrences = await loadFaqOccurrences("shop");

    expect(GET_FaqItems).toHaveBeenNthCalledWith(1, "shop", { page: 1, page_size: 100 });
    expect(GET_FaqItems).toHaveBeenNthCalledWith(2, "shop", { page: 2, page_size: 100 });
    expect(occurrences).toEqual([
      {
        question: "Co to OE?",
        language: null,
        source: "faq",
        name: "Co to OE?",
        routes: [],
        isPublished: true,
        to: "/faq/items/1",
      },
    ]);
  });

  it("reads the drafts of every content type in the channel, with their publish state and Builder link", async () => {
    GET_ContentTypes.mockResolvedValue({ data: { data: [{ slug: "blog-post", label: "Blog post" }] } });
    GET_Content.mockResolvedValueOnce({
      data: {
        pagination: { pages: 2 },
        data: [{ uid: "u1", name: "Klocki", language: "pl", routes: ["klocki"], is_published: true,
          content: { sections: { a: faqSection("Co to OE?") } } }],
      },
    }).mockResolvedValueOnce({
      data: { pagination: { pages: 2 }, data: [{ uid: "u2", name: "Szkic", language: null, routes: [], is_published: false, content: {} }] },
    });

    const occurrences = await loadContentOccurrences("shop");

    expect(GET_Content).toHaveBeenNthCalledWith(1, { type: "blog-post", page: 1, limit: 100, channel: "shop" });
    expect(GET_Content).toHaveBeenNthCalledWith(2, { type: "blog-post", page: 2, limit: 100, channel: "shop" });
    expect(occurrences).toEqual([
      {
        question: "Co to OE?",
        language: "pl",
        source: "Blog post",
        name: "Klocki",
        routes: ["klocki"],
        isPublished: true,
        to: { name: "Builder", params: { content_type: "content", type: "blog-post", uid: "u1" }, query: { lg: "pl" } },
      },
    ]);
  });
});
