<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('access.roles.title')" />
    </template>
    <Loader block v-if="loading" />

    <DataTable
      v-else
      :columns="columns"
      :rows="roles"
      row-key="id"
      :row-attrs="(row) => ({ 'data-testid': `role-row-${row.key}` })"
      :empty-text="$t('access.roles.empty')"
      empty-size="md"
      @row-click="openRole"
    >
      <template #cell-name="{ row }">
        <router-link :to="roleLink(row)" class="fw-600 t-accent" @click.stop>{{ row.name }}</router-link>
      </template>
      <template #cell-builtin="{ row }">
        <StatusBadge
          :tone="row.builtin ? 'neutral' : 'accent'"
          :dot="false"
          :label="row.builtin ? $t('access.roles.builtin') : $t('access.roles.custom')"
        />
      </template>
    </DataTable>

    <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { GET_AccessAllRoles } from "@/api/access/api";
import { extractApiMessage } from "@/composables/useFormErrors";

// Built-in and custom roles (django-access), every page of them.

export default {
  name: "AccessRoleList",
  setup() {
    return { notify: useNotifyStore() };
  },
  data() {
    return { roles: [], loading: false };
  },
  computed: {
    columns() {
      return [
        { key: "name", label: this.$t("access.roles.name"), width: "1fr", truncate: true },
        { key: "key", label: this.$t("access.roles.key"), width: "200px", priority: 2 },
        { key: "builtin", label: this.$t("access.roles.type"), width: "max-content" },
        { key: "grant_count", label: this.$t("access.roles.grants"), width: "120px", numeric: true, priority: 2 },
      ];
    },
    fabActions() {
      return [{ icon: "add", label: this.$t("access.roles.create"), handler: () => this.$router.push("/access/roles/new") }];
    },
  },
  mounted() {
    this.fetchRoles();
  },
  methods: {
    roleLink(row) {
      return `/access/roles/${encodeURIComponent(row.key)}`;
    },
    openRole(row) {
      this.$router.push(this.roleLink(row));
    },
    async fetchRoles() {
      this.loading = true;
      try {
        this.roles = await GET_AccessAllRoles();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
