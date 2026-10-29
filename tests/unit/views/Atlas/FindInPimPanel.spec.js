import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockLinkToRealProduct = vi.fn();
const mockSpawnNotification = vi.fn();

vi.mock("@/api/atlas/api", () => ({
  POST_LinkToRealProduct: (...args) => mockLinkToRealProduct(...args),
}));

vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockSpawnNotification }),
}));

import FindInPimPanel from "@/views/Atlas/components/FindInPimPanel.vue";

const globalStubs = {
  DedupSearchBox: {
    name: "DedupSearchBox",
    props: ["scope", "initialQuery", "imageUrl", "inline"],
    emits: ["results"],
    template: "<div class='stub-box' />",
  },
  CandidateRow: {
    name: "CandidateRow",
    props: ["hit"],
    template: "<div class='stub-row'><slot name='actions' /></div>",
  },
  // The Link action is an IconButton: a plain button that keeps `disabled` and the test id.
  IconButton: {
    props: ["disabled"],
    emits: ["click"],
    template: "<button :disabled='disabled' @click=\"$emit('click')\" />",
  },
  FontAwesomeIcon: true,
};

function makeHit(overrides = {}) {
  return {
    kind: "pim_product",
    ref: "SKU-1",
    score: 90,
    decision: "match",
    reasons: [],
    basic: { sku: "SKU-1", name: "Bosch GSR 12V-15", detail_url: "/x" },
    ...overrides,
  };
}

describe("FindInPimPanel.vue", () => {
  beforeEach(() => {
    mockLinkToRealProduct.mockReset();
    mockSpawnNotification.mockReset();
  });

  function mountPanel(props = {}) {
    return mount(FindInPimPanel, {
      props: {
        productId: 42,
        name: "Bosch GSR 12V-15",
        ean: "5901234123457",
        imageUrl: "/media/atlas/photo.jpg",
        ...props,
      },
      global: { stubs: globalStubs },
    });
  }

  it("seeds DedupSearchBox from name+ean and passes imageUrl through", () => {
    const wrapper = mountPanel();
    const box = wrapper.findComponent({ name: "DedupSearchBox" });
    expect(box.props("initialQuery")).toBe("Bosch GSR 12V-15 5901234123457");
    expect(box.props("imageUrl")).toBe("/media/atlas/photo.jpg");
    expect(box.props("scope")).toEqual(["pim_product"]);
  });

  it("link() success: attaches the SP by pk, notifies, emits linked with the sku", async () => {
    mockLinkToRealProduct.mockResolvedValue({ data: {} });
    const wrapper = mountPanel();
    await wrapper
      .findComponent({ name: "DedupSearchBox" })
      .vm.$emit("results", { hits: [makeHit()] });

    await wrapper
      .find("[data-testid='find-in-pim-link-SKU-1']")
      .trigger("click");
    await flushPromises();

    // The SP-attaching endpoint, not a bare product-links create: only this
    // sets real_product and takes the row out of the dedup pool.
    expect(mockLinkToRealProduct).toHaveBeenCalledWith(42, {
      real_product_sku: "SKU-1",
    });
    expect(mockSpawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "positive" })
    );
    expect(wrapper.emitted("linked")).toEqual([["SKU-1"]]);
  });

  it("link() failure: notifies negative and does not emit linked", async () => {
    mockLinkToRealProduct.mockRejectedValue({
      response: { data: { detail: "Conflict" } },
    });
    const wrapper = mountPanel();
    await wrapper
      .findComponent({ name: "DedupSearchBox" })
      .vm.$emit("results", { hits: [makeHit()] });

    await wrapper
      .find("[data-testid='find-in-pim-link-SKU-1']")
      .trigger("click");
    await flushPromises();

    expect(mockSpawnNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "negative" })
    );
    expect(wrapper.emitted("linked")).toBeUndefined();
  });

  it("disables the Link button for the in-flight sku until the request settles", async () => {
    let resolveLink;
    mockLinkToRealProduct.mockReturnValue(
      new Promise((resolve) => {
        resolveLink = resolve;
      })
    );
    const wrapper = mountPanel();
    await wrapper
      .findComponent({ name: "DedupSearchBox" })
      .vm.$emit("results", { hits: [makeHit()] });

    const button = wrapper.find("[data-testid='find-in-pim-link-SKU-1']");
    await button.trigger("click");
    expect(
      wrapper
        .find("[data-testid='find-in-pim-link-SKU-1']")
        .attributes("disabled")
    ).toBeDefined();

    resolveLink({ data: {} });
    await flushPromises();
    expect(
      wrapper
        .find("[data-testid='find-in-pim-link-SKU-1']")
        .attributes("disabled")
    ).toBeUndefined();
  });
});
