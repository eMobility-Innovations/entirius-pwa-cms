<template>
  <div
    class="auth-card fs-300 p-400 t-basic-700 br-50 bg-basic-100 b-basic-300 shadow-down"
  >
    <!-- Forgot password mode -->
    <template v-if="showForgotPassword">
      <p class="fs-700 fw-600 txt-center mb-50">
        {{ $t("login.forgot_title") }}
      </p>
      <p class="fs-300 t-basic-600 txt-center mb-500">
        {{ $t("login.forgot_subtitle") }}
      </p>

      <template v-if="resetEmailSent">
        <div class="auth-card__banner auth-card__banner--success mb-400">
          <p class="fs-300 fw-500">{{ $t("login.reset_email_sent") }}</p>
        </div>
      </template>
      <template v-else>
        <BasicInput
          v-model="resetEmail"
          class="bg-basic-200 mb-300 lh-base-elem"
          :label="$t('login.email')"
        />
        <BasicButton
          :text="$t('login.send_reset_link')"
          @click="sendResetLink"
          class="bg-support-400 b-support-400 jc-ct t-basic-100 w-100 br-50"
        />
      </template>

      <button
        class="auth-card__link mt-300"
        @click="
          showForgotPassword = false;
          resetEmailSent = false;
        "
      >
        {{ $t("login.back_to_login") }}
      </button>
    </template>

    <!-- Login mode -->
    <template v-else>
      <div
        v-if="sessionExpired"
        class="auth-card__banner auth-card__banner--warning mb-400"
      >
        <p class="fs-300 fw-500">{{ $t("login.session_expired") }}</p>
      </div>
      <p class="fs-700 fw-600 txt-center mb-50">{{ $t("login.welcome") }}</p>
      <p class="fs-300 t-basic-600 txt-center mb-500">
        {{ $t("login.subtitle") }}
      </p>
      <BasicInput
        v-model="username"
        class="bg-basic-200 mb-400 lh-base-elem"
        :label="$t('login.username')"
      />
      <div class="auth-card__pw-field mb-300">
        <BasicInput
          v-model="password"
          class="bg-basic-200 lh-base-elem"
          :label="$t('login.password')"
          :type="pwVisible ? 'text' : 'password'"
        />
        <button
          class="auth-card__pw-toggle"
          type="button"
          @click="pwVisible = !pwVisible"
        >
          <FontAwesomeIcon :icon="pwVisible ? 'eye-slash' : 'eye'" />
        </button>
      </div>

      <BasicButton
        :text="$t('login.submit')"
        @click="login"
        class="bg-support-400 b-support-400 jc-ct t-basic-100 w-100 br-50"
      />

      <BasicButton
        v-if="ssoEnabled"
        data-test="sso-login"
        :text="$t('login.sso_submit')"
        @click="ssoLogin"
        class="bg-basic-200 b-basic-300 jc-ct t-basic-700 w-100 br-50 mt-300"
      />

      <button class="auth-card__link mt-300" @click="showForgotPassword = true">
        {{ $t("login.forgot_password") }}
      </button>
    </template>
  </div>
</template>

<script>
const debugMode = process.env.VUE_APP_DEBUG == "true" ? true : false;
const environment = process.env.NODE_ENV === "development";
const username = process.env.VUE_APP_USERNAME;
const password = process.env.VUE_APP_PASSWORD;

