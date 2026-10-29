import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockPatchSource = vi.fn();

vi.mock("@/api/atlas/api", () => ({
  PATCH_Source: (...args) => mockPatchSource(...args),
}));

// Pinia stores used by setup() — stub to no-op.
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/stores/regional", () => ({
  useRegionalStore: () => ({
    fetchAll: vi.fn(),
    languageOptions: [],
    currencyOptions: [],
    countryOptions: [],
  }),
}));
vi.mock("@/composables/useFormErrors", () => ({
  useFormErrors: () => ({
    errors: {},
    handleApiError: vi.fn(),
    clearErrors: vi.fn(),
    validateFormats: vi.fn(() => true),
  }),
}));

import OverviewTab from "@/views/Atlas/tabs/OverviewTab.vue";

function makeSupplier(overrides = {}) {
  return {
    idx: "nordwind",
    name: "Nordwind",
    kind: "procurement",
    source_type: "feed",
    review_mode: "manual",
    is_active: true,
    default_language_id: 1,
    default_currency_id: 1,
    country_id: null,
    sku_prefix: "FT",
    target_warehouse_code: null,
    default_feature_set_idx: null,
    qty_subtract: 0,
    qty_minimum: 0,
    company_name: "",
    contact_email: "",
    contact_phone: "",
    contact_person: "",
    notes: "",
    lead_time_days: null,
    allow_physical_writes_from_non_primary: false,
    primary_strategy: "lowest_cost_with_stock",
    primary_switch_cooldown_hours: 24,
    primary_switch_hysteresis_pct: 2,
    eval_frequency: "daily",
    ...overrides,
  };
}

const globalStubs = {
  Switcher: {
    name: "Switcher",
    props: ["selected"],
    emits: ["onSelect"],
    template:
      "<button class='stub-switcher' :data-selected='selected' @click=\"$emit('onSelect')\"></button>",
  },
  Dropdown: true,
  NumberInput: true,
  BasicInput: true,
  FormField: { template: "<div><slot/></div>" },
  Teleport: { template: "<div><slot/></div>" },
  FontAwesomeIcon: true,
};

describe("OverviewTab — allow_physical_writes_from_non_primary (etap-10)", () => {
  beforeEach(() => {
    mockPatchSource.mockReset();
  });

  it("seeds form.allow_physical_writes_from_non_primary from the supplier prop", () => {
    const supplier = makeSupplier({ allow_physical_writes_from_non_primary: true });
    const wrapper = mount(OverviewTab, {
      props: { supplier },
      global: { stubs: globalStubs },
    });
    expect(wrapper.vm.form.allow_physical_writes_from_non_primary).toBe(true);
  });

  it("defaults to false when supplier prop omits the field", () => {
    const supplier = makeSupplier();
    delete supplier.allow_physical_writes_from_non_primary;
    const wrapper = mount(OverviewTab, {
      props: { supplier },
      global: { stubs: globalStubs },
    });
    expect(wrapper.vm.form.allow_physical_writes_from_non_primary).toBe(false);
  });

  it("PATCHes the flag when toggled and save() is called", async () => {
    const supplier = makeSupplier({ allow_physical_writes_from_non_primary: false });
    mockPatchSource.mockResolvedValue({ data: { ...supplier, allow_physical_writes_from_non_primary: true } });

    const wrapper = mount(OverviewTab, {
      props: { supplier },
      global: { stubs: globalStubs },
    });
    wrapper.vm.form.allow_physical_writes_from_non_primary = true;
    await wrapper.vm.save();
    await flushPromises();

    expect(mockPatchSource).toHaveBeenCalledTimes(1);
    const [idx, payload] = mockPatchSource.mock.calls[0];
    expect(idx).toBe("nordwind");
    expect(payload).toHaveProperty("allow_physical_writes_from_non_primary", true);
    // Only changed fields go on the wire — name/role/etc must not leak.
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("kind");
  });

  it("skips the PATCH when no field changed (isDirty=false guard)", async () => {
    const supplier = makeSupplier({ allow_physical_writes_from_non_primary: false });
    const wrapper = mount(OverviewTab, {
      props: { supplier },
      global: { stubs: globalStubs },
    });
    await wrapper.vm.save();
    await flushPromises();
    expect(mockPatchSource).not.toHaveBeenCalled();
  });
});
