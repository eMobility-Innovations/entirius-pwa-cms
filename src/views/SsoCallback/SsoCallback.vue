<template>
  <div
    class="auth-card fs-300 p-400 t-basic-700 br-50 bg-basic-100 b-basic-300 shadow-down"
  >
    <template v-if="errorMessage">
      <p class="fs-700 fw-600 txt-center mb-50">{{ $t("login.sso_failed") }}</p>
      <div class="auth-card__banner auth-card__banner--error mb-400">
        <p class="fs-300 fw-500" data-testid="sso-error">{{ errorMessage }}</p>
      </div>
      <BasicButton
        :text="$t('login.back_to_login')"
        @click="goToLogin"
        class="bg-support-400 b-support-400 jc-ct t-basic-100 w-100 br-50"
      />
    </template>
    <p v-else class="fs-500 fw-500 txt-center">
      {{ $t("login.sso_in_progress") }}
    </p>
  </div>
</template>

<script>
import {
  POST_SsoCallback,
  SSO_STATE_KEY,
  isSsoEnabled,
  ssoRedirectUri,
} from "@/api/sso/api";
import { useUserStore } from "@/stores/user";
import { useLoginSession, consumeReturnRoute } from "@/composables/useLoginSession";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  setup() {
    const userStore = useUserStore();
    const { completeLogin } = useLoginSession();
    return { userStore, completeLogin };
  },
  data() {
    return { errorMessage: "" };
  },
  async mounted() {
    // Single use: a reload or a second tab must never reuse the state.
    const expectedState = sessionStorage.getItem(SSO_STATE_KEY);
    sessionStorage.removeItem(SSO_STATE_KEY);

    if (!isSsoEnabled() || this.userStore.isAuth) {
      this.$router.replace("/");
      return;
    }
    this.errorMessage = this.validate(expectedState);
    if (!this.errorMessage) {
      await this.finishLogin();
    }
  },
  methods: {
    validate(expectedState) {
      const { code, state, error } = this.$route.query;
      if (error) {
        return this.$t("login.sso_provider_error", { error });
      }
      if (!code || !state || state !== expectedState) {
        return this.$t("login.sso_state_mismatch");
      }
      return "";
    },
    async finishLogin() {
      const { code, state } = this.$route.query;
      try {
        const { data } = await POST_SsoCallback({
          code,
          state,
          redirectUri: ssoRedirectUri(),
        });
        await this.completeLogin(data);
        this.$router.replace(consumeReturnRoute() || "/");
      } catch (error) {
        this.errorMessage = extractApiMessage(error, this.$t("login.sso_failed"));
      }
    },
    goToLogin() {
      this.$router.replace("/");
    },
  },
};
</script>
