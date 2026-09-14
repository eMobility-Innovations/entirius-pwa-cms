<template>
  <div class="access-grants">
    <h1>{{ $t("access.grants") }}</h1>

    <form v-if="canWrite" class="access-grants__form" @submit.prevent="submit">
      <select v-model="form.role" data-test="role">
        <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
      </select>

      <select v-model="form.granteeKind" data-test="kind">
        <option value="user">{{ $t("access.person") }}</option>
        <option value="group">{{ $t("access.group") }}</option>
      </select>

      <!-- A person is identified by their KEYCLOAK username, which is what the matrix keys
           on. It differs from the CMS username for anyone whose name collided with a local
           account, so it is never typed from memory — it is picked from the directory. -->
      <input
        v-if="form.granteeKind === 'user'"
        v-model="userQuery"
        :placeholder="$t('access.search_people')"
        data-test="user-search"
      />
      <ul v-if="form.granteeKind === 'user'">
        <li v-for="u in userResults" :key="u.kc_username">
          <button type="button" @click="form.kcUsername = u.kc_username">
            {{ u.kc_username }} — {{ u.first_name }} {{ u.last_name }}
          </button>
        </li>
      </ul>

      <!-- A group is picked by NAME and submitted as a name. The server resolves it to
           grp-<lldap_uuid> once, at write time, so the grant survives a rename. -->
      <select v-if="form.granteeKind === 'group'" v-model="form.groupName" data-test="group">
        <option v-for="g in groups" :key="g.name" :value="g.name" :disabled="!g.grantable">
          {{ g.name }}{{ g.grantable ? "" : ` — ${$t("access.not_grantable")}` }}
        </option>
      </select>

      <button type="submit" data-test="grant">{{ $t("access.grant") }}</button>
    </form>

    <p v-if="error" class="access-grants__error" data-test="error">{{ error }}</p>

    <table>
      <tbody>
        <tr v-for="g in grants" :key="g.id">
          <td>{{ g.role }}</td>
          <td>
            <span v-if="g.grantee_type === 'group'">
              {{ g.group_name || g.grantee }}
              <em v-if="!g.name_resolved">{{ $t("access.unresolved_group") }}</em>
            </span>
            <span v-else>{{ g.grantee }}</span>
          </td>
          <td>{{ g.granted_by }}</td>
          <td>
            <button v-if="canWrite" :data-test="`revoke-${g.id}`" @click="revoke(g.id)">
              {{ $t("access.revoke") }}
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
import { GET_Grants, POST_Grant, DELETE_Grant, GET_Groups, GET_Users } from "@/api/access/api";

const store = useAccessMatrixStore();
const { canWrite, catalog } = storeToRefs(store);

const grants = ref([]);
const groups = ref([]);
const userResults = ref([]);
const userQuery = ref("");
const error = ref("");
const form = reactive({ role: "USER", granteeKind: "user", kcUsername: "", groupName: "" });
const roles = computed(() => catalog.value?.roles || ["SYSADMIN", "ADMIN", "USER"]);

async function load() {
  grants.value = (await GET_Grants()).data;
  try {
    groups.value = (await GET_Groups()).data;
  } catch (e) {
    // A 503 here means the directory is down, NOT that there are no groups. Saying so
    // stops somebody concluding the group does not exist and granting by name instead.
    groups.value = [];
    error.value = e?.error?.message || "access.directory_unavailable";
  }
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

async function createGrant({ role, granteeKind, kcUsername, groupName }) {
  const payload =
    granteeKind === "group" ? { role, group_name: groupName } : { role, user: kcUsername };
  await POST_Grant(payload);
  await load();
}

async function submit() {
  error.value = "";
  try {
    await createGrant({ ...form });
  } catch (e) {
    error.value = e?.error?.message || String(e);
  }
}

async function revoke(id) {
  error.value = "";
  try {
    await DELETE_Grant(id);
    await load();
  } catch (e) {
    // The refusal that matters: removing the last way in. The message names the host
    // command, and it must reach the screen verbatim.
    error.value = e?.error?.message || String(e);
  }
}

onMounted(load);
defineExpose({ createGrant, revoke });
</script>
