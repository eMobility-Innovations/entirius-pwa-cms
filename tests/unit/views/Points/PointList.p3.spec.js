import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/deliverypoints/api", () => ({
  GET_Points: vi.fn().mockResolvedValue({ data: { results: [], count: 0 } }),
  GET_PointsChannel: vi.fn().mockResolvedValue({ data: { results: [], count: 0 } }),
  GET_DPChannels: vi.fn().mockResolvedValue({ data: [{ idx: "b2c", name: "B2C" }] }),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderEnd() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));

import { GET_Points, GET_PointsChannel } from "@/api/deliverypoints/api";
import PointList from "@/views/Points/PointList.vue";

const BasicSelect = { name: "BasicSelect", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };

// Plan 17: the channel filter's `@onSelect` handler now hangs on BasicSelect `@update:model-value`.
describe("PointList — channel filter on BasicSelect", () => {
  it("fetches the picked channel's points, and all points for the 'all' option", async () => {
    const wrapper = mount(PointList, {
      global: { stubs: { BasicSelect, DataTable: true, MobileFilterPanel: true, Pagination: true, FloatingActions: true } },
    });
    await flushPromises();
    const select = wrapper.findComponent({ name: "BasicSelect" });
    await select.vm.$emit("update:modelValue", "b2c");
    expect(GET_PointsChannel).toHaveBeenLastCalledWith("b2c", expect.any(Object));
    expect(select.props("modelValue")).toBe("b2c");
    GET_Points.mockClear();
    await select.vm.$emit("update:modelValue", "__all");
    expect(GET_Points).toHaveBeenCalledTimes(1);
  });
});

// Plan 54b: a stale `?page=N` that comes back empty (or 404) goes to page 1 instead of an empty page without a pager.
describe("PointList — stale page", () => {
  const mountOnPage = (replace) =>
    mount(PointList, {
      global: {
        stubs: { BasicSelect, DataTable: true, MobileFilterPanel: true, Pagination: true, FloatingActions: true },
        mocks: { $route: { path: "/points", query: { page: "4", search: "x" } }, $router: { push: vi.fn(), replace } },
      },
    });

  it("drops the page from the query when the page comes back empty", async () => {
    GET_Points.mockResolvedValueOnce({ data: { results: [], count: 30 } });
    const replace = vi.fn();
    mountOnPage(replace);
    await flushPromises();
    expect(replace).toHaveBeenCalledWith({ path: "/points", query: { search: "x" } });
  });

  it("does the same for the API's 404 on a page past the end", async () => {
    GET_Points.mockRejectedValueOnce({ response: { status: 404 } });
    const replace = vi.fn();
    mountOnPage(replace);
    await flushPromises();
    expect(replace).toHaveBeenCalledWith({ path: "/points", query: { search: "x" } });
  });

  it("stays on a page with rows", async () => {
    GET_Points.mockResolvedValueOnce({ data: { results: [{ id: 1 }], count: 30 } });
    const replace = vi.fn();
    mountOnPage(replace);
    await flushPromises();
    expect(replace).not.toHaveBeenCalled();
  });
});

// Plan 56b: the smoke finds a carrier point by its marker's test id, not by any icon in the type column.
describe("PointList — carrier marker", () => {
  it("marks a carrier point's type with point-carrier, and only that one", async () => {
    const { default: DataTable } = await import("@/boots/DataTable/index.vue");
    GET_Points.mockResolvedValueOnce({
      data: {
        count: 2,
        results: [
          { id: 1, code: "a", type: { name: "InPost", is_carrier: true } },
          { id: 2, code: "b", type: { name: "Own", is_carrier: false } },
        ],
      },
    });
    const wrapper = mount(PointList, {
      global: {
        components: { DataTable },
        stubs: { BasicSelect, MobileFilterPanel: true, Pagination: true, FloatingActions: true },
      },
    });
    await flushPromises();
    const rows = wrapper.findAll(".data-table__row");
    expect(rows.map((row) => row.find('[data-testid="point-carrier"]').exists())).toEqual([true, false]);
  });
});
