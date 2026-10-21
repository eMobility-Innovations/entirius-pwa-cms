import { describe, it, expect, afterEach } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

import BasicTooltip from "@/boots/BasicTooltip/index.vue";
import { hintsOn } from "@/composables/fieldHints";

describe("BasicTooltip", () => {
  const wrappers = [];
  const mountTip = (props = {}, slot = "<button class='control'>Zapisz</button>") => {
    const wrapper = mount(BasicTooltip, {
      props: { text: "Najpierw wybierz kraje", ...props },
      slots: { default: slot },
      attachTo: document.body,
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const bubble = (wrapper) => wrapper.find('[role="tooltip"]');

  afterEach(() => {
    hintsOn.value = true;
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
  });

  it("wraps its slot: the first focusable gets aria-describedby, the tip is hidden", async () => {
    const wrapper = mountTip();
    await nextTick();
    expect(wrapper.find(".control").attributes("aria-describedby")).toBe(bubble(wrapper).attributes("id"));
    expect(bubble(wrapper).isVisible()).toBe(false);
    expect(wrapper.attributes("tabindex")).toBeUndefined();
  });

  it("appends its id to the trigger's own aria-describedby", async () => {
    const wrapper = mountTip({}, "<button class='control' aria-describedby='hint'>Zapisz</button>");
    await nextTick();
    const id = bubble(wrapper).attributes("id");
    expect(wrapper.find(".control").attributes("aria-describedby")).toBe(`hint ${id}`);
  });

  it("re-evaluates on a text change: a tip equal to the trigger's name drops its id, a different one adds it", async () => {
    const wrapper = mountTip({ text: "Save" }, "<button class='control' aria-label='Save'>x</button>");
    await nextTick();
    expect(wrapper.find(".control").attributes("aria-describedby")).toBeUndefined();
    await wrapper.setProps({ text: "Save the draft first" });
    expect(wrapper.find(".control").attributes("aria-describedby")).toBe(bubble(wrapper).attributes("id"));
    await wrapper.setProps({ text: "Save" });
    expect(wrapper.find(".control").attributes("aria-describedby")).toBeUndefined();
  });

  it("shows on hover, hides on leave", async () => {
    const wrapper = mountTip();
    await wrapper.trigger("mouseenter");
    expect(bubble(wrapper).isVisible()).toBe(true);
    await wrapper.trigger("mouseleave");
    expect(bubble(wrapper).isVisible()).toBe(false);
  });

  it("a click on the trigger hides it until the pointer leaves (it would cover the menu the click opened)", async () => {
    const wrapper = mountTip({}, "<button class='control' @click.stop>Zapisz</button>");
    await wrapper.trigger("mouseenter");
    await wrapper.find(".control").trigger("click");
    expect(bubble(wrapper).isVisible()).toBe(false);
    await wrapper.trigger("mouseleave");
    await wrapper.trigger("mouseenter");
    expect(bubble(wrapper).isVisible()).toBe(true);
  });

  it("shows on keyboard focus, hides on Esc and on blur", async () => {
    const wrapper = mountTip();
    const control = wrapper.find(".control").element;
    control.focus();
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(true);
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(bubble(wrapper).isVisible()).toBe(false);
    control.blur();
    control.focus();
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(true);
    control.blur();
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(false);
  });

  it("help variant: a `?` button named „Pomoc”, described by the tip", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    const help = wrapper.find("button.basic-tooltip__help");
    expect(help.attributes("aria-label")).toBe("common.help");
    expect(help.attributes("aria-describedby")).toBe(bubble(wrapper).attributes("id"));
    expect(help.find(".basic-tooltip__mark").text()).toBe("?");
    expect(help.find(".basic-tooltip__mark").attributes("aria-hidden")).toBe("true");
  });

  it("help levels: subtle by default, important on request", () => {
    expect(mountTip({ variant: "help" }, "").find("button").classes()).toContain("basic-tooltip__help--subtle");
    const important = mountTip({ variant: "help", level: "important" }, "");
    expect(important.find("button").classes()).toContain("basic-tooltip__help--important");
  });

  it("takes a fixed tip id (FormField describes its control with it)", () => {
    const wrapper = mountTip({ variant: "help", tipId: "field-7-hint" }, "");
    expect(bubble(wrapper).attributes("id")).toBe("field-7-hint");
    expect(wrapper.find("button").attributes("aria-describedby")).toBe("field-7-hint");
  });

  it("help on touch: a tap toggles it, the emulated mouse hover does not; a tap elsewhere or Esc closes it", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    const tap = async (target) => {
      target.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));
      target.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
      await nextTick();
    };
    await tap(wrapper.find("button").element);
    await wrapper.trigger("mouseenter");
    expect(bubble(wrapper).isVisible()).toBe(true);
    await tap(wrapper.find("button").element);
    expect(bubble(wrapper).isVisible()).toBe(false);

    await tap(wrapper.find("button").element);
    await tap(document.body);
    expect(bubble(wrapper).isVisible()).toBe(false);

    await tap(wrapper.find("button").element);
    await wrapper.trigger("keydown", { key: "Escape" });
    expect(bubble(wrapper).isVisible()).toBe(false);
    await tap(wrapper.find("button").element);
    expect(bubble(wrapper).isVisible()).toBe(true);
  });

  it("help with a mouse: hover shows it, a click does not pin it", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    wrapper.element.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await wrapper.trigger("mouseenter");
    wrapper.find("button").element.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", bubbles: true }));
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(true);
    await wrapper.trigger("mouseleave");
    expect(bubble(wrapper).isVisible()).toBe(false);
  });

  it("help: keyboard focus opens it; an activation without a pointer (Enter, a screen reader) toggles it", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    const help = wrapper.find("button").element;
    help.focus();
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(true);
    help.blur();
    await nextTick();
    help.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(true);
    help.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(false);
  });

  it("help opened with Enter closes when Tab moves focus on", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    const next = document.body.appendChild(document.createElement("button"));
    const help = wrapper.find("button").element;
    help.focus();
    help.dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true }));
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(true);
    next.focus();
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(false);
  });

  it("help on a hybrid device: after a tap, a real mouse hover shows it again", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    const button = wrapper.find("button").element;
    button.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    button.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(false);
    wrapper.element.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    await wrapper.trigger("mouseenter");
    expect(bubble(wrapper).isVisible()).toBe(true);
  });

  it("a tapped hint goes when hints are switched off and stays closed when they come back", async () => {
    const wrapper = mountTip({ variant: "help" }, "");
    wrapper.find("button").element.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    await nextTick();
    hintsOn.value = false;
    await nextTick();
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
    hintsOn.value = true;
    await nextTick();
    expect(bubble(wrapper).isVisible()).toBe(false);
  });

  it("hints off (the account-menu switch) removes a help mark, never a plain tooltip", async () => {
    hintsOn.value = false;
    try {
      expect(mountTip({ variant: "help" }, "").find(".basic-tooltip").exists()).toBe(false);
      expect(mountTip().find(".control").exists()).toBe(true);
    } finally {
      hintsOn.value = true;
    }
  });

  it("a disabled control alone (disabled with a reason): the wrapper is the tab stop", async () => {
    const wrapper = mountTip({}, "<button class='control' disabled>Zapisz</button>");
    await nextTick();
    expect(wrapper.attributes("tabindex")).toBe("0");
    expect(wrapper.attributes("aria-describedby")).toBe(bubble(wrapper).attributes("id"));
  });

  it("open forces it shown", () => {
    expect(bubble(mountTip({ open: true })).isVisible()).toBe(true);
  });
});
