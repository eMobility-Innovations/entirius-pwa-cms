<template>
  <AuthLayout
    :title="$t(success ? 'user.change_password' : 'user.change_password_title')"
    :subtitle="success ? '' : $t('user.change_password_subtitle')"
    :status-tone="success ? 'positive' : 'negative'"
  >
    <template v-if="statusText" #status>{{ statusText }}</template>

    <BasicButton v-if="success" variant="primary" size="lg" class="jc-ct w-100" @click="goHome">
      {{ $t("user.back_to_home") }}
    </BasicButton>

    <form v-else class="flex-column gap-6" @submit.prevent="handleSubmit">
      <div class="flex-column gap-4">
        <PasswordField v-model="oldPassword" :label="$t('user.old_password')" :error="errors.oldPassword" />
        <PasswordField
          v-model="newPassword"
          :label="$t('user.new_password')"
          :error="errors.newPassword"
          autocomplete="new-password"
        />
        <PasswordField
          v-model="confirmPassword"
          :label="$t('user.confirm_password')"
          :error="errors.confirmPassword"
          autocomplete="new-password"
        />
      </div>
      <BasicButton type="submit" variant="primary" size="lg" :loading="saving" class="jc-ct w-100">
        {{ $t("user.change_password_submit") }}
      </BasicButton>
    </form>
  </AuthLayout>
</template>

<script>
import { POST_PasswordChange } from "@/api/contentDB/api";
import { parsePasswordError } from "@/utils/password-errors";
import { passwordErrors } from "@/utils/passwordForm";
import AuthLayout from "@/boots/AuthLayout/index.vue";
import PasswordField from "@/boots/AuthLayout/PasswordField.vue";

// Errors show under their field and once in the AuthLayout live summary (plan 59), never as a toast.
export default {
  components: { AuthLayout, PasswordField },
  data() {
    return {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
      saving: false,
      success: false,
      errors: {},
      formError: "",
    };
  },
  computed: {
    statusText() {
      return this.success ? this.$t("user.password_changed_message") : this.formError;
    },
  },
  watch: {
    oldPassword: "clearErrors",
    newPassword: "clearErrors",
    confirmPassword: "clearErrors",
  },
  methods: {
    clearErrors() {
      this.errors = {};
      this.formError = "";
    },
    validate() {
      const { oldPassword, newPassword, confirmPassword } = this;
      const { errors, summary } = passwordErrors(this.$t, { oldPassword, newPassword, confirmPassword });
      this.errors = errors;
      this.formError = summary;
      return !summary;
    },
    async handleSubmit() {
      if (!this.validate()) return;
      this.saving = true;
      try {
        await POST_PasswordChange({
          old_password: this.oldPassword,
          new_password: this.newPassword,
          new_password_check: this.confirmPassword,
        });
        this.success = true;
      } catch (error) {
        const { message } = parsePasswordError(error);
        this.formError = message || this.$t("notifications.error");
      } finally {
        this.saving = false;
      }
    },
    goHome() {
      this.$router.push("/");
    },
  },
};
</script>
