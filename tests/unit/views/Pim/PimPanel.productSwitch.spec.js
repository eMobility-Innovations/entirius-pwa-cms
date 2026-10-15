import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { config, mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";

vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ fetchChannels: vi.fn() }) }));
vi.mock("@/stores/quality", () => ({ useQualityStore: () => ({ available: true, probe: vi.fn() }) }));

import PimPanel from "@/views/Pim/index.vue";
import ProductDetail from "@/views/Pim/ProductDetail.vue";

// Going from one product page to another (same route, new SKU) shows the new product: the view is mounted anew.
describe("PIM panel — one product after another", () => {
  // The real router's $route, not the global test mock.
  const mocks = config.global.mocks;
  beforeAll(() => {
    const { $route, $router, ...rest } = mocks;
    config.global.mocks = rest;
  });
  afterAll(() => {
    config.global.mocks = mocks;
  });

  it("mounts the product view again for a new SKU, not for a tab or the AI drawer", async () => {
    const mounted = vi.fn();
    const Product = { template: "<p>{{ $route.params.sku }}</p>", mounted() { mounted(this.$route.params.sku); } };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/pim", component: PimPanel, children: [{ path: "products/:sku(.*)", component: Product }] }],
    });
    router.push("/pim/products/A");
    await router.isReady();
    const wrapper = mount({ template: "<router-view />" }, { global: { plugins: [router] } });
    await flushPromises();

    await router.push("/pim/products/A?ai=1#seo");
    await router.push("/pim/products/B");
    await flushPromises();

    expect(mounted.mock.calls).toEqual([["A"], ["B"]]);
    expect(wrapper.text()).toBe("B");
  });

  it("unsaved edits ask first before another product replaces this one", () => {
    const guardNavigation = vi.fn();
    const next = vi.fn();
    const route = (sku) => ({ params: { sku } });

    ProductDetail.beforeRouteUpdate.call({ guardNavigation }, route("A"), route("A"), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(guardNavigation).not.toHaveBeenCalled();

    ProductDetail.beforeRouteUpdate.call({ guardNavigation }, route("B"), route("A"), next);
    expect(guardNavigation).toHaveBeenCalledWith(route("B"), route("A"), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
