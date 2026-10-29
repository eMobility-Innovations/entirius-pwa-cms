import { describe, it, expect } from "vitest";
import { buildNavRoutes, filterNavRoutes, isNavActive } from "@/components/Navigation/nav-routes";

const routes = [
  { app: ["atlas"], route: "/atlas/list", labelKey: "nav.atlas_list" },
  {
    app: ["atlas"],
    route: "/atlas/find",
    labelKey: "nav.atlas_find",
    requiresModule: "lookup",
  },
];

describe("filterNavRoutes — requiresModule gating", () => {
  it("hides a requiresModule entry when the module is disabled", () => {
    const visible = filterNavRoutes(routes, {
      panel: "atlas",
      isModuleEnabled: () => false,
    });
    expect(visible.map((r) => r.route)).toEqual(["/atlas/list"]);
  });

  it("shows a requiresModule entry once the module is enabled", () => {
    const visible = filterNavRoutes(routes, {
      panel: "atlas",
      isModuleEnabled: (key) => key === "lookup",
    });
    expect(visible.map((r) => r.route)).toEqual(["/atlas/list", "/atlas/find"]);
  });

  it("hides a requiresModule entry when no isModuleEnabled callback is provided", () => {
    const visible = filterNavRoutes(routes, { panel: "atlas" });
    expect(visible.map((r) => r.route)).toEqual(["/atlas/list"]);
  });
});

// FIX-17b item 5: a page without an entry of its own lights the entry it belongs to — never nothing selected.
// UX-010: with communicator the Inbox entry owns both lists, so opening a company card never moves the lit entry.
const leadsEntries = (modules) =>
  filterNavRoutes(buildNavRoutes(), {
    panel: "leads",
    isDesktop: true,
    isModuleEnabled: (key) => modules.includes(key),
  });
const lit = (modules, path) =>
  leadsEntries(modules)
    .filter((route) => isNavActive(route, path))
    .map((route) => route.route);

describe("isNavActive — pages without an entry of their own", () => {
  it.each([
    ["/leads/conversations/23", "/leads/inbox"],
    ["/leads/inbox/51", "/leads/inbox"],
    ["/leads/companies", "/leads/inbox"],
    ["/leads/companies/new", "/leads/inbox"],
    ["/leads/companies/100", "/leads/inbox"],
    ["/leads/settings/sending", "/leads/settings"],
  ])("leads + communicator: %s lights %s only", (path, entry) => {
    expect(lit(["leads", "communicator"], path)).toEqual([entry]);
  });

  it("leads without communicator: a company card lights the Companies entry", () => {
    expect(lit(["leads"], "/leads/companies/100")).toEqual([
      "/leads/companies",
    ]);
  });
});
