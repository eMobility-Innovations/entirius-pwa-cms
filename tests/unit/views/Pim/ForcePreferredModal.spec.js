import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

import ForcePreferredModal from "@/views/Pim/components/supplier/ForcePreferredModal.vue";

const stubs = {
  BasicModal: {
    props: { open: Boolean },
    emits: ["close"],
    template: '<div class="bm-stub"><slot name="title" /><slot /><slot name="footer" /></div>',
  },
  ActionBar: { template: "<div><slot /></div>" },
};

const baseProps = {
  visible: true,
  autoPreferredName: "Acme Tools",
  autoPreferredReason: "lowest_cost",
  targetSupplierName: "Nordwind",
  targetSupplierIdx: "nordwind",
};

describe("ForcePreferredModal", () => {
  it("does not emit confirmed when reason is shorter than 3 chars", async () => {
    const wrapper = mount(ForcePreferredModal, { global: { stubs }, props: baseProps });
    await wrapper.setData({ reason: "ok" });
    await wrapper.find('[data-test="force-preferred-confirm"]').trigger("click");
    expect(wrapper.emitted("confirmed")).toBeUndefined();
  });

  it("emits confirmed with payload when reason is valid and target is set", async () => {
    const wrapper = mount(ForcePreferredModal, { global: { stubs }, props: baseProps });
    await wrapper.setData({ reason: "strategic partner" });
    await wrapper.find('[data-test="force-preferred-confirm"]').trigger("click");
    await flushPromises();
    expect(wrapper.emitted("confirmed")).toBeTruthy();
    expect(wrapper.emitted("confirmed")[0][0]).toEqual({
      supplierIdx: "nordwind",
      reason: "strategic partner",
    });
  });

  it("does not emit confirmed while loading=true", async () => {
    const wrapper = mount(ForcePreferredModal, { global: { stubs }, props: { ...baseProps, loading: true } });
    await wrapper.setData({ reason: "strategic partner" });
    await wrapper.find('[data-test="force-preferred-confirm"]').trigger("click");
    expect(wrapper.emitted("confirmed")).toBeUndefined();
  });

  it("emits close when cancel is clicked", async () => {
    const wrapper = mount(ForcePreferredModal, { global: { stubs }, props: baseProps });
    await wrapper.find('[data-test="force-preferred-cancel"]').trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("resets reason when visible flips from false to true", async () => {
    const wrapper = mount(ForcePreferredModal, { global: { stubs }, props: { ...baseProps, visible: false } });
    await wrapper.setData({ reason: "leftover" });
    await wrapper.setProps({ visible: true });
    expect(wrapper.vm.reason).toBe("");
  });
});
