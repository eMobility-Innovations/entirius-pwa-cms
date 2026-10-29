import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_ProfileSettings: vi.fn() }));
vi.mock("@/api/enrichment/api", () => api);

import QaCheckToggle from "@/views/Pim/components/enrichment/QaCheckToggle.vue";
import { clearQaCheckDefault, qaCheckParams } from "@/views/Pim/components/enrichment/qaCheck";

const BasicSwitch = { name: "BasicSwitch", props: ["modelValue", "label", "disabled"], emits: ["update:modelValue"], template: "<i />" };
const mountWith = (props = {}) => mount(QaCheckToggle, { props, global: { stubs: { BasicSwitch } } });

describe("QaCheckToggle", () => {
  beforeEach(() => {
    clearQaCheckDefault();
    api.GET_ProfileSettings.mockReset();
  });

  it("without a choice it starts at the Settings default and names it", async () => {
    api.GET_ProfileSettings.mockResolvedValue({ data: { qa_check: true } });
    const w = mountWith();
    await flushPromises();
    expect(w.findComponent(BasicSwitch).props("modelValue")).toBe(true);
    expect(w.find("[data-testid='qa-check-toggle-note']").text()).toBe("enrichment.qa.run_default_on");
  });

  it("a flip becomes the run's own choice; the run's choice wins over the default", async () => {
    api.GET_ProfileSettings.mockResolvedValue({ data: { qa_check: true } });
    const w = mountWith({ modelValue: false });
    await flushPromises();
    expect(w.findComponent(BasicSwitch).props("modelValue")).toBe(false);
    w.findComponent(BasicSwitch).vm.$emit("update:modelValue", true);
    expect(w.emitted("update:modelValue")[0]).toEqual([true]);
  });

  it("an unreadable default reads as off; the default loads once", async () => {
    api.GET_ProfileSettings.mockRejectedValueOnce(new Error("403")).mockResolvedValue({ data: { qa_check: true } });
    const w = mountWith();
    await flushPromises();
    expect(w.findComponent(BasicSwitch).props("modelValue")).toBe(false);
    mountWith();
    mountWith();
    await flushPromises();
    expect(api.GET_ProfileSettings).toHaveBeenCalledTimes(2); // the failure is not remembered, the answer is
  });

  it("the params carry only a made choice", () => {
    expect(qaCheckParams(null)).toEqual({});
    expect(qaCheckParams(true)).toEqual({ qa_check: true });
    expect(qaCheckParams(false)).toEqual({ qa_check: false });
  });
});
