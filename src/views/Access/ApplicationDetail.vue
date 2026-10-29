<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader :title="isCreate ? $t('access.applications.create') : application.name || ''" back="/access/applications">
        <template v-if="!notFound && !loadFailed" #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <FormField v-if="!isCreate">
              <BasicSwitch v-model="form.is_active" :label="$t('common.active')" data-testid="application-active" />
            </FormField>
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
    <Loader block v-if="loading" />

    <EmptyState v-else-if="notFound" icon="empty" :title="$t('access.applications.not_found')" />
    <EmptyState v-else-if="loadFailed" icon="empty" :title="$t('notifications.error')" />

    <template v-else>
      <BasicCard :title="$t('access.applications.details')" gap class="mb-8">
        <div class="form-grid">
          <FormField :label="$t('access.applications.name')" required :error="formErrors.getFieldError('name')?.msg || ''">
            <BasicInput v-model="form.name" :maxlength="128" data-testid="application-name" />
          </FormField>
          <FormField
            class="form-grid__wide"
            :label="$t('access.applications.description')"
            :error="formErrors.getFieldError('description')?.msg || ''"
          >
            <BasicTextarea v-model="form.description" :maxlength="1000" />
          </FormField>
        </div>
      </BasicCard>

      <BasicCard v-if="!isCreate" :title="$t('access.tokens.title')" gap class="mb-8">
        <template #actions>
          <BasicButton variant="secondary" mutates data-testid="token-create" @click="creating = true">
            {{ $t("access.tokens.create") }}
          </BasicButton>
        </template>
        <DataTable
          :columns="tokenColumns"
          :rows="tokens"
          row-key="id"
          :row-attrs="(row) => ({ 'data-testid': `token-row-${row.id}` })"
          :empty-text="$t('access.tokens.empty')"
        >
          <template #cell-name="{ row }">
            <div class="flex-column gap-1">
              <span class="fw-600">{{ row.name || "—" }}</span>
              <span class="token-key t-muted fs-200" data-testid="token-key">{{ tokenKey(row) }}</span>
              <span v-if="row.legacy" class="flex ai-ct flex-wrap gap-2">
                <Tag :label="$t('access.tokens.legacy_key')" />
                <span class="token-source t-muted fs-200" data-testid="token-legacy-source">{{ row.legacy_source }}</span>
              </span>
              <BasicTooltip v-if="row.rotation_due" :text="$t('access.tokens.rotation_due_tip', { days: rotationDays })">
                <span tabindex="0" class="token-rotation" data-testid="token-rotation-due">
                  <StatusBadge tone="warning" size="sm" :label="$t('access.tokens.rotation_due')" />
                </span>
              </BasicTooltip>
            </div>
          </template>
          <template #cell-scopes="{ row }">
            <div class="token-scopes flex-column gap-1">
              <div class="flex flex-wrap gap-2">
                <Tag v-for="key in row.scopes" :key="key" :label="scopeLabel(key)" />
              </div>
              <span class="t-muted fs-200" data-testid="token-channel">
                {{ $t("access.tokens.channel") }}: {{ row.channel_idx || $t("access.tokens.every_channel") }}
              </span>
            </div>
          </template>
          <template #cell-expires_at="{ row }">
            <span data-testid="token-expires">{{ expiryText(row) }}</span>
          </template>
          <template #cell-age_days="{ row }">
            <span data-testid="token-age">{{ ageText(row.age_days) }}</span>
          </template>
          <template #cell-last_used_at="{ value }">
            <span data-testid="token-last-used">{{ lastUsedText(value) }}</span>
          </template>
          <template #cell-state="{ row }">
            <StatusBadge :tone="STATE_TONES[row.state]" :label="$t(`access.tokens.states.${row.state}`)" />
          </template>
          <template #cell-actions="{ row }">
            <BasicMenu
              v-if="row.state !== 'revoked'"
              :items="tokenMenu(row)"
              :label="$t('access.tokens.actions', { token: rowName(row) })"
              placement="bottom-end"
              @select="(item) => item.run()"
            >
              <template #trigger>
                <IconButton
                  icon="more"
                  mutates
                  :label="$t('access.tokens.actions', { token: rowName(row) })"
                  :data-testid="`token-menu-${row.id}`"
                />
              </template>
            </BasicMenu>
          </template>
        </DataTable>
      </BasicCard>
    </template>

    <TokenCreateDialog
      v-if="creating"
      v-model:open="creating"
      :scopes="scopes"
      :channels="channelOptions"
      :rotation-days="rotationDays"
      :submit="createToken"
    />
    <TokenRotateDialog
      v-if="rotating"
      :open="!!rotating"
      :token="rotating"
      :submit="rotateToken"
      @update:open="rotating = null"
    />
    <TokenExpiryDialog
      v-if="expiring"
      :open="!!expiring"
      :token="expiring"
      :submit="setExpiry"
      @update:open="expiring = null"
    />
    <ConfirmDialog
      tone="danger"
      :open="!!revoking"
      :title="$t('access.tokens.revoke_title')"
      :confirm-label="$t('access.tokens.revoke')"
      confirm-testid="token-revoke-confirm"
      @confirm="revokeToken"
      @cancel="revoking = null"
    >
      <p>{{ $t("access.tokens.revoke_message", { token: revoking ? rowName(revoking) : "" }) }}</p>
      <p v-if="revoking?.legacy" class="token-source mt-2" data-testid="token-revoke-legacy">
        {{ $t("access.tokens.revoke_legacy", { source: revoking.legacy_source }) }}
      </p>
      <p v-if="revokingPublishable" class="mt-2 fw-600" role="alert" data-testid="token-revoke-publishable">
        {{ $t("access.tokens.revoke_publishable") }}
      </p>
    </ConfirmDialog>

    <SecretReveal ref="secretReveal" v-model:open="reveal.open" :title="reveal.title" />

    <ConfirmDialog
      :open="!!pendingNav"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
      @confirm="saveAndLeave"
      @discard="confirmLeave"
      @cancel="cancelLeave"
    />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";
