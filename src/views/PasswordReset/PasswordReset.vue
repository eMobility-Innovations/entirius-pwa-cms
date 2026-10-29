<template>
  <AuthLayout :title="title" :subtitle="done ? '' : $t('reset.subtitle')" :status-tone="success ? 'positive' : 'negative'">
    <template v-if="statusText" #status>{{ statusText }}</template>

    <BasicButton v-if="done" variant="primary" size="lg" class="jc-ct w-100" @click="goToLogin">
      {{ $t("reset.back_to_login") }}
    </BasicButton>

    <form v-else class="flex-column gap-6" @submit.prevent="handleReset">
      <div class="flex-column gap-4">
        <PasswordField
          v-model="newPassword"
          :label="$t('reset.new_password')"
          :error="errors.newPassword"
          autocomplete="new-password"
        />
        <PasswordField
          v-model="confirmPassword"
          :label="$t('reset.confirm_password')"
          :error="errors.confirmPassword"
          autocomplete="new-password"
        />
      </div>
      <BasicButton type="submit" variant="primary" size="lg" :loading="saving" class="jc-ct w-100">
        {{ $t("reset.submit") }}
      </BasicButton>
    </form>
  </AuthLayout>
</template>

<script>
import { POST_PasswordResetConfirm } from "@/api/contentDB/api";
import { parsePasswordError } from "@/utils/password-errors";
import { passwordErrors } from "@/utils/passwordForm";
import AuthLayout from "@/boots/AuthLayout/index.vue";
import PasswordField from "@/boots/AuthLayout/PasswordField.vue";

// Errors show under their field and once in the AuthLayout live summary (plan 59), never as a toast.
export default {
  components: { AuthLayout, PasswordField },
  data() {
    return {
      newPassword: "",
      confirmPassword: "",
      saving: false,
      success: false,
      error: false,
      errorMessage: "",
      errors: {},
      formError: "",
    };
  },
  computed: {
    resetKey() {
      return this.$route.query.key || "";
    },
    done() {
      return this.success || this.error;
    },
    title() {
      if (this.success) return this.$t("reset.success_title");
      return this.$t(this.error ? "reset.error_title" : "reset.title");
    },
    statusText() {
      if (this.success) return this.$t("reset.success_message");
      return this.error ? this.errorMessage : this.formError;
    },
  },
  watch: {
    newPassword: "clearErrors",
    confirmPassword: "clearErrors",
  },
  mounted() {
    if (!this.resetKey) {
      this.error = true;
      this.errorMessage = this.$t("reset.invalid_link");
    }
  },
  methods: {
    clearErrors() {
      this.errors = {};
      this.formError = "";
    },
    validate() {
      const { newPassword, confirmPassword } = this;
      const { errors, summary } = passwordErrors(this.$t, { newPassword, confirmPassword });
      this.errors = errors;
      this.formError = summary;
      return !summary;
    },
    async handleReset() {
      if (!this.validate()) return;
      this.saving = true;
      try {
        await POST_PasswordResetConfirm({
          key: this.resetKey,
          new_password: this.newPassword,
          new_password_check: this.confirmPassword,
        });
        this.success = true;
      } catch (err) {
        this.showRequestError(err);
      } finally {
        this.saving = false;
      }
    },
    showRequestError(err) {
      const { isTerminal, message } = parsePasswordError(err);
      if (message && !isTerminal) {
        this.formError = message;
        return;
      }
      this.error = true;
      this.errorMessage = message || this.$t("reset.error_message");
    },
    goToLogin() {
      this.$router.push("/");
    },
  },
};
</script>
