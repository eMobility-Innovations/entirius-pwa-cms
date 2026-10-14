import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nextTick, reactive } from "vue";
import { mount, flushPromises } from "@vue/test-utils";

const route = reactive({ path: "/pages/content", meta: { panel: "pages" }, params: {}, query: {} });
vi.mock("vue-router", () => ({ useRoute: () => route, useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

const user = reactive({
  user: { username: "ops" },
  isSidebarCollapsed: false,
  theme: "dark",
  lang: "PL",
  hints: true,
  toggleSidebar: vi.fn(),
  setTheme: vi.fn(),
  setHints: vi.fn(),
  setLanguage: vi.fn(),
  logout: vi.fn(),
});
const health = reactive({ panelOpen: false });
vi.mock("@/stores/user", () => ({ useUserStore: () => user }));
vi.mock("@/stores/configHealth", () => ({ useConfigHealthStore: () => health }));
vi.mock("@/stores/quality", () => ({ useQualityStore: () => ({ available: true }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ pendingSuggestions: 0 }) }));
// django-access is not under test here: allow-all, as without the module.
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ can: () => true, canAny: () => true, ensureLoaded: () => Promise.resolve(), available: false, isStaff: true }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({
    loaded: true,
    healthAvailable: true,
    isPanelEnabled: (idx) => idx !== "stock",
    isModuleEnabled: (key) => ["leads", "communicator", "munin"].includes(key),
  }),
}));

import SidebarNav from "@/boots/SidebarNav/index.vue";
import SidebarNavItem from "@/boots/SidebarNav/SidebarNavItem.vue";
import MobileMenu from "@/boots/MobileMenu/index.vue";
import BottomTabBar from "@/boots/BottomTabBar/index.vue";
import UserMenu from "@/boots/UserMenu/index.vue";
import AppHeader from "@/boots/AppHeader/index.vue";
import { t } from "@/i18n";
import { panels } from "@/configs/access";

const RouterLink = {
  props: ["to"],
  template: "<a :href=\"typeof to === 'string' ? to : to.path\"><slot /></a>",
};
const global = { stubs: { RouterLink, ConfigHealthButton: true, NotificationBell: true } };
const wrappers = [];
const mountIt = (component, props = {}) => {
  const wrapper = mount(component, { props, global, attachTo: document.body });
  wrappers.push(wrapper);
  return wrapper;
};
const setViewport = (desktop) =>
  vi.stubGlobal("matchMedia", () => ({ matches: desktop, addEventListener: () => {}, removeEventListener: () => {} }));
const goTo = async (path, meta) => {
  route.path = path;
  route.meta = meta;
  await nextTick();
};

