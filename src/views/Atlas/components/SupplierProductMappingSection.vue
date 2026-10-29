<template>
  <section class="sp-mapping-section">
    <header class="sp-mapping-section__head">
      <h3 class="fs-300 fw-600 m-0">
        {{ $t("atlas.products.drawer.mapping_title") }}
      </h3>
      <BasicButton
        v-if="supplierIdx"
        size="sm"
        :data-testid="`drawer-open-mappings-${supplierIdx}`"
        @click="$emit('open-mappings')"
      >
        {{ $t("atlas.products.drawer.open_mappings_tab") }}
      </BasicButton>
    </header>
    <Loader block v-if="loading" />
    <p v-else-if="!profiles.length" class="fs-200 t-muted m-0">
      {{ $t("atlas.products.drawer.no_mapping_profiles") }}
    </p>
    <ul v-else class="sp-mapping-section__profiles">
      <li v-for="p in profiles" :key="p.id" class="sp-mapping-section__profile">
        <div class="flex ai-ct jc-sb gap-5 flex-wrap">
          <span class="fw-600">{{ p.name || p.idx }}</span>
          <span class="fs-200 t-muted">
            {{ $t("atlas.products.drawer.mapping_counts", {
              attrs: p._attrCount,
              cats: p._catCount,
            }) }}
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>

<script>
import {
  GET_MappingProfiles,
  GET_AttributeMappings,
  GET_CategoryMappings,
} from "@/api/atlas/api";

export default {
  name: "SupplierProductMappingSection",
  props: {
    supplierIdx: { type: String, required: true },
  },
  emits: ["open-mappings"],
  data() {
    return {
      profiles: [],
      loading: false,
    };
  },
  watch: {
    supplierIdx: {
      immediate: true,
      handler(val) {
        if (val) this.fetchProfiles(val);
        else this.profiles = [];
      },
    },
  },
  methods: {
    async fetchProfiles(idx) {
      this.loading = true;
      try {
        const { data } = await GET_MappingProfiles(idx, { page_size: 20 });
        const profiles = data?.results || [];
        await Promise.all(profiles.map((p) => this.hydrateCounts(p)));
        this.profiles = profiles;
      } catch (err) {
        this.profiles = [];
      } finally {
        this.loading = false;
      }
    },
    async hydrateCounts(profile) {
      profile._attrCount = 0;
      profile._catCount = 0;
      try {
        const [attrRes, catRes] = await Promise.all([
          GET_AttributeMappings(profile.id, { page_size: 1 }),
          GET_CategoryMappings(profile.id, { page_size: 1 }),
        ]);
        profile._attrCount = attrRes.data?.count ?? attrRes.data?.results?.length ?? 0;
        profile._catCount = catRes.data?.count ?? catRes.data?.results?.length ?? 0;
      } catch (err) {
        // soft-fail
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.sp-mapping-section {
  margin-top: var(--space-8);
  padding-top: var(--space-8);
  border-top: 1px solid var(--border-subtle);
}
.sp-mapping-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  margin-bottom: var(--space-2);
}
.sp-mapping-section__profiles {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sp-mapping-section__profile {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);

  &:last-child {
    border-bottom: 0;
  }
}
</style>
