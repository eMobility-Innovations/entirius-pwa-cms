<template>
  <div>
    <h1>{{ $t("access.roles") }}</h1>
    <!-- Said on screen because it is the one thing about this table that surprises people:
         a stored set REPLACES the role's defaults. Changing a default in code afterwards
         does not reach a role somebody has overridden here. -->
    <p class="hint">{{ $t("access.override_replaces") }}</p>
    <p v-if="error" data-test="error">{{ error }}</p>

    <table>
      <thead>
        <tr>
          <th></th>
          <th v-for="p in allPermissions" :key="p">{{ p }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="role in roles" :key="role">
          <th>{{ role }}</th>
          <td v-for="p in allPermissions" :key="p">
            <input
              type="checkbox"
              :disabled="!canWrite"
              :checked="selected[role]?.includes(p)"
              @change="toggle(role, p)"
            />
          </td>
          <td>
            <button v-if="canWrite" :data-test="`save-${role}`" @click="save(role, selected[role] || [])">
              {{ $t("access.save") }}
            </button>
            <button
              v-if="canWrite && overridden.has(role)"
              :data-test="`reset-${role}`"
              @click="clear(role)"
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
import { ref, reactive, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import { GET_Overrides, PUT_RoleOverride, DELETE_RoleOverride } from "@/api/access/api";

const store = useAccessMatrixStore();
const { catalog, canWrite } = storeToRefs(store);

const selected = reactive({});
const overridden = ref(new Set());
const error = ref("");

const roles = computed(() => catalog.value?.roles || []);
const allPermissions = computed(() => [
  ...(catalog.value?.pages || []),
  ...(catalog.value?.features || []),
]);

async function load() {
  const { data } = await GET_Overrides();
  overridden.value = new Set(data.roles.map((r) => r.role));
  for (const role of roles.value) {
    const stored = data.roles.find((r) => r.role === role);
    // EFFECTIVE, not role_defaults: the boxes must show what the role carries TODAY.
    selected[role] = stored
      ? [...stored.permissions]
      : [...(catalog.value?.effective?.[role] || [])];
  }
}

function toggle(role, permission) {
  const current = selected[role] || [];
  selected[role] = current.includes(permission)
    ? current.filter((p) => p !== permission)
    : [...current, permission];
}

async function save(role, permissions) {
  error.value = "";
  try {
    // An EMPTY list is sent as an empty list, never skipped: it is how a role is held to
    // nothing at all, and the server stores a marker so it does not revert on next read.
    await PUT_RoleOverride(role, permissions);
    await load();
  } catch (e) {
    error.value = e?.error?.message || String(e);
  }
}

async function clear(role) {
  error.value = "";
  try {
    // A DELETE, not a save of the current defaults. Saving them would freeze today's
    // defaults as an override and silently detach the role from any future change to them.
    await DELETE_RoleOverride(role);
    await load();
  } catch (e) {
    error.value = e?.error?.message || String(e);
  }
}

onMounted(load);
defineExpose({ save, clear, toggle, selected });
</script>