beforeEach(async () => {
  setViewport(true);
  await goTo("/pages/content", { panel: "pages" });
  user.isSidebarCollapsed = false;
  vi.clearAllMocks();
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("SidebarNav", () => {
  const groupButton = (wrapper, label) => wrapper.findAll("button[aria-expanded]").find((b) => b.text() === label);

  it("is the panels landmark (shell.panels) with the harness ids; Home, then every panel in registry order", () => {
    const nav = mountIt(SidebarNav).get("nav");
    expect(nav.attributes("aria-label")).toBe("shell.panels");
    expect(nav.attributes("data-testid")).toBe("app-sidebar");
    expect(nav.attributes("data-fid")).toBe("sidebar");
    const rows = nav.findAll(":scope > div > ul > li").map((li) => li.find(".sidebar-nav-item__label").text());
    expect(rows).toEqual(["nav.home", ...panels.map((p) => t(p.labelKey))]);
  });

  it("opens the active panel's group and marks its entry aria-current; nothing else is current", () => {
    const wrapper = mountIt(SidebarNav);
    expect(groupButton(wrapper, t("panels.pages")).attributes("aria-expanded")).toBe("true");
    expect(groupButton(wrapper, t("panels.pim")).attributes("aria-expanded")).toBe("false");
    const current = wrapper.findAll("[aria-current='page']");
    expect(current.map((a) => a.attributes("href"))).toEqual(["/pages/content"]);
  });

  it("lights Home on / and a detail page's entry through the resolver (current section, not page)", async () => {
    const wrapper = mountIt(SidebarNav);
    await goTo("/", {});
    expect(wrapper.find("[aria-current='page']").attributes("href")).toBe("/");
    await goTo("/points/5", { panel: "points", navParent: "/points/list" });
    expect(wrapper.find("[aria-current='page']").exists()).toBe(false);
    expect(wrapper.get("[aria-current='true']").attributes("href")).toBe("/points/list");
  });

  it("rail and flat: the active panel's link is the page on its root, the section below it", async () => {
    const flat = mountIt(SidebarNav, { flat: true });
    const pages = () => flat.findAll("a").find((a) => a.text() === t("panels.pages"));
    expect(pages().attributes("aria-current")).toBe("page");
    await goTo("/pages/gallery", { panel: "pages" });
    expect(pages().attributes("aria-current")).toBe("true");
  });

  it("with the collapsed prop the footer toggle reports v-model and writes no preference", async () => {
    const wrapper = mountIt(SidebarNav, { collapsed: true });
    await wrapper.get(".sidebar-nav__footer button").trigger("click");
    expect(wrapper.emitted("update:collapsed")).toEqual([[false]]);
    expect(user.toggleSidebar).not.toHaveBeenCalled();
  });

  it("a group button toggles its list (Enter / Space are native button clicks) and controls it", async () => {
    const wrapper = mountIt(SidebarNav);
    const pim = groupButton(wrapper, t("panels.pim"));
    expect(document.getElementById(pim.attributes("aria-controls"))).toBe(null);
    await pim.trigger("click");
    expect(pim.attributes("aria-expanded")).toBe("true");
    expect(document.getElementById(pim.attributes("aria-controls")).tagName).toBe("UL");
    await pim.trigger("click");
    expect(pim.attributes("aria-expanded")).toBe("false");
  });

  it("a single-entry panel is a leaf link without a chevron; a locked panel is not focusable", () => {
    const wrapper = mountIt(SidebarNav);
    const orders = wrapper.findAll("a").find((a) => a.text() === t("panels.checkout_orders"));
    expect(orders.attributes("href")).toBe("/checkout-orders/orders");
    const locked = wrapper.find("[aria-disabled='true']");
    expect(locked.text()).toContain(t("panels.stock"));
    expect(locked.text()).toContain("shell.locked");
    expect(locked.element.matches("a, button, [tabindex]")).toBe(false);
  });

  it("a locked panel in the rail stays out of the tab order and keeps its name for screen readers", () => {
    user.isSidebarCollapsed = true;
    const locked = mountIt(SidebarNav).get("[aria-disabled='true']");
    expect(locked.element.closest("[tabindex]")).toBe(null);
    expect(locked.text()).toContain(t("panels.stock"));
  });

  it("the collapsed rail shows icon links named by aria-label; the footer toggle reports and flips the state", async () => {
    user.isSidebarCollapsed = true;
    const wrapper = mountIt(SidebarNav);
    expect(wrapper.find("nav").classes()).toContain("sidebar-nav--collapsed");
    expect(wrapper.find("a").attributes("aria-label")).toBe("nav.home");
    expect(wrapper.find("a .sidebar-nav-item__label").exists()).toBe(false);
    const toggle = wrapper.get(".sidebar-nav__footer button");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(toggle.attributes("aria-controls")).toBe(wrapper.get("nav").attributes("id"));
    await toggle.trigger("click");
    expect(user.toggleSidebar).toHaveBeenCalledOnce();
  });

  it("flat: no title, no footer, no harness ids; every panel one link to its root", () => {
    const wrapper = mountIt(SidebarNav, { flat: true });
    expect(wrapper.find(".sidebar-nav__title").exists()).toBe(false);
    expect(wrapper.find(".sidebar-nav__footer").exists()).toBe(false);
    expect(wrapper.get("nav").attributes("data-testid")).toBeUndefined();
    expect(wrapper.find("button[aria-expanded]").exists()).toBe(false);
    expect(wrapper.findAll("a").find((a) => a.text() === t("panels.pim")).attributes("href")).toBe("/pim/products");
  });
});

describe("SidebarNavItem", () => {
  it("a level-2 active link is aria-current with the accent rail class", () => {
    const item = mountIt(SidebarNavItem, { label: "List", icon: "file", to: "/pages/content", level: 2, active: true }).get("a");
    expect(item.attributes("aria-current")).toBe("page");
    expect(item.classes()).toEqual(expect.arrayContaining(["sidebar-nav-item--l2", "sidebar-nav-item--active"]));
  });
});

describe("MobileMenu", () => {
  const opener = () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    return button;
  };

  it("is a modal dialog: focus on its close button, Tab cycles inside, Esc closes and focus returns", async () => {
    const menuButton = opener();
    const wrapper = mountIt(MobileMenu, { open: true, id: "menu-x" });
    await flushPromises();
    const dialog = document.getElementById("menu-x");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement.classList).toContain("mobile-menu__close");
    const close = document.activeElement;
    const last = [...dialog.querySelectorAll("a[href]")].at(-1);
    last.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    await wrapper.setProps({ open: false });
    await flushPromises();
    expect(document.activeElement).toBe(menuButton);
  });

  it("closes on navigation, on a link to the page already open, and from its close button", async () => {
    const wrapper = mountIt(MobileMenu, { open: true });
    await flushPromises();
    await goTo("/pim/products", { panel: "pim" });
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    document.querySelector(".mobile-menu__panel a[href]").click();
    expect(wrapper.emitted("update:open")).toHaveLength(2);
    document.querySelector(".mobile-menu__close").click();
    expect(wrapper.emitted("update:open")).toHaveLength(3);
  });

  it("inline: in the page flow, no trap, no close button", async () => {
    const before = document.activeElement;
    const wrapper = mountIt(MobileMenu, { open: true, inline: true });
    await flushPromises();
    expect(wrapper.find(".mobile-menu__close").exists()).toBe(false);
    expect(document.activeElement).toBe(before);
  });
});

