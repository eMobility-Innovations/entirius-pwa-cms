import { describe, it, expect, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";

vi.mock("@/api/stock/api", () => ({ POST_ImportCSV: vi.fn() }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));

import ImportCSVModal from "@/views/Stock/ImportCSVModal.vue";

const BasicModal = { name: "BasicModal", props: ["actions"], template: "<div><slot /></div>" };
const stubs = { BasicModal, FormField: { template: "<div><slot /></div>" }, BasicButton: true };

const actionsOf = (wrapper) => wrapper.findComponent({ name: "BasicModal" }).props("actions");
const byKey = (wrapper, key) => actionsOf(wrapper).find((action) => action.key === key);

// Plan 38: the dialog footer moved from raw buttons to BasicModal `actions` (an ActionBar).
describe("ImportCSVModal footer actions", () => {
  it("offers Upload only once a file is picked", async () => {
    const wrapper = mount(ImportCSVModal, { props: { warehouseCode: "main" }, global: { stubs } });
    expect(actionsOf(wrapper).map((action) => action.key)).toEqual(["cancel", "upload"]);
    expect(byKey(wrapper, "upload").disabled).toBe(true);
    wrapper.vm.selectedFile = new File(["sku;qty"], "stock.csv");
    await nextTick();
    expect(byKey(wrapper, "upload").disabled).toBe(false);
    byKey(wrapper, "cancel").onClick();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("closes or finishes after the report", async () => {
    const wrapper = mount(ImportCSVModal, { props: { warehouseCode: "main" }, global: { stubs } });
    wrapper.vm.report = { rows_parsed: 1, rows_imported: 1, rows_skipped: 0, errors: [] };
    await nextTick();
    expect(actionsOf(wrapper).map((action) => action.key)).toEqual(["close", "done"]);
    byKey(wrapper, "done").onClick();
    expect(wrapper.emitted("imported")).toHaveLength(1);
  });
});
