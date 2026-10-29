<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('lookup.find.title')" />
    </template>
      <p class="fs-300 t-body mb-10">
        {{ $t("lookup.find.subtitle") }}
      </p>

      <ReadonlyOff>
        <DedupSearchBox
          :initial-query="initialQuery"
          :initial-image="initialImage"
          :scope="initialScope"
          data-testid="atlas-find-box"
          @results="onResults"
          @error="onSearchError"
        />
      </ReadonlyOff>

      <p v-if="understoodLine" class="fs-200 t-muted mt-8">
        {{ $t("lookup.find.understood_prefix") }} {{ understoodLine }}
      </p>

      <div
        v-if="warnings.length"
        class="bg-warning-subtle t-warning p-5 rounded mt-8"
        data-testid="atlas-find-warnings"
      >
        <p class="fs-200">{{ warnings.join(", ") }}</p>
      </div>

      <div class="mt-10">
        <template v-for="kind in ['exact', 'similar']" :key="kind">
          <h2
            v-if="groups[kind].length"
            class="fs-400 fw-600 mt-8 mb-5"
            :data-testid="`atlas-find-group-${kind}`"
          >
            {{ $t(`lookup.match.${kind}`) }}
          </h2>
          <CandidateRow
            v-for="hit in groups[kind]"
            :key="`${hit.kind}-${hit.ref}`"
            :hit="hit"
          />
        </template>

        <EmptyState
          v-if="searched && matched.length === 0"
          :title="$t('lookup.find.empty_title')"
          :message="
            hasImage
              ? $t('lookup.find.empty_image')
              : $t('lookup.find.empty_message')
          "
          icon="search"
        >
          <BasicButton variant="ghost"
            data-testid="atlas-find-create-product"
            @click="goCreateProduct"
          >
            {{ $t('lookup.find.create_product') }}
          </BasicButton>
        </EmptyState>

        <details
          v-if="groups.none.length"
          class="mt-8"
          data-testid="atlas-find-rest"
        >
          <summary class="fs-200 t-muted">
            {{ $t("lookup.match.none", { n: groups.none.length }) }}
          </summary>
          <div class="mt-5">
            <CandidateRow
              v-for="hit in groups.none"
              :key="`${hit.kind}-${hit.ref}`"
              :hit="hit"
            />
          </div>
        </details>
      </div>
  </PageLayout>
</template>

<script>
import DedupSearchBox from "@/components/lookup/DedupSearchBox.vue";
import CandidateRow from "@/components/lookup/CandidateRow.vue";
import { groupHits } from "@/utils/lookupMatch";
import { markRaw } from "vue";
import { useLookupFindStore } from "@/stores/lookupFind";
import { ReadonlyOff } from "@/composables/useReadonly";

const DEFAULT_SCOPE = ["pim_product", "atlas_source_product"];

export default {
  name: "AtlasFind",
  components: { ReadonlyOff, DedupSearchBox, CandidateRow },
  setup() {
    return { findStore: useLookupFindStore() };
  },
  // Opening a hit leaves the atlas subtree, so the view unmounts — data() seeds
  // from the store's last search (if any) to survive the back-navigation.
  data() {
    const saved = this.findStore.saved;
    return {
      hits: saved?.hits ?? [],
      queryParsed: saved?.queryParsed ?? null,
      warnings: saved?.warnings ?? [],
      searched: !!saved,
      lastQuery: saved?.q ?? "",
      hasImage: !!saved?.hasImage,
    };
  },
  computed: {
    initialQuery() {
      return this.findStore.saved?.q ?? (this.$route.query.q || "");
    },
    initialImage() {
      return this.findStore.saved?.imageBlob ?? null;
    },
    initialScope() {
      return this.findStore.saved?.scope ?? DEFAULT_SCOPE;
    },
    // Exact / similar are shown as results; `none` rows (blocking neighbours nothing agreed
    // on) are folded under a disclosure so the top neighbour stays a click away.
    groups() {
      return groupHits(this.hits);
    },
    matched() {
      return [...this.groups.exact, ...this.groups.similar];
    },
    understoodLine() {
      const parsed = this.queryParsed;
      if (!parsed) return "";
      const parts = [];
      if (parsed.gtin14) parts.push(`GTIN ${parsed.gtin14}`);
      if (parsed.brand_norm) parts.push(`brand ${parsed.brand_norm}`);
      if (parsed.name_norm) parts.push(parsed.name_norm);
      return parts.join(" · ");
    },
  },
  methods: {
    onResults(response) {
      this.hits = response.hits || [];
      this.queryParsed = response.query_parsed || null;
      this.warnings = response.warnings || [];
      this.lastQuery = response.q || "";
      this.hasImage = !!response.hasImage;
      this.searched = true;
      this.findStore.save({
        hits: this.hits,
        queryParsed: this.queryParsed,
        warnings: this.warnings,
        q: this.lastQuery,
        hasImage: this.hasImage,
        scope: response.scope,
        // markRaw: the store's ref would deep-wrap the Blob in a reactive proxy,
        // and a proxied Blob breaks identity (and FormData internals) on restore.
        imageBlob: response.imageBlob ? markRaw(response.imageBlob) : null,
      });
    },
    // A failed search must not leave the previous, now-stale, result list
    // on screen next to the box's own error banner — nor come back from the
    // store on the next visit.
    onSearchError() {
      this.hits = [];
      this.queryParsed = null;
      this.warnings = [];
      this.hasImage = false;
      this.searched = false;
      this.findStore.clear();
    },
    goCreateProduct() {
      this.$router.push({
        name: "PimProductCreate",
        query: { q: this.lastQuery },
      });
    },
  },
};
</script>
