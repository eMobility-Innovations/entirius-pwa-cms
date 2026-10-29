import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const postProduct = vi.fn();
const getRequired = vi.fn();
vi.mock("@/api/pim/api", () => ({
  POST_Product: (...args) => postProduct(...args),
  GET_FeatureSets: () => Promise.resolve({ data: { results: [{ idx: "outdoor", name: "Outdoor" }] } }),
  GET_FeatureSetRequiredFeatures: (...args) => getRequired(...args),
  GET_FeatureAttributes: vi.fn(),
  POST_AddToChannel: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "pl", activeChannelLanguages: ["PL"], channels: [{ idx: "pl", name: "PL" }] }),
}));

import ProductCreate from "@/views/Pim/ProductCreate.vue";
import { resetPimCapabilities } from "@/composables/usePimCapabilities";

const REQUIRED = [{ feature: { idx: "name", name: "Name", feature_type: 4 }, source: "system" }];
const stubs = {
  teleport: true,
  IconButton: true,
  BasicSwitch: true,
  BasicSelect: true,
  BasicCheckbox: true,
  BasicCard: { template: "<div><slot /></div>" },
  AttributeField: { name: "AttributeField", props: ["row", "error"], template: "<div class='af' />" },
  FormField: { template: "<div><slot /></div>" },
};

async function mountWithSet() {
  const wrapper = mount(ProductCreate, { global: { stubs } });
  await flushPromises();
  Object.assign(wrapper.vm.$data.form, { sku: "CHAIR-1", feature_set_idx: "outdoor" });
  await flushPromises();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  resetPimCapabilities();
  postProduct.mockReset().mockResolvedValue({ data: { sku: "CHAIR-1" } });
  getRequired.mockReset();
});

describe("ProductCreate — required features (PIM >= 3.3.0)", () => {
  it("renders an input per required feature and sends the filled ones as attributes", async () => {
    getRequired.mockResolvedValue({ data: REQUIRED });
    const wrapper = await mountWithSet();
    expect(wrapper.findAll(".af")).toHaveLength(1);

    wrapper.vm.requiredRows[0].value_txt_t9n = { pl: "Krzesło" };
    await wrapper.vm.createProduct();
    const payload = postProduct.mock.calls[0][1];
    expect(payload.attributes).toEqual([expect.objectContaining({ feature_idx: "name", value_txt_t9n: { pl: "Krzesło" } })]);
  });

  it("an empty required input blocks the create with a field error, no request", async () => {
    getRequired.mockResolvedValue({ data: REQUIRED });
    const wrapper = await mountWithSet();
    await wrapper.vm.createProduct();
    expect(postProduct).not.toHaveBeenCalled();
    expect(wrapper.vm.formErrors.getFieldError("name")).toBeTruthy();
  });

  it("the PIM's REQUIRED_FEATURE_MISSING lands on the feature's field", async () => {
    getRequired.mockResolvedValue({ data: REQUIRED });
    const wrapper = await mountWithSet();
    wrapper.vm.requiredRows[0].value_txt_t9n = { pl: "x" };
    postProduct.mockRejectedValue({
      response: { data: { error: "VALIDATION_ERROR", message: "bad", details: [{ field: "attributes.name", issue: "REQUIRED_FEATURE_MISSING", description: "Name is required" }] } },
    });
    await wrapper.vm.createProduct();
    expect(wrapper.vm.requiredError("name")).toBe("Name is required");
  });
});

describe("ProductCreate — legacy PIM (required-features 404)", () => {
  it("shows no extra inputs and sends no attributes", async () => {
    getRequired.mockRejectedValue({ response: { status: 404, data: {} } });
    const wrapper = await mountWithSet();
    expect(wrapper.findAll(".af")).toHaveLength(0);

    await wrapper.vm.createProduct();
    expect(postProduct.mock.calls[0][1]).not.toHaveProperty("attributes");
  });

  it("asks the endpoint once, however many sets are chosen", async () => {
    getRequired.mockRejectedValue({ response: { status: 404, data: {} } });
    const wrapper = await mountWithSet();
    wrapper.vm.$data.form.feature_set_idx = "other";
    await flushPromises();
    expect(getRequired).toHaveBeenCalledTimes(1);
  });
});
