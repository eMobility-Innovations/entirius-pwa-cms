<template>
  <div class="flex-column gap-4" data-testid="test-generate">
    <FormField :label="$t('communicator.test.search')">
      <BasicInput v-model="search" type="search" icon="search" data-testid="test-generate-search" @update:model-value="find" />
    </FormField>
    <div v-if="companies.length" class="flex flex-wrap gap-3">
      <BasicButton :mutates="false" v-for="company in companies" :key="company.id" size="sm" data-testid="test-generate-company" @click="generate(company)">
        {{ company.domain }}
      </BasicButton>
    </div>
    <p v-if="busy" class="t-muted m-0" role="status">{{ $t("communicator.test.generating") }}</p>
    <p v-if="error" class="t-negative m-0" role="alert" data-testid="test-generate-error">{{ error }}</p>
    <BasicCard v-if="preview" data-testid="test-generate-preview">
      <p class="t-muted m-0">{{ $t("communicator.test.not_saved") }}</p>
      <h4 data-testid="test-generate-subject">{{ preview.subject }}</h4>
      <p v-for="(paragraph, i) in paragraphs" :key="i">{{ paragraph }}</p>
    </BasicCard>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { t } from "@/i18n";
import { GET_Companies, GET_Company } from "@/api/leads/api";
import { POST_TestGenerate } from "@/api/communicator/api";
import { extractApiMessage } from "@/composables/useFormErrors";

// Draft preview for one company: nothing is saved, closing the drawer discards it.
const props = defineProps({ templateId: { type: [String, Number], required: true } });
const search = ref("");
const companies = ref([]);
const preview = ref(null);
const busy = ref(false);
const error = ref("");

const paragraphs = computed(() => (preview.value?.body_text || "").split(/\n\s*\n/));

async function find() {
  if (search.value.trim().length < 2) return;
  companies.value = (await GET_Companies({ search: search.value.trim(), page_size: 10 })).data.results;
}

function renderContext(company) {
  const contact = company.contacts.find((c) => c.is_primary) || company.contacts[0] || {};
  const { name, domain, platform, industry, hooks } = company;
  return { company_name: name, domain, platform, industry, hooks, first_name: contact.first_name || "" };
}

async function generate(company) {
  error.value = "";
  busy.value = true;
  try {
    const detail = (await GET_Company(company.id)).data;
    preview.value = (await POST_TestGenerate(props.templateId, renderContext(detail))).data;
  } catch (err) {
    error.value = extractApiMessage(err, t("leads.review.error"));
  } finally {
    busy.value = false;
  }
}
</script>
