import { describe, it, expect, vi, afterEach } from "vitest";
import { h } from "vue";
import { mount } from "@vue/test-utils";

import BasicButton from "@/boots/BasicButton/index.vue";

describe("BasicButton", () => {
  const text = (props = {}, label = "Save") => mount(BasicButton, { props, slots: { default: label } });

  it("is md by default and sm on request", () => {
    expect(text().classes()).toContain("button-basic--md");
    expect(text({ size: "sm" }, "Edit").classes()).toContain("button-basic--sm");
  });

  it("a text button is secondary by default, not icon-only and carries no accessible-name attributes", () => {
    const wrapper = text();
    expect(wrapper.classes()).toContain("button-basic--secondary");
    expect(wrapper.classes()).not.toContain("button-basic--icon");
    expect(wrapper.attributes("aria-label")).toBeUndefined();
    expect(wrapper.text()).toBe("Save");
  });

  it("an icon-only button is a square named by label (aria-label and title)", () => {
    const wrapper = mount(BasicButton, { props: { icon: "delete", label: "Delete" } });
    expect(wrapper.classes()).toContain("button-basic--icon");
    expect(wrapper.attributes("aria-label")).toBe("Delete");
    expect(wrapper.attributes("title")).toBe("Delete");
    expect(wrapper.find("font-awesome-icon-stub").attributes("icon")).toBe("trash-can");
  });

  it("emits click unless disabled", async () => {
    const wrapper = mount(BasicButton, { props: { icon: "delete", label: "Delete" } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    await wrapper.setProps({ disabled: true });
    expect(wrapper.attributes("disabled")).toBeDefined();
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("emits click with the native event, whose currentTarget is the button while the listener runs", async () => {
    const seen = [];
    const Parent = {
      render() {
        return h(BasicButton, { onClick: (event) => seen.push([event, event?.currentTarget]) }, () => "Go");
      },
    };
    const wrapper = mount(Parent);
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
        return h("div", { onClick: onParent }, [h(BasicButton, { stop: this.stop }, () => "Go")]);
      },
    };
    await mount(Parent, { props: { stop: true } }).find("button").trigger("click");
    expect(onParent).not.toHaveBeenCalled();
    await mount(Parent, { props: { stop: false } }).find("button").trigger("click");
    expect(onParent).toHaveBeenCalledTimes(1);
  });

  it("a text button with label shows the text and is named by the label", () => {
    const wrapper = text({ label: "Edit product" }, "Edit");
    expect(wrapper.classes()).not.toContain("button-basic--icon");
    expect(wrapper.text()).toBe("Edit");
    expect(wrapper.attributes("aria-label")).toBe("Edit product");
    expect(wrapper.attributes("title")).toBe("Edit product");
  });

  describe("variant API", () => {
    const button = (props, label = "Zapisz szkic") => mount(BasicButton, { props, slots: { default: label } });

    it("the variant is a class, the label the default slot, the type button", () => {
      const wrapper = button({ variant: "danger-solid" });
      expect(wrapper.classes()).toEqual(
        expect.arrayContaining(["button-basic--danger-solid", "button-basic--labelled"])
      );
      expect(wrapper.classes()).not.toContain("button-basic--icon");
      expect(wrapper.text()).toBe("Zapisz szkic");
      expect(wrapper.attributes("type")).toBe("button");
      expect(button({ variant: "primary", type: "submit" }).attributes("type")).toBe("submit");
    });

    it("a meaning icon renders before the label through FontAwesome", () => {
      const wrapper = button({ variant: "secondary", icon: "saveDraft" });
      const icon = wrapper.find(".btn-icon font-awesome-icon-stub");
      expect(icon.attributes("icon")).toBe("floppy-disk");
      expect(wrapper.find(".btn-icon").element.nextElementSibling.textContent).toBe("Zapisz szkic");
      expect(wrapper.find("i").exists()).toBe(false);
    });

    it("loading swaps the icon for a spinner, disables and sets aria-busy", async () => {
      const wrapper = button({ variant: "primary", icon: "publish", loading: true });
      expect(wrapper.find(".button-basic__spinner").exists()).toBe(true);
      expect(wrapper.find("font-awesome-icon-stub").exists()).toBe(false);
      expect(wrapper.attributes("disabled")).toBeDefined();
      expect(wrapper.attributes("aria-busy")).toBe("true");
      await wrapper.trigger("click");
      expect(wrapper.emitted("click")).toBeUndefined();
    });

    it("disabled blocks the click; no aria-busy while idle", async () => {
      const wrapper = button({ variant: "ghost", disabled: true });
      expect(wrapper.attributes("disabled")).toBeDefined();
      expect(wrapper.attributes("aria-busy")).toBeUndefined();
      await wrapper.trigger("click");
      expect(wrapper.emitted("click")).toBeUndefined();
    });
  });

  describe("accessible-name warning", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });

    it("warns for an icon-only button without label, still a square", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const wrapper = mount(BasicButton, { props: { icon: "delete" } });
      expect(warn).toHaveBeenCalledOnce();
      expect(wrapper.classes()).toContain("button-basic--icon");
    });

    it("stays quiet for a named icon-only button and for a text button", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mount(BasicButton, { props: { icon: "close", label: "Close" } });
      text();
      expect(warn).not.toHaveBeenCalled();
    });

    it("is silent in a production build", () => {
      vi.stubEnv("NODE_ENV", "production");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mount(BasicButton, { props: { icon: "delete" } });
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
