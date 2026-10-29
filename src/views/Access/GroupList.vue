<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('access.groups.title')" :description="$t('access.groups.help')" />
    </template>

    <Loader block v-if="loading" />

    <DataTable
      v-else
      :columns="columns"
      :rows="groups"
      row-key="id"
      :row-attrs="(row) => ({ 'data-testid': `group-row-${row.id}` })"
      :empty-text="$t('access.groups.empty')"
      empty-size="md"
    >
      <template #cell-roles="{ row }">
        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="grant in row.grants"
            :key="grant.id"
            :label="grant.role.name"
            removable
            mutates
            @remove="pendingRevoke = { grant, group: row }"
          />
          <span v-if="!row.grants.length" class="t-muted">—</span>
        </div>
      </template>
      <template #cell-actions="{ row }">
        <IconButton icon="add" mutates :label="$t('access.groups.add_role', { group: row.name })" @click="openAdd(row)" />
      </template>
    </DataTable>

    <template #footer>
      <Pagination v-if="pages > 1" :page="page" :pages="pages" @update:page="changePage" />
    </template>

    <BasicModal
      :open="!!addingTo"
      :title="$t('access.groups.add_role', { group: addingTo?.name || '' })"
      size="sm"
      :actions="addActions"
      @update:open="(open) => !open && closeAdd()"
    >
      <FormField :label="$t('access.grants.role')">
        <BasicSelect v-model="newRole" :options="addOptions" data-testid="group-role-select" />
      </FormField>
    </BasicModal>

    <ConfirmDialog
      tone="danger"
      :open="!!pendingRevoke"
      :title="$t('access.grants.revoke_title')"
      @confirm="revokeGrant"
      @cancel="pendingRevoke = null"
    >
      <p>
        {{ $t("access.grants.revoke_message", { role: pendingRevoke?.grant.role.name || "", holder: pendingRevoke?.group.name || "" }) }}
      </p>
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_AccessGroups, GET_AccessAllRoles, POST_AccessGrant, DELETE_AccessGrant } from "@/api/access/api";
import { grantPayload, grantErrorMessage, roleOptions } from "./grants";

// auth.Groups with their member counts and roles (django-access): a role granted to a group reaches every member.
// Groups and memberships are managed outside the CMS (Django admin); roles are added and revoked here.
const PAGE_SIZE = 20;

export default {
  name: "AccessGroupList",
  setup() {
    return { loader: useLoaderStore(), notify: useNotifyStore() };
  },
  data() {
    return { groups: [], roles: [], count: 0, page: 1, loading: false, addingTo: null, newRole: null, pendingRevoke: null };
  },
  computed: {
    columns() {
      return [
        { key: "name", label: this.$t("access.groups.name"), width: "1fr", truncate: true },
        { key: "member_count", label: this.$t("access.groups.members"), width: "120px", numeric: true, priority: 2 },
        { key: "roles", label: this.$t("access.staff.roles"), width: "max-content" },
        { key: "actions", label: "", actions: true },
      ];
    },
    pages() {
      return Math.ceil(this.count / PAGE_SIZE);
    },
    addOptions() {
      return roleOptions(this.roles, (this.addingTo?.grants || []).map((grant) => grant.role.key));
    },
    addActions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: this.closeAdd },
        { key: "add", role: "primary", label: this.$t("access.grants.add"), disabled: !this.newRole, onClick: this.addGrant },
      ];
    },
  },
  mounted() {
    this.fetchGroups();
    this.fetchRoles();
  },
  methods: {
    async fetchGroups() {
      this.loading = true;
      try {
        const { data } = await GET_AccessGroups({ page: this.page, page_size: PAGE_SIZE });
        this.groups = data.results || [];
        this.count = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
    async fetchRoles() {
      try {
        this.roles = await GET_AccessAllRoles();
      } catch {
        // No roles to offer: the add dialog stays empty, the list still shows.
      }
    },
    changePage(page) {
      this.page = page;
      this.fetchGroups();
    },
    openAdd(group) {
      this.newRole = null;
      this.addingTo = group;
    },
    closeAdd() {
      this.addingTo = null;
    },
    async addGrant() {
      const payload = grantPayload(this.newRole, { groupId: this.addingTo.id });
      this.closeAdd();
      await this.mutate(() => POST_AccessGrant(payload), "access.grants.granted");
    },
    async revokeGrant() {
      const { grant } = this.pendingRevoke;
      this.pendingRevoke = null;
      await this.mutate(() => DELETE_AccessGrant(grant.id), "access.grants.revoked", { revoking: true });
    },
    async mutate(change, doneKey, options = {}) {
      this.loader.loaderStart();
      try {
        await change();
        this.notify.spawnNotification({ type: "positive", msg: this.$t(doneKey) });
        await this.fetchGroups();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: grantErrorMessage(err, this.$t, options) });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>
