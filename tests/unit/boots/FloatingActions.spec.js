import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

import FloatingActions from "@/boots/FloatingActions/index.vue";

const mountFab = (props = {}) => mount(FloatingActions, { props: { actions: [], ...props }, attachTo: document.body });

describe("FloatingActions", () => {
  it("the FAB carries the landmark id and toggles the speed-dial", async () => {
    const wrapper = mountFab({ actions: [{ icon: "add", label: "Dodaj", handler: vi.fn() }] });
    const fab = wrapper.find('[data-fid="fab"]');
    expect(fab.attributes("aria-expanded")).toBe("false");
    await fab.trigger("click");
    expect(fab.attributes("aria-expanded")).toBe("true");
    wrapper.unmount();
  });

  it("action icons take meaning keys only; a raw FontAwesome name is never looked up", () => {
    const wrapper = mountFab({
      open: true,
      actions: [
        { icon: "add", label: "Dodaj", handler: vi.fn() },
        { icon: "upload", label: "Wgraj", handler: vi.fn() },
      ],
    });
    const icons = wrapper.findAll(".floating-actions__action font-awesome-icon-stub").map((i) => i.attributes("icon"));
    expect(icons).toEqual(["plus", "file-arrow-up"]);
    wrapper.unmount();
  });

  it("renders the labelled pill next to the FAB and calls its handler", async () => {
    const handler = vi.fn();
    const wrapper = mountFab({ pill: { icon: "reorder", label: "Zarządzaj kolejnością", handler, testid: "reorder" } });
    const pill = wrapper.find('[data-testid="reorder"]');
    expect(pill.text()).toBe("Zarządzaj kolejnością");
    expect(pill.find("font-awesome-icon-stub").attributes("icon")).toBe("arrows-up-down");
    expect(pill.element.nextElementSibling.dataset.fid).toBe("fab");
    await pill.trigger("click");
    expect(handler).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("no pill without the prop", () => {
    const wrapper = mountFab();
    expect(wrapper.find(".floating-actions__pill").exists()).toBe(false);
    wrapper.unmount();
  });
});
