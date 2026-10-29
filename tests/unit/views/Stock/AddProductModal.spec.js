import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/stock/api", () => ({
  GET_WarehouseProducts: vi.fn().mockResolvedValue({
    data: { results: [{ sku: "SKU-1", quantity: 0, has_stock: false }], count: 1 },
  }),
}));

import BasicCheckbox from "@/boots/BasicCheckbox/index.vue";
import AddProductModal from "@/views/Stock/AddProductModal.vue";

const BasicModal = { name: "BasicModal", props: ["actions"], template: "<div><slot /></div>" };

async function mountModal() {
  const wrapper = mount(AddProductModal, {
    props: { warehouseCode: "main" },
    attachTo: document.body,
    global: { components: { BasicCheckbox }, stubs: { BasicModal, Pagination: true } },
  });
  await flushPromises();
  return wrapper;
}

// Plan 40 review: the checkbox click must not reach the row handler too (a label click also dispatches a click on
// the inner input — two toggles). Each pointer target toggles the SKU exactly once.
describe("AddProductModal row selection", () => {
  it.each([
    ["the label text", ".checkbox-item__label"],
    ["the box", ".checkbox-item__input"],
    ["the rest of the row", ".add-product__row"],
  ])("a click on %s toggles the SKU once", async (_name, selector) => {
    const wrapper = await mountModal();

    await wrapper.find(selector).trigger("click");

    expect([...wrapper.vm.selectedSkus]).toEqual(["SKU-1"]);
    expect(wrapper.find(".checkbox-item__input").element.checked).toBe(true);
    wrapper.unmount();
  });
});
