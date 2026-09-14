<template>
  <section aria-labelledby="matrix-title">
    <h2 id="matrix-title">{{ $t("access.permission_matrix") }}</h2>
    <p v-if="loading" role="status">{{ $t("access.loading_permissions") }}</p>
    <p v-if="error" class="access-error" role="alert" data-test="error">
      {{ error }}
    </p>
    <div v-if="!loading" class="access-table-scroll">
      <table class="access-matrix">
        <thead>
          <tr>
            <th scope="col">{{ $t("access.target") }}</th>
            <th v-for="p in allPermissions" :key="p" scope="col">
              <span class="access-vertical">{{ p }}</span>
            </th>
            <th scope="col">
              <span class="access-muted">{{ $t("access.actions") }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :data-test="`row-${row.scope}-${row.name}`"
          >
            <th scope="row">
              {{ row.name
              }}<small>{{
                row.scope === "user"
                  ? $t("access.user_override")
                  : hasOverride(row)
                  ? $t("access.customised")
                  : $t("access.default")
              }}</small>
            </th>
            <td v-for="p in allPermissions" :key="p">
              <input
                type="checkbox"
                :aria-label="`${row.name}: ${p}`"
                :disabled="!canWrite || busy === row.id"
                :checked="current(row).includes(p)"
                @change="toggleRow(row, p)"
              />
            </td>
            <td>
              <div v-if="canWrite" class="access-inline">
                <button
                  v-if="isDirty(row)"
                  :data-test="`save-${row.name}`"
                  :disabled="busy === row.id"
                  @click="saveRow(row)"
                >
                  {{ $t("access.save") }}
                </button>
                <button
                  v-if="hasOverride(row)"
                  :data-test="`reset-${row.name}`"
                  :disabled="busy === row.id"
                  @click="resetRow(row)"
                >
                  {{ $t("access.reset_to_defaults") }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <form
      v-if="canWrite && (includeUsers || userOnly)"
      class="access-inline access-add-override"
      @submit.prevent="add(userQuery)"
    >
      <input
        v-model="userQuery"
        list="access-override-users"
        :aria-label="$t('access.override_username')"
        :placeholder="$t('access.keycloak_username')"
        @input="searchUsers"
      />
      <datalist id="access-override-users">
        <option
          v-for="u in userResults"
          :key="u.kc_username"
          :value="u.kc_username"
        >
          {{ u.first_name }} {{ u.last_name }}
        </option>
      </datalist>
      <button :disabled="!userQuery.trim() || loading">
        + {{ $t("access.add_user_override") }}
      </button>
    </form>
  </section>
</template>
<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import {
  GET_Overrides,
  GET_Catalog,
  GET_Users,
  PUT_RoleOverride,
  DELETE_RoleOverride,
  PUT_UserOverride,
  DELETE_UserOverride,
} from "@/api/access/api";
import { t } from "@/i18n";
import { errorMessage } from "./helpers";
const props = defineProps({ includeUsers: Boolean, userOnly: Boolean });
const store = useAccessMatrixStore();
const { catalog, canWrite } = storeToRefs(store);
const stored = ref({ roles: [], users: [] }),
  drafts = reactive(new Map()),
  added = ref([]);
const error = ref(""),
  loading = ref(true),
  busy = ref("");
const userQuery = ref(""),
  userResults = ref([]);
const roleNames = ["SYSADMIN", "ADMIN", "USER"];
const allPermissions = computed(() => [
  ...(catalog.value?.pages || []),
  ...(catalog.value?.features || []),
]);
const people = computed(() =>
  [
    ...new Set([
      ...stored.value.users.map((u) => u.kc_username),
      ...added.value,
    ]),
  ].sort()
);
const makeRow = (scope, name) => ({ scope, name, id: `${scope}:${name}` });
const rows = computed(() => [
  ...(props.userOnly ? [] : roleNames.map((name) => makeRow("role", name))),
  ...(props.includeUsers || props.userOnly
    ? people.value.map((name) => makeRow("user", name))
    : []),
]);
function override(row) {
  return row.scope === "role"
    ? stored.value.roles.find((r) => r.role === row.name)
    : stored.value.users.find((u) => u.kc_username === row.name);
}
function hasOverride(row) {
  return !!override(row);
}
function baseline(row) {
  return (
    override(row)?.permissions ??
    (row.scope === "role" ? catalog.value?.effective?.[row.name] ?? [] : [])
  );
}
function current(row) {
  return drafts.get(row.id) ?? baseline(row);
}
function isDirty(row) {
  if (!drafts.has(row.id)) return false;
  const a = current(row),
    b = baseline(row);
  return (
    (row.scope === "user" && !hasOverride(row)) ||
    a.length !== b.length ||
    a.some((p) => !b.includes(p))
  );
}
function toggleRow(row, p) {
  if (!canWrite.value) return;
  const value = current(row);
  drafts.set(
    row.id,
    value.includes(p) ? value.filter((x) => x !== p) : [...value, p]
  );
}
async function load() {
  try {
    stored.value = (await GET_Overrides()).data;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
async function saveRow(row, permissions = current(row)) {
  if (!canWrite.value || busy.value) return;
  busy.value = row.id;
  error.value = "";
  try {
    await (row.scope === "role" ? PUT_RoleOverride : PUT_UserOverride)(
      row.name,
      [...permissions]
    );
    // Update only the saved row: drafts in other rows survive writes and failed requests.
    const list = row.scope === "role" ? stored.value.roles : stored.value.users;
    const key = row.scope === "role" ? "role" : "kc_username";
    const old = list.findIndex((r) => r[key] === row.name);
    const value = { [key]: row.name, permissions: [...permissions] };
    if (old < 0) list.push(value);
    else list.splice(old, 1, value);
    drafts.delete(row.id);
    added.value = added.value.filter((n) => n !== row.name);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = "";
  }
}
async function resetRow(row) {
  if (!canWrite.value || busy.value) return;
  busy.value = row.id;
  error.value = "";
  try {
    await (row.scope === "role" ? DELETE_RoleOverride : DELETE_UserOverride)(
      row.name
    );
    if (row.scope === "role") {
      stored.value.roles = stored.value.roles.filter(
        (r) => r.role !== row.name
      );
      // The catalog's effective set may still contain the removed override.
      try {
        catalog.value = (await GET_Catalog()).data;
      } catch {
        error.value = t("access.override_reset_reload");
      }
    } else
      stored.value.users = stored.value.users.filter(
        (u) => u.kc_username !== row.name
      );
    drafts.delete(row.id);
    added.value = added.value.filter((n) => n !== row.name);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = "";
  }
}
function add(name) {
  name = name.trim();
  if (!canWrite.value || !name || people.value.includes(name)) return;
  added.value.push(name);
  drafts.set(`user:${name}`, []);
  userQuery.value = "";
}
let searchVersion = 0;
async function searchUsers() {
  const version = ++searchVersion;
  try {
    const { data } = await GET_Users(userQuery.value);
    if (version === searchVersion) userResults.value = data;
  } catch {
    if (version === searchVersion)
      error.value = t("access.directory_unavailable");
  }
}
const defaultScope = () => (props.userOnly ? "user" : "role");
const selected = computed(() =>
  Object.fromEntries(rows.value.map((row) => [row.name, current(row)]))
);
const save = (name, permissions) =>
  saveRow(makeRow(defaultScope(), name), permissions);
const clear = (name) => resetRow(makeRow(defaultScope(), name));
const toggle = (name, permission) =>
  toggleRow(makeRow(defaultScope(), name), permission);
onMounted(load);
defineExpose({ save, clear, toggle, selected, add, people });
</script>