import { getLang } from "@/i18n";
import { formatDate } from "@/utils/format";
import {
  GET_AccessApplication,
  GET_AccessCatalogue,
  GET_AccessAllTokens,
  POST_AccessApplication,
  PATCH_AccessApplication,
  POST_AccessToken,
  POST_AccessTokenRotate,
  POST_AccessTokenRevoke,
  POST_AccessTokenExpiry,
} from "@/api/access/api";
import SecretReveal from "@/boots/SecretReveal/index.vue";
import TokenCreateDialog from "./TokenCreateDialog.vue";
import TokenRotateDialog from "./TokenRotateDialog.vue";
import TokenExpiryDialog from "./TokenExpiryDialog.vue";
import { ageText, isPublishable, relativeDays, tokenKey } from "./tokens";

// An application (django-access) and its tokens. New token and Rotate answer the raw value once: it goes from the
// response straight into SecretReveal (`show()` on the boot — never this page's data), never into a toast, a store,
// the router or a log. SecretReveal is imported, not the global async one, so its ref is there at the first token. The
// header's Active switch sits in a FormField: a read-only page disables it with every other field. Legacy keys show
// their source and last use and never expire by themselves (D28) — Set expiry gives one only when an administrator
// picks it. No token has to expire (D31): each row shows its age, and "Rotation recommended" when the API says
// `rotation_due` (the catalogue's `token_rotation_days` in the tooltip). Revoking a publishable key warns that
// storefronts lose it at once.
const EMPTY_FORM = { name: "", description: "", is_active: true };
const STATE_TONES = { active: "positive", expired: "warning", revoked: "neutral" };

