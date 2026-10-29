<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader :title="isCreate ? $t('access.roles.create') : role.name || ''" back="/access/roles">
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
    <Loader block v-if="loading" />

    <EmptyState v-else-if="notFound" icon="empty" :title="$t('access.roles.not_found')" />
    <EmptyState v-else-if="loadFailed" icon="empty" :title="$t('notifications.error')" />

    <template v-else>
      <p v-if="isBuiltin" class="role-notice mb-8" role="status" data-testid="builtin-notice">
        {{ $t("access.roles.builtin_notice") }}
      </p>
      <p v-if="droppedReserved" class="role-notice mb-8" role="status" data-testid="reserved-dropped-notice">
        {{ $t("access.roles.reserved_dropped") }}
      </p>

      <BasicCard :title="$t('access.roles.details')" gap class="mb-8">
        <div class="form-grid">
          <FormField :label="$t('access.roles.name')" required :error="formErrors.getFieldError('name')?.msg || ''">
            <BasicInput v-model="form.name" :disabled="isBuiltin" />
          </FormField>
          <FormField
            :label="$t('access.roles.key')"
            :required="isCreate"
            hint-level="important"
            :hint="isCreate ? $t('access.roles.key_hint') : ''"
            :error="formErrors.getFieldError('key')?.msg || ''"
          >
            <BasicInput v-model="form.key" :disabled="!isCreate" />
          </FormField>
          <FormField
            class="form-grid__wide"
            :label="$t('access.roles.description')"
            :error="formErrors.getFieldError('description')?.msg || ''"
          >
            <BasicTextarea v-model="form.description" :disabled="isBuiltin" />
          </FormField>
        </div>
      </BasicCard>

      <BasicCard :title="$t('access.roles.permissions')" gap class="mb-8">
        <PermissionMatrix
          v-model="form.permissions"
          :areas="catalogue"
          :disabled="isBuiltin"
          :show-reserved="isBuiltin"
        />
      </BasicCard>
    </template>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      :title="$t('access.roles.delete_title')"
      @confirm="deleteRole"
      @cancel="showDeleteConfirm = false"
    >
      <p>{{ $t("access.roles.delete_message", { name: role.name || "" }) }}</p>
    </ConfirmDialog>

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
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";
import {
  GET_AccessCatalogue,
  GET_AccessAllRoles,
  GET_AccessRole,
  POST_AccessRole,
  PATCH_AccessRole,
  DELETE_AccessRole,
} from "@/api/access/api";
import { assignableOnly, toPermissionKeys } from "@/boots/PermissionMatrix/matrix";

// A role (django-access): custom roles are edited here; the four built-ins open read-only and offer Duplicate, which
// opens the create form prefilled (`?from=<key>`) without access.manage — that area belongs to the built-in
// Administrator only (the server answers 400 ACCESS_MANAGE_RESERVED otherwise). The route carries the role key; the
// API addresses roles by id, so the key is looked up in the role list, every page of it.
export const RESERVED_ISSUE = "ACCESS_MANAGE_RESERVED";
const EMPTY_FORM = { key: "", name: "", description: "", permissions: {} };
// `roles/new` is the create route, so a role keyed "new" could never be opened.
const CREATE_SEGMENT = "new";

export function isReservedError(err) {
  const body = err?.response?.data ?? err;
  return Array.isArray(body?.details) && body.details.some((detail) => detail.issue === RESERVED_ISSUE);
}

