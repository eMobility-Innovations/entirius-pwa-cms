import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ isDefaultChannel: false }),
}));

import InheritanceField from "@/views/Pim/components/InheritanceField.vue";

const ConfirmStub = { name: "ConfirmDialog", props: ["open"], emits: ["confirm", "cancel"], template: "<div />" };

const mountField = (props = {}) =>
  mount(InheritanceField, {
    props: { inherited: true, language: "en", ...props },
    global: {
      mocks: { $t: (key) => key },
      stubs: {
        Tag: true,
        BasicButton: { template: "<button @click=\"$emit('click')\"><slot /></button>", emits: ["click"] },
        ConfirmDialog: ConfirmStub,
      },
    },
    slots: { default: "<span class='slot' />" },
  });

describe("InheritanceField", () => {
  it("emits toggle-override with override=true while inherited", async () => {
    const wrapper = mountField();
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("toggle-override")[0][0]).toEqual({ language: "en", override: true });
  });

  it("Inherit on an overridden language asks first and emits override=false only on confirm", async () => {
    const wrapper = mountField({ overriddenLangs: ["en"] });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("toggle-override")).toBeUndefined();
    expect(wrapper.findComponent(ConfirmStub).props("open")).toBe(true);

    await wrapper.findComponent(ConfirmStub).vm.$emit("confirm");
    expect(wrapper.emitted("toggle-override")[0][0]).toEqual({ language: "en", override: false });
    expect(wrapper.findComponent(ConfirmStub).props("open")).toBe(false);
  });

  it("cancelling Inherit keeps the override and emits nothing", async () => {
    const wrapper = mountField({ overriddenLangs: ["en"] });
    await wrapper.find("button").trigger("click");
    await wrapper.findComponent(ConfirmStub).vm.$emit("cancel");

    expect(wrapper.emitted("toggle-override")).toBeUndefined();
    expect(wrapper.findComponent(ConfirmStub).props("open")).toBe(false);
  });

  it("renders no toggle when the product does not inherit", () => {
    expect(mountField({ inherited: false }).find("button").exists()).toBe(false);
  });
});
