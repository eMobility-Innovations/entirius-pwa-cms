<template>
  <AuthLayout :title="$t(errorMessage ? 'login.sso_failed' : 'login.sso_in_progress')">
    <template v-if="errorMessage" #status>
      <span data-testid="sso-error" data-test="sso-error-message">{{ errorMessage }}</span>
      <span v-if="debugId" data-test="sso-debug-id">{{ $t("login.sso_reference", { id: debugId }) }}</span>
    </template>
    <BasicButton v-if="errorMessage" variant="primary" size="lg" class="jc-ct w-100" @click="goToLogin">
      {{ $t("login.back_to_login") }}
    </BasicButton>
    <Loader v-else />
  </AuthLayout>
</template>

<script>
import {
  POST_SsoCallback,
} from "@/api/sso/api";
import { SSO_STATE_KEY, isSsoEnabled, ssoRedirectUri, blockAutoLogin, allowAutoLogin } from "@/configs/sso";
import { useUserStore } from "@/stores/user";
import { useLoginSession, consumeReturnRoute } from "@/composables/useLoginSession";
import { extractApiMessage } from "@/composables/useFormErrors";
import AuthLayout from "@/boots/AuthLayout/index.vue";

let signInInFlight = false;

export default {
  components: { AuthLayout },
  setup() {
    const userStore = useUserStore();
    const { completeLogin } = useLoginSession();
    return { userStore, completeLogin };
  },
  data() {
    return { errorMessage: "", debugId: "" };
  },
  async mounted() {
    if (signInInFlight && this.userStore.isAuth) return;
    // Single use: a reload or a second tab must never reuse the state.
    let expectedState;
    try {
      expectedState = sessionStorage.getItem(SSO_STATE_KEY) || sessionStorage.getItem("cms_sso_state");
      sessionStorage.removeItem(SSO_STATE_KEY);
      sessionStorage.removeItem("cms_sso_state");
    } catch { expectedState = null; }

    if (!isSsoEnabled() || this.userStore.isAuth) {
      this.$router.replace("/");
      return;
    }
    this.errorMessage = this.validate(expectedState);
    if (this.errorMessage) blockAutoLogin();
    if (!this.errorMessage) {
      signInInFlight = true;
      try { await this.finishLogin(); } finally { signInInFlight = false; }
    }
  },
  methods: {
    failureKey(kind) {
      const fork = process.env.VUE_APP_SSO_ENABLED !== undefined;
      const keys = { state: fork ? "login.sso_error_state" : "login.sso_state_mismatch", code: fork ? "login.sso_error_no_code" : "login.sso_state_mismatch", generic: fork ? "login.sso_error_generic" : "login.sso_failed" };
      return keys[kind];
    },
    validate(expectedState) {
      const { code, state, error } = this.$route.query;
      if (error) {
        return this.$t("login.sso_provider_error", { error });
      }
      if (!code) return this.$t(this.failureKey("code"));
      if (!state || state !== expectedState) {
        return this.$t(this.failureKey("state"));
      }
      return "";
    },
    async finishLogin() {
      const { code, state } = this.$route.query;
      try {
        const { data } = await POST_SsoCallback({
          code,
          state,
          redirect_uri: ssoRedirectUri(),
        });
        if (!data?.access || !data?.refresh) {
          this.errorMessage = this.$t("login.sso_error_no_tokens");
          blockAutoLogin();
          return;
        }
        await this.completeLogin(data);
        allowAutoLogin();
        this.$router.replace(consumeReturnRoute() || "/");
      } catch (error) {
        blockAutoLogin();
        this.debugId = error?.response?.data?.debug_id || "";
        this.errorMessage = extractApiMessage(error, this.$t(this.failureKey("generic")));
      }
    },
    goToLogin() {
      this.$router.replace("/");
    },
  },
};
</script>
