<template>
  <div class="access-panel">
    <!-- Shown to exactly the people the matrix grants page:access. Someone with no grant
         is not shown a shell with five empty tabs — they are told they hold none, and by
         whom it can be given, because a blank page leaves them nothing to act on. -->
    <nav v-if="canRead" aria-label="Access views">
      <router-link to="/access/grants">Access overview</router-link>
      <router-link to="/access/audit">{{ $t("access.audit") }}</router-link>
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
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAccessMatrixStore } from "@/stores/accessMatrix";

const store = useAccessMatrixStore();
const { canRead, loaded } = storeToRefs(store);

onMounted(() => store.ensureLoaded());
</script>

<style lang="scss" src="./access.scss"></style>
