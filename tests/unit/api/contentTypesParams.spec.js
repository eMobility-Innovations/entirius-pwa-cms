import { describe, it, expect, vi } from "vitest";

vi.mock("@/api/contentDB/client", () => ({ api: { get: vi.fn(async () => ({ data: {} })) } }));

import { api } from "@/api/contentDB/client";
import { GET_ContentTypes } from "@/api/contentDB/api";

describe("GET_ContentTypes", () => {
  it("sends page and limit to the HTTP client, so a paged list can be walked", async () => {
    await GET_ContentTypes({ CDB_TYPE: "content", page: 2, limit: 100 });
    const [url, config] = api.get.mock.calls.at(-1);
    expect(url).toMatch(/\/content-types\/$/);
    expect(config.params).toEqual({ page: 2, limit: 100 });
  });

  it("callers without paging send no paging params", async () => {
    await GET_ContentTypes({ CDB_TYPE: "layout-extender" });
    const [, config] = api.get.mock.calls.at(-1);
    expect(config.params.page).toBeUndefined();
    expect(config.params.limit).toBeUndefined();
  });
});
