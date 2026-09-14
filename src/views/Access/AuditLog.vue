<template>
  <div>
    <h1>{{ $t("access.audit") }}</h1>
    <!-- Read-only by construction: this component imports nothing that writes. -->
    <table>
      <thead>
        <tr>
          <th>{{ $t("access.when") }}</th>
          <th>{{ $t("access.who") }}</th>
          <th>{{ $t("access.what") }}</th>
          <th>{{ $t("access.target") }}</th>
          <th>{{ $t("access.role") }}</th>
          <!-- The column that answers "who did this, and where". A change made on this
               page and one made with manage.py land in ONE stream, and `via` is the only
               thing that tells them apart. -->
          <th>{{ $t("access.via") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="i">
          <td>{{ r.created_at }}</td>
          <td>{{ r.actor }}</td>
          <td>{{ r.action }}</td>
          <td>{{ r.target }}</td>
          <td>{{ r.details?.role }}</td>
          <td>{{ r.details?.via }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { GET_Audit } from "@/api/access/api";

const rows = ref([]);

onMounted(async () => {
  rows.value = (await GET_Audit()).data;
});
</script>
