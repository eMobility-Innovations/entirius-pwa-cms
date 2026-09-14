<template>
  <div class="access-overview">
    <p class="access-banner">
      {{ $t("access.default_access") }}
      <strong>{{ $t("access.override_replaces") }}</strong>
      {{ $t("access.empty_override") }}
    </p>
    <Grants @changed="unassigned?.load()" />
    <RoleMatrix :include-users="true" />
    <Unassigned ref="unassigned" @changed="refreshGrants" />
  </div>
</template>
<script setup>
import { ref, provide } from "vue";
import Grants from "./Grants.vue";
import RoleMatrix from "./RoleMatrix.vue";
import Unassigned from "./Unassigned.vue";
const unassigned = ref(null);
const grantRevision = ref(0);
provide("grantRevision", grantRevision);
function refreshGrants() {
  grantRevision.value++;
}
</script>
