<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('dp.types')" />
    </template>

      <!-- Inline create row -->
      <div class="create-row mb-10">
        <div class="create-row__fields">
          <BasicInput
            v-model="newType.code"
            :placeholder="$t('dp.code')"
            class="create-row__input"
          />
          <BasicInput
            v-model="newType.name"
            :placeholder="$t('dp.name')"
            class="create-row__input"
          />
          <div class="flex ai-ct gap-5">
            <BasicSwitch
              :label="$t('dp.is_carrier')"
              v-model="newType.is_carrier"
            />
          </div>
        </div>
        <BasicButton mutates
          variant="primary"
          @click="createType"
        >
          {{ $t('common.add') }}
        </BasicButton>
      </div>

      <Loader block v-show="loading" />

      <DataTable
        empty-size="md"
        v-show="!loading"
        :columns="columns"
        :rows="types"
        row-key="id"
        :empty-text="$t('dp.no_types')"
        @row-click="onRowClick"
      >
        <template #cell-lock="{ row }">
          <font-awesome-icon
            v-if="row.is_carrier"
            :icon="$icons.lock"
            class="t-muted"
          />
        </template>
        <template #cell-is_carrier="{ value }">
          <StatusBadge
            v-if="value"
            :label="$t('dp.carrier')"
            tone="info"
          />
          <StatusBadge v-else :label="$t('dp.custom')" tone="neutral" />
        </template>
        <template #cell-is_active="{ value }">
          <StatusBadge
            :label="value ? $t('dp.active') : $t('dp.inactive')"
            :tone="value ? 'positive' : 'negative'"
          />
        </template>
      </DataTable>

    <BasicModal
      :open="!!editingType"
      :title="editingType ? editingType.name || editingType.code : ''"
      :actions="modalActions"
      @close="cancelEdit"
    >
      <div class="form-grid">
        <FormField :label="$t('dp.code')">
          <BasicInput v-model="editForm.code" />
        </FormField>
        <FormField :label="$t('dp.name')">
          <BasicInput v-model="editForm.name" />
        </FormField>
        <FormField :label="$t('dp.sort_order')" required :error="sortOrderError">
          <NumberInput v-model="editForm.sort_order" />
        </FormField>
      </div>
      <div class="flex ai-ct wrap gap-5 mt-4">
        <BasicSwitch
          :label="$t('dp.is_carrier')"
          v-model="editForm.is_carrier"
        />
        <BasicSwitch
          :label="$t('dp.is_active')"
          v-model="editForm.is_active"
        />
      </div>
    </BasicModal>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteType"
      @cancel="showDeleteConfirm = false"
      :title="$t('dp.confirm_delete_title')"
    >
      <template #default
        ><p>{{ $t("dp.confirm_delete_type") }}</p></template
      >
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import {
  GET_Types,
  POST_Type,
  PATCH_Type,
  DELETE_Type,
} from "@/api/deliverypoints/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "TypeList",
  components: {},
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      types: [],
      loading: false,
      editingType: null,
      showDeleteConfirm: false,
      newType: {
        code: "",
        name: "",
        is_carrier: false,
      },
      editForm: {
        code: "",
        name: "",
        is_carrier: false,
        is_active: true,
        sort_order: 0,
      },
    };
  },
  computed: {
    // An emptied sort order is refused, never saved as 0 (that would move the type to the top).
    sortOrderError() {
      return String(this.editForm.sort_order ?? "").trim() === "" ? this.$t("dp.sort_order_required") : "";
    },
    modalActions() {
      return [
        { key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
          onClick: () => (this.showDeleteConfirm = true) },
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: this.cancelEdit },
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.saveType },
      ];
    },
    columns() {
      return [
        { key: "lock", label: "", sortable: false, width: "36px" },
        {
          key: "code",
          label: this.$t("dp.code"),
          sortable: false,
          width: "1fr",
          priority: 2,
        },
        {
          key: "name",
          label: this.$t("dp.name"),
          sortable: false,
          width: "2fr",
        },
        {
          key: "is_carrier",
          label: this.$t("dp.is_carrier"),
          sortable: false,
          width: "120px",
          priority: 2,
        },
        {
          key: "is_active",
          label: this.$t("dp.status"),
          sortable: false,
          width: "100px",
        },
        {
          key: "sort_order",
          label: this.$t("dp.sort_order"),
          sortable: false,
          width: "80px",
          priority: 2,
          numeric: true,
        },
      ];
    },
  },
  mounted() {
    this.fetchTypes();
  },
  methods: {
    async fetchTypes() {
      this.loading = true;
      try {
        const { data } = await GET_Types({ page_size: 100 });
        this.types = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    onRowClick(row) {
      if (row.is_carrier) {
        this.notify.spawnNotification({
          type: "informative",
          msg: this.$t("dp.carrier_read_only"),
        });
        return;
      }
      this.editingType = row;
      this.editForm = {
        code: row.code || "",
        name: row.name || "",
        is_carrier: row.is_carrier ?? false,
        is_active: row.is_active ?? true,
        sort_order: row.sort_order ?? 0,
      };
    },
    cancelEdit() {
      this.editingType = null;
    },
    async createType() {
      if (!this.newType.code || !this.newType.name) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.$t("categories.empty_fields"),
        });
        return;
      }
      this.loader.loaderStart();
      try {
        await POST_Type({
          code: this.newType.code,
          name: this.newType.name,
          is_carrier: this.newType.is_carrier,
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("dp.type_created"),
        });
        this.notify.spawnNotification({
          type: "informative",
          msg: this.$t("dp.type_created_order_warning"),
          timeout: 12000,
        });
        this.newType = { code: "", name: "", is_carrier: false };
        await this.fetchTypes();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async saveType() {
      if (this.sortOrderError) return;
      this.loader.loaderStart();
      try {
        await PATCH_Type(this.editingType.id, {
          code: this.editForm.code,
          name: this.editForm.name,
          is_carrier: this.editForm.is_carrier,
          is_active: this.editForm.is_active,
          // NumberInput emits text: the API gets a number.
          sort_order: Number(this.editForm.sort_order),
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("dp.type_saved"),
        });
        this.editingType = null;
        await this.fetchTypes();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async deleteType() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Type(this.editingType.id);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("dp.type_deleted"),
        });
        this.editingType = null;
        await this.fetchTypes();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.create-row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-raised);
  flex-wrap: wrap;
}

.create-row__fields {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex: 1;
  flex-wrap: wrap;
}

.create-row__input {
  flex: 1;
  min-width: 140px;
  max-width: 220px;
}
</style>
