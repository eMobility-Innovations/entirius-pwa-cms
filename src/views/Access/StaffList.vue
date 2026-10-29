<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('access.staff.title')" :description="$t('access.staff.help')">
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-5">
        <BasicInput
          v-model="search"
          :placeholder="$t('access.staff.search')"
          :aria-label="$t('access.staff.search')"
          icon="search"
          class="staff-list__search"
          data-testid="staff-search"
          @input="debouncedFetch(searchAndFetch)"
        />
        <p v-if="created" class="m-0 fs-200" role="status" data-testid="staff-created">
          {{ $t("access.staff.created", { username: created.username }) }}
          <router-link :to="userLink(created)" class="fw-600 t-accent" data-testid="staff-created-open">
            {{ $t("access.staff.open_account") }}
          </router-link>
        </p>
      </div>
    </template>

    <Loader block v-if="loading" />

    <DataTable
      v-else
      :columns="columns"
      :rows="staff"
      row-key="id"
      :row-attrs="(row) => ({ 'data-testid': `staff-row-${row.username}` })"
      empty-size="md"
      @row-click="openUser"
    >
      <template #cell-name="{ row }">
        <router-link :to="userLink(row)" class="fw-600 t-accent" @click.stop>{{ row.name || row.username }}</router-link>
      </template>
      <template #cell-roles="{ row }">
        <div class="flex flex-wrap gap-2">
          <Tag v-if="row.is_superuser" :label="$t('access.staff.superuser')" data-testid="staff-superuser" />
          <Tag v-for="role in row.roles" :key="`${role.key}-${role.via_group}`" :label="roleLabel(role)" />
        </div>
      </template>
      <template #empty>
        <EmptyState icon="empty" size="md" :title="$t('access.staff.empty')" :message="$t('access.staff.help')" />
      </template>
    </DataTable>

    <template #footer>
      <Pagination v-if="pages > 1" :page="page" :pages="pages" @update:page="changePage" />
    </template>

    <StaffCreateDialog v-model:open="creating" :roles="roles" :submit="createStaff" />
    <SecretReveal ref="secretReveal" v-model:open="reveal" :title="$t('access.staff.password_title')" />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_AccessStaff, GET_AccessAllRoles, POST_AccessStaff } from "@/api/access/api";
import SecretReveal from "@/boots/SecretReveal/index.vue";
import StaffCreateDialog from "./StaffCreateDialog.vue";
import { roleLabel } from "./grants";

// Active staff accounts with their roles, direct and through groups (django-access). "New staff member" creates one
// with one role (more on the account page). A generated password comes once in the create answer: it goes straight
// into SecretReveal (`show()` on the boot, never this page's data, a toast, a store, the router or a log), and the page
// does not leave while it is open. A typed password is never shown again. The action is a primary header action: a
// read-only page hides it.
const PAGE_SIZE = 20;

export default {
  name: "AccessStaffList",
  components: { SecretReveal, StaffCreateDialog },
  setup() {
    return { notify: useNotifyStore(), ...useSearchDebounce() };
  },
  data() {
    return { staff: [], count: 0, page: 1, loading: false, roles: [], creating: false, reveal: false, created: null };
  },
  computed: {
    headerActions() {
      return [
        { key: "create", role: "primary", label: this.$t("access.staff.create"), onClick: this.openCreate, testid: "staff-create" },
      ];
    },
    columns() {
      return [
        { key: "name", label: this.$t("access.staff.name"), width: "1fr", truncate: true },
        { key: "username", label: this.$t("access.staff.username"), width: "160px", priority: 2 },
        { key: "email", label: this.$t("access.staff.email"), width: "220px", priority: 2 },
        { key: "roles", label: this.$t("access.staff.roles"), width: "max-content" },
      ];
    },
    pages() {
      return Math.ceil(this.count / PAGE_SIZE);
    },
  },
  beforeRouteLeave(to, from, next) {
    if (this.reveal) return next(false);
    next();
  },
  mounted() {
    this.fetchStaff();
  },
  methods: {
    roleLabel(role) {
      return roleLabel(role, this.$t);
    },
    userLink(row) {
      return `/access/staff/${row.id}`;
    },
    openUser(row) {
      this.$router.push(this.userLink(row));
    },
    searchAndFetch() {
      this.page = 1;
      this.fetchStaff();
    },
    changePage(page) {
      this.page = page;
      this.fetchStaff();
    },
    async openCreate() {
      try {
        if (!this.roles.length) this.roles = await GET_AccessAllRoles();
        this.creating = true;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      }
    },
    // The dialog's call: a refusal goes back to the dialog (its field errors). The dialog goes first (its focus trap
    // hands focus back), then a generated password opens in SecretReveal.
    async createStaff(payload) {
      const { data } = await POST_AccessStaff(payload);
      this.creating = false;
      this.created = { id: data.id, username: data.username };
      if (data.password) {
        await this.$nextTick();
        this.$refs.secretReveal.show(data.password);
        this.reveal = true;
      }
      await this.fetchStaff();
    },
    async fetchStaff() {
      this.loading = true;
      try {
        const params = {
          page: this.page,
          page_size: PAGE_SIZE,
          ...(this.search ? { search: this.search } : {}),
        };
        const { data } = await GET_AccessStaff(params);
        this.staff = data.results || [];
        this.count = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.staff-list__search {
  flex: 1;
  max-width: 400px;
  min-width: 150px;

  @include max-tablet {
    flex-basis: 100%;
    max-width: none;
  }
}
</style>
