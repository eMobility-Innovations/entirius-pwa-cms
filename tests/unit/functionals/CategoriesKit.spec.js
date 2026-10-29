import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockContent = vi.fn();

vi.mock("@/api/contentDB/api", () => ({ _METHOD_content: (...a) => mockContent(...a) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/handy", () => ({
  useHandyStore: () => ({ handyType: {}, defaults: {}, open_Handykit: vi.fn(), pass_Asset: vi.fn() }),
}));
vi.mock("@/stores/contentDBChannel", () => ({ useContentDBChannelStore: () => ({ defaultLanguage: "pl" }) }));

import CategoriesKit from "@/functionals/Handy-kit/kits/categories-kit/index.vue";

// The menu renders its panel (the list) at once, as BasicMenu does with v-show.
const BasicMenu = { template: '<div><slot name="trigger" /><slot name="panel" :close="() => {}" /></div>' };

const page = (n, pages) => ({
  data: {
    data: Array.from({ length: 6 }, (_, i) => ({ uid: `c${n}-${i}`, name: `Category ${n}-${i}` })),
    pagination: { page: n, pages, limit: 6 },
  },
});

// jsdom has no IntersectionObserver: record each one so the test can report the sentinel in view.
const observers = [];
class FakeObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    observers.push(this);
  }
}

describe("categories-kit", () => {
  beforeEach(() => {
    observers.length = 0;
    mockContent.mockReset();
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads the second page when the sentinel after a short first page is in view", async () => {
    mockContent.mockResolvedValueOnce(page(1, 2)).mockResolvedValueOnce(page(2, 2));
    const wrapper = mount(CategoriesKit, { global: { stubs: { BasicMenu, ConfirmDialog: true } } });
    await flushPromises();

    const [observer] = observers;
    const list = wrapper.find(".categories-kit__list").element;
    expect(observer.options.root).toBe(list);
    expect(observer.observe).toHaveBeenCalledWith(list.lastElementChild);

    observer.callback([{ isIntersecting: true }]);
    await flushPromises();

    expect(mockContent).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: "get", params: expect.objectContaining({ page: 2, limit: 6 }) })
    );
    expect(wrapper.findAll(".categories-kit__list > .ph-2")).toHaveLength(12);
  });

  it("re-checks the sentinel after a page lands, so an early return while loading loses no page", async () => {
    let land;
    mockContent.mockResolvedValueOnce(page(1, 3)).mockReturnValueOnce(new Promise((r) => (land = r)));
    const wrapper = mount(CategoriesKit, { global: { stubs: { BasicMenu, ConfirmDialog: true } } });
    await flushPromises();

    const [observer] = observers;
    observer.callback([{ isIntersecting: true }]);
    observer.callback([{ isIntersecting: true }]); // page 2 still loading: returns early
    expect(mockContent).toHaveBeenCalledTimes(2);
    observer.observe.mockClear();

    land(page(2, 3));
    await flushPromises();
    const sentinel = wrapper.find(".categories-kit__list").element.lastElementChild;
    expect(observer.unobserve).toHaveBeenCalledWith(sentinel);
    expect(observer.observe).toHaveBeenCalledWith(sentinel);
  });

  it("does not load past the last page and disconnects on unmount", async () => {
    mockContent.mockResolvedValueOnce(page(1, 1));
    const wrapper = mount(CategoriesKit, { global: { stubs: { BasicMenu, ConfirmDialog: true } } });
    await flushPromises();

    const [observer] = observers;
    observer.callback([{ isIntersecting: true }]);
    await flushPromises();
    expect(mockContent).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });
});