export default {
  name: "AccessApplicationDetail",
  components: { SecretReveal, TokenCreateDialog, TokenRotateDialog, TokenExpiryDialog },
  setup() {
    const formErrors = useFormErrors();
    return {
      loader: useLoaderStore(),
      notify: useNotifyStore(),
      channelStore: useCheckoutChannelStore(),
      ...useUnsavedChanges(),
      formErrors,
      STATE_TONES,
    };
  },
  data() {
    return {
      application: {},
      form: { ...EMPTY_FORM },
      tokens: [],
      scopes: [],
      rotationDays: 0,
      loading: true,
      notFound: false,
      loadFailed: false,
      creating: false,
      rotating: null,
      expiring: null,
      revoking: null,
      reveal: { open: false, title: "" },
    };
  },
  computed: {
    isCreate() {
      return !this.$route.params.id;
    },
    headerActions() {
      return [{ key: "save", role: "primary", label: this.$t("common.save"), onClick: this.save, testid: "application-save" }];
    },
    tokenColumns() {
      return [
        { key: "name", label: this.$t("access.tokens.name"), width: "minmax(160px, 1fr)" },
        { key: "scopes", label: this.$t("access.tokens.scopes"), width: "minmax(140px, 1fr)", priority: 2 },
        { key: "expires_at", label: this.$t("access.tokens.expires"), width: "120px", priority: 2 },
        { key: "age_days", label: this.$t("access.tokens.age"), width: "80px", priority: 2 },
        { key: "last_used_at", label: this.$t("access.tokens.last_used"), width: "120px", priority: 2 },
        { key: "state", label: this.$t("access.tokens.state"), width: "max-content" },
        { key: "actions", label: "", actions: true },
      ];
    },
    channelOptions() {
      return this.channelStore.channels.map((channel) => ({ label: channel.label || channel.idx, value: channel.idx }));
    },
    revokingPublishable() {
      return !!this.revoking && isPublishable(this.revoking.scopes, this.scopes);
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  // A shown-once value open in SecretReveal closes only through its "I have stored it": the page does not leave under it.
  beforeRouteLeave(to, from, next) {
    if (this.reveal.open) return next(false);
    this.guardNavigation(to, from, next);
  },
  mounted() {
    this.load();
  },
  methods: {
    formatDate,
    tokenKey,
    async load() {
      try {
        if (!this.isCreate) await this.fetchApplication();
      } catch (err) {
        this.notFound = isNotFound(err);
        this.loadFailed = !this.notFound;
        if (this.loadFailed) this.notifyError(err, "notifications.error");
      } finally {
        this.loading = false;
        this.snapshot(this.form);
        this.track(this.form);
      }
    },
    async fetchApplication() {
      const id = this.$route.params.id;
      const [application, catalogue] = await Promise.all([GET_AccessApplication(id), GET_AccessCatalogue()]);
      this.application = application.data;
      this.form = this.editForm(application.data);
      this.scopes = catalogue.data.scopes || [];
      this.rotationDays = catalogue.data.token_rotation_days || 0;
      this.channelStore.fetchChannels();
      await this.fetchTokens();
    },
    async fetchTokens() {
      this.tokens = await GET_AccessAllTokens(this.application.id);
    },
    editForm({ name, description, is_active }) {
      return { name, description: description || "", is_active };
    },
    ageText(days) {
      return ageText(days, getLang().toLowerCase());
    },
    lastUsedText(iso) {
      return iso ? formatDate(iso) : this.$t("access.tokens.never_used");
    },
    rowName(token) {
      return token.name || tokenKey(token);
    },
    scopeLabel(key) {
      const label = this.$t(`access.scopes.${key}`);
      return label === `access.scopes.${key}` ? this.scopes.find((s) => s.key === key)?.label || key : label;
    },
    // "in 364 days · 03/10/2027"; a legacy key without one reads "No expiry" like any other token, with no warning.
    expiryText(token) {
      if (!token.expires_at) return this.$t("access.tokens.no_expiry");
      return `${relativeDays(token.expires_at, getLang().toLowerCase())} · ${formatDate(token.expires_at, { timeStyle: undefined })}`;
    },
    tokenMenu(token) {
      return [
        { key: "rotate", label: this.$t("access.tokens.rotate"), icon: "refresh", testid: "token-rotate", run: () => (this.rotating = token) },
        { key: "expiry", label: this.$t("access.tokens.set_expiry"), icon: "scheduled", testid: "token-expiry", run: () => (this.expiring = token) },
        { key: "revoke", label: this.$t("access.tokens.revoke"), icon: "remove", danger: true, testid: "token-revoke", run: () => (this.revoking = token) },
      ];
    },
    // The dialog that asked goes first (its focus trap hands focus back), then the value opens in SecretReveal.
    async showSecret(raw, titleKey) {
      this.creating = false;
      this.rotating = null;
      await this.$nextTick();
      this.$refs.secretReveal.show(raw);
      this.reveal = { open: true, title: this.$t(titleKey) };
    },
    // The dialogs' calls: a refusal goes back to the dialog (its field errors), success refreshes the tokens.
    async createToken(payload) {
      const { data } = await POST_AccessToken(this.application.id, payload);
      await this.showSecret(data.raw, "access.tokens.created_title");
      await this.refreshTokens();
    },
    async rotateToken(payload) {
      const { data } = await POST_AccessTokenRotate(this.rotating.id, payload);
      await this.showSecret(data.raw, "access.tokens.rotated_title");
      await this.refreshTokens();
    },
    async setExpiry(payload) {
      await POST_AccessTokenExpiry(this.expiring.id, payload);
      this.notify.spawnNotification({ type: "positive", msg: this.$t("access.tokens.expiry_saved") });
      await this.refreshTokens();
    },
    async revokeToken() {
      const token = this.revoking;
      this.revoking = null;
      this.loader.loaderStart();
      try {
        await POST_AccessTokenRevoke(token.id);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("access.tokens.revoked") });
        await this.refreshTokens();
      } catch (err) {
        this.notifyError(err, "notifications.error");
      } finally {
        this.loader.loaderFinish();
      }
    },
    // The change is done: a failed reload of the list is said, never reported as a failed change.
    async refreshTokens() {
      try {
        await this.fetchTokens();
      } catch (err) {
        this.notifyError(err, "notifications.error");
      }
    },
    async saveAndLeave() {
      if (await this.save()) this.confirmLeave();
    },
    async save() {
      if (!this.formErrors.validateRequired(this.form, { name: this.$t("access.applications.name") })) return false;
      this.loader.loaderStart();
      try {
        const { data } = this.isCreate
          ? await POST_AccessApplication({ name: this.form.name, description: this.form.description })
          : await PATCH_AccessApplication(this.application.id, this.form);
        this.afterSave(data);
        return true;
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notifyError(err, "notifications.save_error");
        return false;
      } finally {
        this.loader.loaderFinish();
      }
    },
    afterSave(data) {
      const created = this.isCreate;
      this.application = data;
      this.form = this.editForm(data);
      this.snapshot(this.form);
      this.track(this.form);
      this.notify.spawnNotification({ type: "positive", msg: this.$t("access.applications.saved") });
      // Save and leave finishes the user's own navigation instead.
      if (created && !this.pendingNav) this.$router.push(`/access/applications/${data.id}`);
    },
    notifyError(err, fallbackKey) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t(fallbackKey)) });
    },
  },
};
</script>

<style lang="scss" scoped>
.token-key {
  font-family: var(--font-mono);
}

// A long scope label ends in an ellipsis (Tag's own `title`) instead of running under the next column.
.token-scopes {
  min-width: 0;
}

// The badge is the tooltip's tab stop: keyboard users reach the rotation advice too.
.token-rotation {
  display: inline-flex;
  border-radius: var(--radius-full);
}

// `<app>.<Model>#<pk>`, comma-separated for a secret found in several rows: it wraps anywhere instead of clipping.
.token-source {
  overflow-wrap: anywhere;
}
</style>
