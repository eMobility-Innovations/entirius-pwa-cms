import { describe, it, expect, vi } from "vitest";
import { h } from "vue";
import { mount } from "@vue/test-utils";

import IconButton from "@/boots/IconButton/index.vue";

const mountIconButton = (props = {}, attrs = {}) =>
  mount(IconButton, { props: { icon: "delete", label: "Usuń", ...props }, attrs });
const mountButton = (props = {}, attrs = {}) => mountIconButton(props, attrs).find("button");

describe("IconButton", () => {
  it("draws the meaning's glyph, is named by label (aria-label) and shows it as its BasicTooltip", () => {
    const wrapper = mountIconButton();
    const button = wrapper.find("button");
    expect(button.find("font-awesome-icon-stub").attributes("icon")).toBe("trash-can");
    expect(button.attributes("aria-label")).toBe("Usuń");
    expect(button.attributes("title")).toBeUndefined();
    expect(button.attributes("type")).toBe("button");
    expect(wrapper.find('[role="tooltip"]').text()).toBe("Usuń");
    // The tip repeats the name: no second announcement.
    expect(button.attributes("aria-describedby")).toBeUndefined();
  });

  it("is ghost md by default; variant and size are classes", () => {
    expect(mountButton().classes()).toEqual(expect.arrayContaining(["icon-button--ghost", "icon-button--md"]));
    expect(mountButton({ variant: "outline", size: "lg" }).classes()).toEqual(
      expect.arrayContaining(["icon-button--outline", "icon-button--lg"])
    );
  });

  it("aria-pressed only on a toggle", () => {
    expect(mountButton().attributes("aria-pressed")).toBeUndefined();
    expect(mountButton({ pressed: false }).attributes("aria-pressed")).toBe("false");
    expect(mountButton({ pressed: true }).attributes("aria-pressed")).toBe("true");
  });

  it("emits click unless disabled, and passes data-testid to the button", async () => {
    const wrapper = mountIconButton({}, { "data-testid": "row-delete", class: "ml-2" });
    const button = wrapper.find("button");
    expect(button.attributes("data-testid")).toBe("row-delete");
    expect(button.classes()).toContain("ml-2");
    await button.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    await wrapper.setProps({ disabled: true });
    await button.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("emits click with the native event, whose currentTarget is the button while the listener runs", async () => {
    const seen = [];
    const wrapper = mountIconButton({ onClick: (event) => seen.push([event, event?.currentTarget]) });
    await wrapper.find("button").trigger("click");
    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toBeInstanceOf(MouseEvent);
    expect(seen[0][1]).toBe(wrapper.find("button").element);
  });

  it("stops the click at the button unless :stop is false", async () => {
    const onParent = vi.fn();
    const Parent = {
      props: ["stop"],
      render() {
        return h("div", { onClick: onParent }, [h(IconButton, { icon: "edit", label: "Edytuj", stop: this.stop })]);
      },
    };
    await mount(Parent, { props: { stop: true } }).find("button").trigger("click");
    expect(onParent).not.toHaveBeenCalled();
    await mount(Parent, { props: { stop: false } }).find("button").trigger("click");
    expect(onParent).toHaveBeenCalledTimes(1);
  });

  it("rejects an icon that is no meaning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountButton({ icon: "trash-can" });
    const messages = warn.mock.calls.map(([message]) => message);
    expect(messages.some((m) => m.includes('custom validator check failed for prop "icon"'))).toBe(true);
    warn.mockRestore();
  });
});
