import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Plan 37: the raw date inputs are BasicDatePickers and the lead status is an inline chip row. A picked date still
// becomes the date_from / date_to param and reloads page 1; clearing the dates drops both params.
const mockGetBookings = vi.fn();

vi.mock("@/api/contactForms/api", () => ({ GET_Bookings: (...a) => mockGetBookings(...a) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ channels: [{ idx: "eu" }] }) }));

import IconButton from "@/boots/IconButton/index.vue";
import MobileFilterPanel from "@/boots/MobileFilterPanel/index.vue";
import BookingList from "@/views/ContactForms/BookingList.vue";

const PickerProbe = {
  name: "BasicDatePicker",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<div />",
};
const stubs = {
  PageHeader: true,
  BasicSelect: true,
  DataTable: true,
  Pagination: true,
  FormField: { template: "<div><slot /></div>" },
  BasicDatePicker: PickerProbe,
};
const components = { IconButton, MobileFilterPanel };
const lastParams = () => mockGetBookings.mock.calls.at(-1)[0];

describe("BookingList date filters", () => {
  beforeEach(() => {
    mockGetBookings.mockReset().mockResolvedValue({ data: { results: [], count: 0 } });
  });

  it("the From and To pickers set the date params and reload page 1", async () => {
    const wrapper = mount(BookingList, { global: { stubs, components } });
    await flushPromises();
    wrapper.vm.currentPage = 3;
    const [from, to] = wrapper.findAllComponents(PickerProbe);

    await from.vm.$emit("update:modelValue", "2026-09-01");
    await to.vm.$emit("update:modelValue", "2026-09-30");
    await flushPromises();

    expect(lastParams()).toMatchObject({ page: 1, date_from: "2026-09-01", date_to: "2026-09-30" });
    expect(from.props("modelValue")).toBe("2026-09-01");
  });

  it("the clear-dates button drops both params and reloads", async () => {
    const wrapper = mount(BookingList, { global: { stubs, components } });
    await flushPromises();
    const [from, to] = wrapper.findAllComponents(PickerProbe);
    await from.vm.$emit("update:modelValue", "2026-09-01");
    await to.vm.$emit("update:modelValue", "2026-09-30");
    await flushPromises();
    const calls = mockGetBookings.mock.calls.length;

    // MobileFilterPanel renders its slot twice (desktop row, phone panel): the desktop copy's button.
    const clear = wrapper.findAll("button").find((b) => b.attributes("aria-label") === "cf.clear_dates");
    await clear.trigger("click");
    await flushPromises();

    expect(mockGetBookings.mock.calls.length).toBe(calls + 1);
    expect(lastParams()).not.toHaveProperty("date_from");
    expect(lastParams()).not.toHaveProperty("date_to");
    expect(from.props("modelValue")).toBeFalsy();
    expect(to.props("modelValue")).toBeFalsy();
  });

  it("a lead status chip filters by lead_status", async () => {
    const wrapper = mount(BookingList, { global: { stubs, components } });
    await flushPromises();
    const chip = wrapper.findAll("filter-chip-stub").find((c) => c.attributes("label") === "cf.statuses.won");
    await chip.trigger("click");
    await flushPromises();
    expect(lastParams()).toMatchObject({ lead_status: "won" });
  });
});
