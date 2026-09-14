<template>
  <div
    class="auth-card fs-300 p-400 t-basic-700 br-50 bg-basic-100 b-basic-300 shadow-down"
  >
    <template v-if="error">
      <p class="fs-700 fw-600 txt-center mb-50">
        {{ $t("login.sso_error_title") }}
      </p>
      <div class="auth-card__banner auth-card__banner--error mb-400">
        <p class="fs-300 fw-500" data-test="sso-error-message">
          {{ errorMessage }}
        </p>
        <p
          v-if="debugId"
          class="fs-200 t-basic-600 mt-100"
          data-test="sso-debug-id"
        >
          {{ $t("login.sso_reference", { id: debugId }) }}
        </p>
      </div>
      <BasicButton
        :text="$t('login.back_to_login')"
        @click="goToLogin"
        class="bg-support-400 b-support-400 jc-ct t-basic-100 w-100 br-50"
      />
    </template>

    <template v-else>
      <p class="fs-700 fw-600 txt-center mb-50" data-test="sso-progress">
        {{ $t("login.sso_signing_in") }}
      </p>
    </template>
  </div>
</template>

<script>
import { POST_SsoCallback } from "@/api/sso/api";
import { SSO_STATE_KEY, blockAutoLogin, ssoRedirectUri } from "@/configs/sso";
import { GET_User, GET_UserDetails } from "@/api/contentDB/api";
import { useUserStore } from "@/stores/user";
import { useMuninStore } from "@/stores/munin";
import { extractApiMessage } from "@/composables/useFormErrors";

// Matches the password path: the access token is short-lived and the store refreshes it.
const TOKEN_LIFETIME_MS = 15 * 60 * 1000;

/**
 * Whether an exchange started by THIS page load is still running.
 *
 * Module scope, deliberately: the thing it has to survive is a remount, which destroys
 * the component instance and builds a new one. App.vue renders a <router-view> in its
 * unauthenticated branch and another inside the authenticated layout, so setAuth() flips
 * `isAuth` and this component is recreated on the same route while the first instance is
 * still awaiting hydrateUser(). Instance state cannot see across that; this can.
 */
let signInInFlight = false;

