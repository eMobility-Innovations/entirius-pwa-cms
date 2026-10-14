import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

const modules = new Set(["leads", "communicator", "lookup", "checkout_voucher"]);
// django-access is not under test here: allow-all, as without the module.
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ can: () => true, canAny: () => true, ensureLoaded: () => Promise.resolve(), available: false, isStaff: true }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({
    loaded: true,
    isPanelEnabled: (idx) => idx !== "stock",
    isModuleEnabled: (key) => modules.has(key),
    ensureLoaded: vi.fn(),
  }),
}));
vi.mock("@/stores/quality", () => ({ useQualityStore: () => ({ available: true }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ pendingSuggestions: 0 }) }));
vi.mock("@/stores/user", () => ({ useUserStore: () => ({ isAuth: true }) }));

import router from "@/router";
import { panels } from "@/configs/access";
import { t } from "@/i18n";
import {
  HOME,
  activePanelOf,
  buildCrumbs,
  crumbParents,
  goBackTo,
  navTree,
  panelList,
  resolveNavEntry,
  useBreadcrumbs,
} from "@/composables/useNav";

const ALL_MODULES = { qualityAvailable: true, isModuleEnabled: (key) => modules.has(key) };
const tree = (isDesktop = true) => navTree({ ...ALL_MODULES, isDesktop });
const resolve = (path) => router.resolve(path);
const litEntry = (path) => {
  const route = resolve(path);
  return resolveNavEntry(tree()[route.meta.panel], route)?.route ?? null;
};

describe("panelList", () => {
  it("keeps the registry order and marks each panel enabled or locked", () => {
    const list = panelList((idx) => idx !== "stock", false);
    expect(list.map((p) => p.idx)).toEqual(panels.map((p) => p.idx));
    expect(list.find((p) => p.idx === "stock").isEnabled).toBe(false);
    expect(list.find((p) => p.idx === "pim").isEnabled).toBe(true);
  });

  it("drops locked panels with the hide flag", () => {
    expect(panelList((idx) => idx !== "stock", true).map((p) => p.idx)).not.toContain("stock");
  });
});

describe("navTree", () => {
  it("groups the filtered entries per panel, every panel of the registry present", () => {
    const desktop = tree();
    expect(Object.keys(desktop)).toEqual(panels.map((p) => p.idx));
    expect(desktop.leads.map((e) => e.route)).toEqual(["/leads/inbox", "/leads/board", "/leads/import", "/leads/settings"]);
    expect(tree(false).leads.map((e) => e.route)).toEqual(["/leads/inbox", "/leads/settings"]);
  });

  it("single-entry panels have one entry (leaf links, decision 2)", () => {
    const single = Object.entries(tree()).filter(([, entries]) => entries.length === 1).map(([idx]) => idx);
    expect(single.sort()).toEqual(["accounts", "checkout", "emails", "promo", "stock", "translation"]);
  });

  // r05 §6: the tab bar has 5 slots at 393 px and no overflow design.
  it("no panel has more than 5 mobile entries, with every optional module on", () => {
    const crowded = Object.entries(tree(false)).filter(([, entries]) => entries.length > 5);
    expect(crowded.map(([idx]) => idx)).toEqual([]);
  });
});

describe("resolveNavEntry", () => {
  it.each([
    ["/pim/products", "/pim/products"],
    ["/pim/products/SKU-1", "/pim/products"],
    ["/emails/templates/order/5", "/emails"],
    ["/stock/manage", "/stock"],
    ["/pages/content/static-page", "/pages/content"],
    ["/leads/companies/100", "/leads/inbox"],
    ["/leads/settings/templates/3", "/leads/settings"],
  ])("%s lights %s", (path, entry) => {
    expect(litEntry(path)).toBe(entry);
  });

  // The detail and create pages whose path does not nest under their list (r05 §2).
  it.each([
    ["/points/create", "/points/list"],
    ["/points/5", "/points/list"],
    ["/forms/7", "/forms/list"],
    ["/agreements/create", "/agreements/list"],
    ["/agreements/terms", "/agreements/list"],
    ["/atlas/3", "/atlas/list"],
    ["/promo/create", "/promo/list"],
    ["/promo/voucher/5", "/promo/list"],
    ["/promo/9", "/promo/list"],
  ])("navParent: %s lights %s", (path, entry) => {
    expect(resolve(path).meta.navParent).toBe(entry);
    expect(litEntry(path)).toBe(entry);
  });

  it("every navParent names an entry of its own panel", () => {
    const desktop = tree();
    const dangling = router
      .getRoutes()
      .filter((r) => r.meta.navParent && !desktop[r.meta.panel].some((e) => e.route === r.meta.navParent))
      .map((r) => r.name);
    expect(dangling).toEqual([]);
  });

  it("exact beats activeOn beats navParent beats prefix", () => {
    const entries = [
      { route: "/a", app: ["x"] },
      { route: "/a/b", app: ["x"], activeOn: ["/a/b/c"] },
      { route: "/z", app: ["x"] },
    ];
    const at = (path, meta = {}) => resolveNavEntry(entries, { path, meta })?.route ?? null;
    expect(at("/a")).toBe("/a");
    expect(at("/a/b/c/d")).toBe("/a/b");
    expect(at("/a/b/x", { navParent: "/z" })).toBe("/z");
    expect(at("/a/b/x")).toBe("/a/b");
    expect(at("/q")).toBe(null);
  });
});

