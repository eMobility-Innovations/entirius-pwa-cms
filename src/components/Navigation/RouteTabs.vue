<template>
  <BasicTabs
    :model-value="route.name"
    :options="options"
    :id-prefix="tabs.idPrefix"
    @update:model-value="(name) => router.push({ name })"
  />
</template>

<script setup>
// The sections of one screen as tabs, each its own route (Enricher → Review: Proposals | Runs), placed under the
// PageHeader: `tabs` { idPrefix, sections: [{ route, labelKey, badge?, testid }] } from nav-routes.js; the page wraps
// its body in `routeTabPanel(tabs, <its route name>)`. A section whose area (its route's `meta.area`) the user cannot
// read is left out, as on Leads → Settings — the page's own tab always stays; a `badge` takes its number from the
// nav counts.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BasicTabs from "@/boots/BasicTabs/index.vue";
import { useNavCounts } from "@/composables/useNav";
import { useAccessStore } from "@/stores/access";
import { t } from "@/i18n";

const props = defineProps({
  tabs: { type: Object, required: true },
});

const route = useRoute();
const router = useRouter();
const access = useAccessStore();
const counts = useNavCounts();

const readable = (section) => access.can(router.resolve({ name: section.route }).meta.area);
const options = computed(() =>
  props.tabs.sections.filter(readable).map((section) => ({
    value: section.route,
    label: t(section.labelKey),
    testid: section.testid,
    count: (section.badge && counts.value[section.badge]) || null,
  }))
);
</script>
