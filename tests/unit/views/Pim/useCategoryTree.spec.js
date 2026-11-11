// The lazy category tree: levels keyed by parent pk, paged per level, restored from localStorage.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCategoryTree } from "@/views/Pim/composables/useCategoryTree";

// A fake backend: cats = [{pk, idx, name, parent_category, position}], page size 100 like django-pim.
function makeBackend(cats, { withCount = false } = {}) {
  const list = vi.fn(async (_ch, params) => {
    let rows = cats.filter((c) =>
      params.root_only ? c.parent_category == null : params.parent_category !== undefined ? c.parent_category === params.parent_category : true
    );
    if (params.search) rows = rows.filter((c) => c.name.includes(params.search));
    if (params.is_active !== undefined) rows = rows.filter((c) => c.is_active === params.is_active);
    rows = [...rows].sort((a, b) => a.position - b.position);
    const size = params.page_size;
    const start = (params.page - 1) * size;
    const results = rows.slice(start, start + size).map(({ position, ...c }) => {
      const item = { is_active: true, product_count: 0, ...c };
      if (withCount) item.subcategory_count = cats.filter((x) => x.parent_category === c.pk).length;
      return item;
    });
    return { data: { count: rows.length, next: start + size < rows.length ? "n" : null, results } };
  });
  const detail = vi.fn(async (_ch, idx) => {
    const c = cats.find((x) => x.idx === idx);
    const parent = cats.find((x) => x.pk === c.parent_category);
    return { data: { ...c, parent_category_idx: parent ? parent.idx : null } };
  });
  const reorder = vi.fn(async (_ch, { items }) => {
    items.forEach(({ idx, parent_category_idx, position }) => {
      const c = cats.find((x) => x.idx === idx);
      c.parent_category = cats.find((x) => x.idx === parent_category_idx)?.pk ?? null;
      c.position = position;
    });
    return { data: {} };
  });
  return { api: { GET_Categories: list, GET_Category: detail, PATCH_CategoriesReorder: reorder }, list, detail, reorder };
}

function dataset() {
  const cats = [];
  let pk = 1;
  const add = (idx, parent, position, extra = {}) => {
    const c = { pk: pk++, idx, name: idx, parent_category: parent, position, ...extra };
    cats.push(c);
    return c;
  };
  const r0 = add("r0", null, 0);
  const r1 = add("r1", null, 1);
  for (let i = 0; i < 250; i++) add(`c${i}`, r0.pk, i);
  const g = add("c0g", cats.find((c) => c.idx === "c0").pk, 0);
  add("deep", g.pk, 0, { name: "Needle" });
  add("d1", r1.pk, 0);
  return cats;
}

const nodes = (tree) => tree.rows.value.filter((r) => r.type === "node").map((r) => r.item.idx);
const make = (backend, extra = {}) => {
  const errors = [];
  const tree = useCategoryTree({ getChannel: () => "ch", api: backend.api, onError: (e) => errors.push(e), ...extra });
  return { tree, errors };
};

beforeEach(() => localStorage.clear());

