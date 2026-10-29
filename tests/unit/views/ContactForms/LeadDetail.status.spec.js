import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Plan 37: the lead's status change sits in the PageHeader (no panel toolbar teleport). The transitions BasicSelect
// still runs onTransition: a plain status posts the same transition, "won" opens the Mark-as-won dialog first.
const mockTransition = vi.fn();

vi.mock("@/api/contactForms/api", () => ({
  GET_Lead: () => Promise.resolve({ data: { id: 7, status: "qualified", name: "Ada", channel_idx: "" } }),
  PATCH_Lead: vi.fn(),
  POST_LeadTransition: (...a) => mockTransition(...a),
  GET_ChannelIntegrations: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));

import LeadDetail from "@/views/ContactForms/LeadDetail.vue";

const SelectProbe = {
  name: "BasicSelect",
  props: ["options", "modelValue", "placeholder"],
  emits: ["update:modelValue"],
  template: "<div />",
};
const stubs = {
  PageHeader: { template: "<div><slot name=\"meta\" /><slot name=\"actions\" /></div>" },
  BasicSelect: SelectProbe,
  ActionBar: true,
  BasicCard: true,
  BasicModal: true,
};

async function mountLead() {
  const wrapper = mount(LeadDetail, { global: { stubs, mocks: { $route: { params: { id: "7" } } } } });
  await flushPromises();
  return wrapper;
}

describe("LeadDetail status select", () => {
  beforeEach(() => {
    mockTransition.mockReset().mockResolvedValue({ data: { id: 7, status: "lost", deal_value: null } });
  });

  it("offers the allowed transitions except won, which has its own action", async () => {
    const wrapper = await mountLead();
    const select = wrapper.findComponent(SelectProbe);
    expect(select.props("options").map((o) => o.value)).toEqual(["lost"]);
    expect(wrapper.vm.headerActions.map((a) => a.key)).toEqual(["mark-as-won", "save"]);
  });

  it("a picked status posts the same transition call", async () => {
    const wrapper = await mountLead();
    await wrapper.findComponent(SelectProbe).vm.$emit("update:modelValue", "lost");
    await flushPromises();
    expect(mockTransition).toHaveBeenCalledWith(7, { new_status: "lost" });
    expect(wrapper.vm.lead.status).toBe("lost");
  });

  it("won asks for the deal value before any call", async () => {
    const wrapper = await mountLead();
    wrapper.vm.onTransition("won");
    expect(wrapper.vm.showMarkAsWon).toBe(true);
    expect(mockTransition).not.toHaveBeenCalled();
  });
});
