import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_ProfileSettings: vi.fn(), PUT_ProfileSettings: vi.fn() }));
const spawnNotification = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));

import QaCheckSetting from "@/views/EnrichmentProfile/QaCheckSetting.vue";

const BasicSwitch = { name: "BasicSwitch", props: ["modelValue", "label", "hint", "disabled"], emits: ["update:modelValue"], template: "<i />" };
const stubs = { BasicCard: { props: ["title"], template: "<section><slot /></section>" }, BasicSwitch };

describe("QaCheckSetting", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    spawnNotification.mockReset();
  });

  it("shows the stored default and saves a flip at once", async () => {
    api.GET_ProfileSettings.mockResolvedValue({ data: { qa_check: false } });
    api.PUT_ProfileSettings.mockResolvedValue({ data: { qa_check: true } });
    const w = mount(QaCheckSetting, { global: { stubs } });
    await flushPromises();
    const toggle = w.findComponent(BasicSwitch);
    expect(toggle.props()).toMatchObject({ modelValue: false, label: "enrichment.profile.qa_setting.label" });
    toggle.vm.$emit("update:modelValue", true);
    await flushPromises();
    expect(api.PUT_ProfileSettings).toHaveBeenCalledWith({ qa_check: true });
    expect(w.findComponent(BasicSwitch).props("modelValue")).toBe(true);
    expect(spawnNotification).toHaveBeenCalledWith({ type: "positive", msg: "enrichment.profile.qa_setting.on_toast" });
  });

  it("a refused save keeps the old value and says why", async () => {
    api.GET_ProfileSettings.mockResolvedValue({ data: { qa_check: true } });
    api.PUT_ProfileSettings.mockRejectedValue(new Error("nope"));
    const w = mount(QaCheckSetting, { global: { stubs } });
    await flushPromises();
    w.findComponent(BasicSwitch).vm.$emit("update:modelValue", false);
    await flushPromises();
    expect(w.findComponent(BasicSwitch).props("modelValue")).toBe(true);
    expect(spawnNotification.mock.calls[0][0].type).toBe("negative");
  });
});
