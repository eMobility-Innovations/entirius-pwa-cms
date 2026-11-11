import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => ({ GET_Categories: vi.fn(), GET_Category: vi.fn(), POST_Category: vi.fn() }));
vi.mock("@/api/pim/api", () => api);
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ activeChannelIdx: "bigtree", activeChannelLanguages: ["en"] }),
}));

import CategoryCreate from "@/views/Pim/CategoryCreate.vue";

const stubs = {
  PageLayout: { template: "<div><slot name='header' /><slot /></div>" },
  PageHeader: true,
  PimChannelSelect: true,
  BasicCard: { template: "<div><slot /></div>" },
  FormField: { template: "<div><slot /></div>" },
  BasicInput: true,
  BasicTextarea: true,
  BasicSwitch: true,
  BasicSelect: { name: "BasicSelect", props: ["options", "modelValue", "moreLabel"], template: "<div />" },
};

function mountCreate(query = {}) {
  return mount(CategoryCreate, { global: { stubs, mocks: { $route: { query }, $router: { push: vi.fn() } } } });
}
const parentSelect = (w) => w.findAllComponents({ name: "BasicSelect" })[0];

describe("CategoryCreate parent picker", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Object.values(api).forEach((fn) => fn.mockReset());
    api.GET_Categories.mockResolvedValue({ data: { results: [{ idx: "r1", name: "Root 1" }], next: "p2" } });
  });

  it("offers the first page, root first, with a load-more row", async () => {
    const w = mountCreate();
    await flushPromises();
    expect(api.GET_Categories).toHaveBeenCalledWith("bigtree", { page: 1, page_size: 50 });
    expect(parentSelect(w).props("options").map((o) => o.value)).toEqual([null, "r1"]);
    expect(parentSelect(w).props("moreLabel")).not.toBe("");
  });

  it("preselects ?parent and shows its name from the detail endpoint", async () => {
    api.GET_Category.mockResolvedValue({ data: { idx: "bt-deep", name: "Szukany Węzeł Głęboki" } });
    const w = mountCreate({ parent: "bt-deep" });
    await flushPromises();
    expect(api.GET_Category).toHaveBeenCalledWith("bigtree", "bt-deep");
    expect(parentSelect(w).props("modelValue")).toBe("bt-deep");
    expect(parentSelect(w).props("options").find((o) => o.value === "bt-deep").label).toBe("Szukany Węzeł Głęboki");
  });

  it("keeps the idx as the label when the parent cannot be read", async () => {
    api.GET_Category.mockRejectedValue(new Error("404"));
    const w = mountCreate({ parent: "gone" });
    await flushPromises();
    expect(parentSelect(w).props("options").find((o) => o.value === "gone").label).toBe("gone");
  });
});
