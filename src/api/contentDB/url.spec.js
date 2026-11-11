import { describe, it, expect } from "vitest";

import { withTrailingSlash } from "@/api/contentDB/url";

describe("withTrailingSlash", () => {
  it("adds the slash a path lacks", () => {
    expect(withTrailingSlash("/routes/about")).toBe("/routes/about/");
    expect(withTrailingSlash("/attributes/color/values/7")).toBe("/attributes/color/values/7/");
  });

  it("leaves a path that already ends in a slash", () => {
    expect(withTrailingSlash("/routes/")).toBe("/routes/");
    expect(withTrailingSlash("/content-sets/")).toBe("/content-sets/");
  });

  it("keeps the slashes inside a route", () => {
    expect(withTrailingSlash("/routes/blog/x")).toBe("/routes/blog/x/");
  });

  it("puts the slash before the query string", () => {
    expect(withTrailingSlash("/page/home/1/published?all=true")).toBe("/page/home/1/published/?all=true");
    expect(withTrailingSlash("/page/home/1/published/?all=true")).toBe("/page/home/1/published/?all=true");
  });
});
