<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader :title="user.name || user.username || $t('access.staff.detail')" back="/access/staff">
        <template v-if="user.username" #meta>
          <span class="t-muted fs-200">{{ user.username }}<template v-if="user.email"> · {{ user.email }}</template></span>
          <Tag v-if="user.is_superuser" :label="$t('access.staff.superuser')" />
        </template>
      </PageHeader>
    </template>
    <Loader block v-if="loading" />

    <EmptyState v-else-if="notFound" icon="empty" :title="$t('access.staff.not_found')" />
    <EmptyState v-else-if="loadFailed" icon="empty" :title="$t('notifications.error')" />

    <template v-else>
      <BasicCard :title="$t('access.staff.direct_roles')" gap class="mb-8">
        <DataTable
          :columns="grantColumns"
          :rows="directGrants"
          row-key="id"
          :row-attrs="(row) => ({ 'data-testid': `grant-row-${row.role.key}` })"
          :empty-text="$t('access.staff.no_direct_roles')"
        >
          <template #cell-role="{ row }">{{ row.role.name }}</template>
          <template #cell-created_at="{ value }">{{ formatDate(value) }}</template>
          <template #cell-actions="{ row }">
            <IconButton
              icon="delete"
              variant="danger"
              mutates
              :label="$t('access.grants.revoke_role', { role: row.role.name })"
              @click="pendingRevoke = row"
            />
          </template>
        </DataTable>
        <div class="flex ai-fe flex-wrap gap-4 mt-6">
          <FormField :label="$t('access.grants.add_role')" class="staff-detail__add">
            <BasicSelect v-model="newRole" :options="addOptions" data-testid="grant-role-select" />
          </FormField>
          <BasicButton variant="secondary" mutates :disabled="!newRole" data-testid="grant-add" @click="addGrant">
            {{ $t("access.grants.add") }}
          </BasicButton>
        </div>
        <p v-if="lockout" class="staff-detail__notice m-0" role="alert" data-testid="grant-lockout">
          {{ $t("access.grants.lockout") }}
        </p>
      </BasicCard>

      <BasicCard :title="$t('access.staff.group_roles')" gap class="mb-8">
        <DataTable :columns="groupColumns" :rows="groupRows" row-key="id" :empty-text="$t('access.staff.no_groups')">
          <template #cell-roles="{ row }">
            <div class="flex flex-wrap gap-2">
              <Tag v-for="grant in row.grants" :key="grant.id" :label="grant.role.name" />
              <span v-if="!row.grants.length" class="t-muted">—</span>
            </div>
          </template>
        </DataTable>
      </BasicCard>
    </template>

    <ConfirmDialog
      tone="danger"
      :open="!!pendingRevoke"
      :title="$t('access.grants.revoke_title')"
      @confirm="revokeGrant"
      @cancel="pendingRevoke = null"
    >
      <p>{{ $t("access.grants.revoke_message", { role: pendingRevoke?.role.name || "", holder: holderName }) }}</p>
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useAccessStore } from "@/stores/access";
import { isConflict, isNotFound } from "@/api/createClient";
import { formatDate } from "@/utils/format";
import { GET_AccessStaffUser, GET_AccessAllRoles, POST_AccessGrant, DELETE_AccessGrant } from "@/api/access/api";
import { grantPayload, grantErrorMessage, roleOptions } from "./grants";

// One staff account (django-access): roles granted directly (revoke, add) and the roles its groups bring, read-only
// here — a group's roles change on the Groups page. A revoke the lockout guard refuses (409) stays as a notice line in
// the card until the next grant change; other refusals are toasts.

export default {
  name: "AccessStaffDetail",
  setup() {
    return { loader: useLoaderStore(), notify: useNotifyStore(), access: useAccessStore() };
  },
  data() {
    return {
      user: {},
      roles: [],
      newRole: null,
      pendingRevoke: null,
      lockout: false,
      loading: true,
      notFound: false,
      loadFailed: false,
    };
  },
  computed: {
    grantColumns() {
      return [
        { key: "role", label: this.$t("access.grants.role"), width: "1fr", truncate: true },
        { key: "created_at", label: this.$t("access.grants.granted_at"), width: "180px", priority: 2 },
        { key: "actions", label: "", actions: true },
      ];
    },
    groupColumns() {
      return [
        { key: "name", label: this.$t("access.groups.name"), width: "1fr", truncate: true },
        { key: "roles", label: this.$t("access.staff.roles"), width: "max-content" },
      ];
    },
    directGrants() {
      return (this.user.grants || []).filter((grant) => grant.user);
    },
    groupRows() {
      const grants = (this.user.grants || []).filter((grant) => grant.group);
      return (this.user.groups || []).map((group) => ({ ...group, grants: grants.filter((g) => g.group.id === group.id) }));
    },
    addOptions() {
      return roleOptions(this.roles, this.directGrants.map((grant) => grant.role.key));
    },
    holderName() {
      return this.user.name || this.user.username || "";
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    formatDate,
    async load() {
      this.fetchRoles();
      try {
        this.user = (await GET_AccessStaffUser(this.$route.params.id)).data;
      } catch (err) {
        this.notFound = isNotFound(err);
        this.loadFailed = !this.notFound;
        if (this.loadFailed) this.notifyError(err);
      } finally {
        this.loading = false;
      }
    },
    async fetchRoles() {
      try {
        this.roles = await GET_AccessAllRoles();
      } catch {
        // No roles to offer: the grants still show and revoke.
      }
    },
    async reloadUser() {
      this.user = (await GET_AccessStaffUser(this.user.id)).data;
    },
    async addGrant() {
      await this.mutate(async () => {
        await POST_AccessGrant(grantPayload(this.newRole, { userId: this.user.id }));
        this.newRole = null;
        return "access.grants.granted";
      });
    },
    async revokeGrant() {
      const grant = this.pendingRevoke;
      this.pendingRevoke = null;
      await this.mutate(async () => {
        await DELETE_AccessGrant(grant.id);
        return "access.grants.revoked";
      }, { revoking: true });
    },
    // A grant change, then the account again (its group roles may name the same role); errors as sentences.
    async mutate(change, options = {}) {
      this.lockout = false;
      this.loader.loaderStart();
      try {
        const doneKey = await change();
        this.notify.spawnNotification({ type: "positive", msg: this.$t(doneKey) });
        await this.reloadUser();
        // Your own grants: the sidebar and read-only pages follow now, not after the next refusal.
        if (this.user.id === this.access.me?.user?.id) this.access.refresh(true);
      } catch (err) {
        if (options.revoking && isConflict(err)) this.lockout = true;
        else this.notifyError(err, options);
      } finally {
        this.loader.loaderFinish();
      }
    },
    notifyError(err, options = {}) {
      this.notify.spawnNotification({ type: "negative", msg: grantErrorMessage(err, this.$t, options) });
    },
  },
};
</script>

<style lang="scss" scoped>
.staff-detail__add {
  min-width: 220px;
}

// The lockout refusal: the notice bar of docs/ui-rules.md § Locked / system entity, under the grant controls.
.staff-detail__notice {
  color: var(--text-strong);
  background: var(--warning-subtle);
  border-radius: var(--radius-base);
  padding: var(--space-2) var(--space-4);
}
</style>
