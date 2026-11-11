import { computed, reactive, ref, watch } from "vue";
import { GET_Attributes, GET_Categories, GET_Category, GET_Feature, GET_Features } from "@/api/pim/api";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { t } from "@/i18n";

export const OPTIONS_PAGE_SIZE = 50;

const asList = (value) => (Array.isArray(value) ? value : [value]).filter((v) => v !== null && v !== undefined && v !== "");

/**
 * Options of a BasicSelect backed by a paginated, searchable API list (one page at a time, never the whole list).
 *
 *   fetchPage({ search?, page, page_size }) -> { results, next }
 *   toOption(row) -> { value, label, description? }
 *   resolveOne(value) -> option   (a chosen value that is not on the loaded page; fallback label = the value)
 *
 * Template: <BasicSelect :options="src.options" :more-label="src.moreLabel" @search="src.onSearch" @more="src.loadMore" />
 * `track(value | values)` tells which values are chosen, so their labels stay in `options` whatever page is loaded.
 * The returned object is reactive: refs unwrap, so templates read `src.options` directly.
 */
export function useRemoteOptions({ fetchPage, toOption, resolveOne, pageSize = OPTIONS_PAGE_SIZE }) {
  const { debouncedFetch } = useSearchDebounce(300);
  const loaded = ref([]);
  const hasMore = ref(false);
  const loading = ref(false);
  const chosen = ref([]);
  const known = reactive(new Map());
  let query = "";
  let page = 0;
  let seq = 0;

  async function load(append = false) {
    const mine = ++seq;
    const next = append ? page + 1 : 1;
    loading.value = true;
    try {
      const data = await fetchPage({ ...(query ? { search: query } : {}), page: next, page_size: pageSize });
      if (mine !== seq) return;
      const rows = (data.results || []).map(toOption);
      rows.forEach((option) => known.set(option.value, option));
      const have = new Set(append ? loaded.value.map((o) => o.value) : []);
      loaded.value = [...(append ? loaded.value : []), ...rows.filter((o) => !have.has(o.value))];
      page = next;
      hasMore.value = Boolean(data.next);
    } catch {
      if (mine !== seq || append) return;
      loaded.value = [];
      hasMore.value = false;
    } finally {
      if (mine === seq) loading.value = false;
    }
  }

  async function resolveMissing(values) {
    const missing = values.filter((value) => !known.has(value));
    missing.forEach((value) => known.set(value, { value, label: String(value) }));
    await Promise.all(
      missing.map(async (value) => {
        try {
          const option = await resolveOne?.(value);
          if (option) known.set(value, option);
        } catch {
          // the idx stays as the label
        }
      })
    );
  }

  const options = computed(() => {
    const inList = new Set(loaded.value.map((o) => o.value));
    const extras = chosen.value.filter((v) => !inList.has(v)).map((v) => known.get(v)).filter(Boolean);
    return [...extras, ...loaded.value];
  });

  function track(value) {
    chosen.value = asList(value);
    return resolveMissing(chosen.value);
  }

  function onSearch(text) {
    const trimmed = (text || "").trim();
    if (trimmed === query) return;
    query = trimmed;
    debouncedFetch(() => load(false));
  }

  function reload() {
    query = "";
    known.clear();
    loaded.value = [];
    hasMore.value = false;
    return Promise.all([load(false), resolveMissing(chosen.value)]);
  }

  const moreLabel = computed(() => (hasMore.value ? t("select.load_more") : ""));
  const loadMore = () => (loading.value ? undefined : load(true));

  return reactive({ options, moreLabel, hasMore, loading, load: () => load(false), loadMore, onSearch, reload, track });
}

const orUndefined = (value) => (value === "" ? undefined : value);
const emptyPage = { results: [], next: null };

/** Categories of one channel: label = name, secondary line = idx. `channel` is a getter (the channel can change). */
export function useCategoryOptions(channel) {
  const toOption = (c) => ({ value: c.idx, label: c.name || c.idx, description: c.idx });
  return useRemoteOptions({
    fetchPage: async (params) => (channel() ? (await GET_Categories(channel(), params)).data : emptyPage),
    toOption,
    resolveOne: async (idx) => (channel() ? toOption((await GET_Category(channel(), idx)).data) : undefined),
  });
}

// `lang` (a getter) picks the channel's language from `name_t9n`; the default-language `name` is the fallback.
const idName = (row, lang) => {
  const name = row.name_t9n?.[lang] || row.name;
  return { value: row.idx, label: name ? `${row.idx} — ${name}` : row.idx };
};

/** Attributes (global list; `featureIdx` narrows it to one feature): label "idx — name", search over idx and name. */
export function useAttributeOptions(featureIdx, lang) {
  const scope = () => ({ feature_idx: orUndefined(featureIdx?.()) });
  const toOption = (row) => idName(row, lang?.());
  return useRemoteOptions({
    fetchPage: async (params) => (await GET_Attributes({ ...scope(), ...params })).data,
    toOption,
    resolveOne: async (idx) => {
      const { data } = await GET_Attributes({ ...scope(), search: idx, page_size: 100 });
      const row = (data.results || []).find((r) => r.idx === idx);
      return row ? toOption(row) : undefined;
    },
  });
}

/** Features, optionally in a channel's language: label "idx — name". */
export function useFeatureOptions(channel) {
  return useRemoteOptions({
    fetchPage: async (params) => (await GET_Features(params, channel?.())).data,
    toOption: idName,
    resolveOne: async (idx) => idName((await GET_Feature(idx)).data),
  });
}