describe("BottomTabBar", () => {
  it("lists the current panel's entries on a phone, named by the panel, the lit one aria-current", async () => {
    setViewport(false);
    await goTo("/leads/companies/7", { panel: "leads" });
    const nav = mountIt(BottomTabBar).get("nav");
    expect(nav.attributes("aria-label")).toBe("Leads");
    expect(nav.attributes("data-fid")).toBe("tab-bar");
    expect(nav.findAll("a").map((a) => a.attributes("href"))).toEqual(["/leads/inbox", "/leads/settings"]);
    expect(nav.get("[aria-current='page']").attributes("href")).toBe("/leads/inbox");
  });

  it("is hidden with one entry and on meta.noBottomBar", async () => {
    await goTo("/checkout-orders/orders", { panel: "checkout" });
    expect(mountIt(BottomTabBar).find("nav").exists()).toBe(false);
    await goTo("/leads/inbox/3", { panel: "leads", noBottomBar: true });
    expect(mountIt(BottomTabBar).find("nav").exists()).toBe(false);
  });
});

describe("UserMenu", () => {
  const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
  const labels = () => [...document.querySelectorAll(ITEMS)].map((el) => el.textContent.trim());
  const item = (text) => [...document.querySelectorAll(ITEMS)].find((el) => el.textContent.includes(text));

  it("opens from a named trigger with aria-haspopup=menu: theme names its target, languages, health, password, logout", async () => {
    const wrapper = mountIt(UserMenu);
    const trigger = wrapper.get("[data-fid='user-button']");
    expect(trigger.attributes("aria-label")).toBe("ops");
    await flushPromises();
    expect(trigger.attributes("aria-haspopup")).toBe("menu");
    await trigger.trigger("click");
    await flushPromises();
    expect(document.querySelector(".basic-menu__heading").textContent).toBe("ops");
    expect(labels()).toEqual([
      t("app.light_mode"),
      t("shell.field_hints"),
      "English",
      "Polski",
      t("config_health.title"),
      t("user.change_password"),
      t("app.log_out"),
    ]);
    const radios = [...document.querySelectorAll('[role="menuitemradio"]')];
    expect(radios.map((el) => [el.textContent.trim(), el.getAttribute("aria-checked")])).toEqual([
      ["English", "false"],
      ["Polski", "true"],
    ]);
  });

  it("field hints is a checkbox item, checked while hints are on; choosing it flips them", async () => {
    mountIt(UserMenu, { inline: true });
    await flushPromises();
    const hints = document.querySelector('[role="menuitemcheckbox"]');
    expect(hints.textContent.trim()).toBe(t("shell.field_hints"));
    expect(hints.getAttribute("aria-checked")).toBe("true");
    hints.click();
    expect(user.setHints).toHaveBeenCalledWith(false);
    user.hints = false;
    await flushPromises();
    expect(document.querySelector('[role="menuitemcheckbox"]').getAttribute("aria-checked")).toBe("false");
    user.hints = true;
  });

  it("the items act: theme flips, another language is set, health opens, logout logs out", async () => {
    mountIt(UserMenu, { inline: true });
    await flushPromises();
    item(t("app.light_mode")).click();
    expect(user.setTheme).toHaveBeenCalledWith("default");
    item("Polski").click();
    expect(user.setLanguage).not.toHaveBeenCalled();
    item("English").click();
    expect(user.setLanguage).toHaveBeenCalledWith("EN");
    item(t("config_health.title")).click();
    expect(health.panelOpen).toBe(true);
    item(t("app.log_out")).click();
    expect(user.logout).toHaveBeenCalledOnce();
  });
});

describe("AppHeader", () => {
  it("is the banner with the wordmark home link; desktop has no menu button", () => {
    const wrapper = mountIt(AppHeader, { mobile: false });
    expect(wrapper.get("header").attributes("data-fid")).toBe("header");
    expect(wrapper.get("[data-fid='logo']").attributes("href")).toBe("/");
    expect(wrapper.find("[aria-controls='app-mobile-menu']").exists()).toBe(false);
    expect(wrapper.find("h1, h2").exists()).toBe(false);
  });

  it("mobile: the menu button controls the menu, reports its state and toggles v-model", async () => {
    const wrapper = mountIt(AppHeader, { mobile: true, menuId: "m1" });
    const button = wrapper.get("[aria-controls='m1']");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("aria-label")).toBe("shell.menu");
    await button.trigger("click");
    expect(wrapper.emitted("update:menuOpen")).toEqual([[true]]);
    await wrapper.setProps({ menuOpen: true });
    expect(button.attributes("aria-expanded")).toBe("true");
    expect(button.attributes("aria-label")).toBe("shell.close_menu");
  });
});
