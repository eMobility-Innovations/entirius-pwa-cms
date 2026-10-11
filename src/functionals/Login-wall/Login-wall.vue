<template>
  <AuthLayout :title="title" :subtitle="subtitle" :status-tone="statusTone">
    <template v-if="statusText" #status>{{ statusText }}</template>

    <!-- Forgot password mode -->
    <template v-if="showForgotPassword">
      <form v-if="!resetEmailSent" class="flex-column gap-6" @submit.prevent="sendResetLink">
        <FormField :label="$t('login.email')" :error="errors.email">
          <BasicInput v-model="resetEmail" size="lg" autocomplete="email" inputmode="email" />
        </FormField>
        <BasicButton type="submit" variant="primary" size="lg" class="jc-ct w-100">
          {{ $t("login.send_reset_link") }}
        </BasicButton>
      </form>
      <BasicButton variant="ghost" size="lg" class="jc-ct w-100 mt-4" @click="closeForgotPassword">
        {{ $t("login.back_to_login") }}
      </BasicButton>
    </template>

    <!-- Login mode -->
    <template v-else>
      <form class="flex-column gap-6" @submit.prevent="login">
        <div class="flex-column gap-4">
          <FormField :label="$t('login.username')" :error="errors.username">
            <BasicInput v-model="username" size="lg" autocomplete="username" />
          </FormField>
          <PasswordField v-model="password" :label="$t('login.password')" :error="errors.password" />
        </div>
        <BasicButton type="submit" variant="primary" size="lg" :loading="signingIn" class="jc-ct w-100">
          {{ $t("login.submit") }}
        </BasicButton>
      </form>

      <template v-if="ssoEnabled">
        <p class="login-wall__divider fs-200 t-muted mv-5">{{ $t("login.sso_or") }}</p>
        <BasicButton data-testid="sso-login" variant="secondary" size="lg" class="jc-ct w-100" @click="startSsoLogin">
          {{ $t("login.sso_submit") }}
        </BasicButton>
      </template>

      <BasicButton variant="ghost" size="lg" class="jc-ct w-100 mt-4" @click="openForgotPassword">
        {{ $t("login.forgot_password") }}
      </BasicButton>
    </template>
  </AuthLayout>
</template>

<script>
// The dev auto-login pair is read in development only; a production build refuses to start with either set.
const environment = process.env.NODE_ENV === "development";
const username = environment ? process.env.VUE_APP_USERNAME : "";
const password = environment ? process.env.VUE_APP_PASSWORD : "";

import { POST_Login, POST_PasswordReset } from "../../api/contentDB/api";
import {
  POST_SsoLoginUrl,
  SSO_STATE_KEY,
  isSsoEnabled,
  ssoRedirectUri,
} from "@/api/sso/api";
import { useLoginSession, consumeReturnRoute } from "@/composables/useLoginSession";
import { extractApiMessage } from "@/composables/useFormErrors";
import AuthLayout from "@/boots/AuthLayout/index.vue";
import PasswordField from "@/boots/AuthLayout/PasswordField.vue";

const noErrors = () => ({ username: "", password: "", email: "" });

// Errors show under their field and once in the AuthLayout live summary (plan 59), never as a toast.
export default {
  components: { AuthLayout, PasswordField },
  setup() {
    const { completeLogin } = useLoginSession();
    return { completeLogin };
  },
  data() {
    return {
      username,
      password,
      signingIn: false,
      sessionExpired: false,
      showForgotPassword: false,
      resetEmail: "",
      resetEmailSent: false,
      errors: noErrors(),
      formError: "",
    };
  },
  computed: {
    ssoEnabled() {
      return isSsoEnabled();
    },
    title() {
      return this.$t(this.showForgotPassword ? "login.forgot_title" : "login.welcome");
    },
    subtitle() {
      return this.$t(this.showForgotPassword ? "login.forgot_subtitle" : "login.subtitle");
    },
    statusText() {
      if (this.formError) return this.formError;
      if (this.showForgotPassword) return this.resetEmailSent ? this.$t("login.reset_email_sent") : "";
      return this.sessionExpired ? this.$t("login.session_expired") : "";
    },
    statusTone() {
      if (this.formError) return "negative";
      return this.showForgotPassword ? "positive" : "warning";
    },
  },
  watch: {
    username: "clearErrors",
    password: "clearErrors",
    resetEmail: "clearErrors",
  },
  mounted() {
    if (localStorage.getItem("session_expired") === "1") {
      this.sessionExpired = true;
      localStorage.removeItem("session_expired");
    }
  },
  methods: {
    clearErrors() {
      this.errors = noErrors();
      this.formError = "";
    },
    validateCredentials() {
      this.errors.username = this.username ? "" : this.$t("login.username_required");
      this.errors.password = this.password ? "" : this.$t("login.password_required");
      const missing = this.errors.username || this.errors.password;
      this.formError = missing ? this.$t("login.empty_credentials") : "";
      return !missing;
    },
    async login() {
      this.sessionExpired = false;
      if (!this.validateCredentials()) return;
      this.signingIn = true;
      try {
        const { data } = await POST_Login({
          username: this.username,
          password: this.password,
        });
        await this.completeLogin(data.data || {});

        const returnRoute = consumeReturnRoute();
        if (returnRoute) {
          this.$router.push(returnRoute);
        }
      } catch (error) {
        this.formError = extractApiMessage(error, this.$t("login.unknown_error"));
      } finally {
        this.signingIn = false;
      }
    },
    async startSsoLogin() {
      this.clearErrors();
      try {
        const { data } = await POST_SsoLoginUrl({ redirectUri: ssoRedirectUri() });
        sessionStorage.setItem(SSO_STATE_KEY, data.state);
        window.location.assign(data.authorization_url);
      } catch (error) {
        this.formError = extractApiMessage(error, this.$t("login.sso_failed"));
      }
    },
    openForgotPassword() {
      this.clearErrors();
      this.showForgotPassword = true;
    },
    closeForgotPassword() {
      this.clearErrors();
      this.showForgotPassword = false;
      this.resetEmailSent = false;
    },
    async sendResetLink() {
      if (!this.resetEmail) {
        this.errors.email = this.$t("common.required");
        this.formError = this.$t("login.enter_email");
        return;
      }
      try {
        await POST_PasswordReset({ email: this.resetEmail });
      } catch {
        // Show success regardless to prevent email enumeration
      }
      this.resetEmailSent = true;
    },
  },
};
</script>

<style lang="scss" scoped>
.login-wall__divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  &::before,
  &::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
