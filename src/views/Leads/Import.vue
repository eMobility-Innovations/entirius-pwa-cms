<template>
  <PageLayout data-testid="leads-import">
    <template #header>
      <PageHeader :title="$t('leads.import.title')">
        <template #actions>
          <ActionBar :actions="actions" />
        </template>
      </PageHeader>
    </template>
    <div class="import flex-column gap-8">
      <p class="m-0">{{ $t("leads.import.hint") }}</p>
      <BasicCard :title="$t('leads.import.columns_title')" gap data-testid="import-columns">
        <ul class="import__list">
          <li v-for="key in COLUMN_KEYS" :key="key">{{ $t(`leads.import.${key}`) }}</li>
        </ul>
      </BasicCard>
      <BasicCard :title="$t('leads.import.after_title')" gap data-testid="import-after">
        <p class="m-0">{{ $t("leads.import.after") }}</p>
      </BasicCard>
      <div class="flex ai-ct flex-wrap gap-5">
        <!-- the native picker stays scriptable (a page object sets its files); the button opens it -->
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".csv,text/csv"
          tabindex="-1"
          data-testid="import-file"
          @change="pick"
        />
        <BasicButton data-testid="import-choose" @click="fileInput.click()">{{ $t("leads.import.choose") }}</BasicButton>
        <span data-testid="import-file-name">{{ file?.name || $t("leads.import.no_file") }}</span>
      </div>
      <p v-if="error" class="t-negative m-0" data-testid="import-error">{{ error }}</p>
      <BasicCard v-if="batch" data-testid="import-report">
        <div class="flex-column gap-3">
          <p class="m-0">{{ $t("leads.import.status") }}: <strong data-testid="import-status">{{ batch.status }}</strong></p>
          <p class="m-0" data-testid="import-counts">
            {{ $t("leads.import.counts", { created: batch.created_count, matched: batch.matched_count, skipped: batch.skipped_count }) }}
          </p>
          <ul v-if="batch.report?.length" class="import__list">
            <li v-for="entry in batch.report" :key="`${entry.row}-${entry.reason}`">
              {{ $t("leads.import.row", { row: entry.row }) }}: {{ entry.reason }}
            </li>
          </ul>
          <router-link
            v-if="batch.status === 'done'"
            class="t-accent"
            :to="{ name: 'LeadsBoard' }"
            data-testid="import-to-board"
          >
            {{ $t("leads.import.to_board") }}
          </router-link>
        </div>
      </BasicCard>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { t } from "@/i18n";
import { GET_Import, POST_Import } from "@/api/leads/api";
import { extractApiMessage } from "@/composables/useFormErrors";

// CSV upload: the batch runs on the leads queue; the screen polls it until done or failed.
const POLL_MS = 2000;
const COLUMN_KEYS = ["column_company", "column_domain", "column_contact", "column_legal_basis"];
const SAMPLE_NAME = "leads-sample.csv";
const SAMPLE_CSV = [
  "company_name,domain,first_name,last_name,email,legal_basis",
  "Example Shop,example-shop.test,Jan,Kowalski,jan@example-shop.test,legitimate_interest",
  "Another Shop,another-shop.test,Anna,Nowak,anna@another-shop.test,consent",
  "",
].join("\n");
const FINISHED = ["done", "failed"];
const router = useRouter();
const fileInput = ref(null);
const file = ref(null);
const batch = ref(null);
const busy = ref(false);
const error = ref("");
let timer = null;

// R5: the secondary ways in, then Upload — the one primary — rightmost.
const actions = computed(() => [
  { key: "sample", label: t("leads.import.sample"), role: "secondary", testid: "import-sample", onClick: downloadSample },
  {
    key: "one",
    label: t("leads.add.one"),
    role: "secondary",
    testid: "import-add-one",
    onClick: () => router.push({ name: "LeadsCompanyNew" }),
  },
  {
    key: "upload",
    label: t("leads.import.upload"),
    role: "primary",
    testid: "import-upload",
    disabled: !file.value || busy.value,
    onClick: upload,
  },
]);

function pick(event) {
  file.value = event.target.files?.[0] || null;
}

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
  const link = document.createElement("a");
  Object.assign(link, { href: url, download: SAMPLE_NAME });
  link.click();
  URL.revokeObjectURL(url);
}

function fail(err) {
  clearTimeout(timer);
  busy.value = false;
  error.value = extractApiMessage(err, t("leads.import.failed"));
}

// Every poll handles its own failure: a later poll runs from the timer, outside upload()'s try.
async function poll() {
  try {
    batch.value = (await GET_Import(batch.value.id)).data;
  } catch (err) {
    return fail(err);
  }
  if (FINISHED.includes(batch.value.status)) busy.value = false;
  else timer = setTimeout(poll, POLL_MS);
}

async function upload() {
  error.value = "";
  busy.value = true;
  try {
    batch.value = (await POST_Import(file.value)).data;
  } catch (err) {
    return fail(err);
  }
  await poll();
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<style scoped>
.import__list {
  margin: 0;
  padding-left: var(--space-4);
}
</style>
