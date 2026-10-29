import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetDef = vi.fn();
const mockPostDef = vi.fn();
const mockPatchDef = vi.fn();
const mockDeleteDef = vi.fn();
const mockGetStatus = vi.fn();
const mockGetFeatures = vi.fn();
const spawnNotification = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_GapDefinition: (...a) => mockGetDef(...a),
  POST_GapDefinition: (...a) => mockPostDef(...a),
  PATCH_GapDefinition: (...a) => mockPatchDef(...a),
  DELETE_GapDefinition: (...a) => mockDeleteDef(...a),
  GET_GapsStatus: (...a) => mockGetStatus(...a),
  GET_Features: (...a) => mockGetFeatures(...a),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification }),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ allLanguages: ["en", "pl"], channels: [] }),
}));
vi.mock("@/stores/quality", () => ({
  useQualityStore: () => ({ available: true, probe: () => Promise.resolve() }),
}));

import GapDefinitionEdit from "@/views/Pim/GapDefinitionEdit.vue";

const existingRule = {
  key: "pl-description",
  check_key: "feature_present",
  params: { feature_idx: "description" },
  severity: "critical",
  label_t9n: { en: "Missing description" },
  languages: null,
  channels: null,
  active: true,
  display_order: 1,
};

const SwitchStub = {
  name: "BasicSwitch",
  props: ["modelValue", "label"],
  emits: ["update:modelValue"],
  template: "<div />",
};

const mountEdit = ({ key, push } = {}) =>
  mount(GapDefinitionEdit, {
    global: {
      components: { BasicSwitch: SwitchStub },
      mocks: {
        $route: { params: key ? { key } : {}, query: {}, path: "/pim/gap-definitions" },
        $router: { push: push || (() => {}), replace: () => {} },
      },
      stubs: {
        teleport: true,
        ConfirmationModal: true,
        NumberInput: true,
        ChannelMultiSelect: true,
      },
    },
  });

describe("GapDefinitionEdit", () => {
  beforeEach(() => {
    mockGetDef.mockReset();
    mockPostDef.mockReset();
    mockPatchDef.mockReset();
    mockDeleteDef.mockReset();
    mockGetStatus.mockReset();
    mockGetFeatures.mockReset();
    spawnNotification.mockReset();
    mockGetFeatures.mockResolvedValue({
      data: { results: [{ idx: "description", name: "Description" }] },
    });
    mockGetStatus.mockResolvedValue({ data: { is_stale: true } });
  });

  it("builds check-specific params for the selected check", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.paramFeatureIdx = "description";
    wrapper.vm.paramMinLength = "120";
    wrapper.vm.paramRole = "MAIN";

    wrapper.vm.form.check_key = "feature_present";
    expect(wrapper.vm.buildStructuredParams()).toEqual({ feature_idx: "description" });

    wrapper.vm.form.check_key = "feature_min_length";
    expect(wrapper.vm.buildStructuredParams()).toEqual({ feature_idx: "description", min_length: 120 });

    wrapper.vm.form.check_key = "picture_present";
    expect(wrapper.vm.buildStructuredParams()).toEqual({ role: "MAIN" });

    wrapper.vm.paramRole = "";
    expect(wrapper.vm.buildStructuredParams()).toEqual({});
  });

  it("create posts the structured payload", async () => {
    mockPostDef.mockResolvedValueOnce({ data: {} });
    const push = vi.fn();
    const wrapper = mountEdit({ push });
    await flushPromises();

    wrapper.vm.form.key = "pl-desc";
    wrapper.vm.paramFeatureIdx = "description";
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPostDef).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "pl-desc",
        check_key: "feature_present",
        params: { feature_idx: "description" },
        severity: "critical",
        active: true,
        languages: null,
        channels: null,
      })
    );
    expect(push).toHaveBeenCalledWith("/pim/gap-definitions");
  });

  it("blocks save when the key is missing", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.form.key = "";
    wrapper.vm.paramFeatureIdx = "description";
    await wrapper.vm.save();

    expect(mockPostDef).not.toHaveBeenCalled();
    expect(wrapper.vm.errors.key).toBeTruthy();
  });

  it("blocks save when a feature check has no attribute", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.form.key = "k";
    wrapper.vm.paramFeatureIdx = "";
    await wrapper.vm.save();

    expect(mockPostDef).not.toHaveBeenCalled();
    expect(wrapper.vm.errors.params).toBeTruthy();
  });

  it("severity-only edit reports 'applied immediately' and skips the stale check", async () => {
    mockGetDef.mockResolvedValueOnce({ data: { ...existingRule } });
    mockPatchDef.mockResolvedValueOnce({ data: {} });
    const wrapper = mountEdit({ key: "pl-description" });
    await flushPromises();

    wrapper.vm.form.severity = "warning";
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchDef).toHaveBeenCalledWith("pl-description", expect.objectContaining({ severity: "warning" }));
    expect(spawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pim.gaps_applied_immediately" })
    );
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it("condition edit reports a plain save (list banner picks up the stale state)", async () => {
    mockGetDef.mockResolvedValueOnce({ data: { ...existingRule } });
    mockPatchDef.mockResolvedValueOnce({ data: {} });
    const wrapper = mountEdit({ key: "pl-description" });
    await flushPromises();

    wrapper.vm.form.check_key = "feature_min_length";
    wrapper.vm.paramMinLength = "5";
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchDef).toHaveBeenCalled();
    expect(spawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pim.gap_definition_saved" })
    );
  });

  it("the raw params switch enters raw mode seeded from the structured params", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    const rawSwitch = wrapper
      .findAllComponents(SwitchStub)
      .find((sw) => sw.props("label") === "pim.gap_raw_params");
    expect(rawSwitch.props("modelValue")).toBe(false);
    await rawSwitch.vm.$emit("update:modelValue", true);

    expect(wrapper.vm.rawParamsMode).toBe(true);
    expect(JSON.parse(wrapper.vm.rawParamsText)).toEqual(wrapper.vm.buildStructuredParams());
  });

  it("raw JSON fallback rejects invalid JSON without posting", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.form.key = "k";
    wrapper.vm.rawParamsMode = true;
    wrapper.vm.rawParamsText = "{ not json";
    await wrapper.vm.save();

    expect(mockPostDef).not.toHaveBeenCalled();
    expect(wrapper.vm.rawParamsError).toBeTruthy();
  });

  it("delete removes the rule and returns to the list", async () => {
    mockGetDef.mockResolvedValueOnce({ data: { ...existingRule } });
    mockDeleteDef.mockResolvedValueOnce({ data: { detail: "deleted" } });
    const push = vi.fn();
    const wrapper = mountEdit({ key: "pl-description", push });
    await flushPromises();

    await wrapper.vm.deleteRule();
    await flushPromises();

    expect(mockDeleteDef).toHaveBeenCalledWith("pl-description");
    expect(push).toHaveBeenCalledWith("/pim/gap-definitions");
  });
});
