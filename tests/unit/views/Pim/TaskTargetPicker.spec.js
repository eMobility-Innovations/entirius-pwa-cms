import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ POST_ResolveSubjects: vi.fn(), GET_Categories: vi.fn(), GET_Products: vi.fn() }));
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => ({ POST_ResolveSubjects: api.POST_ResolveSubjects }));
vi.mock("@/api/pim/api", () => ({ GET_Categories: api.GET_Categories, GET_Products: api.GET_Products }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    channels: [{ idx: "eu", name: "Europe" }], activeChannelIdx: "eu", setActiveChannel: vi.fn(), fetchChannels: vi.fn(),
  }),
}));

import TaskTargetPicker from "@/views/Pim/components/enrichment/TaskTargetPicker.vue";
import { parseRefs } from "@/views/Pim/components/enrichment/taskTargets";

const stubs = {
  FormField: { props: ["error"], template: "<div><slot /><p v-if='error' data-testid='field-error'>{{ error }}</p></div>" },
  BasicSelect: true,
  SegmentedControl: true,
  BasicTextarea: { name: "BasicTextarea", props: ["modelValue"], emits: ["update:modelValue"], template: "<textarea />" },
};

async function mountPicker() {
  const w = mount(TaskTargetPicker, { global: { stubs } });
  await flushPromises();
  return w;
}

async function paste(w, text) {
  w.findComponent({ name: "BasicTextarea" }).vm.$emit("update:modelValue", text);
  await w.vm.$nextTick();
  vi.runAllTimers();
  await flushPromises();
}

const lastTarget = (w) => w.emitted("update:modelValue").at(-1)[0];

describe("parseRefs", () => {
  it("splits an Excel column, commas, semicolons and spaces; dedupes in order", () => {
    expect(parseRefs("A-1\r\nB-2\tC-3, A-1;D-4  ;\n\n E-5,")).toEqual(["A-1", "B-2", "C-3", "D-4", "E-5"]);
    expect(parseRefs("  ")).toEqual([]);
  });
});

describe("TaskTargetPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("checks the pasted SKUs in the channel: unknown ones are named and left out", async () => {
    api.POST_ResolveSubjects.mockResolvedValue({
      data: { known: [{ ref: "A", label: "Sofa" }, { ref: "B", label: "" }], unknown: ["X", "Y"] },
    });
    const w = await mountPicker();
    await paste(w, "A\nB\nX, Y\nA");
    expect(api.POST_ResolveSubjects).toHaveBeenCalledWith({ module: "pim", channel: "eu", refs: ["A", "B", "X", "Y"] });
    expect(lastTarget(w)).toEqual({ skus: ["A", "B"], filters: null, count: 2, pending: false });
    expect(w.find("[data-testid='task-targets-summary']").text()).toContain("enrichment.studio.task.recognised_few");
    expect(w.find("[data-testid='task-targets-unknown']").exists()).toBe(true);
    expect(w.vm.unknownText).toBe('enrichment.studio.task.unknown::{"count":2,"list":"X, Y"}');
  });

  it("names the first 10 unknown SKUs and counts the rest", async () => {
    const unknown = Array.from({ length: 12 }, (_, i) => `U${i}`);
    api.POST_ResolveSubjects.mockResolvedValue({ data: { known: [], unknown } });
    const w = await mountPicker();
    await paste(w, unknown.join(" "));
    expect(w.vm.unknownText).toContain('"count":12');
    expect(w.vm.unknownText).toContain('U8, U9\\",\\"count\\":2');
    expect(w.vm.unknownText).not.toContain("U10");
  });

  it("is pending while typing, so nothing runs on a half-checked list", async () => {
    api.POST_ResolveSubjects.mockResolvedValue({ data: { known: [{ ref: "A", label: "" }], unknown: [] } });
    const w = await mountPicker();
    w.findComponent({ name: "BasicTextarea" }).vm.$emit("update:modelValue", "A");
    await w.vm.$nextTick();
    expect(lastTarget(w).pending).toBe(true);
    vi.runAllTimers();
    await flushPromises();
    expect(lastTarget(w)).toMatchObject({ skus: ["A"], pending: false });
  });

  it("over 500 SKUs: an error, no lookup, nothing to run", async () => {
    const w = await mountPicker();
    await paste(w, Array.from({ length: 501 }, (_, i) => `S${i}`).join("\n"));
    expect(api.POST_ResolveSubjects).not.toHaveBeenCalled();
    expect(w.find("[data-testid='field-error']").text()).toBe('enrichment.studio.task.too_many::{"max":500}');
    expect(lastTarget(w)).toMatchObject({ skus: [], count: 0, pending: false });
  });

  it("a stale answer never overwrites a newer paste", async () => {
    let first;
    api.POST_ResolveSubjects
      .mockReturnValueOnce(new Promise((resolve) => (first = resolve)))
      .mockResolvedValueOnce({ data: { known: [{ ref: "B", label: "" }], unknown: [] } });
    const w = await mountPicker();
    await paste(w, "A");
    await paste(w, "B");
    first({ data: { known: [{ ref: "A", label: "" }], unknown: [] } });
    await flushPromises();
    expect(lastTarget(w).skus).toEqual(["B"]);
  });

  describe("category", () => {
    const pickCategory = async (w, idx) => {
      w.vm.mode = "category";
      await flushPromises();
      w.vm.category = idx;
      await flushPromises();
    };

    beforeEach(() => api.GET_Categories.mockResolvedValue({ data: { results: [{ idx: "sofas", name: "Sofas" }] } }));

    it("a small category runs as its SKUs (Run now stays possible)", async () => {
      api.GET_Products.mockResolvedValue({ data: { count: 2, results: [{ sku: "A" }, { sku: "B" }] } });
      const w = await mountPicker();
      await pickCategory(w, "sofas");
      expect(api.GET_Products).toHaveBeenCalledWith("eu", { category: "sofas", page_size: 20 });
      expect(lastTarget(w)).toEqual({ skus: ["A", "B"], filters: null, count: 2, pending: false });
    });

    it("a big category is a filter scope; over 500 the summary says one run takes the first 500", async () => {
      api.GET_Products.mockResolvedValue({ data: { count: 640, results: [] } });
      const w = await mountPicker();
      await pickCategory(w, "sofas");
      expect(lastTarget(w)).toEqual({ skus: [], filters: { category_idx: "sofas" }, count: 640, pending: false });
      expect(w.find("[data-testid='task-targets-summary']").text()).toContain("enrichment.studio.task.first_only");
    });
  });
});
