import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";

vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: (area) => area !== "rules" }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ pendingSuggestions: 3 }) }));

import RouteTabs from "@/components/Navigation/RouteTabs.vue";
import { routeTabPanel } from "@/components/Navigation/nav-routes";

const Page = { template: "<div />" };
const TABS = {
  idPrefix: "settings",
  sections: [
    { route: "Profile", labelKey: "nav.enrichment_profile", testid: "tab-profile" },
    { route: "Memory", labelKey: "nav.enrichment_memory", badge: "memorySuggestions", testid: "tab-memory" },
    { route: "Rules", labelKey: "nav.enrichment_spawn_rules", testid: "tab-rules" },
  ],
};

async function mountTabs(path = "/profile") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/profile", name: "Profile", component: Page, meta: { area: "profile" } },
      { path: "/memory", name: "Memory", component: Page, meta: { area: "profile" } },
      { path: "/rules", name: "Rules", component: Page, meta: { area: "rules" } },
    ],
  });
  router.push(path);
  await router.isReady();
  const wrapper = mount(RouteTabs, { props: { tabs: TABS }, global: { plugins: [router], stubs: { RouteTabs: false } } });
  return { wrapper, router };
}

describe("RouteTabs", () => {
  it("one tab per readable section, the current route's selected, a badge with its nav count", async () => {
    const { wrapper } = await mountTabs("/memory");
    const tabs = wrapper.findAll("[role='tab']");
    expect(tabs.map((tab) => tab.text())).toEqual(["Company profile", "Memory 3"]);
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual(["false", "true"]);
    expect(tabs[1].attributes("id")).toBe("settings-tab-Memory");
    expect(wrapper.find("[data-testid='tab-rules']").exists()).toBe(false);
  });

  it("picking a tab opens its route", async () => {
    const { wrapper, router } = await mountTabs();
    await wrapper.find("[data-testid='tab-memory']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("Memory");
  });

  it("the page body is the panel its tab controls", () => {
    expect(routeTabPanel(TABS, "Memory")).toEqual({
      role: "tabpanel", id: "settings-panel-Memory", "aria-labelledby": "settings-tab-Memory",
    });
  });
});
