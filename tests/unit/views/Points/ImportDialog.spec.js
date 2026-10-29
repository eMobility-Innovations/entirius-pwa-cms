// Plan 54b: the unrouted import dialog loads its types when it opens (not on its host's mount), starts clean on every
// open, and its result badge is translated.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/deliverypoints/api", () => ({
  GET_Types: vi.fn().mockResolvedValue({ data: { results: [{ code: "locker", name: "Locker" }] } }),
  POST_Import: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

import { GET_Types } from "@/api/deliverypoints/api";
import ImportDialog from "@/views/Points/ImportDialog.vue";

const StatusBadge = { name: "StatusBadge", props: ["label"], template: "<span />" };
const Pass = { template: "<div><slot /></div>" };
const stubs = { BasicModal: Pass, FormField: Pass, StatusBadge,
  ImportChooseFile: true, BasicSelect: true, BasicRadioGroup: true };

describe("Points ImportDialog", () => {
  it("fetches the types on open, not while closed, and clears the last result", async () => {
    const wrapper = mount(ImportDialog, { props: { open: false }, global: { stubs } });
    await flushPromises();
    expect(GET_Types).not.toHaveBeenCalled();

    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(GET_Types).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.typeOptions).toEqual([{ label: "Locker", value: "locker" }]);

    wrapper.vm.importResult = { created: 1 };
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(StatusBadge).props("label")).toBe("dp.import_complete");
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    expect(wrapper.vm.importResult).toBeNull();
    expect(GET_Types).toHaveBeenCalledTimes(2);
  });
});
