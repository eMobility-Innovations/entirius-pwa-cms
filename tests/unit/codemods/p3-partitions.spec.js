// @vitest-environment node
// Node, not happy-dom: the codemods resolve their files from import.meta.url, a file: URL only under node.
import { describe, it, expect } from "vitest";
import { partitionFiles, partitionOf } from "../../../scripts/codemods/p3-partitions.mjs";

describe("p3 sweep partitions", () => {
  it("puts every view in the partition dev-plans § Streams names", () => {
    expect(partitionOf("src/views/Pim/ProductList.vue")).toBe(1);
    expect(partitionOf("src/functionals/Handy-kit/Handy-kit.vue")).toBe(1);
    expect(partitionOf("src/App.vue")).toBe(1);
    expect(partitionOf("src/views/Leads/Inbox.vue")).toBe(2);
    expect(partitionOf("src/views/Gallery.vue")).toBe(2);
  });

  it("leaves boots, the catalogue and non-SFC files to no sweep", () => {
    expect(partitionOf("src/boots/BasicButton/index.vue")).toBeNull();
    expect(partitionOf("src/views/UiCatalogue/sections/Icons.vue")).toBeNull();
    expect(partitionOf("src/router/index.js")).toBeNull();
  });

  it("splits the swept files into two disjoint sets", () => {
    const [one, two] = [partitionFiles(1), partitionFiles(2)];
    expect(one.length).toBeGreaterThan(0);
    expect(two.length).toBeGreaterThan(0);
    expect(one.filter((file) => two.includes(file))).toEqual([]);
    expect([...one, ...two].sort()).toEqual(partitionFiles());
  });
});
