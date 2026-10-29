<template>
  <div class="notif-list" data-testid="notif-list">
    <div class="notif-list__head">
      <p class="notif-list__title">{{ $t("notification_bar.title") }}</p>
      <IconButton
        icon="close"
        :label="$t('notification_bar.close')"
        data-testid="notif-close"
        @click="emit('close')"
      />
    </div>
    <p v-if="!store.items.length" class="notif-list__empty">
      {{ $t("notification_bar.empty") }}
    </p>
    <BasicButton
      v-for="item in store.items"
      :key="item.id"
      variant="ghost"
      class="notif-row"
      :class="`notif-row--${item.severity}`"
      data-testid="notif-row"
      @click="openItem(item)"
    >
      <span class="notif-row__dot" aria-hidden="true"></span>
      <span class="notif-row__text">
        <span class="notif-row__title">{{ rowTitle(item) }}</span>
        <span
          v-if="preview(item.body)"
          class="notif-row__preview"
          data-testid="notif-preview"
          >{{ preview(item.body) }}</span
        >
        <span class="notif-row__age">{{ formatDayTime(item.created_at) }}</span>
      </span>
    </BasicButton>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { GET_Company } from "@/api/leads/api";
import BasicButton from "@/boots/BasicButton/index.vue";
import { useMuninStore } from "@/stores/munin";
import { useNotificationsStore } from "@/stores/notifications";
import { formatDayTime } from "@/utils/leadsTime";
import { companyIdFromSubjectRef } from "@/utils/subjectRef";

// The bell's panel (BasicMenu `panel` mode: the menu anchors it, names it and closes it on Esc). `close` asks the
// menu to close: the close button, and a row that jumps elsewhere.
const emit = defineEmits(["close"]);
const store = useNotificationsStore();
const munin = useMuninStore();
const router = useRouter();
const companyNames = ref({});
const EMAIL = /\S+@\S+/;

// A leads notification names its company, never a bare address ("Possible opt-out · Example Shop 6").
function rowTitle(item) {
  const name = companyNames.value[companyIdFromSubjectRef(item.subject_ref)];
  if (!name || item.title.includes(name)) return item.title;
  return EMAIL.test(item.title)
    ? item.title.replace(EMAIL, name)
    : `${item.title} · ${name}`;
}

async function loadCompanyNames(items) {
  if (!munin.isModuleEnabled("leads")) return;
  const ids = [
    ...new Set(
      items
        .map((item) => companyIdFromSubjectRef(item.subject_ref))
        .filter(Boolean)
    ),
  ];
  const results = await Promise.allSettled(ids.map((id) => GET_Company(id)));
  results.forEach((result, i) => {
    if (result.status === "fulfilled")
      companyNames.value[ids[i]] = result.value.data.name;
  });
}
watch(() => store.items, loadCompanyNames, { immediate: true });

async function openItem(item) {
  const route = await store.open(item);
  if (!route) return;
  emit("close");
  router.push(route);
}

// Rows with the same title ("Reply from Example Shop 5") differ by what was written: the body's own words, without
// the quoted history of earlier mails. A quote header ("On … wrote:", "W dniu … napisał(a):") may wrap over up to three
// lines, must end with ":" and be followed by quoted (">") lines or the end of the body. It never starts on the body's
// first line and never swallows a line that itself starts a header, so a reply beginning "On Monday …" keeps its words.
const QUOTE_HEADER =
  /(?<=\n)[ \t]*(On|W dniu)\b[^\n]*(\n(?![ \t]*(On|W dniu)\b)[^\n]*){0,2}?(wrote|napisał\(a\)|napisała?):[ \t]*(?=\s*(>|(?![\s\S])))/gm;
const preview = (body) =>
  (body || "")
    .trim()
    .replace(QUOTE_HEADER, "")
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
</script>

<style scoped>
.notif-list {
  width: 20rem;
  max-width: 100%;
  max-height: 60vh;
  overflow-y: auto;
}
.notif-list__head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-2) var(--space-2) var(--space-4);
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
}
.notif-list__title {
  margin: 0;
  font-weight: 600;
}
.notif-list__empty {
  margin: 0;
  padding: var(--space-4);
  color: var(--text-muted);
}
/* A row is a ghost BasicButton laid out as a list row: full width, wrapping text, top-aligned. */
.notif-list .notif-row {
  justify-content: flex-start;
  align-items: flex-start;
  width: 100%;
  min-height: 3rem;
  padding: var(--space-3) var(--space-4);
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  border-radius: 0;
  text-align: left;
  font-size: inherit;
  font-weight: inherit;
  white-space: normal;
  color: var(--text-body);
}
.notif-row :deep(.btn-text) {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-width: 0;
}
.notif-row__dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  margin-top: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--accent-fill);
}
.notif-row--high .notif-row__dot {
  background: var(--negative-fill);
}
.notif-row__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.notif-row__title {
  overflow-wrap: anywhere;
}
.notif-row__preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--fs-200);
  color: var(--text-secondary);
}
.notif-row__age {
  font-size: var(--fs-200);
  color: var(--text-muted);
}
/* Phone: the close button gets a 40 px hit area; the negative margin keeps the header height. */
@media (max-width: 1023px) {
  .notif-list__head .button-basic--icon {
    --btn-height: var(--space-10);

    margin: calc((var(--elem-height) - var(--space-10)) / 2);
  }
}
</style>
