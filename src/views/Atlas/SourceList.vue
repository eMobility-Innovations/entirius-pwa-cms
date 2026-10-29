<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('atlas.list_title')">
        <template #actions>
          <BasicButton
            variant="primary"
            data-testid="suppliers-create-btn"
            @click="openCreate"
          >
            {{ $t('atlas.create_button') }}
          </BasicButton>
        </template>
      </PageHeader>
    </template>
    <template #toolbar>
      <div class="flex ai-ct flex-wrap gap-5">
        <BasicInput
          v-model="search"
          :placeholder="$t('common.start_typing')"
          icon="search"
          class="supplier-list__search"
          data-testid="suppliers-search-input"
          @input="debouncedFetch(searchAndFetch)"
        />
        <MobileFilterPanel
          :active-count="activeFilterCount"
          :trigger-label="$t('builder.filters')"
        >
          <p class="fs-200 t-secondary">{{ $t("atlas.filter.kind") }}</p>
          <div class="flex ai-ct flex-wrap gap-2">
            <FilterChip
              v-for="opt in kindOptions"
              :key="opt.value"
              :label="opt.label"
              :active="kindFilter === opt.value"
              :data-testid="`suppliers-filter-kind-${opt.value}`"
              @click="setKindFilter(opt.value)"
            />
          </div>
          <p class="fs-200 t-secondary">
            {{ $t("atlas.filter.status") }}
          </p>
          <div class="flex ai-ct flex-wrap gap-2">
            <FilterChip
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :active="statusFilter === opt.value"
              :data-testid="`suppliers-filter-status-${opt.value}`"
              @click="setStatusFilter(opt.value)"
            />
          </div>
        </MobileFilterPanel>
      </div>
    </template>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="suppliers"
        :sortable="true"
        row-key="idx"
        :empty-text="$t('atlas.empty_state_title')"
        @sort="onSort"
        @row-click="onRowClick"
      >
        <template #cell-kind="{ value }">
          <StatusBadge :label="$t(`atlas.kind.${value}`)" :tone="kindVariant(value)" />
        </template>
        <template #cell-source_type="{ value }">
          <StatusBadge
            :label="$t(`atlas.type.${value || 'feed'}`)"
            tone="neutral"
          />
        </template>
        <template #cell-is_active="{ value }">
          <StatusBadge
            :label="value ? $t('common.active') : $t('common.inactive')"
            :tone="value ? 'positive' : 'negative'"
          />
        </template>
        <template #cell-default_currency_id="{ value }">
          {{ regionalStore.currencyById(value)?.iso3 || "—" }}
        </template>
        <template #cell-actions="{ row }">
          <div class="flex ai-ct gap-2" @click.stop>
            <IconButton
              icon="edit"
              :label="$t('common.edit')"
              size="sm"
              :data-testid="`suppliers-edit-${row.idx}`"
              @click="onEdit(row)"
            />
            <IconButton
              icon="delete"
              :label="$t('common.delete')"
              variant="danger"
              size="sm"
              :data-testid="`suppliers-delete-${row.idx}`"
              @click="openDelete(row)"
            />
          </div>
        </template>
      </DataTable>

    <template #footer>
      <Pagination
        v-if="totalCount > pageSize"
        :page="paginationState.page"
        :pages="paginationState.pages"
        @update:page="onPageChange"
      />
    </template>

    <!-- Create supplier drawer -->
    <SideDrawer
      :visible="createVisible"
      :title="$t('atlas.create_button')"
      width="420px"
      @close="closeCreate"
    >
      <form class="flex flex-column gap-5" @submit.prevent="submitCreate">
        <FormField
          :label="$t('atlas.form.idx_label')"
          required
          :error="errors.idx?.msg || ''"
        >
          <BasicInput
            v-model="createForm.idx"
            format="key"
            :maxlength="64"
            placeholder="example-supplier"
            data-testid="suppliers-create-idx"
          />
        </FormField>
        <FormField
          :label="$t('atlas.form.name_label')"
          required
          :error="errors.name?.msg || ''"
        >
          <BasicInput
            v-model="createForm.name"
            :maxlength="128"
            data-testid="suppliers-create-name"
          />
        </FormField>
        <FormField :label="$t('atlas.form.kind_label')">
          <BasicSelect
            :options="kindDropdownOptions"
            v-model="createForm.kind"
            data-testid="suppliers-create-kind"
          />
        </FormField>
        <FormField :label="$t('atlas.form.type_label')">
          <BasicSelect
            :options="typeDropdownOptions"
            v-model="createForm.source_type"
            data-testid="suppliers-create-type"
          />
        </FormField>
        <FormField :label="$t('atlas.form.default_language_label')">
          <BasicSelect
            :options="regionalStore.languageOptions"
            v-model="createForm.default_language_id"
            :placeholder="$t('atlas.form.select_language')"
            data-testid="suppliers-create-language"
          />
        </FormField>
        <FormField :label="$t('atlas.form.default_currency_label')">
          <BasicSelect
            :options="regionalStore.currencyOptions"
            v-model="createForm.default_currency_id"
            :placeholder="$t('atlas.form.select_currency')"
            data-testid="suppliers-create-currency"
          />
        </FormField>
        <FormField :label="$t('atlas.form.sku_prefix_label')" :error="errors.sku_prefix?.msg || ''">
          <BasicInput
            v-model="createForm.sku_prefix"
            format="key"
            :maxlength="10"
            placeholder="SUP"
            data-testid="suppliers-create-sku-prefix"
          />
        </FormField>
        <div class="flex ai-ct jc-end gap-5 mt-8">
          <BasicButton
            variant="secondary"
            type="button"
            data-testid="suppliers-create-cancel"
            @click="closeCreate"
          >
            {{ $t('common.cancel') }}
          </BasicButton>
          <BasicButton
            variant="primary"
            type="submit"
            :disabled="creating"
            data-testid="suppliers-create-submit"
          >
            {{ $t('common.save') }}
          </BasicButton>
        </div>
      </form>
    </SideDrawer>

    <!-- Delete confirmation modal -->
    <BasicModal
      :open="deleteVisible"
      size="sm"
      :title="$t('atlas.delete.modal_title')"
      @update:open="(open) => open || closeDelete()"
    >
      <p class="mb-5">
        <strong>{{ deleteTarget?.name }}</strong> ({{ deleteTarget?.idx }})
      </p>
      <BasicRadioGroup
        v-model="deleteForce"
        :options="deleteModeOptions"
        :aria-label="$t('atlas.delete.modal_title')"
        class="mb-3"
      />
      <!-- The line follows the chosen option: the safe deactivation reads neutral, the permanent delete negative. -->
      <p
        v-if="deleteForce"
        class="flex ai-ct gap-2 fs-200 fw-600 t-negative mb-5"
        data-testid="suppliers-delete-warning"
      >
        <FontAwesomeIcon :icon="$icons.warning" aria-hidden="true" />
        {{ $t("atlas.delete.hard_warning") }}
      </p>
      <p v-else class="fs-200 t-muted mb-5" data-testid="suppliers-delete-note">
        {{ $t("atlas.delete.soft_note") }}
      </p>
      <div
        v-if="deleteForce && deleteImpact"
        class="suppliers-delete-impact"
        data-testid="suppliers-delete-impact-banner"
      >
        <p class="fs-200 mb-2">
          {{
            $t("atlas.delete.impact_links", {
              count: deleteImpact.affected_links_count,
            })
          }}
        </p>
        <p class="fs-200">
          {{
            $t("atlas.delete.impact_pushed_skus", {
              count: deleteImpact.affected_pushed_skus_count,
            })
          }}
        </p>
      </div>
      <template #footer>
        <BasicButton
          variant="secondary"
          data-testid="suppliers-delete-cancel"
          @click="closeDelete"
        >
          {{ $t('common.cancel') }}
        </BasicButton>
        <BasicButton mutates
          variant="danger-solid"
          :disabled="deleting"
          data-testid="suppliers-delete-confirm"
          @click="submitDelete"
        >
          {{ deleteForce
              ? $t('atlas.delete.confirm_button_hard')
              : $t('atlas.delete.confirm_button_soft') }}
        </BasicButton>
      </template>
    </BasicModal>
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { useRegionalStore } from "@/stores/regional";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_Sources,
  POST_Source,
  DELETE_Source,
  GET_SupplierDeleteImpact,
} from "@/api/atlas/api";

