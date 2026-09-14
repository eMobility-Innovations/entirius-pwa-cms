<template>
  <div>
    <h1>{{ $t("access.service_accounts") }}</h1>
    <!-- Read-only by construction. Creating one is a host command because it also creates
         a Django user: manage.py escaccess_service_account. -->
    <p class="hint">{{ $t("access.service_accounts_cli") }}</p>

    <h2>{{ $t("access.declared") }}</h2>
    <table>
      <tbody>
        <tr v-for="a in declared" :key="a.username">
          <td>{{ a.username }}</td>
          <td>{{ a.purpose }}</td>
        </tr>
      </tbody>
    </table>

    <h2>{{ $t("access.unclassified_staff") }}</h2>
    <!-- Neither linked to SSO nor marked as a machine, so NOTHING tells a consumer what
         they are — and an unmarked account silently enters every human-only path. -->
    <p class="hint">{{ $t("access.unclassified_staff_why") }}</p>
    <ul>
      <li v-for="name in unclassified" :key="name">{{ name }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { GET_ServiceAccounts } from "@/api/access/api";

const declared = ref([]);
const unclassified = ref([]);

onMounted(async () => {
  const { data } = await GET_ServiceAccounts();
  declared.value = data.declared;
  unclassified.value = data.unclassified_staff;
});
</script>
