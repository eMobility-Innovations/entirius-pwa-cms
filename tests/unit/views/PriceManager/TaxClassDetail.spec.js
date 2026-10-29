import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setLang } from "@/i18n";

const mockGetTaxClass = vi.fn();
const mockPostRate = vi.fn();

vi.mock("@/api/pricemanager/api", () => ({
  GET_PmTaxClass: (...a) => mockGetTaxClass(...a),
  POST_PmTaxClass: vi.fn(),
  PATCH_PmTaxClass: vi.fn(),
  DELETE_PmTaxClass: vi.fn(),
  POST_PmTaxRate: (...a) => mockPostRate(...a),
  DELETE_PmTaxRate: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification() {} }),
}));
vi.mock("@/functionals/Confirmation-modal/index.vue", () => ({ default: { template: "<div />" } }));

import TaxClassDetail from "@/views/PriceManager/TaxClassDetail.vue";
import NumberInput from "@/boots/NumberInput/index.vue";

const TAX_CLASS = {
  idx: "standard",
  name: "Standard",
  rates: [
    { country: "PL", rate: "0.2300" },
    { country: "DE", rate: "0.0850" },
  ],
};

async function mountDetail() {
  mockGetTaxClass.mockResolvedValue({ data: TAX_CLASS });
  const wrapper = mount(TaxClassDetail, {
    global: {
      mocks: { $route: { params: { idx: "standard" }, query: {} } },
      stubs: { Teleport: true, NumberInput: true },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("TaxClassDetail — rate unit", () => {
  beforeEach(() => {
    mockGetTaxClass.mockReset();
    mockPostRate.mockReset();
    setLang("PL");
  });
  afterEach(() => setLang("EN"));

  it("shows stored fractions as percent", async () => {
    const rows = (await mountDetail()).findAll(".pm-rates-table__row");
    expect(rows[0].text()).toContain("23 %");
    expect(rows[1].text()).toContain("8,5 %");
  });

  it("stores a typed 23 as the fraction 0.2300", async () => {
    mockPostRate.mockResolvedValue({ data: {} });
    const wrapper = await mountDetail();
    wrapper.vm.newRate = { country_iso2: "cz", rate: 23 };
    await wrapper.vm.addRate();
    expect(mockPostRate).toHaveBeenCalledWith("standard", { country_code: "CZ", rate: "0.2300" });
  });

  it.each([null, "", ".", "-", "101", "-1"])("does not post the rate %j and shows the field error", async (rate) => {
    const wrapper = await mountDetail();
    wrapper.vm.newRate = { country_iso2: "cz", rate };
    await flushPromises();
    await wrapper.vm.addRate();
    expect(mockPostRate).not.toHaveBeenCalled();
    expect(wrapper.vm.rateError).toBe("pm.rate_range_error");
  });

  it("clears the field error once the rate is typed again", async () => {
    mockGetTaxClass.mockResolvedValue({ data: TAX_CLASS });
    const wrapper = mount(TaxClassDetail, {
      global: {
        mocks: { $route: { params: { idx: "standard" }, query: {} } },
        components: { NumberInput },
        stubs: { Teleport: true, FormField: { template: "<div><slot /></div>" } },
      },
    });
    await flushPromises();
    const input = wrapper.find(".number-input__value");
    await input.setValue("101");
    wrapper.vm.newRate.country_iso2 = "cz";
    await wrapper.vm.addRate();
    expect(wrapper.vm.rateError).toBe("pm.rate_range_error");
    await input.setValue("10");
    expect(wrapper.vm.rateError).toBe("");
  });
});

// Plan 39 review: the header (title, back) stays while the record loads; only the actions wait for it.
describe("TaxClassDetail — header while loading", () => {
  it("renders the PageHeader without actions before the record arrives", async () => {
    mockGetTaxClass.mockReset().mockReturnValue(new Promise(() => {}));
    const PageHeader = { name: "PageHeader", props: ["title", "back"], template: '<header><slot name="actions" /></header>' };
    const wrapper = mount(TaxClassDetail, {
      global: {
        mocks: { $route: { params: { idx: "standard" }, query: {} } },
        stubs: { Teleport: true, PageHeader, ActionBar: true },
      },
    });
    await flushPromises();

    const header = wrapper.findComponent({ name: "PageHeader" });
    expect(header.exists()).toBe(true);
    expect(header.props("back")).toBe("/pricing/tax-classes");
    expect(wrapper.findComponent({ name: "ActionBar" }).exists()).toBe(false);
  });
});
