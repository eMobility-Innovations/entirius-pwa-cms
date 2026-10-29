<template>
  <div
    class="find-in-pim-panel p-8 b-subtle bb-100"
    data-testid="find-in-pim-panel"
  >
    <ReadonlyOff>
      <DedupSearchBox
        :scope="['pim_product']"
        :initial-query="initialQuery"
        :image-url="imageUrl"
        inline
        data-testid="find-in-pim-box"
        @results="onResults"
      />
    </ReadonlyOff>

    <div class="find-in-pim-panel__results mt-8">
      <CandidateRow
        v-for="hit in matched"
        :key="`${hit.kind}-${hit.ref}`"
        :hit="hit"
      >
        <template #actions>
          <IconButton mutates
            icon="link"
            size="sm"
            :disabled="linkingSku === hit.basic?.sku"
            :label="$t('lookup.row.link')"
            :data-testid="`find-in-pim-link-${hit.basic?.sku}`"
            @click="link(hit)"
          />
        </template>
      </CandidateRow>

      <p
        v-if="searched && matched.length === 0"
        class="fs-200 t-muted mt-5"
        data-testid="find-in-pim-empty"
      >
        {{ $t("lookup.find.empty_message") }}
      </p>

      <details
        v-if="groups.none.length"
        class="mt-5"
        data-testid="find-in-pim-rest"
      >
        <summary class="fs-200 t-muted">
          {{ $t("lookup.match.none", { n: groups.none.length }) }}
        </summary>
        <div class="mt-5">
          <CandidateRow
            v-for="hit in groups.none"
            :key="`${hit.kind}-${hit.ref}`"
            :hit="hit"
          >
            <template #actions>
              <IconButton mutates
                icon="link"
                size="sm"
                :disabled="linkingSku === hit.basic?.sku"
                :label="$t('lookup.row.link')"
                :data-testid="`find-in-pim-link-${hit.basic?.sku}`"
                @click="link(hit)"
              />
            </template>
          </CandidateRow>
        </div>
      </details>
    </div>
  </div>
</template>

<script>
import DedupSearchBox from "@/components/lookup/DedupSearchBox.vue";
import CandidateRow from "@/components/lookup/CandidateRow.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { POST_LinkToRealProduct } from "@/api/atlas/api";
import { groupHits } from "@/utils/lookupMatch";
import { ReadonlyOff } from "@/composables/useReadonly";

export default {
  name: "FindInPimPanel",
  components: { ReadonlyOff, DedupSearchBox, CandidateRow },
  props: {
    // The SourceProduct being matched — the link endpoint addresses it by pk.
    productId: { type: [Number, String], required: true },
    // SourceProduct identifiers seeding the search.
    name: { type: String, default: "" },
    ean: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
  },
  emits: ["linked"],
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return {
      hits: [],
      searched: false,
      linkingSku: "",
    };
  },
  computed: {
    initialQuery() {
      return [this.name, this.ean].filter(Boolean).join(" ").trim();
    },
    groups() {
      return groupHits(this.hits);
    },
    matched() {
      return [...this.groups.exact, ...this.groups.similar];
    },
  },
  methods: {
    onResults(response) {
      this.hits = response.hits || [];
      this.searched = true;
    },
    async link(hit) {
      const sku = hit.basic?.sku;
      if (!sku || this.linkingSku) return;
      this.linkingSku = sku;
      try {
        // Attaches the SourceProduct itself (sets real_product), which is what
        // takes it out of the dedup pool — a bare product-link would not.
        await POST_LinkToRealProduct(this.productId, {
          real_product_sku: sku,
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("lookup.source_detail.link_success", { sku }),
        });
        this.$emit("linked", sku);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.linkingSku = "";
      }
    },
  },
};
</script>