export default {
  name: "AccessRoleDetail",
  setup() {
    const formErrors = useFormErrors();
    return { loader: useLoaderStore(), notify: useNotifyStore(), ...useUnsavedChanges(), formErrors };
  },
  data() {
    return {
      catalogue: [],
      role: {},
      form: { ...EMPTY_FORM },
      loading: true,
      notFound: false,
      loadFailed: false,
      droppedReserved: false,
      showDeleteConfirm: false,
    };
  },
  computed: {
    isCreate() {
      return !this.$route.params.key;
    },
    isBuiltin() {
      return !this.isCreate && !!this.role.builtin;
    },
    headerActions() {
      if (this.notFound || this.loadFailed) return [];
      if (this.isBuiltin) {
        return [{ key: "duplicate", role: "secondary", label: this.$t("access.roles.duplicate"), onClick: this.duplicate }];
      }
      return [
        ...(this.isCreate
          ? []
          : [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              onClick: () => (this.showDeleteConfirm = true) }]),
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.saveRole },
      ];
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
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  // Another role: the same route record, remounted by the panel's router-view (keyed on the path, so a query change
  // never remounts a view).
  beforeRouteUpdate(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      try {
        const { data } = await GET_AccessCatalogue();
        this.catalogue = data.modules || [];
        const sourceKey = this.isCreate ? this.$route.query.from : this.$route.params.key;
        if (sourceKey) this.role = await this.fetchRole(sourceKey);
        this.form = this.isCreate ? this.copyForm(this.role) : this.editForm(this.role);
      } catch (err) {
        this.notFound = isNotFound(err) || err?.notFound === true;
        this.loadFailed = !this.notFound;
        if (this.loadFailed) this.notifyError(err, "notifications.error");
      } finally {
        this.loading = false;
        this.snapshot(this.form);
        this.track(this.form);
      }
    },
    async fetchRole(key) {
      const found = (await GET_AccessAllRoles()).find((role) => role.key === key);
      if (!found) throw Object.assign(new Error(`No role ${key}`), { notFound: true });
      return (await GET_AccessRole(found.id)).data;
    },
    editForm(role) {
      const { key, name, description, permissions } = role;
      return { key, name, description: description || "", permissions: { ...(permissions || {}) } };
    },
    // A copy keeps what a custom role may hold; dropping access.manage is said in a notice.
    copyForm(source) {
      if (!source.key) return { ...EMPTY_FORM, permissions: {} };
      const permissions = assignableOnly(source.permissions || {}, this.catalogue);
      this.droppedReserved = Object.keys(permissions).length < Object.keys(source.permissions || {}).length;
      const name = this.$t("access.roles.copy_of", { name: source.name });
      return { key: "", name, description: source.description || "", permissions };
    },
    duplicate() {
      this.$router.push({ path: "/access/roles/new", query: { from: this.role.key } });
    },
    payload() {
      const { key, name, description, permissions } = this.form;
      const body = { name, description, permissions: toPermissionKeys(permissions, this.catalogue) };
      return this.isCreate ? { key, ...body } : body;
    },
    async saveAndLeave() {
      if (await this.saveRole()) this.confirmLeave();
    },
    async saveRole() {
      const required = { name: this.$t("access.roles.name"), ...(this.isCreate ? { key: this.$t("access.roles.key") } : {}) };
      if (!this.formErrors.validateRequired(this.form, required) || !this.keyUsable()) return false;
      this.loader.loaderStart();
      try {
        const { data } = this.isCreate
          ? await POST_AccessRole(this.payload())
          : await PATCH_AccessRole(this.role.id, this.payload());
        this.afterSave(data);
        return true;
      } catch (err) {
        this.showSaveError(err);
        return false;
      } finally {
        this.loader.loaderFinish();
      }
    },
    keyUsable() {
      if (!this.isCreate || this.form.key !== CREATE_SEGMENT) return true;
      this.formErrors.errors.key = { status: "error", msg: this.$t("access.roles.key_reserved") };
      return false;
    },
    afterSave(data) {
      const created = this.isCreate;
      this.role = data;
      this.form = this.editForm(data);
      this.snapshot(this.form);
      this.track(this.form);
      this.notify.spawnNotification({ type: "positive", msg: this.$t("access.roles.saved") });
      // Save and leave finishes the user's own navigation instead.
      if (created && !this.pendingNav) this.$router.push(`/access/roles/${encodeURIComponent(data.key)}`);
    },
    showSaveError(err) {
      if (isReservedError(err)) {
        this.notify.spawnNotification({ type: "negative", msg: this.$t("access.roles.reserved_error") });
        return;
      }
      this.formErrors.handleApiError(err);
      this.notifyError(err, "notifications.save_error");
    },
    async deleteRole() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_AccessRole(this.role.id);
        this.snapshot(this.form);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("access.roles.deleted") });
        this.$router.push("/access/roles");
      } catch (err) {
        this.notifyError(err, "notifications.error");
      } finally {
        this.loader.loaderFinish();
      }
    },
    notifyError(err, fallbackKey) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t(fallbackKey)) });
    },
  },
};
</script>

<style lang="scss" scoped>
// Locked built-in role / a copy without access.manage: the notice bar above the form (docs/ui-rules.md § Locked /
// system entity).
.role-notice {
  color: var(--text-muted);
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  padding: var(--space-2) var(--space-4);
}
</style>
