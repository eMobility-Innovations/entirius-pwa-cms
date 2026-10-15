import { describe, it, expect, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";

const mockGetTask = vi.fn((id) =>
  id === "9"
    ? Promise.reject(new Error("gone"))
    : Promise.resolve({ data: { id: Number(id), type: "pim.writer", params: { template: "desc" }, scope_spec: { refs: ["A", "B"] }, created_at: "2026-10-15T10:00:00Z" } })
);
vi.mock("@/api/enrichment/api", () => ({
  GET_Task: (id) => mockGetTask(id),
  GET_Workers: () => Promise.resolve({ data: [] }),
  GET_Templates: () => Promise.resolve({ data: { results: [{ key: "desc", label: "Opis produktu" }] } }),
  GET_Proposals: vi.fn(),
}));

import { useRunLabels } from "@/views/EnrichmentReview/useRunLabels";

describe("useRunLabels", () => {
  it("loads each run behind the rows once and labels it: what ran, what it covered, when", async () => {
    const { labels, load } = useRunLabels();
    await load([5, 5, "5", null, "", 9]);
    await flushPromises();
    await load([5, 9]);

    expect(mockGetTask.mock.calls.map(([id]) => id)).toEqual(["5", "9"]);
    expect(labels.value).toEqual({
      5: { name: "Opis produktu", title: "Opis produktu · 2 products", at: "2026-10-15T10:00:00Z" },
    });
  });
});
