import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";

import ActionBar from "@/boots/ActionBar/index.vue";

const stubs = {
  BasicButton: {
    props: ["variant", "icon", "disabled", "loading", "type"],
    emits: ["click"],
    template: "<button class='stub-basic' :type='type' :data-variant='variant' @click=\"$emit('click')\"><slot /></button>",
  },
  IconButton: {
    props: ["icon", "label", "variant", "disabled"],
    emits: ["click"],
    template: "<button class='stub-icon' :data-icon='icon' :data-variant='variant' @click=\"$emit('click')\">{{ label }}</button>",
  },
};

const action = (role, label, extra = {}) => ({ key: label, label, role, onClick: vi.fn(), ...extra });
const mountBar = (actions, slots) => mount(ActionBar, { props: { actions }, slots, global: { stubs } });

describe("ActionBar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("orders utilities · secondary · danger · primary, the primary rightmost (R5)", () => {
    const wrapper = mountBar([
      action("primary", "Zapisz i publikuj"),
      action("danger", "Usuń"),
      action("secondary", "Zapisz szkic"),
      action("utility", "Ustawienia", { icon: "settings" }),
    ]);
    const labels = wrapper.findAll(".action-bar__actions button").map((b) => b.text());
    expect(labels).toEqual(["Ustawienia", "Zapisz szkic", "Usuń", "Zapisz i publikuj"]);
  });

  it("form: the button submits that form from outside it; without one it stays a plain button", () => {
    const wrapper = mountBar([action("secondary", "Wersje"), action("primary", "Zapisz", { form: "edit-form" })]);
    const [versions, save] = wrapper.findAll(".stub-basic");
    expect(save.attributes()).toMatchObject({ type: "submit", form: "edit-form" });
    expect(versions.attributes("type")).toBe("button");
    expect(versions.attributes("form")).toBeUndefined();
  });

  it("expanded: aria-expanded on the button only when the action sets it", () => {
    const wrapper = mountBar([action("secondary", "Nowa wersja", { expanded: false }), action("primary", "Zapisz")]);
    const [toggle, save] = wrapper.findAll(".stub-basic");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(save.attributes("aria-expanded")).toBeUndefined();
  });

  it("a utility is an IconButton, the others BasicButtons of their role", () => {
    const wrapper = mountBar([action("utility", "Ustawienia", { icon: "settings" }), action("danger", "Usuń")]);
    expect(wrapper.find(".stub-icon").attributes("data-icon")).toBe("settings");
    expect(wrapper.find(".stub-basic").attributes("data-variant")).toBe("danger");
  });

  it("a utility is an outline IconButton unless it names its variant (an icon-only delete is danger)", () => {
    const wrapper = mountBar([
      action("utility", "Tłumaczenia", { icon: "translate" }),
      action("utility", "Usuń", { icon: "delete", variant: "danger" }),
    ]);
    expect(wrapper.findAll(".stub-icon").map((b) => b.attributes("data-variant"))).toEqual(["outline", "danger"]);
  });

  it("calls the action's onClick", async () => {
    const save = action("primary", "Zapisz");
    await mountBar([save]).find(".stub-basic").trigger("click");
    expect(save.onClick).toHaveBeenCalledOnce();
  });

  it("carries the visible label 'Akcje' for the mobile row and appends slot content", () => {
    const wrapper = mountBar([], { default: "<button class='own'>Own</button>" });
    expect(wrapper.find(".action-bar__label").text()).toBe("common.actions");
    expect(wrapper.find(".action-bar__actions .own").exists()).toBe(true);
  });

  it("warns in dev when more than one primary is given", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountBar([action("primary", "Zapisz")]);
    expect(warn).not.toHaveBeenCalled();
    mountBar([action("primary", "Zapisz"), action("primary", "Publikuj")]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("2 primary actions"));
  });

  it("drops the actions caption where it sits in its own footer (a dialog)", () => {
    expect(mountBar([action("primary", "Start")]).find(".action-bar__label").exists()).toBe(true);
    const bare = mount(ActionBar, { props: { actions: [action("primary", "Start")], labelled: false }, global: { stubs } });
    expect(bare.find(".action-bar__label").exists()).toBe(false);
  });
});
