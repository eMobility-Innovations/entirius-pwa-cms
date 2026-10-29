import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetSettings = vi.fn();
const mockPatchSettings = vi.fn();
const mockGetSets = vi.fn();
const mockPatchSet = vi.fn();
const spawnNotification = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_GapSettings: (...a) => mockGetSettings(...a),
  PATCH_GapSettings: (...a) => mockPatchSettings(...a),
  GET_FeatureSetsGlobal: (...a) => mockGetSets(...a),
  PATCH_FeatureSet: (...a) => mockPatchSet(...a),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification }),
}));

import QualitySettings from "@/views/Pim/components/QualitySettings.vue";

const sets = [
  { idx: "default", name: "Default", is_default: true },
  { idx: "bikes", name: "Bikes", is_default: false },
];

const SwitchStub = { name: "BasicSwitch", props: ["modelValue", "disabled"], emits: ["update:modelValue"], template: "<div />" };
const SelectStub = { name: "BasicSelect", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };

const mountCard = () =>
  mount(QualitySettings, {
    global: {
      components: { BasicSwitch: SwitchStub, BasicSelect: SelectStub },
      stubs: {
        ConfirmDialog: true,
        // Slot-rendering stub so the select (data-test="default-set-picker") is reachable.
        FormField: { template: "<div><slot /></div>" },
      },
    },
  });

describe("QualitySettings", () => {
  beforeEach(() => {
    mockGetSettings.mockReset();
    mockPatchSettings.mockReset();
    mockGetSets.mockReset();
    mockPatchSet.mockReset();
    spawnNotification.mockReset();
  });

  it("renders the card with switcher state after a successful GET", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: false } });
    mockGetSets.mockResolvedValueOnce({ data: { results: sets } });
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.find('[data-test="quality-settings-card"]').exists()).toBe(true);
    expect(wrapper.vm.settings.gaps_skip_default_featureset).toBe(false);
    expect(wrapper.vm.currentDefaultIdx).toBe("default");
  });

  it("soft-compat: failed GET renders nothing and stays silent", async () => {
    mockGetSettings.mockRejectedValueOnce(new Error("old backend"));
    mockGetSets.mockRejectedValueOnce(new Error("old backend"));
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.find('[data-test="quality-settings-card"]').exists()).toBe(false);
    expect(spawnNotification).not.toHaveBeenCalled();
  });

  it("toggle PATCHes the inverted value and updates state", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockResolvedValueOnce({ data: { results: [] } });
    mockPatchSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: false } });
    const wrapper = mountCard();
    await flushPromises();

    await wrapper.vm.toggleSkipDefault();

    expect(mockPatchSettings).toHaveBeenCalledWith({ gaps_skip_default_featureset: false });
    expect(wrapper.vm.settings.gaps_skip_default_featureset).toBe(false);
    expect(spawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "positive" })
    );
  });

  it("toggle failure keeps the old value and shows a negative toast", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockResolvedValueOnce({ data: { results: [] } });
    mockPatchSettings.mockRejectedValueOnce(new Error("boom"));
    const wrapper = mountCard();
    await flushPromises();

    await wrapper.vm.toggleSkipDefault();

    expect(wrapper.vm.settings.gaps_skip_default_featureset).toBe(true);
    expect(spawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "negative" })
    );
  });

  it("default-set pick + confirm sends exactly one PATCH and refetches sets", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockResolvedValue({ data: { results: sets } });
    mockPatchSet.mockResolvedValueOnce({ data: {} });
    const wrapper = mountCard();
    await flushPromises();

    wrapper.vm.onPickDefault("bikes");
    expect(wrapper.vm.pendingDefaultIdx).toBe("bikes");

    await wrapper.vm.confirmDefaultChange();

    expect(mockPatchSet).toHaveBeenCalledTimes(1);
    expect(mockPatchSet).toHaveBeenCalledWith("bikes", { is_default: true });
    expect(mockGetSets).toHaveBeenCalledTimes(2); // mount + refetch
    expect(wrapper.vm.pendingDefaultIdx).toBe(null);
  });

  it("default-set PATCH failure shows a negative toast and resets saving", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockResolvedValueOnce({ data: { results: sets } });
    mockPatchSet.mockRejectedValueOnce(new Error("boom"));
    const wrapper = mountCard();
    await flushPromises();

    wrapper.vm.onPickDefault("bikes");
    await wrapper.vm.confirmDefaultChange();

    expect(spawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "negative" })
    );
    expect(wrapper.vm.saving).toBe(false);
    expect(wrapper.vm.pendingDefaultIdx).toBe(null);
  });

  it("sets fetch failure still renders the card (toggle-only mode)", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockRejectedValueOnce(new Error("boom"));
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.find('[data-test="quality-settings-card"]').exists()).toBe(true);
    expect(wrapper.vm.allSets).toHaveLength(0);
    expect(wrapper.find('[data-test="default-set-picker"]').exists()).toBe(false);
  });

  it("picking the current default is a no-op", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockResolvedValueOnce({ data: { results: sets } });
    const wrapper = mountCard();
    await flushPromises();

    wrapper.vm.onPickDefault("default");

    expect(wrapper.vm.pendingDefaultIdx).toBe(null);
    expect(mockPatchSet).not.toHaveBeenCalled();
  });

  it("the switch PATCHes the inverted value and the select stages the picked set", async () => {
    mockGetSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: true } });
    mockGetSets.mockResolvedValueOnce({ data: { results: sets } });
    mockPatchSettings.mockResolvedValueOnce({ data: { gaps_skip_default_featureset: false } });
    const wrapper = mountCard();
    await flushPromises();

    const toggle = wrapper.findComponent(SwitchStub);
    expect(toggle.props("modelValue")).toBe(true);
    await toggle.vm.$emit("update:modelValue", false);
    await flushPromises();
    expect(mockPatchSettings).toHaveBeenCalledWith({ gaps_skip_default_featureset: false });

    const picker = wrapper.findComponent(SelectStub);
    expect(picker.props("modelValue")).toBe("default");
    await picker.vm.$emit("update:modelValue", "bikes");
    expect(wrapper.vm.pendingDefaultIdx).toBe("bikes");
  });
});
