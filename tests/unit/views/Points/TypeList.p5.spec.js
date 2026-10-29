/**
 * Plan 43 — the point-type edit dialog is a BasicModal: a row opens it with the type's values, its ActionBar is
 * Delete (danger, opens the confirm) · Cancel · Save, and closing it clears the type. A carrier row never opens it.
 */
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/deliverypoints/api", () => ({
  GET_Types: vi.fn().mockResolvedValue({ data: { results: [] } }),
  POST_Type: vi.fn(),
  PATCH_Type: vi.fn(),
  DELETE_Type: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
const notify = vi.hoisted(() => ({ spawnNotification: vi.fn() }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => notify }));

import { PATCH_Type } from "@/api/deliverypoints/api";
import TypeList from "@/views/Points/TypeList.vue";

const BasicModal = {
  name: "BasicModal",
  props: ["open", "title", "actions"],
  emits: ["close"],
  template: "<div v-if='open'><slot /></div>",
};

async function mountList() {
  const wrapper = mount(TypeList, {
    global: { stubs: { BasicModal, DataTable: true, ConfirmDialog: true, BasicSwitch: true, PageHeader: true } },
  });
  await flushPromises();
  return wrapper;
}

describe("TypeList — edit dialog on BasicModal", () => {
  it("opens with the row's values and offers Delete · Cancel · Save", async () => {
    const wrapper = await mountList();
    wrapper.vm.onRowClick({ id: 3, code: "locker", name: "Locker", is_carrier: false, is_active: true, sort_order: 2 });
    await wrapper.vm.$nextTick();

    const modal = wrapper.findComponent({ name: "BasicModal" });
    expect(modal.props("open")).toBe(true);
    expect(modal.props("title")).toBe("Locker");
    expect(wrapper.vm.editForm).toMatchObject({ code: "locker", sort_order: 2 });
    const [remove, cancel, save] = modal.props("actions");
    expect([remove.key, remove.variant, cancel.key, save.role]).toEqual(["delete", "danger", "cancel", "primary"]);

    remove.onClick();
    expect(wrapper.vm.showDeleteConfirm).toBe(true);
    await modal.vm.$emit("close");
    expect(modal.props("open")).toBe(false);
  });

  it("keeps a carrier type closed and says why", async () => {
    const wrapper = await mountList();
    wrapper.vm.onRowClick({ id: 1, code: "inpost", name: "InPost", is_carrier: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: "BasicModal" }).props("open")).toBe(false);
    expect(notify.spawnNotification).toHaveBeenCalledWith(expect.objectContaining({ msg: "dp.carrier_read_only" }));
  });
});

// Plan 54b: sort order is a NumberInput and goes to the API as a number.
describe("TypeList — sort order", () => {
  it("saves the edited sort order as a number", async () => {
    const NumberInput = { name: "NumberInput", props: ["modelValue"], emits: ["update:modelValue"], template: "<div />" };
    const wrapper = mount(TypeList, {
      global: { stubs: { BasicModal, NumberInput, FormField: { template: "<div><slot /></div>" }, DataTable: true, ConfirmDialog: true, BasicSwitch: true, PageHeader: true } },
    });
    await flushPromises();
    wrapper.vm.onRowClick({ id: 3, code: "locker", name: "Locker", is_carrier: false, is_active: true, sort_order: 2 });
    await wrapper.vm.$nextTick();
    await wrapper.findComponent(NumberInput).vm.$emit("update:modelValue", "7");
    await wrapper.findComponent({ name: "BasicModal" }).props("actions").find((action) => action.key === "save").onClick();
    expect(PATCH_Type).toHaveBeenCalledWith(3, expect.objectContaining({ sort_order: 7 }));
  });

  // Plan 56b: an emptied field is a field error, never a silent 0 (which would move the type to the top).
  it("an emptied sort order is a field error and nothing is saved", async () => {
    PATCH_Type.mockClear();
    const NumberInput = { name: "NumberInput", props: ["modelValue"], emits: ["update:modelValue"], template: "<div />" };
    const FormField = { name: "FormField", props: ["label", "error", "required"], template: "<div><slot /></div>" };
    const wrapper = mount(TypeList, {
      global: { stubs: { BasicModal, NumberInput, FormField, DataTable: true, ConfirmDialog: true, BasicSwitch: true, PageHeader: true } },
    });
    await flushPromises();
    wrapper.vm.onRowClick({ id: 3, code: "locker", name: "Locker", is_carrier: false, is_active: true, sort_order: 2 });
    await wrapper.vm.$nextTick();
    await wrapper.findComponent(NumberInput).vm.$emit("update:modelValue", "");
    await wrapper.findComponent({ name: "BasicModal" }).props("actions").find((action) => action.key === "save").onClick();
    const field = wrapper.findAllComponents(FormField).find((f) => f.props("label") === "dp.sort_order");
    expect(field.props("error")).toBe("dp.sort_order_required");
    expect(PATCH_Type).not.toHaveBeenCalled();
  });
});
