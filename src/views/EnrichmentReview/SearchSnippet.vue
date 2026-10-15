<template>
  <div class="search-snippet flex-column gap-1" data-testid="search-snippet">
    <span class="search-snippet__url fs-200 t-secondary">{{ url || "—" }}</span>
    <span class="search-snippet__title">{{ cut(title, TITLE_CUT) }}</span>
    <p class="search-snippet__text fs-200 m-0">{{ cut(text, CUT) }}</p>
  </div>
</template>

<script>
// How a page reads in a search result: the URL, the title and the description, each cut where a search engine cuts
// it. A meta description shows under the product's name; a meta title over the product's meta description.
const CUT = 160;
const TITLE_CUT = 60;

export default {
  name: "SearchSnippet",
  props: {
    title: { type: String, default: "" },
    url: { type: String, default: "" },
    text: { type: String, default: "" },
  },
  data() {
    return { CUT, TITLE_CUT };
  },
  methods: {
    cut(text, at) {
      return text.length > at ? `${text.slice(0, at - 1).trimEnd()}…` : text;
    },
  },
};
</script>

<style lang="scss" scoped>
.search-snippet {
  padding: var(--space-5);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-base);
  max-width: 600px;
}
.search-snippet__url {
  word-break: break-all;
}
.search-snippet__title {
  color: var(--accent);
  font-size: var(--fs-400);
  line-height: 1.3;
}
.search-snippet__text {
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