describe("useCategoryTree", () => {
  it("loads only the roots, page 1, with root_only", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    expect(b.list).toHaveBeenCalledTimes(1);
    expect(b.list.mock.calls[0][1]).toMatchObject({ root_only: true, page: 1, page_size: 100 });
    expect(nodes(tree)).toEqual(["r0", "r1"]);
  });

  it("expands one level, pages it, and never auto-loads the next page", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    await tree.toggle(tree.levels.root.items[0]);
    await vi.waitFor(() => expect(tree.levels[1]?.loading).toBe(false));
    expect(tree.levels[1].items).toHaveLength(100);
    expect(tree.levels[1].count).toBe(250);
    const more = tree.rows.value.find((r) => r.type === "more");
    expect(more).toMatchObject({ loaded: 100, count: 250, levelKey: 1 });
    await tree.loadMore(1);
    await tree.loadMore(1);
    expect(tree.levels[1].items).toHaveLength(250);
    expect(tree.rows.value.find((r) => r.type === "more")).toBeUndefined();
    expect(b.list.mock.calls.filter(([, p]) => p.parent_category === 1)).toHaveLength(3);
  });

  it("shows the toggle until an expand returns no children, then marks a leaf", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    const r1 = tree.levels.root.items[1];
    expect(tree.isLeaf(r1)).toBe(false);
    tree.toggle(tree.levels.root.items[1]);
    await vi.waitFor(() => expect(tree.levels[r1.pk].loading).toBe(false));
    const d1 = tree.levels[r1.pk].items[0];
    tree.toggle(d1);
    await vi.waitFor(() => expect(tree.levels[d1.pk].loading).toBe(false));
    expect(tree.isLeaf(d1)).toBe(true);
    expect(tree.rows.value.find((r) => r.item?.idx === "d1").leaf).toBe(true);
  });

  it("uses subcategory_count when the API sends it", async () => {
    const b = makeBackend(dataset(), { withCount: true });
    const { tree } = make(b);
    await tree.load();
    const [r0] = tree.levels.root.items;
    expect(tree.isLeaf(r0)).toBe(false);
    expect(tree.isLeaf({ pk: 99, idx: "x", subcategory_count: 0 })).toBe(true);
  });

  it("reports a failed expand and retries with loadMore", async () => {
    const b = makeBackend(dataset());
    const { tree, errors } = make(b);
    await tree.load();
    const orig = b.api.GET_Categories.getMockImplementation();
    b.api.GET_Categories.mockRejectedValueOnce(new Error("boom"));
    tree.toggle(tree.levels.root.items[1]);
    await vi.waitFor(() => expect(errors).toHaveLength(1));
    await vi.waitFor(() => expect(tree.rows.value.some((r) => r.type === "error")).toBe(true));
    b.api.GET_Categories.mockImplementation(orig);
    await tree.loadMore(tree.levels.root.items[1].pk);
    expect(nodes(tree)).toContain("d1");
    expect(tree.rows.value.some((r) => r.type === "error")).toBe(false);
  });

  it("completes the level before a before/after reorder and renumbers all siblings", async () => {
    const cats = dataset();
    const b = makeBackend(cats);
    const { tree } = make(b);
    await tree.load();
    tree.toggle(tree.levels.root.items[0]);
    await vi.waitFor(() => expect(tree.levels[1].loading).toBe(false));
    expect(tree.levels[1].nextPage).toBe(2);
    expect(await tree.move("c5", "c1", "after")).toBe(true);
    const { items } = b.reorder.mock.calls[0][1];
    expect(items).toHaveLength(250);
    expect(items.map((i) => i.position)).toEqual([...Array(250).keys()]);
    expect(items.slice(0, 3).map((i) => i.idx)).toEqual(["c0", "c1", "c5"]);
    expect(items.every((i) => i.parent_category_idx === "r0")).toBe(true);
    expect(tree.levels[1].items.slice(0, 3).map((i) => i.idx)).toEqual(["c0", "c1", "c5"]);
    expect(tree.levels[1].items).toHaveLength(250);
  });

  it("inside drop: position = child count from a page_size=1 request, refreshes both levels, expands target", async () => {
    const cats = dataset();
    const b = makeBackend(cats);
    const { tree } = make(b);
    await tree.load();
    tree.toggle(tree.levels.root.items[0]);
    await vi.waitFor(() => expect(tree.levels[1].loading).toBe(false));
    expect(await tree.move("c5", "r1", "inside")).toBe(true);
    expect(b.list.mock.calls.some(([, p]) => p.page_size === 1 && p.parent_category === 2)).toBe(true);
    expect(b.reorder.mock.calls[0][1].items).toEqual([{ idx: "c5", parent_category_idx: "r1", position: 1 }]);
    expect(tree.levels[1].count).toBe(249);
    expect(tree.levels[1].pages).toBe(1);
    expect(tree.expanded.value.has("r1")).toBe(true);
    await vi.waitFor(() => expect(tree.levels[2]?.items.map((i) => i.idx)).toEqual(["d1", "c5"]));
  });

  it("refuses a drop onto an own descendant", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    tree.toggle(tree.levels.root.items[0]);
    await vi.waitFor(() => expect(tree.levels[1].loading).toBe(false));
    tree.toggle(tree.levels[1].items[0]);
    await vi.waitFor(() => expect(tree.levels[tree.levels[1].items[0].pk]?.loading).toBe(false));
    expect(tree.canDrop("r0", "c0")).toBe(false);
    expect(tree.canDrop("c0", "c0g")).toBe(false);
    expect(tree.canDrop("c0g", "c1")).toBe(true);
  });

  it("persists expanded nodes and pages per channel and restores them lazily", async () => {
    const b = makeBackend(dataset());
    const first = make(b).tree;
    await first.load();
    first.toggle(first.levels.root.items[0]);
    await vi.waitFor(() => expect(first.levels[1].loading).toBe(false));
    await first.loadMore(1);
    expect(JSON.parse(localStorage.getItem("cms_pim_category_expanded_ch"))).toEqual(["r0"]);
    expect(JSON.parse(localStorage.getItem("cms_pim_category_pages_ch"))).toEqual({ r0: 2 });

    b.list.mockClear();
    const second = make(b).tree;
    await second.load();
    expect(second.levels[1].items).toHaveLength(200);
    expect(second.expanded.value.has("r0")).toBe(true);
    expect(b.list.mock.calls.filter(([, p]) => p.parent_category === 1)).toHaveLength(2);
  });

  it("survives blocked storage", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { tree } = make(makeBackend(dataset()));
    await tree.load();
    expect(nodes(tree)).toEqual(["r0", "r1"]);
    spy.mockRestore();
  });

  it("resets on a channel change", async () => {
    let channel = "a";
    const b = makeBackend(dataset());
    const tree = useCategoryTree({ getChannel: () => channel, api: b.api });
    await tree.load();
    tree.toggle(tree.levels.root.items[0]);
    await vi.waitFor(() => expect(tree.levels[1].loading).toBe(false));
    channel = "b";
    await tree.load();
    expect(Object.keys(tree.levels)).toEqual(["root"]);
    expect(tree.expanded.value.size).toBe(0);
  });

  it("search and the status filter give a flat paginated list", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    await tree.applyFilter("Needle", null);
    expect(tree.isSearchMode.value).toBe(true);
    expect(b.list.mock.calls.at(-1)[1]).toMatchObject({ search: "Needle", page: 1, page_size: 100 });
    expect(tree.search.items.map((i) => i.idx)).toEqual(["deep"]);
    await tree.applyFilter("", false);
    expect(b.list.mock.calls.at(-1)[1]).toMatchObject({ is_active: false });
    await tree.applyFilter("", null);
    expect(tree.isSearchMode.value).toBe(false);
  });

  it("ignores a stale search answer", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    const slow = tree.applyFilter("Needle", null);
    await tree.applyFilter("c1", null);
    await slow;
    expect(tree.search.query).toBe("c1");
    expect(tree.search.items.every((i) => i.name.includes("c1"))).toBe(true);
  });

  it("reveals a deep node: resolves the chain and loads each level until it is found", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    expect(await tree.revealInTree("deep")).toBe("ok");
    expect(nodes(tree)).toContain("deep");
    expect(tree.highlightIdx.value).toBe("deep");
    expect(tree.expanded.value.has("c0g")).toBe(true);
  });

  it("reveal finds a node on a later page of its level", async () => {
    const b = makeBackend(dataset());
    const { tree } = make(b);
    await tree.load();
    expect(await tree.revealInTree("c230")).toBe("ok");
    expect(tree.levels[1].pages).toBe(3);
  });

  describe("completing a level before a reorder", () => {
    // 1 root with 1000 children (10 pages); the backend answers each page after a tick and tracks concurrency.
    function bigLevel() {
      const cats = [{ pk: 1, idx: "r", name: "r", parent_category: null, position: 0 }];
      for (let i = 0; i < 1000; i++) cats.push({ pk: i + 2, idx: `k${i}`, name: `k${i}`, parent_category: 1, position: i });
      const b = makeBackend(cats);
      const base = b.api.GET_Categories.getMockImplementation();
      const state = { active: 0, max: 0, failPage: null };
      b.api.GET_Categories.mockImplementation(async (ch, params) => {
        if (params.parent_category !== 1 || params.page_size !== 100) return base(ch, params);
        state.active++;
        state.max = Math.max(state.max, state.active);
        await new Promise((r) => setTimeout(r, 60 + (10 - params.page) * 5));
        state.active--;
        if (state.failPage === params.page) throw new Error("boom");
        return base(ch, params);
      });
      return { cats, b, state };
    }

    async function opened(env) {
      const { tree, errors } = make(env.b);
      await tree.load();
      tree.toggle(tree.levels.root.items[0]);
      await vi.waitFor(() => expect(tree.levels[1].loading).toBe(false));
      return { tree, errors };
    }

    it("fetches the missing pages concurrently (at most 4) and keeps the page order", async () => {
      const env = bigLevel();
      const { tree } = await opened(env);
      env.state.max = 0;
      expect(await tree.move("k50", "k1", "after")).toBe(true);
      expect(env.state.max).toBeGreaterThan(1);
      expect(env.state.max).toBeLessThanOrEqual(4);
      const { items } = env.b.reorder.mock.calls[0][1];
      expect(items).toHaveLength(1000);
      expect(items.slice(0, 3).map((i) => i.idx)).toEqual(["k0", "k1", "k50"]);
      expect(items.slice(3, 6).map((i) => i.idx)).toEqual(["k2", "k3", "k4"]);
      expect(items.at(-1).idx).toBe("k999");
    });

    it("keeps the loading state on the level while it completes", async () => {
      const env = bigLevel();
      const { tree } = await opened(env);
      const moving = tree.move("k50", "k1", "after");
      await vi.waitFor(() => expect(tree.levels[1].loading).toBe(true));
      await moving;
      expect(tree.levels[1].loading).toBe(false);
    });

    it("a failed page sets the level error and sends no reorder", async () => {
      const env = bigLevel();
      const { tree, errors } = await opened(env);
      env.state.failPage = 6;
      expect(await tree.move("k50", "k1", "after")).toBe(false);
      expect(env.b.reorder).not.toHaveBeenCalled();
      expect(errors.length).toBeGreaterThan(0);
      expect(tree.levels[1].items).toHaveLength(100);
    });
  });
});
