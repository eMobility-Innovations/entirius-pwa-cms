<template>
  <section aria-labelledby="assignments-title">
    <h2 id="assignments-title">{{ $t("access.grants") }}</h2>
    <p v-if="loading" role="status">{{ $t("access.loading_grants") }}</p>
    <p v-if="error" class="access-error" role="alert" data-test="error">
      {{ error }}
    </p>
    <p v-if="directoryError" class="access-error" role="status">
      {{ directoryError }}
    </p>
    <div class="access-role-grid">
      <article
        v-for="role in roles"
        :key="role"
        class="access-card"
        :class="`access-role--${role}`"
      >
        <h3>{{ role }}</h3>
        <div class="access-chips">
          <span
            v-for="g in grants.filter((g) => g.role === role)"
            :key="g.id"
            class="access-chip"
            :class="`access-chip--${g.grantee_type}`"
          >
            {{
              g.grantee_type === "group"
                ? g.group_name || g.grantee_label || g.grantee
                : g.grantee
            }}
            <em v-if="g.grantee_type === 'group' && !g.name_resolved">{{
              $t("access.unresolved_group")
            }}</em>
            <button
              v-if="canWrite"
              :disabled="busy"
              :data-test="`revoke-${g.id}`"
              :aria-label="
                $t('access.remove_grant', {
                  name: g.group_name || g.grantee,
                  role,
                })
              "
              @click="revoke(g.id)"
            >
              ×
            </button>
          </span>
          <span
            v-if="!loading && !error && !grants.some((g) => g.role === role)"
            class="access-muted"
            >{{ $t("access.nobody") }}</span
          >
        </div>
        <template v-if="canWrite">
          <form
            v-if="adding?.role === role"
            class="access-inline"
            @submit.prevent="submit"
          >
            <input
              v-model="newGrantee"
              :list="
                adding.type === 'group' ? 'access-groups' : 'access-grant-users'
              "
              :aria-label="
                adding.type === 'group'
                  ? $t('access.group')
                  : $t('access.keycloak_username')
              "
              :placeholder="
                adding.type === 'group'
                  ? $t('access.group')
                  : $t('access.keycloak_username')
              "
              @input="searchUsers"
              @keydown.esc="adding = null"
            />
            <button :disabled="busy || !newGrantee.trim()">
              {{ $t("common.add") }}
            </button>
            <button type="button" @click="adding = null">
              {{ $t("common.cancel") }}
            </button>
          </form>
          <div v-else class="access-inline">
            <button
              :disabled="busy || !!directoryError"
              :data-test="`add-group-${role}`"
              @click="startAdding(role, 'group')"
            >
              + {{ $t("access.group") }}
            </button>
            <button
              :disabled="busy"
              :data-test="`add-user-${role}`"
              @click="startAdding(role, 'user')"
            >
              + {{ $t("access.person") }}
            </button>
          </div>
        </template>
      </article>
    </div>
    <datalist id="access-groups">
      <option
        v-for="g in groups.filter((g) => g.grantable)"
        :key="g.name"
        :value="g.name"
      />
    </datalist>
    <datalist id="access-grant-users">
      <option
        v-for="u in userResults"
        :key="u.kc_username"
        :value="u.kc_username"
      >
        {{ u.first_name }} {{ u.last_name }}
      </option>
    </datalist>
  </section>
</template>
<script setup>
import { ref, onMounted, inject, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import {
  GET_Grants,
  POST_Grant,
  DELETE_Grant,
  GET_Groups,
  GET_Users,
} from "@/api/access/api";
import { t } from "@/i18n";
import { errorMessage } from "./helpers";
const emit = defineEmits(["changed"]);
const { canWrite } = storeToRefs(useAccessMatrixStore());
const roles = ["SYSADMIN", "ADMIN", "USER"];
const grants = ref([]),
  groups = ref([]),
  userResults = ref([]);
const error = ref(""),
  directoryError = ref(""),
  loading = ref(true),
  busy = ref(false);
const adding = ref(null),
  newGrantee = ref("");
async function load() {
  loading.value = true;
  const results = await Promise.allSettled([GET_Grants(), GET_Groups()]);
  if (results[0].status === "fulfilled") grants.value = results[0].value.data;
  else error.value = errorMessage(results[0].reason);
  directoryError.value =
    results[1].status === "rejected"
      ? `${t("access.directory_unavailable")} ${errorMessage(results[1].reason)}`
      : "";
  groups.value = results[1].status === "fulfilled" ? results[1].value.data : [];
  loading.value = false;
}
let searchVersion = 0;
async function searchUsers() {
  if (adding.value?.type !== "user") return;
  const version = ++searchVersion;
  try {
    const { data } = await GET_Users(newGrantee.value);
    if (version === searchVersion) userResults.value = data;
  } catch {
    if (version === searchVersion)
      error.value = t("access.directory_unavailable");
  }
}
function startAdding(role, type) {
  adding.value = { role, type };
  newGrantee.value = "";
  searchUsers();
}
async function mutate(action) {
  if (!canWrite.value || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await action();
    adding.value = null;
    await load();
    emit("changed");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
async function createGrant({ role, granteeKind, kcUsername, groupName }) {
  if (granteeKind === "group" && directoryError.value) return;
  return mutate(() =>
    POST_Grant(
      granteeKind === "group"
        ? { role, group_name: groupName }
        : { role, user: kcUsername }
    )
  );
}
function submit() {
  const name = newGrantee.value.trim();
  if (!name) return;
  if (
    adding.value.type === "group" &&
    !groups.value.some((g) => g.name === name && g.grantable)
  ) {
    error.value = t("access.choose_grantable_group");
    return;
  }
  return createGrant({
    role: adding.value.role,
    granteeKind: adding.value.type,
    groupName: name,
    kcUsername: name,
  });
}
function revoke(id) {
  return mutate(() => DELETE_Grant(id));
}
watch(inject("grantRevision", ref(0)), load);
onMounted(load);
defineExpose({ createGrant, revoke });
</script>