import {
  POST_Login,
  GET_User,
  GET_UserDetails,
  POST_PasswordReset,
} from "../../api/contentDB/api";
import { useNotifyStore } from "@/stores/notify";
import { useUserStore } from "@/stores/user";
import { useMuninStore } from "@/stores/munin";
import { extractApiMessage } from "@/composables/useFormErrors";
import { POST_SsoLoginUrl } from "@/api/sso/api";
import { SSO_STATE_KEY, isSsoEnabled, ssoRedirectUri } from "@/configs/sso";
export default {
  setup() {
    const notify = useNotifyStore();
    const userStore = useUserStore();
    const munin = useMuninStore();
    return { notify, userStore, munin };
  },
  data() {
    return {
      username: environment || debugMode ? username : "",
      password: environment || debugMode ? password : "",
      pwVisible: false,
      sessionExpired: false,
      showForgotPassword: false,
      resetEmail: "",
      resetEmailSent: false,
    };
  },
  computed: {
    ssoEnabled() {
      return isSsoEnabled();
    },
  },
  mounted() {
    if (localStorage.getItem("session_expired") === "1") {
      this.sessionExpired = true;
      localStorage.removeItem("session_expired");
    }
  },
  methods: {
    /**
     * Hand off to the identity provider. The response is FLAT —
     * { authorization_url, state } — not the { data, meta } envelope the password path
     * returns, so it is read one level up. `state` is parked in session storage and
     * compared when the provider redirects back: that comparison is what makes a code
     * this browser never asked for unusable.
     */
    async ssoLogin() {
      try {
        const { data } = await POST_SsoLoginUrl({
          redirect_uri: ssoRedirectUri(),
        });
        const { authorization_url, state } = data || {};

        if (!authorization_url || !state) {
          throw new Error("sso-login-url-incomplete");
        }

        try {
          sessionStorage.setItem(SSO_STATE_KEY, state);
        } catch {
          // Private-mode browsers refuse session storage; without the stash the
          // callback cannot verify state, so stop here rather than start a login
          // that is guaranteed to be rejected on return.
          throw new Error("sso-state-unstorable");
        }

        window.location.assign(authorization_url);
      } catch (error) {
        this.notify.spawnNotification({
          title: extractApiMessage(error, this.$t("login.sso_error_generic")),
          type: "negative",
          timeout: "2500",
        });
      }
    },
    async login() {
      this.sessionExpired = false;
      try {
        // err handler
        if (![this.username, this.password].every(Boolean)) {
          const err = new Error();
          err.status = 403;
          err.response = this.$t("login.empty_credentials");
          throw err;
        }

        const { data } = await POST_Login({
          username: this.username,
          password: this.password,
        });
        const { data: loginData = {}, meta: loginMeta = {} } = data;
        const { access, refresh, customer_id = null } = loginData;

        // SET EXPIRATION TIME
        // ------------
        // 15 mins
        const remainingMilliseconds = 15 * 60 * 1000;

        const expiryDate = new Date(
          new Date().getTime() + remainingMilliseconds
        );
        // ------------

        this.userStore.setAuth({
          token: access,
          refresh,
          customer_id,
          expiryDate: expiryDate,
        });

        // ------------------------
        // Content permissions live in ContentDB (Pages panel). On lean stacks
        // without contentdb this 404s — it must NOT abort login, otherwise
        // setUser() never runs and the left menu renders empty. Default to [].
        let permissions = [];
        try {
          const { data: userData } = await GET_User({});
          permissions = userData?.data || [];
        } catch (e) {
          console.warn("content-permissions unavailable (contentdb not installed)", e);
        }

        let username = "";
        let first_name = "";
        let last_name = "";
        let email = "";
        let extra = null;
        try {
          const { data: userDetailsResponse } = await GET_UserDetails({
            uid: customer_id,
          });
          const { data: userDetails } = userDetailsResponse;
          ({
            username = "",
            first_name = "",
            last_name = "",
            email = "",
            extra = null,
          } = userDetails);
        } catch (e) {
          console.warn("Profile endpoint unavailable — using defaults", e);
        }
        this.userStore.loadPreferences(extra);
        // TODO fix later
        // permissions per content types
        const layout_ext = ["header", "footer"];
        const perms = permissions.map((p) => {
          return {
            ...p,
            _for: layout_ext.includes(p.slug) ? "layout-extender" : "content",
            _limit: layout_ext.includes(p.slug) ? 1 : null,
          };
        });

        this.userStore.setUser({
          username,
          first_name,
          last_name,
          email,
          permissions: perms,
        });

        await this.munin.fetchModules();

        const returnRoute = localStorage.getItem("cms_return_route");
        if (returnRoute && returnRoute !== "/") {
          localStorage.removeItem("cms_return_route");
          this.$router.push(returnRoute);
        }
      } catch (error) {
        const title = extractApiMessage(
          error,
          "Unknown error. Contact administrator."
        );
        this.notify.spawnNotification({
          title,
          type: "negative",
          timeout: "2500",
        });
      }
    },
    async sendResetLink() {
      if (!this.resetEmail) {
        this.notify.spawnNotification({
          title: this.$t("login.enter_email"),
          type: "negative",
          timeout: "2500",
        });
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
