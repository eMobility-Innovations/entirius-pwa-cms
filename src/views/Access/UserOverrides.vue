<template>
  <div>
    <h1>{{ $t("access.users") }}</h1>
    <!-- A per-person set REPLACES the set their ROLE carries; it is not added to it. -->
    <p class="hint">{{ $t("access.override_replaces") }}</p>
    <p v-if="error" data-test="error">{{ error }}</p>

    <!-- Adding a person searches KEYCLOAK. Sourcing this from the CMS user table would
         hand back `patryk_1` for anyone whose name collided with a local account, and the
         override written from it would apply to nobody. -->
    <div v-if="canWrite">
      <input v-model="userQuery" :placeholder="$t('access.search_people')" data-test="user-search" />
      <ul>
        <li v-for="u in userResults" :key="u.kc_username">
          <button type="button" :data-test="`add-${u.kc_username}`" @click="add(u.kc_username)">
            {{ u.kc_username }} — {{ u.first_name }} {{ u.last_name }}
          </button>
        </li>
      </ul>
    </div>

    <table>
      <thead>
        <tr>
          <th></th>
          <th v-for="p in allPermissions" :key="p">{{ p }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="name in people" :key="name">
          <!-- The KEYCLOAK username, always. There is deliberately no fallback to a CMS
               username: a row labelled with the wrong one is worse than no row. -->
          <th>{{ name }}</th>
          <td v-for="p in allPermissions" :key="p">
            <input
              type="checkbox"
              :disabled="!canWrite"
              :checked="selected[name]?.includes(p)"
              @change="toggle(name, p)"
            />
          </td>
          <td>
            <button v-if="canWrite" :data-test="`save-${name}`" @click="save(name, selected[name] || [])">
              {{ $t("access.save") }}
            </button>
            <button
              v-if="canWrite && overridden.has(name)"
              :data-test="`reset-${name}`"
              @click="clear(name)"
            >
              {{ $t("access.reset_to_defaults") }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import { GET_Overrides, PUT_UserOverride, DELETE_UserOverride, GET_Users } from "@/api/access/api";

const store = useAccessMatrixStore();
const { catalog, canWrite } = storeToRefs(store);

const selected = reactive({});
const people = ref([]);
const overridden = ref(new Set());
const userResults = ref([]);
const userQuery = ref("");
const error = ref("");

const allPermissions = computed(() => [
  ...(catalog.value?.pages || []),
  ...(catalog.value?.features || []),
]);

async function load() {
  const { data } = await GET_Overrides();
  overridden.value = new Set(data.users.map((u) => u.kc_username));
  const existing = new Set(people.value);
  for (const row of data.users) {
    selected[row.kc_username] = [...row.permissions];
    existing.add(row.kc_username);
  }
  people.value = [...existing].sort();
}

function add(kcUsername) {
  if (!people.value.includes(kcUsername)) {
    selected[kcUsername] = selected[kcUsername] || [];
    people.value = [...people.value, kcUsername].sort();
  }
}

function toggle(kcUsername, permission) {
  const current = selected[kcUsername] || [];
  selected[kcUsername] = current.includes(permission)
    ? current.filter((p) => p !== permission)
    : [...current, permission];
}

watch(userQuery, async (q) => {
  if (!q || q.length < 2) {
    userResults.value = [];
    return;
  }
  try {
    userResults.value = (await GET_Users(q)).data;
  } catch {
    userResults.value = [];
  }
});

async function save(kcUsername, permissions) {
  error.value = "";
  try {
    // An EMPTY list is sent as an empty list: it is how one person is held to nothing at
    // all, and the server stores a marker so it does not revert to their role on re-read.
    await PUT_UserOverride(kcUsername, permissions);
    await load();
  } catch (e) {
    error.value = e?.error?.message || String(e);
  }
}

async function clear(kcUsername) {
  error.value = "";
  try {
    await DELETE_UserOverride(kcUsername);
    await load();
  } catch (e) {
    error.value = e?.error?.message || String(e);
  }
}

onMounted(load);
defineExpose({ save, clear, toggle, add, selected, people });
</script>
