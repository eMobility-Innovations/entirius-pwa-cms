<template>
  <section aria-labelledby="unassigned-title">
    <h2 id="unassigned-title">{{ $t("access.unassigned") }}</h2>
    <p v-if="note" role="status" class="access-muted">{{ note }}</p>
    <p v-if="error" role="alert" class="access-error">{{ error }}</p>
    <div class="access-unassigned-grid">
      <article
        v-for="type in ['user', 'group']"
        :key="type"
        class="access-card"
      >
        <h3>
          {{
            type === "user"
              ? $t("access.unassigned_users")
              : $t("access.unassigned_groups")
          }}
          ({{ items[type].length }})
        </h3>
        <div class="access-unassigned-list">
          <div
            v-for="name in items[type]"
            :key="name"
            class="access-unassigned-row"
          >
            <span>{{ name }}</span>
            <div v-if="canWrite" class="access-inline">
              <button
                v-for="role in roles"
                :key="role"
                :disabled="busy || (type === 'group' && !!directoryError)"
                :aria-label="$t('access.grant_to', { role, name })"
                @click="assign(type, name, role)"
              >
                {{ role }}
              </button>
            </div>
          </div>
          <p v-if="type === 'group' && directoryError" class="access-error">
            {{ directoryError }}
          </p>
          <p v-else-if="!items[type].length" class="access-muted">
            {{ loading ? $t("access.loading") : $t("access.none") }}
          </p>
        </div>
      </article>
    </div>
  </section>
</template>
<script setup>
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import { GET_Unassigned, GET_Groups, POST_Grant } from "@/api/access/api";
import { t } from "@/i18n";
import { errorMessage } from "./helpers";
const emit = defineEmits(["changed"]);
const { canWrite } = storeToRefs(useAccessMatrixStore());
const roles = ["SYSADMIN", "ADMIN", "USER"];
const data = ref({ users: [], groups: [] }),
  grantable = ref([]);
const note = ref(""),
  error = ref(""),
  directoryError = ref(""),
  loading = ref(true),
  busy = ref(false);
const items = computed(() => ({
  user: data.value.users.map((u) => u.username),
  group: data.value.groups.map((g) => g.name),
}));
async function load() {
  loading.value = true;
  note.value = "";
  const results = await Promise.allSettled([GET_Unassigned(), GET_Groups()]);
  if (results[0].status === "fulfilled") data.value = results[0].value.data;
  else {
    data.value = { users: [], groups: [] };
    note.value =
      results[0].reason?.response?.status === 404
        ? t("access.unassigned_unsupported")
        : t("access.unassigned_unavailable");
  }
  directoryError.value =
    results[1].status === "rejected"
      ? t("access.directory_unavailable")
      : "";
  grantable.value =
    results[1].status === "fulfilled"
      ? results[1].value.data.filter((g) => g.grantable).map((g) => g.name)
      : [];
  loading.value = false;
}
async function assign(type, name, role) {
  if (!canWrite.value || busy.value) return;
  if (type === "group" && !grantable.value.includes(name)) {
    error.value = t("access.not_grantable");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    await POST_Grant(
      type === "user" ? { role, user: name } : { role, group_name: name }
    );
    await load();
    emit("changed");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
defineExpose({ load });
</script>