export default {
  name: "SsoCallback",
  setup() {
    const userStore = useUserStore();
    const munin = useMuninStore();
    return { userStore, munin };
  },
  data() {
    return {
      error: false,
      errorMessage: "",
      debugId: "",
    };
  },
  mounted() {
    this.completeLogin();
  },
  methods: {
    /** Read `state` back out of session storage, consuming it either way. */
    takeStashedState() {
      try {
        const stashed = window.sessionStorage.getItem(SSO_STATE_KEY);
        window.sessionStorage.removeItem(SSO_STATE_KEY);
        return stashed;
      } catch {
        // Private-mode browsers throw on sessionStorage. Treat it as "nothing stashed".
        return null;
      }
    },

    /** Where the session expired, if the app recorded it. Never worth failing a login over. */
    takeReturnRoute() {
      try {
        const route = window.localStorage.getItem("cms_return_route");
        if (route) window.localStorage.removeItem("cms_return_route");
        return route;
      } catch {
        return null;
      }
    },

    fail(message, debugId = "") {
      // In SSO-only mode the login wall starts a login by itself. Without this, going
      // back to it after a refusal would immediately start the SAME failing login again
      // and the user would never see why. Cleared when they deliberately retry.
      blockAutoLogin();
      this.error = true;
      this.errorMessage = message;
      this.debugId = debugId;
    },

    async completeLogin() {
      // A SECOND MOUNT IS NOT A FAILED SIGN-IN. The moment the exchange succeeds,
      // setAuth() flips App.vue from its unauthenticated branch to the authenticated
      // layout — both render a <router-view> — so this component is destroyed and mounted
      // again on the same route. That remount used to call takeStashedState(), which is
      // single-use BY DESIGN, find nothing, and report the login-CSRF refusal over a
      // login that had just worked: the user saw "this sign-in could not be verified"
      // flash and then landed on the home page.
      //
      // The flash was the smaller half. fail() also calls blockAutoLogin(), so a
      // SUCCESSFUL sign-in left `sso_autologin_blocked` set for the rest of the browser
      // session — the very flag that stops an SSO-ONLY login wall starting a login by
      // itself when the token later expires.
      //
      // Whoever began the exchange owns the navigation, so a remount gets out of the way
      // rather than racing it to a different route. Somebody who opens this route by hand
      // while already signed in has no such instance running, and IS sent home — leaving
      // them on "signing in" for ever would only be a different bug.
      if (this.userStore.isAuth) {
        if (!signInInFlight) this.$router.replace("/");
        return;
      }

      const code = this.$route.query.code || "";
      const state = this.$route.query.state || "";
      const stashedState = this.takeStashedState();

      if (!code || !state) {
        this.fail(this.$t("login.sso_error_no_code"));
        return;
      }

      // Login CSRF: the provider will happily redirect a code that this browser never
      // asked for. The backend consumes `state` single-use as well; this is the half a
      // reviewer looks for on the client.
      if (!stashedState || stashedState !== state) {
        this.fail(this.$t("login.sso_error_state"));
        return;
      }

      signInInFlight = true;
      try {
        await this.exchangeAndEnter(code, state);
      } finally {
        signInInFlight = false;
      }
    },

    /** The exchange itself, from code to a filled store and a navigation. */
    async exchangeAndEnter(code, state) {
      let payload;
      try {
        const { data } = await POST_SsoCallback({
          code,
          state,
          redirect_uri: ssoRedirectUri(),
        });
        payload = data;
      } catch (err) {
        this.fail(
          extractApiMessage(err, this.$t("login.sso_error_generic")),
          err?.response?.data?.debug_id || err?.debug_id || ""
        );
        return;
      }

      // ---------------------------------------------------------------------------
      // The SUCCESS body is FLAT — { access, refresh, customer_id, token_type } — while
      // the password path's body is enveloped as { data, meta }. Destructuring
      // `payload.data` here would yield three undefineds, write empty cookies and leave
      // the user logged out on an HTTP 200 with nothing in any log. Hence the flat read
      // AND the explicit check below: no tokens means failure, never a blank session.
      // ---------------------------------------------------------------------------
      const { access, refresh, customer_id = null } = payload || {};

      if (!access || !refresh) {
        this.fail(this.$t("login.sso_error_no_tokens"));
        return;
      }

      this.userStore.setAuth({
        token: access,
        refresh,
        customer_id,
        expiryDate: new Date(Date.now() + TOKEN_LIFETIME_MS),
      });

      await this.hydrateUser(customer_id);

      const returnRoute = this.takeReturnRoute();
      this.$router.replace(returnRoute && returnRoute !== "/" ? returnRoute : "/");
    },

    /**
     * Fill the same store the password path fills. Every call is optional: a lean stack
     * without ContentDB 404s here, and losing the profile must not undo a valid login.
     */
    async hydrateUser(customerId) {
      let permissions = [];
      try {
        const { data: userData } = await GET_User({});
        permissions = userData?.data || [];
      } catch (e) {
        console.warn("content-permissions unavailable (contentdb not installed)", e);
      }

      let profile = {};
      try {
        const { data: userDetailsResponse } = await GET_UserDetails({
          uid: customerId,
        });
        profile = userDetailsResponse?.data || {};
      } catch (e) {
        console.warn("Profile endpoint unavailable — using defaults", e);
      }

      this.userStore.loadPreferences(profile.extra ?? null);

      const layoutExtenders = ["header", "footer"];
      this.userStore.setUser({
        username: profile.username || "",
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        permissions: permissions.map((p) => ({
          ...p,
          _for: layoutExtenders.includes(p.slug) ? "layout-extender" : "content",
          _limit: layoutExtenders.includes(p.slug) ? 1 : null,
        })),
      });

      try {
        await this.munin.fetchModules();
      } catch (e) {
        console.warn("Module list unavailable", e);
      }
    },

    goToLogin() {
      this.$router.replace("/");
    },
  },
};
</script>