describe("activePanelOf", () => {
  it("is home on /, the route's panel elsewhere, null on a page without one", () => {
    expect(activePanelOf(resolve("/"))).toBe(HOME);
    expect(activePanelOf(resolve("/pim/products/SKU-1"))).toBe("pim");
    expect(activePanelOf(resolve("/ui"))).toBe(null);
  });
});

const panel = (idx) => panels.find((p) => p.idx === idx);
const crumbsAt = (path, title) => {
  const route = resolve(path);
  const entries = tree()[route.meta.panel] ?? [];
  return buildCrumbs(route, {
    panel: panel(route.meta.panel),
    entry: resolveNavEntry(entries, route),
    parents: crumbParents(route, router.getRoutes()),
    title,
  });
};

describe("buildCrumbs", () => {
  it("shows nothing on a panel's list (R3), on Home and outside a panel", () => {
    expect(crumbsAt("/pim/products")).toEqual([]);
    expect(crumbsAt("/stock/manage")).toEqual([]);
    expect(crumbsAt("/")).toEqual([]);
    expect(crumbsAt("/ui")).toEqual([]);
  });

  it("panel → entry → current page, the page title from the view or the route's titleKey", () => {
    const route = resolve("/pim/products/SKU-1");
    expect(crumbsAt("/pim/products/SKU-1")).toEqual([
      { label: t("panels.pim"), to: "/pim/products" },
      { label: t("nav.pim_products"), to: { path: "/pim/products", query: {} } },
      { label: t(route.meta.titleKey) },
    ]);
    expect(crumbsAt("/pim/products/SKU-1", "Blue shirt").at(-1)).toEqual({ label: "Blue shirt" });
  });

  it("keeps both crumbs when the panel root is the entry (Figma S6)", () => {
    const crumbs = crumbsAt("/pages/content/static-page", "Product Showcase");
    expect(crumbs.map((c) => c.label)).toEqual([t("panels.pages"), t("nav.content_list"), "Product Showcase"]);
  });

  it("drops the entry crumb when it reads the same as the panel (Promo)", () => {
    const crumbs = crumbsAt("/promo/7", "Summer sale");
    expect(crumbs).toEqual([{ label: t("panels.promo"), to: "/promo/list" }, { label: "Summer sale" }]);
  });

  it("walks meta.crumbParent with the params the parent takes", () => {
    const email = crumbsAt("/emails/templates/order/5");
    expect(email).toHaveLength(4);
    expect(email[2]).toEqual({
      label: t("emails.template_types"),
      to: { name: "EmailTemplateList", params: { emailType: "order" } },
    });
    const template = crumbsAt("/leads/settings/templates/3");
    expect(template.map((c) => c.to)).toEqual([
      "/leads/inbox",
      { path: "/leads/settings", query: {} },
      { name: "CommunicatorTemplates", params: {} },
      undefined,
    ]);
  });
});

describe("goBackTo", () => {
  const fakeRouter = () => ({ back: vi.fn(), push: vi.fn(), resolve: (to) => ({ path: to.path ?? to }) });
  afterEach(() => window.history.replaceState(null, ""));

  it("goes back in history when the previous entry is the target (keeps the list's filters)", () => {
    window.history.replaceState({ back: "/pim/products?page=3" }, "");
    const r = fakeRouter();
    goBackTo(r, { path: "/pim/products" });
    expect(r.back).toHaveBeenCalledOnce();
    expect(r.push).not.toHaveBeenCalled();
  });

  it("pushes the target after a deep link", () => {
    window.history.replaceState({ back: null }, "");
    const r = fakeRouter();
    goBackTo(r, { path: "/pim/products" });
    expect(r.push).toHaveBeenCalledWith({ path: "/pim/products" });
    expect(r.back).not.toHaveBeenCalled();
  });
});

describe("useBreadcrumbs", () => {
  let result;
  const Probe = defineComponent({
    setup() {
      result = useBreadcrumbs(() => "Order confirmation");
      return () => h("div");
    },
  });

  beforeEach(async () => {
    await router.push("/emails/templates/order/5");
    mount(Probe, { global: { plugins: [router] } });
    await flushPromises();
  });

  it("follows the route: crumbs, the last linked crumb as the back target", async () => {
    expect(result.crumbs.value.at(-1)).toEqual({ label: "Order confirmation" });
    expect(result.backTarget.value).toEqual({ name: "EmailTemplateList", params: { emailType: "order" } });
    await router.push("/emails");
    expect(result.crumbs.value).toEqual([]);
    expect(result.backTarget.value).toBe(null);
  });
});