const CREATE_FORMATS = { idx: { format: "key" }, sku_prefix: { format: "key" } };

const KIND_VARIANTS = {
  procurement: "positive",
  monitoring: "info",
  enrichment: "neutral",
};

const EMPTY_FORM = () => ({
  idx: "",
  name: "",
  kind: "procurement",
  source_type: "feed",
  default_language_id: null,
  default_currency_id: null,
  sku_prefix: "",
});

export default {
  name: "SourceList",
  setup() {
    const notify = useNotifyStore();
    const regionalStore = useRegionalStore();
    regionalStore.fetchAll();
    const { search, debouncedFetch } = useSearchDebounce();
    const { errors, handleApiError, clearErrors, validateFormats } = useFormErrors();
    return {
      notify,
      regionalStore,
      search,
      debouncedFetch,
      errors,
      handleApiError,
      clearErrors,
      validateFormats,
    };
  },
  data() {
    return {
      suppliers: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      ordering: null,
      loading: false,
      kindFilter: "__all",
      statusFilter: "__all",
      // Create
      createVisible: false,
      creating: false,
      createForm: EMPTY_FORM(),
      // Delete
      deleteVisible: false,
      deleteTarget: null,
      deleteForce: false,
      deleteImpact: null,
      deleting: false,
    };
  },
  computed: {
    activeFilterCount() {
      let n = 0;
      if (this.kindFilter !== "__all") n += 1;
      if (this.statusFilter !== "__all") n += 1;
      return n;
    },
    kindOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        { value: "procurement", label: this.$t("atlas.kind.procurement") },
        { value: "monitoring", label: this.$t("atlas.kind.monitoring") },
        { value: "enrichment", label: this.$t("atlas.kind.enrichment") },
      ];
    },
    statusOptions() {
      return [
        { value: "__all", label: this.$t("common.all") },
        { value: "active", label: this.$t("common.active") },
        { value: "inactive", label: this.$t("common.inactive") },
      ];
    },
    kindDropdownOptions() {
      return [
        { value: "procurement", label: this.$t("atlas.kind.procurement") },
        { value: "monitoring", label: this.$t("atlas.kind.monitoring") },
        { value: "enrichment", label: this.$t("atlas.kind.enrichment") },
      ];
    },
    deleteModeOptions() {
      return [
        {
          value: false,
          label: this.$t("atlas.delete.mode_soft_label"),
          testid: "suppliers-delete-soft-radio",
        },
        {
          value: true,
          label: this.$t("atlas.delete.mode_hard_label"),
          testid: "suppliers-delete-hard-radio",
        },
      ];
    },
    typeDropdownOptions() {
      return [
        { value: "feed", label: this.$t("atlas.type.feed") },
        { value: "manual", label: this.$t("atlas.type.manual") },
        { value: "dropship", label: this.$t("atlas.type.dropship") },
      ];
    },
    columns() {
      return [
        {
          key: "idx",
          label: this.$t("atlas.col.idx"),
          sortable: true,
          width: "180px",
          priority: 2,
        },
        {
          key: "name",
          label: this.$t("atlas.col.name"),
          sortable: true,
          width: "minmax(180px, 1fr)",
        },
        {
          key: "kind",
          label: this.$t("atlas.col.kind"),
          sortable: false,
          width: "120px",
          priority: 2,
        },
        {
          key: "source_type",
          label: this.$t("atlas.col.type"),
          sortable: false,
          width: "100px",
          priority: 2,
        },
        {
          key: "default_currency_id",
          label: this.$t("atlas.col.currency"),
          sortable: false,
          width: "80px",
          priority: 2,
        },
        {
          key: "target_warehouse_code",
          label: this.$t("atlas.col.warehouse"),
          sortable: false,
          width: "120px",
          priority: 2,
        },
        {
          key: "is_active",
          label: this.$t("atlas.col.status"),
          sortable: true,
          width: "100px",
        },
        { key: "actions", label: "", sortable: false, actions: true },
      ];
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.max(1, Math.ceil(this.totalCount / this.pageSize)),
      };
    },
  },
  watch: {
    "$route.query.page"(newPage) {
      this.currentPage = parseInt(newPage) || 1;
      this.fetchSuppliers();
    },
  },
  mounted() {
    this.currentPage = parseInt(this.$route.query.page) || 1;
    this.fetchSuppliers();
  },
  methods: {
    kindVariant(kind) {
      return KIND_VARIANTS[kind] || "neutral";
    },
    async fetchSuppliers() {
      this.loading = true;
      try {
        const params = { page: this.currentPage, page_size: this.pageSize };
        if (this.search) params.search = this.search;
        if (this.ordering) params.ordering = this.ordering;
        if (this.kindFilter !== "__all") params.kind = this.kindFilter;
        if (this.statusFilter === "active") params.is_active = true;
        if (this.statusFilter === "inactive") params.is_active = false;
        const { data } = await GET_Sources(params);
        this.suppliers = data.results || [];
        this.totalCount = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    setKindFilter(value) {
      this.kindFilter = value;
      this.currentPage = 1;
      this.fetchSuppliers();
    },
    setStatusFilter(value) {
      this.statusFilter = value;
      this.currentPage = 1;
      this.fetchSuppliers();
    },
    searchAndFetch() {
      this.currentPage = 1;
      this.fetchSuppliers();
    },
    onSort({ key, direction }) {
      this.ordering = key && direction === "desc" ? `-${key}` : key || null;
      this.fetchSuppliers();
    },
    onPageChange(page) {
      this.$router.push({
        path: this.$route.path,
        query: { ...this.$route.query, page: String(page) },
      });
    },
    onRowClick(row) {
      this.$router.push(`/atlas/${row.idx}`);
    },
    onEdit(row) {
      this.$router.push(`/atlas/${row.idx}`);
    },
    openCreate() {
      this.createForm = EMPTY_FORM();
      this.clearErrors();
      this.createVisible = true;
    },
    closeCreate() {
      this.createVisible = false;
    },
    async submitCreate() {
      this.clearErrors();
      if (!this.validateFormats(this.createForm, CREATE_FORMATS)) return;
      this.creating = true;
      try {
        const payload = { ...this.createForm };
        Object.keys(payload).forEach((k) => {
          if (payload[k] === "") delete payload[k];
        });
        const { data } = await POST_Source(payload);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.toast.created", {
            name: data.name || data.idx,
          }),
        });
        this.createVisible = false;
        this.fetchSuppliers();
      } catch (err) {
        this.handleApiError(err);
        if (Object.keys(this.errors).length === 0) {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
        }
      } finally {
        this.creating = false;
      }
    },
    async openDelete(row) {
      this.deleteTarget = row;
      this.deleteForce = false;
      this.deleteImpact = null;
      this.deleteVisible = true;
      try {
        const { data } = await GET_SupplierDeleteImpact(row.idx);
        this.deleteImpact = data;
      } catch (err) {
        // Non-fatal — impact endpoint may be unavailable; soft delete still works.
        this.deleteImpact = {
          affected_links_count: 0,
          affected_pushed_skus_count: 0,
        };
      }
    },
    closeDelete() {
      this.deleteVisible = false;
      this.deleteTarget = null;
    },
    async submitDelete() {
      if (!this.deleteTarget) return;
      this.deleting = true;
      try {
        await DELETE_Source(this.deleteTarget.idx, {
          force: this.deleteForce,
        });
        this.notify.spawnNotification({
          type: this.deleteForce ? "warning" : "positive",
          msg: this.$t(
            this.deleteForce
              ? "atlas.toast.deleted_hard"
              : "atlas.toast.deleted_soft",
            { name: this.deleteTarget.name || this.deleteTarget.idx }
          ),
        });
        this.deleteVisible = false;
        this.deleteTarget = null;
        this.fetchSuppliers();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.supplier-list__search {
  flex: 1;
  min-width: 150px;
  max-width: 400px;
}
.suppliers-delete-impact {
  background: var(--negative-subtle);
  color: var(--negative);
  padding: var(--space-5);
  border-radius: var(--radius-base);
}
</style>
