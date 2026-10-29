import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// The type, channel and status filters are BasicSelects whose `update:model-value` runs the old onSelect handler
// (plan 18): the chosen value is the filter and the list reloads from page 1.
const mockGetSubmissions = vi.fn();

vi.mock("@/api/contactForms/api", () => ({
  GET_Submissions: (...a) => mockGetSubmissions(...a),
  GET_FormTypes: () => Promise.resolve({ data: { results: [] } }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));

import ContactFormList from "@/views/ContactForms/ContactFormList.vue";

const SelectProbe = {
  name: "BasicSelect",
  props: ["options", "modelValue", "floatingLabel"],
  emits: ["update:modelValue"],
  template: "<div />",
};

describe("ContactFormList — filter selects", () => {
  beforeEach(() => {
    mockGetSubmissions.mockReset().mockResolvedValue({ data: { results: [], count: 0 } });
  });

  it.each([
    ["cf.type", "typeFilter"],
    ["cf.channel", "channelFilter"],
    ["cf.status", "statusFilter"],
  ])("the %s select sets %s and reloads page 1", async (label, field) => {
    const wrapper = mount(ContactFormList, {
      global: { stubs: { BasicSelect: SelectProbe, DataTable: true, Pagination: true, MobileFilterPanel: true } },
    });
    await flushPromises();
    wrapper.vm.currentPage = 3;
    mockGetSubmissions.mockClear();

    const select = wrapper.findAllComponents(SelectProbe).find((s) => s.props("floatingLabel") === label);
    await select.vm.$emit("update:modelValue", "picked");
    await flushPromises();

    expect(wrapper.vm[field]).toBe("picked");
    expect(wrapper.vm.currentPage).toBe(1);
    expect(mockGetSubmissions).toHaveBeenCalledTimes(1);
    expect(select.props("modelValue")).toBe("picked");
  });
});
