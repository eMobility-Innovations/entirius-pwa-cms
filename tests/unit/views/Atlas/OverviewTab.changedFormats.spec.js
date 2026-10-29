// Plan 61f: OverviewTab checks only the formatted values the operator changed (real useFormErrors).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockPatchSource = vi.fn();

vi.mock("@/api/atlas/api", () => ({
  PATCH_Source: (...args) => mockPatchSource(...args),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/stores/regional", () => ({
  useRegionalStore: () => ({ fetchAll: vi.fn(), languageOptions: [], currencyOptions: [], countryOptions: [] }),
}));

import OverviewTab from "@/views/Atlas/tabs/OverviewTab.vue";

const supplier = {
  idx: "nordwind",
  name: "Nordwind",
  kind: "procurement",
  source_type: "feed",
  review_mode: "manual",
  is_active: true,
  sku_prefix: "FT",
  contact_email: "legacy",
};

const stubs = {
  Switcher: true,
  Dropdown: true,
  NumberInput: true,
  BasicInput: true,
  FormField: { template: "<div><slot/></div>" },
  Teleport: { template: "<div><slot/></div>" },
  FontAwesomeIcon: true,
};

const mountTab = () => mount(OverviewTab, { props: { supplier }, global: { stubs } });

describe("OverviewTab.save — changed formats only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchSource.mockResolvedValue({ data: { ...supplier, name: "Renamed" } });
  });

  it("saves another field while a stored invalid contact_email is untouched", async () => {
    const wrapper = mountTab();
    wrapper.vm.form.name = "Renamed";
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchSource).toHaveBeenCalledTimes(1);
    expect(mockPatchSource.mock.calls[0][1]).toEqual({ name: "Renamed" });
  });

  it("blocks the save and reports a field error when contact_email is changed to an invalid value", async () => {
    const wrapper = mountTab();
    wrapper.vm.form.contact_email = "bad";
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchSource).not.toHaveBeenCalled();
    expect(wrapper.vm.errors.contact_email?.msg).toBeTruthy();
  });
});
