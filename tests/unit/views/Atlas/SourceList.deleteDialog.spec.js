import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/atlas/api", () => ({
  GET_Sources: vi.fn(() => Promise.resolve({ data: { results: [], count: 0 } })),
  POST_Source: vi.fn(),
  DELETE_Source: vi.fn(),
  GET_SupplierDeleteImpact: vi.fn(() => Promise.resolve({ data: { affected_links_count: 2, affected_pushed_skus_count: 1 } })),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/regional", () => ({
  useRegionalStore: () => ({ fetchAll: vi.fn(), languageOptions: [], currencyOptions: [] }),
}));

import SourceList from "@/views/Atlas/SourceList.vue";

// Plan 54d: the dialog's line follows the chosen option — no danger line while the safe deactivation is chosen.
describe("SourceList — delete dialog line", () => {
  async function openDelete() {
    const wrapper = mount(SourceList, {
      global: {
        stubs: {
          BasicModal: { props: ["open"], template: "<div v-if='open'><slot /><slot name='footer' /></div>" },
          DataTable: true,
          SideDrawer: true,
          PageHeader: true,
          BasicRadioGroup: true,
        },
      },
    });
    await flushPromises();
    await wrapper.vm.openDelete({ idx: "acme", name: "Acme" });
    await flushPromises();
    return wrapper;
  }

  it("the safe deactivation reads neutral, without a warning", async () => {
    const wrapper = await openDelete();
    expect(wrapper.get('[data-testid="suppliers-delete-note"]').text()).toBe("atlas.delete.soft_note");
    expect(wrapper.find('[data-testid="suppliers-delete-warning"]').exists()).toBe(false);
  });

  it("the permanent delete reads negative and says it cannot be undone", async () => {
    const wrapper = await openDelete();
    wrapper.vm.$data.deleteForce = true;
    await flushPromises();
    const warning = wrapper.get('[data-testid="suppliers-delete-warning"]');
    expect(warning.classes()).toContain("t-negative");
    expect(warning.text()).toBe("atlas.delete.hard_warning");
    expect(wrapper.find('[data-testid="suppliers-delete-note"]').exists()).toBe(false);
  });
});
