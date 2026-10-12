<template>
  <aside v-if="product" class="raw-panel" :aria-labelledby="headingId">
    <BasicCard class="gap-8">
      <h2 :id="headingId" class="raw-panel__heading">
        {{ $t("atlas.review.raw_data_title") }}
      </h2>

      <!-- Core fields -->
      <section class="raw-panel__section">
        <h3 class="raw-panel__subheading">{{ $t("atlas.review.raw_panel.core_section") }}</h3>
        <dl class="raw-panel__grid">
          <template v-for="row in coreRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
      </section>

      <!-- Vendor attributes (the `data` JSONField from SupplierProduct) -->
      <section v-if="attributeRows.length" class="raw-panel__section">
        <h3 class="raw-panel__subheading">
          {{ $t("atlas.review.raw_panel.attributes_section") }}
        </h3>
        <dl class="raw-panel__grid">
          <template v-for="row in attributeRows" :key="row.key">
            <dt :title="row.key">{{ row.key }}</dt>
            <dd>
              <pre v-if="row.isJson" class="raw-panel__json">{{ row.value }}</pre>
              <template v-else-if="row.long">
                <span :class="{ 'raw-panel__clamp': !expanded[row.key] }">{{ row.value }}</span>
                <BasicButton
                  variant="ghost"
                  size="sm"
                  class="mt-1"
                  :aria-expanded="String(!!expanded[row.key])"
                  @click="toggle(row.key)"
                >
                  {{ expanded[row.key]
                    ? $t("atlas.review.raw_panel.collapse")
                    : $t("atlas.review.raw_panel.expand") }}
                </BasicButton>
              </template>
              <span v-else>{{ row.value }}</span>
            </dd>
          </template>
        </dl>
      </section>

      <!-- Image URLs (compact list — full gallery on click) -->
      <section v-if="imageUrls.length" class="raw-panel__section">
        <h3 class="raw-panel__subheading">
          {{ $t("atlas.review.raw_panel.images_section") }}
          <span class="raw-panel__count">({{ imageUrls.length }})</span>
        </h3>
        <ul class="raw-panel__images">
          <li v-for="(u, i) in imageUrls" :key="i">
            <a :href="safeHref(u)" target="_blank" rel="noopener noreferrer" class="raw-panel__image-link">
              {{ shortenUrl(u) }}
            </a>
          </li>
        </ul>
      </section>
    </BasicCard>
  </aside>
</template>

<script>
import { formatCost, formatDate } from "@/utils/format";
import { safeHref } from "@/utils/safeHref";

let nextId = 0;

const LONG_TEXT_THRESHOLD = 120;

export default {
  name: "RawDataPanel",
  props: {
    product: { type: Object, default: null },
  },
  data() {
    nextId += 1;
    return { expanded: {}, headingId: `raw-panel-title-${nextId}` };
  },
  watch: {
    "product.id"() {
      this.expanded = {};
    },
  },
  computed: {
    coreRows() {
      const p = this.product;
      if (!p) return [];
      return [
        { label: "ID", value: p.id },
        { label: this.$t("atlas.review.raw_panel.external_id"), value: p.external_id || "—" },
        { label: this.$t("atlas.review.raw_panel.status"), value: p.status || "—" },
        { label: this.$t("atlas.review.raw_panel.cost"), value: formatCost(p.cost, p.currency) || "—" },
        { label: this.$t("atlas.review.raw_panel.stock"), value: p.stock ?? "—" },
        { label: "EAN", value: p.ean || "—" },
        { label: "URL", value: p.url || "—" },
        { label: this.$t("atlas.review.raw_panel.last_synced"), value: formatDate(p.last_synced_at) || "—" },
        { label: this.$t("atlas.review.raw_panel.data_changed"), value: formatDate(p.data_changed_at) || "—" },
      ];
    },
    attributeRows() {
      const data = this.product?.data || {};
      const entries = Object.entries(data);
      if (!entries.length) return [];
      return entries
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => this.formatRow(k, v));
    },
    imageUrls() {
      return Array.isArray(this.product?.image_urls) ? this.product.image_urls : [];
    },
  },
  methods: {
    safeHref,
    toggle(key) {
      this.expanded = { ...this.expanded, [key]: !this.expanded[key] };
    },
    formatRow(key, value) {
      const isObj = value && typeof value === "object";
      if (isObj) {
        return {
          key,
          value: JSON.stringify(value, null, 2),
          isJson: true,
          long: false,
        };
      }
      const str = String(value);
      return {
        key,
        value: str,
        isJson: false,
        long: str.length > LONG_TEXT_THRESHOLD,
      };
    },
    shortenUrl(u) {
      try {
        const url = new URL(u);
        return `${url.hostname}${url.pathname}`.slice(0, 60);
      } catch {
        return String(u).slice(0, 60);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.raw-panel {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.raw-panel__heading {
  font-size: var(--fs-400);
  font-weight: 600;
  margin: 0;
  color: var(--text-body);
}

.raw-panel__section {
  display: flex;
  flex-direction: column;
}

.raw-panel__subheading {
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 0 0 var(--space-2);
}

.raw-panel__count {
  font-weight: 400;
  text-transform: none;
  color: var(--text-muted);
  margin-left: var(--space-1);
}

.raw-panel__grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-1) var(--space-3);
  margin: 0;

  dt {
    font-size: var(--fs-200);
    color: var(--text-muted);
    word-break: break-word;
    align-self: start;
  }

  dd {
    margin: 0;
    font-size: var(--fs-200);
    color: var(--text-body);
    word-break: break-all;
    min-width: 0;
  }
}

.raw-panel__json {
  background: var(--surface-raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  padding: var(--space-1) var(--space-2);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-200);
  max-height: 140px;
  overflow: auto;
  white-space: pre;
}

.raw-panel__clamp {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.raw-panel__images {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.raw-panel__image-link {
  font-size: var(--fs-200);
  color: var(--text-accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
