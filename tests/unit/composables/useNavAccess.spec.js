import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

// Plan 18: the nav drops panels and entries the user cannot read; a module that is off keeps its dimmed card.
const readable = new Set();
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({
    can: (area) => readable.has(area),
    canAny: (areas = []) => areas.some((area) => readable.has(area)),
  }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ loaded: true, isPanelEnabled: (idx) => idx !== "faq", isModuleEnabled: () => true }),
}));
vi.mock("@/stores/user", () => ({ useUserStore: () => ({ isAuth: true }) }));

import router from "@/router";
import { buildNavRoutes, filterNavRoutes } from "@/components/Navigation/nav-routes";
import { usePanels, withAreas } from "@/composables/useNav";

const entriesOf = (panel) =>
  filterNavRoutes(withAreas(buildNavRoutes(), router), {
    panel,
    isDesktop: true,
    qualityAvailable: true,
    isModuleEnabled: () => true,
    canRead: (area) => readable.has(area),
  }).map((entry) => entry.route);

const mountPanels = () => {
  let panels;
  mount(defineComponent({ setup: () => ((panels = usePanels()), () => h("div")) }));
  return panels.value;
};

describe("nav × django-access", () => {
  beforeEach(() => readable.clear());

  it("an entry takes the meta.area of the route it opens", () => {
    const byRoute = Object.fromEntries(withAreas(buildNavRoutes(), router).map((entry) => [entry.route, entry.area]));
    expect(byRoute["/pim/categories"]).toBe("pim.categories");
    expect(byRoute["/atlas/find"]).toBe("lookup.search");
    expect(byRoute["/translation-jobs"]).toBeUndefined();
  });

  it("drops the entries whose area is not readable", () => {
    readable.add("pim.products");
    const pim = entriesOf("pim");
    expect(pim).toContain("/pim/products");
    expect(pim).not.toContain("/pim/categories");
  });

  it("keeps an entry without an area (its panel decides)", () => {
    expect(entriesOf("translation")).toEqual(["/translation-jobs"]);
  });

  it("hides a panel the user cannot read; a module that is off stays a dimmed card", () => {
    readable.add("pim.categories").add("faq.faq");
    const panels = mountPanels();
    expect(panels.map((panel) => panel.idx)).toEqual(["pim", "faq"]);
    expect(panels.find((panel) => panel.idx === "faq").isEnabled).toBe(false);
  });
});
