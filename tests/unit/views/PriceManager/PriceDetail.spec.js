import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Mock APIs before component import — PriceDetail calls these on mount when sku+channel are set.
const mockGetPmPriceDetail = vi.fn();
const mockGetPmPrices = vi.fn();
const mockSpawnNotification = vi.fn();

vi.mock("@/api/pricemanager/api", () => ({
  GET_PmPriceDetail: (...args) => mockGetPmPriceDetail(...args),
  GET_PmPrices: (...args) => mockGetPmPrices(...args),
  PATCH_PmPrice: vi.fn(),
  DELETE_PmPrice: vi.fn(),
  POST_PmFlushSpecial: vi.fn(),
  GET_PmPriceHistory: vi.fn(),
}));

vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart: () => {}, loaderEnd: () => {} }),
}));

vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockSpawnNotification }),
}));

vi.mock("@/composables/useFormErrors", () => ({
  useFormErrors: () => ({
    getFieldError: () => null,
    hasErrors: false,
    clearErrors: () => {},
    validateRequired: () => true,
    validateFormats: () => true,
    handleApiError: () => {},
  }),
}));

vi.mock("@/functionals/Confirmation-modal/index.vue", () => ({ default: { template: "<div />" } }));

import PriceDetail from "@/views/PriceManager/PriceDetail.vue";

function buildPriceRow(overrides = {}) {
  return {
    country: "PL",
    currency: "PLN",
    tax_rate: "0.2300",
    net: "0.13",
    gross: "0.16",
    special_net: null,
    special_gross: null,
    special_from_date: null,
    special_to_date: null,
    is_only_for_verified_user: false,
    modified_at: "2026-05-24T10:00:00Z",
    source: null,
    ...overrides,
  };
}

async function mountDetail(row) {
  mockGetPmPriceDetail.mockResolvedValue({ data: { prices: [row] } });
  mockGetPmPrices.mockResolvedValue({ data: { results: [] } });
  const wrapper = mount(PriceDetail, {
    props: { sku: "CHAIR-001", channelIdxProp: "b2c-europe", embedded: true },
    global: {
      provide: {
        pmChannelIdx: "b2c-europe",
        pmActiveChannel: { calculate_direction: "from_net_to_gross", default_country: "PL" },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("PriceDetail — source badge", () => {
  it("does not render the source row when source is missing", async () => {
    const wrapper = await mountDetail(buildPriceRow({ source: null }));

    expect(wrapper.text()).not.toContain("pm.source_label");
    expect(wrapper.find("status-badge-stub").exists()).toBe(false);
  });

  it("renders a neutral admin_edit badge", async () => {
    const wrapper = await mountDetail(buildPriceRow({ source: "admin_edit" }));

    const badge = wrapper.find("status-badge-stub");
    expect(badge.exists()).toBe(true);
    expect(badge.attributes("label")).toBe("pm.source_admin_edit");
    expect(badge.attributes("tone")).toBe("neutral");
  });
});

async function mountWithCosts(prices, purchaseCosts) {
  mockGetPmPriceDetail.mockResolvedValue({ data: { prices, purchase_costs: purchaseCosts } });
  mockGetPmPrices.mockResolvedValue({ data: { results: [] } });
  const wrapper = mount(PriceDetail, {
    props: { sku: "CHAIR-001", channelIdxProp: "b2c-europe", embedded: true },
    global: {
      provide: {
        pmChannelIdx: "b2c-europe",
        pmActiveChannel: { calculate_direction: "from_net_to_gross", default_country: "PL" },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

const PLN_COST = { country: "PL", currency: "PLN", net_cost: "0.50", supplier_idx: "nordwind", updated_at: null };

describe("PriceDetail — purchase cost + margin", () => {
  it("shows purchase cost and a positive margin when both cost and sell price exist", async () => {
    const wrapper = await mountWithCosts([buildPriceRow({ net: "1.00", source: null })], [PLN_COST]);

    expect(wrapper.text()).toContain("pm.purchase_cost");
    expect(wrapper.text()).toContain("0.50");
    expect(wrapper.text()).toContain("nordwind");
    const marginBadge = wrapper
      .findAll("status-badge-stub")
      .find((b) => (b.attributes("label") || "").startsWith("pm.margin_percent"));
    expect(marginBadge).toBeTruthy();
    expect(marginBadge.attributes("label")).toContain('"value":"50.0"');
    expect(marginBadge.attributes("tone")).toBe("positive");
  });

  it("renders a negative margin badge when cost exceeds the sell price", async () => {
    const wrapper = await mountWithCosts(
      [buildPriceRow({ net: "0.50", source: null })],
      [{ country: "PL", currency: "PLN", net_cost: "1.00", supplier_idx: "nordwind", modified_at: null }]
    );

    const marginBadge = wrapper
      .findAll("status-badge-stub")
      .find((b) => (b.attributes("label") || "").startsWith("pm.margin_percent"));
    expect(marginBadge).toBeTruthy();
    expect(marginBadge.attributes("label")).toContain('"value":"-100.0"');
    expect(marginBadge.attributes("tone")).toBe("negative");
  });

  it("shows the unpriced hint when a purchase cost exists but there is no sell price", async () => {
    const wrapper = await mountWithCosts([], [PLN_COST]);

    expect(wrapper.text()).toContain("pm.purchase_cost");
    expect(wrapper.text()).toContain("pm.unpriced_hint");
  });

  it("shows the cost (in its own currency) but no margin when sell currency differs", async () => {
    const wrapper = await mountWithCosts(
      [buildPriceRow({ net: "1.00", currency: "EUR", country: "DE", source: null })],
      [PLN_COST]
    );

    // Cost is independent of the sell-currency selector — always visible, in its own currency.
    expect(wrapper.text()).toContain("pm.purchase_cost");
    expect(wrapper.text()).toContain("0.50");
    expect(wrapper.text()).toContain("PLN");
    // No margin across currencies (no FX).
    const marginBadge = wrapper
      .findAll("status-badge-stub")
      .find((b) => (b.attributes("label") || "").startsWith("pm.margin_percent"));
    expect(marginBadge).toBeFalsy();
  });
});

// createClient rejects with the v2 body; the HTTP status rides on its non-enumerable `httpStatus`.
function notFoundBody() {
  const body = { error: "INVALID_REQUEST", message: "The requested resource was not found.", details: [] };
  Object.defineProperty(body, "httpStatus", { value: 404 });
  return body;
}

async function mountNotFound(props = {}) {
  mockSpawnNotification.mockClear();
  mockGetPmPriceDetail.mockRejectedValue(notFoundBody());
  const wrapper = mount(PriceDetail, {
    props: { sku: "SEL-754", channelIdxProp: "b2c-europe", embedded: true, ...props },
    global: { provide: { pmChannelIdx: "b2c-europe", pmActiveChannel: { default_country: "PL" } } },
  });
  await flushPromises();
  return wrapper;
}

describe("PriceDetail — product without prices (404)", () => {
  it("shows the empty state instead of an error toast", async () => {
    const wrapper = await mountNotFound();

    expect(wrapper.find("empty-state-stub").attributes("message")).toBe("pm.no_price_for_product");
    expect(mockSpawnNotification).not.toHaveBeenCalled();
  });

  it("tells a configurable product that prices are set per variant", async () => {
    const wrapper = await mountNotFound({ configurable: true });

    expect(wrapper.find("empty-state-stub").attributes("message")).toBe("pm.prices_per_variant");
  });
});
