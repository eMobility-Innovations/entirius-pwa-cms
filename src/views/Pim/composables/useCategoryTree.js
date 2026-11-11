import { ref, reactive, computed } from "vue";
import {
  GET_Categories,
  GET_Category,
  PATCH_CategoriesReorder,
} from "@/api/pim/api";

export const PAGE_SIZE = 100;
const ROOT = "root";
const ROOT_STORAGE_KEY = "__root__";
const RESTORE_CONCURRENCY = 4;
const PARALLEL_PAGES = RESTORE_CONCURRENCY;
const MAX_RESTORED_PAGES = 10;
const REVEAL_PAGE_CAP = 40;
const REVEAL_CHAIN_CAP = 20;

const newLevel = () => ({
  items: [],
  count: 0,
  nextPage: 1,
  pages: 0,
  loading: false,
  error: null,
});

const levelKeyOf = (parentPk) => (parentPk == null ? ROOT : parentPk);

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage blocked: ignore */
  }
}

// Lazy, paginated category tree. Levels are keyed by the parent pk ("root" for the roots); a level is
// {items, count, nextPage, pages, loading, error}. `nextPage` is null once the level is complete.
// A new django-pim may add `subcategory_count` / `position` to list items: both are used when present, never required.
export function useCategoryTree({ getChannel, api = {}, onError = () => {} }) {
  const list = api.GET_Categories || GET_Categories;
  const detail = api.GET_Category || GET_Category;
  const reorderApi = api.PATCH_CategoriesReorder || PATCH_CategoriesReorder;

  const levels = reactive({});
  const expanded = ref(new Set());
  const highlightIdx = ref(null);
  const reordering = ref(false);
  const revealing = ref(false);
  const search = reactive({
    query: "",
    isActive: null,
    ...newLevel(),
  });
  let byPk = new Map();
  let byIdx = new Map();
  let generation = 0;
  let searchSeq = 0;
  let persistedPages = {};
  let queue = [];
  let running = 0;
  let idleResolvers = [];
  let inflight = new Map();

  const channel = () => getChannel();
  const storageKey = (kind) => `cms_pim_category_${kind}_${channel()}`;
  const isSearchMode = computed(
    () => !!search.query.trim() || search.isActive !== null
  );

  // --- storage ---

  function saveExpanded() {
    writeJson(storageKey("expanded"), [...expanded.value]);
  }

  function savePages() {
    const pages = {};
    const put = (key, level) => {
      if (level && level.pages > 1) pages[key] = level.pages;
    };
    put(ROOT_STORAGE_KEY, levels[ROOT]);
    for (const [pk, level] of Object.entries(levels)) {
      const item = byPk.get(Number(pk));
      if (item) put(item.idx, level);
    }
    writeJson(storageKey("pages"), pages);
  }

  // --- level loading ---

  function register(items) {
    items.forEach((item) => {
      byPk.set(item.pk, item);
      byIdx.set(item.idx, item);
    });
  }

  async function fetchPage(parentPk, page, extra = {}) {
    const params = { page, page_size: PAGE_SIZE, ...extra };
    if (parentPk == null) params.root_only = true;
    else params.parent_category = parentPk;
    const { data } = await list(channel(), params);
    return data;
  }

  function appendPage(level, data) {
    const known = new Set(level.items.map((i) => i.idx));
    const fresh = (data.results || []).filter((i) => !known.has(i.idx));
    register(fresh);
    level.items.push(...fresh);
    level.count = data.count ?? level.items.length;
    level.pages += 1;
    level.nextPage = data.next ? level.pages + 1 : null;
  }

  // Loads `pages` more pages of a level (default 1). Errors stay on the level: loadMore() retries.
  function loadLevel(key, pages = 1) {
    if (inflight.has(key)) return inflight.get(key);
    const promise = runLevel(key, pages).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  async function runLevel(key, pages) {
    const gen = generation;
    if (!levels[key]) levels[key] = newLevel();
    const level = levels[key];
    level.loading = true;
    level.error = null;
    try {
      for (let i = 0; i < pages && level.nextPage; i++) {
        const data = await fetchPage(
          key === ROOT ? null : key,
          level.nextPage
        );
        if (gen !== generation) return;
        appendPage(level, data);
      }
    } catch (err) {
      if (gen !== generation) return;
      level.error = err;
      onError(err);
    } finally {
      if (gen === generation) level.loading = false;
    }
    if (gen !== generation) return;
    savePages();
    scheduleRestore(level);
  }

  const loadMore = (key) => loadLevel(key, 1);

  // Fetches the given pages with at most PARALLEL_PAGES requests at once; the result keeps the page order.
  async function fetchPages(parentPk, pageNumbers) {
    const out = new Array(pageNumbers.length);
    let next = 0;
    let failed = false;
    const worker = async () => {
      while (next < pageNumbers.length && !failed) {
        const i = next++;
        try {
          out[i] = await fetchPage(parentPk, pageNumbers[i]);
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    };
    const workers = Math.min(PARALLEL_PAGES, pageNumbers.length);
    await Promise.all(Array.from({ length: workers }, worker));
    return out;
  }

  // Completes a level: the missing pages are known from `count`, so they load in parallel and append in page order.
  // A failed page leaves the level in its error state, with nothing of the failed batch appended.
  async function loadRest(key) {
    await inflight.get(key);
    const level = levels[key];
    const gen = generation;
    while (level.nextPage && !level.error) {
      const last = Math.max(Math.ceil(level.count / PAGE_SIZE), level.nextPage);
      const numbers = Array.from(
        { length: last - level.nextPage + 1 },
        (_, i) => level.nextPage + i
      );
      level.loading = true;
      try {
        const pages = await fetchPages(key === ROOT ? null : key, numbers);
        if (gen !== generation) return;
        pages.forEach((data) => appendPage(level, data));
      } catch (err) {
        if (gen !== generation) return;
        level.error = err;
        onError(err);
      } finally {
        if (gen === generation) level.loading = false;
      }
    }
    if (gen === generation) savePages();
  }

  // Replaces a loaded level in place, keeping how many pages it had.
  async function refreshLevel(key) {
    const level = levels[key];
    if (!level) return;
    const gen = generation;
    const total = Math.max(level.pages, 1);
    try {
      const parentPk = key === ROOT ? null : key;
      const pages = await fetchPages(
        parentPk,
        Array.from({ length: total }, (_, i) => i + 1)
      );
      if (gen !== generation) return;
      const fresh = newLevel();
      pages.forEach((data) => appendPage(fresh, data));
      fresh.nextPage = pages[pages.length - 1].next ? total + 1 : null;
      Object.assign(level, fresh);
    } catch (err) {
      onError(err);
    }
  }

  // --- restore of expanded branches (limited concurrency) ---

  function scheduleRestore(level) {
    level.items.forEach((item) => {
      if (expanded.value.has(item.idx) && !levels[item.pk]) {
        queue.push(item);
      }
    });
    pump();
  }

  function pump() {
    while (running < RESTORE_CONCURRENCY && queue.length) {
      const item = queue.shift();
      if (levels[item.pk]) continue;
      const pages = Math.min(
        persistedPages[item.idx] || 1,
        MAX_RESTORED_PAGES
      );
      const gen = generation;
      running++;
      loadLevel(item.pk, pages).finally(() => {
        if (gen !== generation) return;
        running--;
        pump();
      });
    }
    if (!running && !queue.length) {
      idleResolvers.forEach((r) => r());
      idleResolvers = [];
    }
  }

  const whenIdle = () =>
    running || queue.length
      ? new Promise((resolve) => idleResolvers.push(resolve))
      : Promise.resolve();

  // Resets everything for the active channel, loads the roots, restores expanded branches.
  async function load() {
    generation++;
    inflight = new Map();
    queue = [];
    running = 0;
    byPk = new Map();
    byIdx = new Map();
    Object.keys(levels).forEach((k) => delete levels[k]);
    Object.assign(search, { query: "", isActive: null, ...newLevel() });
    highlightIdx.value = null;
    expanded.value = new Set(readJson(storageKey("expanded"), []));
    persistedPages = readJson(storageKey("pages"), {});
    const rootPages = Math.min(
      persistedPages[ROOT_STORAGE_KEY] || 1,
      MAX_RESTORED_PAGES
    );
    await loadLevel(ROOT, rootPages);
    await whenIdle();
  }

  // --- tree state ---

  function isLeaf(item) {
    const level = levels[item.pk];
    if (level && !level.error && level.nextPage !== 1) return level.count === 0;
    if ("subcategory_count" in item) return item.subcategory_count === 0;
    return false;
  }

  function toggle(item) {
    const next = new Set(expanded.value);
    if (next.has(item.idx)) next.delete(item.idx);
    else next.add(item.idx);
    expanded.value = next;
    saveExpanded();
    if (next.has(item.idx) && !levels[item.pk]) loadLevel(item.pk);
  }

  function collapseAll() {
    expanded.value = new Set();
    saveExpanded();
  }

  function expandItem(item) {
    if (!expanded.value.has(item.idx)) {
      expanded.value = new Set(expanded.value).add(item.idx);
      saveExpanded();
    }
    if (!levels[item.pk]) return loadLevel(item.pk);
  }

  // The visible tree as a flat list of node / more / error rows.
  const rows = computed(() => {
    const out = [];
    const walk = (key, depth) => {
      const level = levels[key];
      if (!level) return;
      level.items.forEach((item) => {
        const child = levels[item.pk];
        const isOpen = expanded.value.has(item.idx);
        out.push({
          type: "node",
          key: `n:${item.idx}`,
          item,
          depth,
          isRoot: depth === 0,
          expanded: isOpen,
          leaf: isLeaf(item),
          loading: !!child?.loading,
        });
        if (isOpen && child) walk(item.pk, depth + 1);
      });
      if (level.error && !level.loading) {
        out.push({ type: "error", key: `e:${key}`, levelKey: key, depth });
      } else if (level.nextPage && level.items.length) {
        out.push({
          type: "more",
          key: `m:${key}`,
          levelKey: key,
          depth,
          loaded: level.items.length,
          count: level.count,
          loading: level.loading,
        });
      }
    };
    walk(ROOT, 0);
    return out;
  });

  // --- search / status filter: a flat list straight from the API ---

  async function loadSearchPage() {
    const seq = searchSeq;
    search.loading = true;
    search.error = null;
    const params = { page: search.nextPage, page_size: PAGE_SIZE };
    if (search.query.trim()) params.search = search.query.trim();
    if (search.isActive !== null) params.is_active = search.isActive;
    try {
      const { data } = await list(channel(), params);
      if (seq !== searchSeq) return;
      appendPage(search, data);
    } catch (err) {
      if (seq !== searchSeq) return;
      search.error = err;
      onError(err);
    } finally {
      if (seq === searchSeq) search.loading = false;
    }
  }

  function applyFilter(query, isActive) {
    searchSeq++;
    Object.assign(search, newLevel(), { query: query || "", isActive });
    if (!isSearchMode.value) return Promise.resolve();
    return loadSearchPage();
  }

  const searchMore = () => (search.loading ? undefined : loadSearchPage());

  // --- show in tree ---

  async function ancestorChain(idx) {
    const chain = [idx];
    let current = idx;
    for (let i = 0; i < REVEAL_CHAIN_CAP; i++) {
      const { data } = await detail(channel(), current);
      if (!data.parent_category_idx) return chain;
      current = data.parent_category_idx;
      chain.unshift(current);
    }
    throw new Error("category chain too deep");
  }

  async function findInLevel(key, idx) {
    if (!levels[key]) await loadLevel(key);
    let pages = 0;
    while (!levels[key].items.some((i) => i.idx === idx)) {
      const level = levels[key];
      if (!level.nextPage || level.error || pages++ >= REVEAL_PAGE_CAP) {
        return null;
      }
      await loadLevel(key);
    }
    return levels[key].items.find((i) => i.idx === idx);
  }

  // Returns "ok" | "not_found" | "error". The caller clears search/filter first (via applyFilter).
  async function revealInTree(idx) {
    const gen = generation;
    revealing.value = true;
    try {
      const chain = await ancestorChain(idx);
      let key = ROOT;
      for (let i = 0; i < chain.length; i++) {
        const item = await findInLevel(key, chain[i]);
        if (gen !== generation) return "error";
        if (!item) return "not_found";
        if (i === chain.length - 1) break;
        await expandItem(item);
        key = item.pk;
      }
      highlightIdx.value = idx;
      return "ok";
    } catch (err) {
      onError(err);
      return "error";
    } finally {
      revealing.value = false;
    }
  }

  // --- drag and drop reorder ---

  function isDescendant(ancestorPk, item) {
    let parent = item.parent_category;
    for (let guard = 0; parent != null && guard < 100; guard++) {
      if (parent === ancestorPk) return true;
      parent = byPk.get(parent)?.parent_category;
    }
    return false;
  }

  function canDrop(draggedIdx, targetIdx) {
    const dragged = byIdx.get(draggedIdx);
    const target = byIdx.get(targetIdx);
    if (!dragged || !target || dragged.idx === target.idx) return false;
    return !isDescendant(dragged.pk, target);
  }

  const sortByPosition = (items) =>
    items.every((i) => i.position != null)
      ? [...items].sort((a, b) => a.position - b.position)
      : items;

  async function childCount(target, dragged) {
    const level = levels[target.pk];
    const alreadyChild = dragged.parent_category === target.pk ? 1 : 0;
    if (level && !level.nextPage && !level.error) {
      return level.items.filter((i) => i.idx !== dragged.idx).length;
    }
    const { data } = await list(channel(), {
      parent_category: target.pk,
      page: 1,
      page_size: 1,
    });
    return data.count - alreadyChild;
  }

  async function buildItems(dragged, target, position) {
    if (position === "inside" || target.parent_category == null) {
      const pos = await childCount(target, dragged);
      return [{ idx: dragged.idx, parent_category_idx: target.idx, position: pos }];
    }
    const key = levelKeyOf(target.parent_category);
    await loadRest(key);
    const level = levels[key];
    if (level.nextPage) throw level.error || new Error("level incomplete");
    const parent = byPk.get(target.parent_category);
    const siblings = sortByPosition(level.items).filter(
      (i) => i.idx !== dragged.idx
    );
    const at = siblings.findIndex((i) => i.idx === target.idx);
    siblings.splice(position === "before" ? at : at + 1, 0, dragged);
    return siblings.map((item, i) => ({
      idx: item.idx,
      parent_category_idx: parent.idx,
      position: i,
    }));
  }

  // Returns true when the move was saved. Errors go to onError and the affected levels are reloaded.
  async function move(draggedIdx, targetIdx, position) {
    if (!canDrop(draggedIdx, targetIdx)) return false;
    const dragged = byIdx.get(draggedIdx);
    const target = byIdx.get(targetIdx);
    const oldKey = levelKeyOf(dragged.parent_category);
    const inside = position === "inside" || target.parent_category == null;
    const newKey = inside ? target.pk : levelKeyOf(target.parent_category);
    reordering.value = true;
    let ok = false;
    try {
      const items = await buildItems(dragged, target, position);
      await reorderApi(channel(), { items });
      ok = true;
    } catch (err) {
      onError(err);
    }
    try {
      await Promise.all(
        [...new Set([oldKey, newKey])].map((key) => refreshLevel(key))
      );
      if (ok && inside) await expandItem(byPk.get(target.pk));
    } finally {
      reordering.value = false;
    }
    return ok;
  }

  return {
    levels,
    expanded,
    rows,
    search,
    isSearchMode,
    highlightIdx,
    reordering,
    revealing,
    load,
    loadMore,
    toggle,
    collapseAll,
    applyFilter,
    searchMore,
    revealInTree,
    canDrop,
    move,
    isLeaf,
    ROOT,
  };
}
