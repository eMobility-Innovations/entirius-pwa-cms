import { describe, it, expect, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import BasicMenu from "@/boots/BasicMenu/index.vue";

const ITEMS = [
  { key: "edit", label: "Edytuj", icon: "edit" },
  { key: "duplicate", label: "Duplikuj", icon: "duplicate", disabled: true },
  { key: "sep", separator: true },
  { key: "delete", label: "Usuń", icon: "delete", danger: true },
];
const key = (target, name) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));

describe("BasicMenu", () => {
  const wrappers = [];
  const mountMenu = (props = {}, slots = {}) => {
    const wrapper = mount(BasicMenu, {
      props: { items: ITEMS, label: "Akcje strony", ...props },
      slots: { trigger: "<button class='trigger'>Więcej</button>", ...slots },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const trigger = () => document.querySelector(".trigger");
  const menu = () => document.querySelector('[role="menu"], [role="dialog"]');
  const items = () => [...document.querySelectorAll('[role="menuitem"]')];
  const open = async () => {
    trigger().click();
    await nextTick();
    await nextTick();
  };

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("sets the trigger's aria-haspopup / aria-expanded / aria-controls and toggles on its click", async () => {
    mountMenu();
    await nextTick();
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().getAttribute("aria-controls")).toBe(menu().id);
    await open();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(menu().style.display).not.toBe("none");
    expect(menu().getAttribute("aria-label")).toBe("Akcje strony");
    trigger().click();
    await nextTick();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("renders menuitems with icons, a separator and a danger item; focus starts on the first", async () => {
    mountMenu();
    await open();
    expect(items().map((item) => item.textContent.trim())).toEqual(["Edytuj", "Duplikuj", "Usuń"]);
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(items()[2].classList).toContain("basic-menu__item--danger");
    expect(items()[1].getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(items()[0]);
  });

  it("a heading item is a caption: not a menuitem, never focused", async () => {
    mountMenu({ items: [{ key: "who", heading: true, label: "admin" }, ...ITEMS] });
    await open();
    expect(document.querySelector(".basic-menu__heading").textContent).toBe("admin");
    expect(items()).toHaveLength(3);
    expect(document.activeElement).toBe(items()[0]);
  });

  it("arrows skip the disabled item and wrap; Home / End jump", async () => {
    mountMenu();
    await open();
    key(document.activeElement, "ArrowDown");
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement, "ArrowDown");
    expect(document.activeElement).toBe(items()[0]);
    key(document.activeElement, "ArrowUp");
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement, "Home");
    expect(document.activeElement).toBe(items()[0]);
    key(document.activeElement, "End");
    expect(document.activeElement).toBe(items()[2]);
  });

  it("choosing emits select and closes with focus back on the trigger; a disabled item does nothing", async () => {
    const wrapper = mountMenu();
    await open();
    items()[1].click();
    expect(wrapper.emitted("select")).toBeUndefined();
    items()[2].click();
    await nextTick();
    expect(wrapper.emitted("select")[0][0].key).toBe("delete");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("Esc closes and returns focus; a click outside closes; ArrowDown on the trigger opens", async () => {
    mountMenu();
    await open();
    key(document.activeElement, "Escape");
    await nextTick();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());

    key(trigger(), "ArrowDown");
    await nextTick();
    await nextTick();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await nextTick();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("the panel slot is a dialog named by label, focus on its first control", async () => {
    mountMenu({ items: [] }, { panel: "<p>Powiadomienia</p><button class='mark'>Oznacz</button>" });
    await nextTick();
    expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
    await open();
    expect(menu().getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(document.querySelector(".mark"));
  });

  it("a disabled `to` item is a button: it neither navigates nor selects", async () => {
    const wrapper = mountMenu({ items: [{ key: "go", label: "Idź", to: "/x", disabled: true }] });
    await open();
    expect(items()[0].tagName).toBe("BUTTON");
    items()[0].click();
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("sheet: a wide floating popover above a phone, an unpositioned bottom sheet on one", async () => {
    mountMenu({ items: [], sheet: true }, { panel: "<p>Stan</p>" });
    await open();
    expect(menu().classList).toContain("basic-menu__popover--sheet");
    expect(menu().classList).not.toContain("basic-menu__popover--bottom");
    expect(menu().style.position).toBe("fixed");
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";

    const phone = (query) => ({ matches: query === "(max-width: 768px)", addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal("matchMedia", phone);
    try {
      mountMenu({ items: [], sheet: true }, { panel: "<p>Stan</p>" });
      await open();
      expect(menu().classList).toContain("basic-menu__popover--bottom");
      expect(menu().style.position).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe("phone sheet: modal like BasicModal", () => {
    const phone = (query) => ({ matches: query === "(max-width: 768px)", addEventListener() {}, removeEventListener() {} });
    const backdrop = () => document.querySelector(".basic-menu__backdrop");
    // The trigger is not focused before the tap (a phone does not focus a tapped button): the sheet focuses it itself.
    const openSheet = async (props = { items: [] }, slots = { panel: "<button class='fix'>Fix</button>" }) => {
      vi.stubGlobal("matchMedia", phone);
      mountMenu({ sheet: true, ...props }, slots);
      await open();
      await nextTick();
    };
    const settle = async () => {
      await nextTick();
      await nextTick();
    };

    afterEach(() => vi.unstubAllGlobals());

    it("opens over a backdrop with the page locked and inert, focus inside", async () => {
      await openSheet();
      expect(backdrop().parentElement).toBe(document.body);
      expect(backdrop().contains(menu())).toBe(true);
      expect(document.body.style.overflow).toBe("hidden");
      expect(trigger().closest("[inert]")).not.toBeNull();
      expect(document.activeElement.classList).toContain("fix");
    });

    it("Esc closes it and focus returns to the trigger", async () => {
      await openSheet();
      key(document.activeElement, "Escape");
      await settle();
      expect(trigger().getAttribute("aria-expanded")).toBe("false");
      expect(backdrop()).toBeNull();
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(trigger());
    });

    it("a tap on the backdrop closes it on its click and focus returns to the trigger; a tap inside does not", async () => {
      await openSheet();
      menu().dispatchEvent(new Event("pointerdown", { bubbles: true }));
      menu().click();
      await settle();
      expect(trigger().getAttribute("aria-expanded")).toBe("true");
      backdrop().dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await settle();
      expect(trigger().getAttribute("aria-expanded")).toBe("true"); // the press alone: the tap's click is still to come
      backdrop().click();
      await settle();
      expect(trigger().getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(trigger());
    });

    it("a close without returnFocus (a panel link, store.panelOpen = false) returns focus to the trigger too", async () => {
      await openSheet();
      wrappers[0].vm.close();
      await settle();
      expect(trigger().getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(trigger());
    });

    it("in items mode focus starts on the first item and Tab keeps it inside, on the sheet itself", async () => {
      await openSheet({ items: ITEMS }, {});
      expect(document.activeElement).toBe(items()[0]);
      key(document.activeElement, "Tab");
      expect(document.activeElement).toBe(menu());
      key(document.activeElement, "Escape");
      await settle();
      expect(document.activeElement).toBe(trigger());
    });

    it("a panel with no focusable content keeps focus on the sheet", async () => {
      await openSheet({ items: [] }, { panel: "<p>All checks passed</p>" });
      expect(document.activeElement).toBe(menu());
      key(document.activeElement, "Tab");
      expect(document.activeElement).toBe(menu());
    });

    it("a closed phone sheet renders no backdrop layer: the popover is back in the menu", async () => {
      await openSheet();
      wrappers[0].vm.close();
      await settle();
      expect(backdrop()).toBeNull();
      expect(menu().closest(".basic-menu")).toBe(wrappers[0].element);
    });

    it("a trigger with no focusable control leaves focus on the menu after close, never on <body>", async () => {
      await openSheet({ items: [] }, { trigger: "<button class='trigger' disabled>Więcej</button>" });
      wrappers[0].vm.open();
      await settle();
      expect(backdrop()).not.toBeNull();
      key(document.activeElement, "Escape");
      await settle();
      expect(document.activeElement).toBe(wrappers[0].element);
    });

    // Plan 61e: the fallback leaves no focusable span behind once focus moves on.
    it("the menu stops being focusable once focus leaves it after the fallback", async () => {
      await openSheet({ items: [] }, { trigger: "<span class='trigger'>Więcej</span>" });
      wrappers[0].vm.open();
      await settle();
      key(document.activeElement, "Escape");
      await settle();
      const root = wrappers[0].element;
      expect(document.activeElement).toBe(root);
      expect(root.getAttribute("tabindex")).toBe("-1");
      root.blur();
      expect(root.hasAttribute("tabindex")).toBe(false);
    });

    it("keeps the fallback while focus is in the sheet, drops it when focus moves on to the page", async () => {
      await openSheet({ items: [] }, { trigger: "<span class='trigger'>Więcej</span>", panel: "<button class='fix'>Fix</button>" });
      wrappers[0].vm.open();
      await settle();
      const root = wrappers[0].element;
      expect(document.activeElement).toBe(menu().querySelector(".fix"));
      expect(root.getAttribute("tabindex")).toBe("-1");
      key(document.activeElement, "Escape");
      await settle();
      expect(document.activeElement).toBe(root);
      const outside = document.body.appendChild(document.createElement("button"));
      outside.focus();
      expect(root.hasAttribute("tabindex")).toBe(false);
      outside.remove();
    });
  });

  describe("an open sheet crossing the phone breakpoint (a rotation)", () => {
    // A matchMedia whose phone query flips on `rotate(true | false)`, notifying its listeners like a browser.
    const viewport = () => {
      const listeners = new Set();
      const media = {
        matches: false,
        addEventListener: (_, fn) => listeners.add(fn),
        removeEventListener() {},
      };
      vi.stubGlobal("matchMedia", () => media);
      return async (phone) => {
        media.matches = phone;
        listeners.forEach((fn) => fn({ matches: phone }));
        await nextTick();
        await nextTick();
      };
    };
    const Panel = {
      mounted: vi.fn(),
      template: "<button class='fix'>Fix</button>",
    };
    const mountSheet = () => mountMenu({ items: [], sheet: true }, { panel: Panel });

    afterEach(() => {
      vi.unstubAllGlobals();
      Panel.mounted.mockClear();
    });

    it("to a phone: the same panel moves onto the backdrop, trapped; Esc returns focus to the trigger", async () => {
      const rotate = viewport();
      mountSheet();
      await open();
      const panel = document.querySelector(".fix");
      await rotate(true);
      expect(document.querySelector(".basic-menu__backdrop").contains(panel)).toBe(true);
      expect(Panel.mounted).toHaveBeenCalledTimes(1);
      expect(trigger().closest("[inert]")).not.toBeNull();
      expect(document.activeElement).toBe(panel);
      key(document.activeElement, "Escape");
      await nextTick();
      await nextTick();
      expect(document.activeElement).toBe(trigger());
    });

    it("to a desktop: the same panel moves back into the menu, open, with the page no longer inert", async () => {
      const rotate = viewport();
      await rotate(true);
      mountSheet();
      await open();
      const panel = document.querySelector(".fix");
      await rotate(false);
      expect(document.querySelector(".basic-menu__backdrop")).toBeNull();
      expect(panel.isConnected && panel.closest(".basic-menu")).toBe(wrappers[0].element);
      expect(Panel.mounted).toHaveBeenCalledTimes(1);
      expect(trigger().getAttribute("aria-expanded")).toBe("true");
      expect(document.querySelector("[inert]")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });
  });

  it("a menu that is no sheet renders no layer: the popover is the menu's own child, nothing is teleported", async () => {
    const wrapper = mountMenu();
    await open();
    expect(menu().parentElement).toBe(wrapper.element);
    expect(wrapper.element.children).toHaveLength(2);
    expect(document.querySelector(".basic-menu__backdrop")).toBeNull();
  });

  it("every menu that is no sheet renders its popover through one shared in-place component", () => {
    const layerType = (wrapper) => wrapper.vm.$.subTree.children[1].type;
    const [first, second] = [mountMenu(), mountMenu()];
    expect(layerType(first)).toBe(layerType(second));
  });

  it("Esc on the trigger closes an open panel with nothing focusable", async () => {
    mountMenu({ items: [] }, { panel: "<p>Brak powiadomień</p>" });
    await open();
    key(trigger(), "Escape");
    await nextTick();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("inline: open in the page flow, a click on the trigger does not close it", async () => {
    mountMenu({ inline: true });
    await nextTick();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    trigger().click();
    await nextTick();
    expect(menu().style.display).not.toBe("none");
    expect(menu().style.position).toBe("");
  });

  it("inline with a top placement draws the drop-up state: the list above the trigger", () => {
    const up = mountMenu({ inline: true, placement: "top-start" });
    const down = mountMenu({ inline: true });
    expect(up.classes()).toContain("basic-menu--inline-up");
    expect(down.classes()).not.toContain("basic-menu--inline-up");
  });
});
