<template>
  <div class="access-overview">
    <p class="access-banner">
      Anyone with a Keycloak account can sign in and gets
      <strong>USER</strong> — a read-only view. Roles below grant more. A role
      or user override <strong>replaces</strong> the default set rather than
      adding to it, and an override saved with nothing ticked is kept as
      genuinely empty.
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
