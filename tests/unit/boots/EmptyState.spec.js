import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import EmptyState from "@/boots/EmptyState/index.vue";
import DataTable from "@/boots/DataTable/index.vue";

const COLUMNS = [{ key: "name", label: "Name" }];
const emptyOf = (props) =>
  mount(DataTable, { props: { columns: COLUMNS, rows: [], ...props }, global: { stubs: { EmptyState } } }).find(
    ".empty-state"
  );

describe("EmptyState size", () => {
  it("keeps the full block unless asked for one line", () => {
    expect(mount(EmptyState, { props: { title: "x" } }).classes()).toContain("empty-state--md");
    expect(mount(EmptyState, { props: { title: "x", size: "sm" } }).classes()).toContain("empty-state--sm");
  });

  it("is one line in a table by default and the full block on a list screen", () => {
    expect(emptyOf({}).classes()).toContain("empty-state--sm");
    expect(emptyOf({ emptySize: "md" }).classes()).toContain("empty-state--md");
  });
});

describe("EmptyState icon", () => {
  const glyph = (icon) => mount(EmptyState, { props: { title: "x", icon } }).find("font-awesome-icon-stub").attributes("icon");

  it("takes a meaning of icons.js", () => {
    expect(glyph("history")).toBe("clock-rotate-left");
    expect(glyph("stock")).toBe("boxes-stacked");
  });
});
