<template>
  <div class="access-panel">
    <!-- Shown to exactly the people the matrix grants page:access. Someone with no grant
         is not shown a shell with five empty tabs — they are told they hold none, and by
         whom it can be given, because a blank page leaves them nothing to act on. -->
    <nav v-if="canRead" aria-label="Access views">
      <router-link to="/access/grants">Access overview</router-link>
      <router-link to="/access/audit">{{ $t("access.matrix_labels.audit") }}</router-link>
      <router-link to="/access/service-accounts">{{
        $t("access.service_accounts")
      }}</router-link>
    </nav>
    <p v-else-if="loaded" data-test="no-grant">{{ $t("access.no_grant") }}</p>

    <router-view v-if="canRead" v-slot="{ Component }">
      <component
        :is="
          ['/access/audit', '/access/service-accounts'].includes($route?.path)
            ? Component
            : AccessOverview
        "
      />
    </router-view>
  </div>
</template>

<script setup>
import AccessOverview from "./AccessOverview.vue";
import { computed, onMounted } from "vue";
import { provideReadonly } from "@/composables/useReadonly";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";

const store = useAccessMatrixStore();
const { canRead, canWrite, loaded } = storeToRefs(store);
// This overlay uses the organization matrix, not django-access's separate API contract.
provideReadonly(computed(() => !canWrite?.value));

onMounted(() => store.ensureLoaded());
</script>

<style lang="scss" src="./access.scss"></style>
