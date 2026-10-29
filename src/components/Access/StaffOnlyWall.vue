<template>
  <AuthLayout
    :title="$t('access.staff_only_title')"
    :subtitle="$t('access.staff_only_message')"
  >
    <BasicButton
      variant="primary"
      size="lg"
      class="jc-ct w-100"
      data-testid="staff-only-logout"
      :loading="leaving"
      @click="logout"
    >
      {{ $t("app.log_out") }}
    </BasicButton>
  </AuthLayout>
</template>

<script setup>
// A customer account (`me.user.is_staff === false`) logged into the CMS: one notice in the sign-in frame instead of
// an empty shell — no sidebar, no panels, no admin calls. The gate refuses it anyway (STAFF_ONLY).
import { ref } from "vue";
import { useUserStore } from "@/stores/user";
import AuthLayout from "@/boots/AuthLayout/index.vue";

const userStore = useUserStore();
const leaving = ref(false);

function logout() {
  leaving.value = true;
  userStore.logout();
}
</script>
