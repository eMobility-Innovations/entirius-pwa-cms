import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/stock/api", () => ({
  GET_Warehouses: vi.fn().mockResolvedValue({
    data: [
      { code: "main", name: "Main", source_type: "manual" },
      { code: "ext", name: "External", source_type: "integration" },
    ],
  }),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderEnd() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));

import StockPanel from "@/views/Stock/index.vue";
import StockWarehousePicker from "@/views/Stock/StockWarehousePicker.vue";

const BasicSelect = { name: "BasicSelect", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };

// Plan 38: the picker left the panel toolbar for the PageHeader `actions` row of the stock table (and, when no
// warehouse is active, the panel wrapper's own PageHeader); the panel wrapper still owns the warehouses and
// provides them to the picker.
const PickerRoute = { components: { StockWarehousePicker }, template: "<StockWarehousePicker />" };

describe("Stock panel — warehouse picker on BasicSelect", () => {
  it("makes the picked warehouse active", async () => {
    const wrapper = mount(StockPanel, {
      global: { stubs: { BasicSelect, StatusBadge: true, RouterView: PickerRoute, EmptyState: true } },
    });
    await flushPromises();
    const select = wrapper.findComponent({ name: "BasicSelect" });
    expect(select.props("modelValue")).toBe("main");
    expect(select.props("options").map((o) => o.value)).toEqual(["main", "ext"]);
    await select.vm.$emit("update:modelValue", "ext");
    expect(wrapper.vm.activeWarehouse.code).toBe("ext");
    expect(select.props("modelValue")).toBe("ext");
  });
});
