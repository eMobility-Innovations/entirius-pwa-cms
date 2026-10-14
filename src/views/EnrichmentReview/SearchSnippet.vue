<template>
  <div class="search-snippet flex-column gap-1" data-testid="search-snippet">
    <span class="search-snippet__url fs-200 t-secondary">{{ url || "—" }}</span>
    <span class="search-snippet__title">{{ title }}</span>
    <p class="search-snippet__text fs-200 m-0">{{ shown }}</p>
  </div>
</template>

<script>
// How a meta description reads in a search result: the page URL, the product name as the title and the text cut
// where a search engine cuts it.
const CUT = 160;

export default {
  name: "SearchSnippet",
  props: {
    title: { type: String, default: "" },
    url: { type: String, default: "" },
    text: { type: String, default: "" },
  },
  computed: {
    shown() {
      return this.text.length > CUT ? `${this.text.slice(0, CUT - 1).trimEnd()}…` : this.text;
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
