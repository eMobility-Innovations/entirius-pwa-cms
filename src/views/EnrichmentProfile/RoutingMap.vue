<template>
  <div class="flex-column gap-2" :data-testid="testid">
    <dl v-if="entries.length" class="m-0 flex-column gap-1 fs-300">
      <div v-for="[key, sections] in entries" :key="key" class="flex flex-wrap gap-2">
        <dt class="fw-600">{{ taskName(key) }}</dt>
        <dd class="m-0 t-secondary">{{ sectionNames(sections) }}</dd>
      </div>
    </dl>
    <p class="m-0 fs-300 t-secondary">{{ $t("enrichment.profile.json_only") }}</p>
  </div>
</template>

<script>
import { GET_Workers } from "@/api/enrichment/api";
import { listOf } from "@/api/enrichment/listOf";

// Which profile sections each AI task reads, in plain words: the task by its worker's name ("Product writer"), the
// sections by their headings. A key no worker names stays as it is. Edited only in "Edit JSON".
export default {
  name: "RoutingMap",
  props: {
    modelValue: { type: Object, default: null },
    testid: { type: String, default: "routing-map" },
  },
  data() {
    return { workers: [] };
  },
  computed: {
    entries() {
      return Object.entries(this.modelValue || {});
    },
  },
  async mounted() {
    try {
      const { data } = await GET_Workers();
      this.workers = listOf(data);
    } catch {
      this.workers = [];
    }
  },
  methods: {
    taskName(key) {
      return this.workers.find((worker) => worker.key === key)?.label || key;
    },
    sectionNames(sections) {
      const list = Array.isArray(sections) ? sections : [sections];
      return list.map((section) => this.$t(`enrichment.profile.sections.${section}`)).join(", ");
    },
  },
};
</script>
