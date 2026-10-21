import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetProduct = vi.fn();
const mockGetPictures = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/api/pim/api", () => ({
  GET_Product: (...a) => mockGetProduct(...a),
  GET_ProductPictures: (...a) => mockGetPictures(...a),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockNotify }),
}));

import ProductPreviewCard from "@/views/EnrichmentReview/ProductPreviewCard.vue";

const product = (over = {}) => ({
  sku: "00079331",
  name: "Dualtron Spider 2",
  ean: null,
  is_enabled: true,
  visibility_name: "Catalog and search",
  feature_set_idx: "default",
  gap_count: 1,
  product_class_name: "ProductSimple",
  og_image: "/media/volkanos/x.jpg",
  ...over,
});

const picture = (role, url, position = 1) => ({ picture_role: role, position, picture: { image_url: url } });
const pictures = (...results) => ({ data: { count: results.length, results } });

const mountCard = (props = {}, routerMock = {}) =>
  mount(ProductPreviewCard, {
    props: { sku: "00079331", channelIdx: "escootersclinic", ...props },
    global: {
      mocks: { $router: { push: vi.fn(), ...routerMock } },
      stubs: { Loader: true, StatusBadge: true, EmptyState: true, FontAwesomeIcon: true },
    },
  });

describe("ProductPreviewCard", () => {
  beforeEach(() => {
    mockGetProduct.mockReset();
    mockGetPictures.mockReset().mockResolvedValue(pictures());
    mockNotify.mockReset();
  });

  it("fetches the product for the channel + sku on mount", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product() });
    const wrapper = mountCard();
    await flushPromises();

    expect(mockGetProduct).toHaveBeenCalledWith("escootersclinic", "00079331");
    expect(wrapper.vm.product.name).toBe("Dualtron Spider 2");
  });

  it("resolves a relative og_image against the API base", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product() });
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.vm.heroUrl).toContain("/media/volkanos/x.jpg");
  });

  it("shows the main picture of the product, read from its pictures list", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product({ og_image: "" }) });
    mockGetPictures.mockResolvedValueOnce(
      pictures(picture("general", "/media/image/g.jpg", 2), picture("main", "/media/image/m.jpg", 1))
    );
    const wrapper = mountCard();
    await flushPromises();

    expect(mockGetPictures).toHaveBeenCalledWith("escootersclinic", "00079331");
    expect(wrapper.get("img.product-preview__img").attributes("src")).toContain("/media/image/m.jpg");
  });

  it("takes the first picture when none has the main role", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product({ og_image: "" }) });
    mockGetPictures.mockResolvedValueOnce(
      pictures(picture("general", "/media/image/a.jpg", 1), picture("angle", "/media/image/b.jpg", 2))
    );
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.vm.heroUrl).toContain("/media/image/a.jpg");
  });

  it("falls back to og_image for a product without pictures, to the placeholder without that too", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product() });
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.vm.heroUrl).toContain("/media/volkanos/x.jpg");

    mockGetProduct.mockResolvedValueOnce({ data: product({ og_image: "" }) });
    await wrapper.setProps({ sku: "00193089" });
    await flushPromises();
    expect(wrapper.find("img.product-preview__img").exists()).toBe(false);
    expect(wrapper.find(".product-preview__img--ph").exists()).toBe(true);
  });

  it("a failed pictures request keeps the product details, with the placeholder and no toast", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product({ og_image: "" }) });
    mockGetPictures.mockRejectedValueOnce({ response: { status: 500 } });
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.vm.product.name).toBe("Dualtron Spider 2");
    expect(wrapper.find(".product-preview__img--ph").exists()).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("Go to PIM navigates to the product detail route", async () => {
    const push = vi.fn();
    mockGetProduct.mockResolvedValueOnce({ data: product() });
    const wrapper = mountCard({}, { push });
    await flushPromises();

    wrapper.vm.goToPim();
    expect(push).toHaveBeenCalledWith({
      name: "PimProductDetail",
      params: { sku: "00079331" },
    });
  });

  it("404 leaves product null without a toast", async () => {
    mockGetProduct.mockRejectedValueOnce({ response: { status: 404 } });
    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.vm.product).toBe(null);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("refetches when the sku prop changes", async () => {
    mockGetProduct.mockResolvedValue({ data: product() });
    const wrapper = mountCard();
    await flushPromises();
    expect(mockGetProduct).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ sku: "00193089" });
    await flushPromises();
    expect(mockGetProduct).toHaveBeenCalledTimes(2);
    expect(mockGetProduct.mock.calls.at(-1)).toEqual(["escootersclinic", "00193089"]);
  });
});

// Plan 54b: inside the preview drawer the card is flat — the drawer frames it and holds the dialog's one heading.
describe("ProductPreviewCard in the drawer", () => {
  it("renders flat, with the name as text instead of a second H2", async () => {
    const { default: BasicCard } = await import("@/boots/BasicCard/index.vue");
    mockGetProduct.mockResolvedValueOnce({ data: product() });
    const wrapper = mount(ProductPreviewCard, {
      props: { sku: "00079331", channelIdx: "escootersclinic", flat: true },
      global: { components: { BasicCard }, stubs: { Loader: true, StatusBadge: true, EmptyState: true, FontAwesomeIcon: true } },
    });
    await flushPromises();
    expect(wrapper.find(".basic-card--flat").exists()).toBe(true);
    expect(wrapper.find("h2").exists()).toBe(false);
    expect(wrapper.find(".product-preview__name").text()).toBe("Dualtron Spider 2");
  });

  it("names the product type in plain words, never the PIM class", async () => {
    mockGetProduct.mockResolvedValueOnce({ data: product() });
    const wrapper = mountCard();
    await flushPromises();
    expect(wrapper.text()).toContain("pim.type_simple");
    expect(wrapper.text()).not.toContain("ProductSimple");
  });
});
