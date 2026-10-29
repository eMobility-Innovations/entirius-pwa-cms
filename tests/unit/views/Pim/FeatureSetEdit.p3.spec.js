import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetFeatureSet = vi.fn(() =>
  Promise.resolve({ data: { idx: "bikes", name: "Bikes", desc: "", is_default: false } })
);

vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetGlobal: (...args) => mockGetFeatureSet(...args),
  GET_FeatureSetsGlobal: () =>
    Promise.resolve({
      data: {
        results: [
          { idx: "bikes", name: "Bikes", is_default: false },
          { idx: "default", name: "Default", is_default: true },
        ],
      },
    }),
  PATCH_FeatureSet: vi.fn(),
  DELETE_FeatureSet: vi.fn(),
  GET_FeatureSetFeaturesGlobal: () =>
    Promise.resolve({
      data: { results: [{ feature_idx: "gears", feature_name: "Gears", attributes_group_idx: "frame" }] },
    }),
  POST_FeatureSetFeatures: vi.fn(),
  DELETE_FeatureSetFeatures: vi.fn(),
  PATCH_FeatureSetFeaturesReorder: vi.fn(),
  GET_AttributesGroups: () => Promise.resolve({ data: { results: [{ idx: "frame", name: "Frame" }] } }),
  POST_AttributesGroup: vi.fn(),
  PATCH_AttributesGroup: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));

import FeatureSetEdit from "@/views/Pim/FeatureSetEdit.vue";
import BasicInput from "@/boots/BasicInput/index.vue";

const SwitchStub = { name: "BasicSwitch", props: ["modelValue", "label"], emits: ["update:modelValue"], template: "<div />" };
const SelectStub = { name: "BasicSelect", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };

const mountEdit = (push = vi.fn()) =>
  mount(FeatureSetEdit, {
    global: {
      components: { BasicSwitch: SwitchStub, BasicSelect: SelectStub },
      mocks: { $route: { params: { idx: "bikes" }, query: {} }, $router: { push, replace() {} } },
      stubs: {
        teleport: true,
        IconButton: true,
        BasicModal: true,
        ConfirmDialog: true,
        SideDrawer: true,
        AttributeLibrary: true,
        BasicInput,
        PimChannelSelect: true,
        PageHeader: { template: "<header><slot name='actions' /></header>" },
        ActionBar: { template: "<div class='stub-actions' />" },
        // Renders every item, so the named groups (and their rename field) are on the page.
        draggable: {
          props: ["modelValue"],
          template: "<div><div v-for='(el, i) in modelValue' :key='i'><slot name='item' :element='el' /></div></div>",
        },
        FormField: {
          props: ["label", "error"],
          template: "<div class='stub-field' :data-label='label' :data-error='error'><slot /></div>",
        },
      },
    },
  });

describe("FeatureSetEdit — P3 controls", () => {
  it("the set picker shows the current set and routes to the picked one", async () => {
    const push = vi.fn();
    const wrapper = mountEdit(push);
    await flushPromises();

    const picker = wrapper.findComponent(SelectStub);
    expect(picker.props("modelValue")).toBe("bikes");
    await picker.vm.$emit("update:modelValue", "default");
    expect(push).toHaveBeenCalledWith("/pim/feature-sets/default");
  });

  it("the default switch asks for confirmation while another set is default", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    await wrapper.findComponent(SwitchStub).vm.$emit("update:modelValue", true);
    expect(wrapper.vm.showDefaultConfirm).toBe(true);
    expect(wrapper.vm.form.is_default).toBe(false);

    wrapper.vm.confirmDefaultChange();
    expect(wrapper.vm.form.is_default).toBe(true);
  });

  it("rename finishes once: Enter and the focus leaving the field do not patch twice", async () => {
    const { PATCH_AttributesGroup } = await import("@/api/pim/api");
    PATCH_AttributesGroup.mockResolvedValue({ data: {} });
    const wrapper = mountEdit();
    await flushPromises();

    const group = { idx: "frame", name: "Frame", name_t9n: {}, features: [] };
    wrapper.vm.startRename(group);
    group.name = "Rama";
    await Promise.all([wrapper.vm.finishRename(group), wrapper.vm.finishRename(group)]);

    expect(PATCH_AttributesGroup).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.renamingGroupIdx).toBe(null);
  });

  it("the group menu renames or removes the group", async () => {
    const wrapper = mountEdit();
    await flushPromises();
    wrapper.vm.groups = [{ idx: "frame", name: "Frame", name_t9n: {}, features: [] }];

    wrapper.vm.onGroupMenu(wrapper.vm.groups[0], { key: "rename" });
    expect(wrapper.vm.renamingGroupIdx).toBe("frame");

    wrapper.vm.onGroupMenu(wrapper.vm.groups[0], { key: "remove" });
    expect(wrapper.vm.groups).toHaveLength(0);
  });
});

describe("FeatureSetEdit — review fixes (plan 54c)", () => {
  async function renaming() {
    const { PATCH_AttributesGroup } = await import("@/api/pim/api");
    PATCH_AttributesGroup.mockReset();
    const wrapper = mountEdit();
    await flushPromises();
    wrapper.vm.onGroupMenu(wrapper.vm.groups[0], { key: "rename" });
    await flushPromises();
    return { wrapper, input: wrapper.find(".rename-input input"), PATCH_AttributesGroup };
  }

  it("the default switch sits in a FormField named by it", async () => {
    const wrapper = mountEdit();
    await flushPromises();
    const field = wrapper.findComponent(SwitchStub).element.closest(".stub-field");
    expect(field.dataset.label).toBe("pim.is_default");
  });

  it("hides the header actions while the set reloads", async () => {
    const wrapper = mountEdit();
    await flushPromises();
    expect(wrapper.find(".stub-actions").exists()).toBe(true);

    mockGetFeatureSet.mockReturnValueOnce(new Promise(() => {}));
    wrapper.vm.fetchData();
    await flushPromises();
    expect(wrapper.find(".stub-actions").exists()).toBe(false);
  });

  it("Escape cancels a group rename: the old name is back and nothing is patched", async () => {
    const { wrapper, input, PATCH_AttributesGroup } = await renaming();
    await input.setValue("Rama");
    await input.trigger("keydown", { key: "Escape" });
    await flushPromises();

    expect(wrapper.vm.renamingGroupIdx).toBe(null);
    expect(wrapper.findAll(".feature-group__name").map((h) => h.text())).toContain("Frame");
    await input.trigger("focusout");
    expect(PATCH_AttributesGroup).not.toHaveBeenCalled();
  });

  it("an empty group name is a field error and is not patched", async () => {
    const { wrapper, input, PATCH_AttributesGroup } = await renaming();
    await input.setValue("  ");
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(PATCH_AttributesGroup).not.toHaveBeenCalled();
    expect(wrapper.vm.renamingGroupIdx).toBe("frame");
    expect(wrapper.find(".rename-input").element.closest(".stub-field").dataset.error).toBe("pim.required_field");
  });

  it("starting another rename gives a group left with an empty name its old name back", async () => {
    const { wrapper, input } = await renaming();
    wrapper.vm.groups.push({ idx: "wheels", name: "Wheels", name_t9n: {}, features: [] });
    await input.setValue("");
    await input.trigger("keydown", { key: "Enter" });

    wrapper.vm.onGroupMenu(wrapper.vm.groups[1], { key: "rename" });
    expect(wrapper.vm.groups[0].name).toBe("Frame");
    wrapper.vm.cancelRename(wrapper.vm.groups[1]);
    expect(wrapper.vm.groups[1].name).toBe("Wheels");
  });
});
