import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

let members = [];
const patchFeature = vi.fn();
const notify = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetGlobal: () => Promise.resolve({ data: { idx: "bikes", name: "Bikes", desc: "", is_default: false } }),
  GET_FeatureSetsGlobal: () => Promise.resolve({ data: { results: [] } }),
  PATCH_FeatureSet: vi.fn(),
  DELETE_FeatureSet: vi.fn(),
  GET_FeatureSetFeaturesGlobal: () => Promise.resolve({ data: { results: members } }),
  POST_FeatureSetFeatures: vi.fn(),
  DELETE_FeatureSetFeatures: vi.fn(),
  PATCH_FeatureSetFeaturesReorder: vi.fn(),
  PATCH_FeatureSetFeature: (...args) => patchFeature(...args),
  GET_AttributesGroups: () => Promise.resolve({ data: { results: [] } }),
  POST_AttributesGroup: vi.fn(),
  PATCH_AttributesGroup: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import FeatureSetEdit from "@/views/Pim/FeatureSetEdit.vue";
import RequiredOverrideControl from "@/views/Pim/components/RequiredOverrideControl.vue";
import SegmentedControl from "@/boots/SegmentedControl/index.vue";
import { resetPimCapabilities } from "@/composables/usePimCapabilities";

const mountEdit = () =>
  mount(FeatureSetEdit, {
    global: {
      components: { SegmentedControl },
      mocks: { $route: { params: { idx: "bikes" }, query: {} }, $router: { push: vi.fn(), replace() {} } },
      stubs: {
        teleport: true,
        IconButton: true,
        BasicSwitch: true,
        BasicSelect: true,
        ConfirmDialog: true,
        SideDrawer: true,
        AttributeLibrary: true,
        PimChannelSelect: true,
        PageHeader: { template: "<header />" },
        ActionBar: true,
        draggable: {
          props: ["modelValue"],
          template: "<div><div v-for='(el, i) in modelValue' :key='i'><slot name='item' :element='el' /></div></div>",
        },
        FormField: { template: "<div><slot /></div>" },
      },
    },
  });

const member = (extra = {}) => ({
  feature: { idx: "gears", name: "Gears", feature_type: 3, is_required: false, scope: 3 },
  ...extra,
});

beforeEach(() => {
  resetPimCapabilities();
  patchFeature.mockReset();
  notify.mockReset();
});

describe("FeatureSetEdit — required override", () => {
  it("legacy PIM (no is_required_override): the control is hidden", async () => {
    members = [member()];
    const wrapper = mountEdit();
    await flushPromises();
    expect(wrapper.findComponent(RequiredOverrideControl).exists()).toBe(false);
  });

  it("new PIM: a control per feature, disabled for a system feature", async () => {
    members = [
      member({ is_required_override: null, is_required: false }),
      { feature: { idx: "name", name: "Name", feature_type: 4, is_required: true, scope: 1 }, is_required_override: null, is_required: true },
    ];
    const wrapper = mountEdit();
    await flushPromises();
    const controls = wrapper.findAllComponents(RequiredOverrideControl);
    expect(controls.map((c) => c.props("disabled"))).toEqual([false, true]);
  });

  it("picking Required PATCHes the override and keeps the PIM's answer", async () => {
    members = [member({ is_required_override: null, is_required: false })];
    patchFeature.mockResolvedValue({ data: { is_required: true, is_required_override: true } });
    const wrapper = mountEdit();
    await flushPromises();
    await wrapper.find('[data-testid="required-required"]').trigger("click");
    await flushPromises();
    expect(patchFeature).toHaveBeenCalledWith("bikes", "gears", { is_required: true });
    expect(wrapper.findComponent(RequiredOverrideControl).props("modelValue")).toBe(true);
  });

  it("a refused change snaps back and tells the operator", async () => {
    members = [member({ is_required_override: false, is_required: false })];
    patchFeature.mockRejectedValue({ response: { data: { message: "System feature" } } });
    const wrapper = mountEdit();
    await flushPromises();
    await wrapper.find('[data-testid="required-required"]').trigger("click");
    await flushPromises();
    expect(wrapper.findComponent(RequiredOverrideControl).props("modelValue")).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative", msg: "System feature" }));
  });
});
