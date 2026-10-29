import { describe, it, expect, vi } from "vitest";
import Builds from "@/views/Builder/Builds.vue";

// Plan 27 moved the content list's filter and language bindings out of the template: the chips filter the groups, the
// language select reloads the list in the picked language, and one ConfirmDialog serves every group's delete.
const docs = [
  { type: "static-page", data: [{ uid: "a" }] },
  { type: "blog-post", data: [] },
];

describe("Builds — content list bindings", () => {
  it("shows every group without a filter and only the picked types with one", () => {
    expect(Builds.computed.visibleDocs.call({ docs, activeFilters: [] })).toEqual(docs);
    expect(Builds.computed.visibleDocs.call({ docs, activeFilters: ["blog-post"] })).toEqual([docs[1]]);
  });

  it("offers the chips of the current content type only", () => {
    const user = { buildTypes: [{ slug: "static-page", _for: "content" }, { slug: "header", _for: "layout-extender" }] };
    expect(Builds.computed.buildTypes.call({ user, content_type: "content" })).toEqual([user.buildTypes[0]]);
    expect(Builds.computed.buildTypes.call({ user: null, content_type: "content" })).toEqual([]);
  });

  it("reloads the list in a new language and ignores the current one", () => {
    const replace = vi.fn(() => Promise.resolve());
    const vm = { language: "en", $router: { replace }, init: vi.fn() };
    Builds.methods.setLanguage.call(vm, "EN");
    expect(vm.init).not.toHaveBeenCalled();

    Builds.methods.setLanguage.call(vm, "PL");
    expect(replace).toHaveBeenCalledWith({ query: { lg: "pl" } });
    expect(vm.init).toHaveBeenCalledWith({ language: "PL" });
  });

  it("deletes the row the dialog was opened for, after the confirm", () => {
    const vm = { confirmation_modal: false, to_remove: null, removeDoc: vi.fn() };
    Builds.methods.askRemove.call(vm, "blog-post", "b1");
    expect(vm.confirmation_modal).toBe(true);
    expect(vm.removeDoc).not.toHaveBeenCalled();

    Builds.methods.confirmRemove.call(vm);
    expect(vm.removeDoc).toHaveBeenCalledWith("blog-post", "b1");
    expect(vm.confirmation_modal).toBe(false);
  });
});

describe("Builds — clear filters", () => {
  it("empties the filters and keeps focus on the first chip", async () => {
    const focus = vi.fn();
    const vm = {
      activeFilters: ["blog-post"],
      $nextTick: () => Promise.resolve(),
      $el: { querySelector: () => ({ focus }) },
    };
    await Builds.methods.clearFilters.call(vm);
    expect(vm.activeFilters).toEqual([]);
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
