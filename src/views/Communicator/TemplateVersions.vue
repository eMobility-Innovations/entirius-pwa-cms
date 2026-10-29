<template>
  <div class="flex-column gap-4" data-testid="template-versions-list">
    <BasicCard v-for="version in versions" :key="version.id" :title="`v${version.number}`" data-testid="template-version">
      <p class="t-muted m-0">{{ formatDayTime(version.created_at) }} · {{ version.model || "—" }}</p>
      <p class="m-0">{{ version.subject }}</p>
    </BasicCard>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { GET_TemplateVersions } from "@/api/communicator/api";
import { formatDayTime } from "@/utils/leadsTime";

// C-39: the Leads time format (DD.MM HH:MM), never the browser's English month.
const props = defineProps({ templateId: { type: [String, Number], required: true } });
const versions = ref([]);
onMounted(async () => {
  versions.value = (await GET_TemplateVersions(props.templateId)).data.results;
});
</script>
