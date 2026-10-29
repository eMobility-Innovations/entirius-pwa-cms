import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import SideDrawer from "@/boots/SideDrawer/index.vue";

describe("SideDrawer", () => {
  const wrappers = [];
  const mountDrawer = (props = {}) => {
    const wrapper = mount(SideDrawer, {
      props: { visible: true, title: "Tłumaczenia", ...props },
      slots: { default: "<button class='inside'>Pole</button>" },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const escape = (target = document) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("focused: a modal dialog named by its title, focus trapped on the close button, Esc closes", async () => {
    const wrapper = mountDrawer();
    await nextTick();
    await nextTick();
    const dialog = document.querySelector('.side-drawer-panel[role="dialog"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")).textContent).toBe("Tłumaczenia");
    expect(document.activeElement.getAttribute("data-testid")).toBe("side-drawer-close");
    escape();
    expect(wrapper.emitted("close")).toHaveLength(1);
    document.querySelector('[data-testid="side-drawer-close"]').click();
    expect(wrapper.emitted("close")).toHaveLength(2);
  });

  it("sticky: in the page flow, no trap; Esc inside closes it", async () => {
    const wrapper = mountDrawer({ mode: "sticky" });
    await nextTick();
    await nextTick();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    expect(document.activeElement).toBe(document.body);
    escape(wrapper.find(".inside").element);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("inline: the focused panel in place, not modal, no trap", async () => {
    const wrapper = mountDrawer({ inline: true });
    await nextTick();
    await nextTick();
    expect(wrapper.find(".side-drawer-panel").exists()).toBe(true);
    expect(wrapper.find(".side-drawer-panel").attributes("aria-modal")).toBeUndefined();
    escape();
    expect(wrapper.emitted("close")).toBeUndefined();
  });
});
