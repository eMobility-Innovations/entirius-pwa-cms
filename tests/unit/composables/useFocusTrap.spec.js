import { describe, it, expect, afterEach } from "vitest";
import { defineComponent, h, nextTick, ref, Teleport } from "vue";
import { mount } from "@vue/test-utils";

import { useFocusTrap } from "@/composables/useFocusTrap";

// A teleported container with two buttons, trapped while `active`.
const Trapped = defineComponent({
  props: { active: Boolean, name: String, field: Boolean, lead: Boolean },
  setup(props) {
    const root = ref(null);
    useFocusTrap(root, { active: () => props.active });
    return () =>
      h(Teleport, { to: "body" }, [
        h("div", { ref: root, "data-trap": props.name }, [
          h("button", { id: `${props.name}-first` }, "first"),
          ...(props.lead
            ? [h("input", { type: "checkbox" }), h("input", { type: "radio" }), h("input", { readonly: true })]
            : []),
          props.field ? h("input", { id: `${props.name}-field` }) : null,
          h("button", { id: `${props.name}-last` }, "last"),
        ]),
      ]);
  },
});

const tab = (shiftKey = false) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }));
const byId = (id) => document.getElementById(id);

function opener() {
  const button = document.createElement("button");
  button.id = "opener";
  document.body.appendChild(button);
  button.focus();
  return button;
}

describe("useFocusTrap", () => {
  const wrappers = [];
  const mountTrap = (props) => {
    const wrapper = mount(Trapped, { props, attachTo: document.body });
    wrappers.push(wrapper);
    return wrapper;
  };

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  it("moves focus to the first focusable, cycles Tab / Shift+Tab inside, and gives focus back on release", async () => {
    const button = opener();
    const wrapper = mountTrap({ active: true, name: "a" });
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(byId("a-first"));

    byId("a-last").focus();
    tab();
    expect(document.activeElement).toBe(byId("a-first"));
    tab(true);
    expect(document.activeElement).toBe(byId("a-last"));

    await wrapper.setProps({ active: false });
    expect(document.activeElement).toBe(button);
  });

  it("starts in the first form field when the dialog has one, before Close", async () => {
    mountTrap({ active: true, name: "f", field: true });
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(byId("f-field"));
  });

  it("skips checkboxes, radios and read-only values for the first stop: the first editable field wins", async () => {
    mountTrap({ active: true, name: "l", field: true, lead: true });
    await nextTick();
    expect(document.activeElement).toBe(byId("l-field"));
  });

  it("marks the rest of <body> inert and locks the scroll while active; releases both", async () => {
    const button = opener();
    const wrapper = mountTrap({ active: true, name: "a" });
    await nextTick();
    await nextTick();
    expect(button.hasAttribute("inert")).toBe(true);
    expect(document.querySelector('[data-trap="a"]').hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");

    await wrapper.setProps({ active: false });
    expect(button.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("stacks: the last trap owns the keyboard, the one below resumes when it closes", async () => {
    opener();
    const outer = mountTrap({ active: true, name: "outer" });
    await nextTick();
    await nextTick();
    byId("outer-last").focus();
    const inner = mountTrap({ active: true, name: "inner" });
    await nextTick();
    await nextTick();

    expect(document.querySelector('[data-trap="outer"]').hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(byId("inner-first"));

    await inner.setProps({ active: false });
    expect(document.querySelector('[data-trap="outer"]').hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(byId("outer-last"));
    tab();
    expect(document.activeElement).toBe(byId("outer-first"));
    expect(document.body.style.overflow).toBe("hidden");
    await outer.setProps({ active: false });
    expect(document.body.style.overflow).toBe("");
  });

  it("calls onEscape of the top trap only", async () => {
    const escapes = { outer: 0, inner: 0 };
    const Counting = defineComponent({
      props: { name: String },
      setup(props) {
        const root = ref(null);
        useFocusTrap(root, { active: () => true, onEscape: () => (escapes[props.name] += 1) });
        return () => h(Teleport, { to: "body" }, [h("div", { ref: root }, [h("button", "x")])]);
      },
    });
    wrappers.push(mount(Counting, { props: { name: "outer" }, attachTo: document.body }));
    await nextTick();
    wrappers.push(mount(Counting, { props: { name: "inner" }, attachTo: document.body }));
    await nextTick();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(escapes).toEqual({ outer: 0, inner: 1 });
  });

  it("a trap closed under another one leaves the top one in charge: background stays inert, focus stays", async () => {
    const button = opener();
    const lower = mountTrap({ active: true, name: "lower" });
    await nextTick();
    await nextTick();
    mountTrap({ active: true, name: "upper" });
    await nextTick();
    await nextTick();
    await lower.setProps({ active: false });
    expect(button.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(byId("upper-first"));
  });

  it("ignores keys from an overlay teleported on top of it (a fullscreen editor)", async () => {
    opener();
    mountTrap({ active: true, name: "a" });
    await nextTick();
    await nextTick();
    const editor = document.createElement("div");
    document.body.appendChild(editor);
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    editor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("never activates while inactive (an inline overlay)", async () => {
    const button = opener();
    mountTrap({ active: false, name: "a" });
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute("inert")).toBe(false);
  });
});
