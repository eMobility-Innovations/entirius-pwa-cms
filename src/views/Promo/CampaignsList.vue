<template>
  <div class="config-list">
    <div class="config-list__toolbar">
      <BasicButton
        variant="primary"
        @click="openCreate"
      >
        {{ $t('promo.campaign_new') }}
      </BasicButton>
    </div>

    <Loader block v-show="loading" />

    <DataTable
      empty-size="md"
      v-show="!loading"
      :columns="columns"
      :rows="campaigns"
      row-key="id"
      :empty-text="$t('promo.campaign_none')"
      @row-click="openEdit"
    >
      <template #cell-typ="{ row }">
        <Tag :label="typLabel(row.typ)" />
      </template>
      <template #cell-valid_from="{ row }">{{
        formatDate(row.valid_from)
      }}</template>
      <template #cell-valid_to="{ row }">{{
        formatDate(row.valid_to)
      }}</template>
      <template #cell-is_active="{ row }">
        <StatusBadge
          :label="row.is_active ? $t('promo.active') : $t('promo.inactive')"
          :tone="row.is_active ? 'positive' : 'negative'"
        />
      </template>
    </DataTable>

    <Pagination
      v-if="totalCount > pageSize"
      :page="paginationState.page"
      :pages="paginationState.pages"
      @update:page="onPageChange"
    />

    <SideDrawer :visible="drawerOpen" :title="drawerTitle" @close="closeDrawer">
      <div class="voucher-form">
        <FormField
          :label="$t('promo.campaign_name')"
          required
          :error="errors.name"
        >
          <BasicInput
            v-model="form.name"
            :maxlength="128"
            :placeholder="$t('promo.campaign_name')"
          />
        </FormField>

        <FormField
          v-if="!isEdit"
          :label="$t('promo.campaign_type')"
          required
          :error="errors.typ"
        >
          <BasicSelect
            :options="typeOptions"
            v-model="form.typ"
            :placeholder="$t('promo.campaign_type')"
          />
        </FormField>

        <div class="voucher-form__row">
          <FormField :label="$t('promo.campaign_valid_from')">
            <BasicInput v-model="form.valid_from" type="date" />
          </FormField>
          <FormField :label="$t('promo.campaign_valid_to')">
            <BasicInput v-model="form.valid_to" type="date" />
          </FormField>
        </div>

        <FormField
          :label="$t('promo.campaign_max_uses')"
          hint-level="important"
          :hint="$t('promo.campaign_max_uses_tip')"
          :error="errors.max_uses_per_customer"
        >
          <NumberInput v-model="form.max_uses_per_customer" :min="0" />
        </FormField>

        <FormField v-if="isEdit" :label="$t('promo.active')">
          <BasicSwitch
            v-model="form.is_active"
          />
        </FormField>

        <ActionBar :actions="drawerActions" class="mt-10" />
      </div>
    </SideDrawer>

    <ConfirmDialog
      tone="danger"
      :open="showDelete"
      @confirm="doDelete"
      @cancel="showDelete = false"
      :title="$t('promo.campaign_delete_title')"
    >
      <template #default
        ><p>{{ $t("promo.campaign_delete_msg") }}</p></template
      >
    </ConfirmDialog>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_Campaigns,
  POST_Campaign,
  PATCH_Campaign,
  DELETE_Campaign,
  GET_VoucherMeta,
} from "@/api/voucher/api";
import { enumDescKey, enumLabel } from "./promo-enum-hints";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";

function emptyForm() {
  return {
    name: "",
    typ: "sale",
    valid_from: "",
    valid_to: "",
    max_uses_per_customer: "0",
    is_active: true,
  };
}

export default {
  name: "CampaignsList",
  components: {},
  setup() {
    return {
      notify: useNotifyStore(),
      checkoutChannel: useCheckoutChannelStore(),
    };
  },
  data() {
    return {
      campaigns: [],
      totalCount: 0,
      currentPage: 1,
      pageSize: 20,
      loading: false,
      saving: false,
      types: [],
      drawerOpen: false,
      isEdit: false,
      editId: null,
      form: emptyForm(),
      errors: {},
      showDelete: false,
    };
  },
  computed: {
    channel() {
      return (
        this.checkoutChannel.activeChannelIdx ||
        process.env.VUE_APP_CHANNEL ||
        "default-local"
      );
    },
    typeOptions() {
      return this.types.map((t) => {
        const k = enumDescKey("campaign_type", t.value);
        return { label: t.label, value: t.value, description: k ? this.$t(k) : "" };
      });
    },
    columns() {
      return [
        { key: "name", label: this.$t("promo.campaign_name"), width: "1fr" },
        { key: "typ", label: this.$t("promo.campaign_type"), width: "150px" },
        {
          key: "valid_from",
          label: this.$t("promo.campaign_valid_from"),
          width: "120px",
        },
        {
          key: "valid_to",
          label: this.$t("promo.campaign_valid_to"),
          width: "120px",
        },
        {
          key: "max_uses_per_customer",
          label: this.$t("promo.campaign_max_uses"),
          width: "120px",
        },
        {
          key: "is_active",
          label: this.$t("promo.col_status"),
          width: "110px",
        },
      ];
    },
    drawerActions() {
      const del = { key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("promo.btn_delete"),
        onClick: () => (this.showDelete = true) };
      return [
        ...(this.isEdit ? [del] : []),
        { key: "save", role: "primary", label: this.$t("promo.btn_save"), onClick: this.save, disabled: this.saving },
      ];
    },
    drawerTitle() {
      return this.isEdit
        ? this.$t("promo.campaign_edit")
        : this.$t("promo.campaign_new");
    },
    paginationState() {
      return {
        page: this.currentPage,
        pages: Math.ceil(this.totalCount / this.pageSize),
      };
    },
  },
  watch: {
    "checkoutChannel.activeChannelIdx"() {
      this.currentPage = 1;
      this.fetchMeta();
      this.fetchCampaigns();
    },
  },
  mounted() {
    this.fetchMeta();
    this.fetchCampaigns();
  },
  methods: {
    typLabel(v) {
      const f = this.types.find((t) => t.value === v);
      return enumLabel("campaign_type", v, f?.label);
    },
    formatDate(v) {
      return v ? v.split("T")[0] : "—";
    },
    async fetchMeta() {
      try {
        const { data } = await GET_VoucherMeta(this.channel);
        this.types = data.campaign_types || [];
      } catch {
        // Non-critical
      }
    },
    async fetchCampaigns() {
      this.loading = true;
      try {
        const { data } = await GET_Campaigns(this.channel, {
          page: this.currentPage,
          page_size: this.pageSize,
        });
        this.campaigns = data.results || [];
        this.totalCount = data.count || 0;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.isEdit = false;
      this.editId = null;
      this.form = emptyForm();
      this.errors = {};
      this.drawerOpen = true;
    },
    openEdit(row) {
      this.isEdit = true;
      this.editId = row.id;
      this.errors = {};
      this.form = {
        name: row.name,
        typ: row.typ,
        valid_from: row.valid_from ? row.valid_from.split("T")[0] : "",
        valid_to: row.valid_to ? row.valid_to.split("T")[0] : "",
        max_uses_per_customer: String(row.max_uses_per_customer ?? 0),
        is_active: row.is_active,
      };
      this.drawerOpen = true;
    },
    closeDrawer() {
      this.drawerOpen = false;
    },
    buildPayload() {
      const p = {
        name: this.form.name,
        valid_from: this.form.valid_from || null,
        valid_to: this.form.valid_to || null,
        max_uses_per_customer: parseInt(this.form.max_uses_per_customer) || 0,
      };
      if (this.isEdit) p.is_active = this.form.is_active;
      else p.typ = this.form.typ;
      return p;
    },
    async save() {
      this.saving = true;
      this.errors = {};
      try {
        if (this.isEdit)
          await PATCH_Campaign(this.channel, this.editId, this.buildPayload());
        else await POST_Campaign(this.channel, this.buildPayload());
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("promo.saved"),
        });
        this.drawerOpen = false;
        this.fetchCampaigns();
      } catch (err) {
        this.applyErrors(err);
      } finally {
        this.saving = false;
      }
    },
    async doDelete() {
      this.showDelete = false;
      try {
        await DELETE_Campaign(this.channel, this.editId);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("promo.deleted"),
        });
        this.drawerOpen = false;
        this.fetchCampaigns();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.extractError(err),
        });
      }
    },
    onPageChange(page) {
      this.currentPage = page;
      this.fetchCampaigns();
    },
    applyErrors(err) {
      const data = err?.response?.data || err;
      const fieldErrors = {};
      const details = data?.details || data?.data?.details;
      if (Array.isArray(details)) {
        for (const d of details)
          if (d.field)
            fieldErrors[String(d.field).split(".").pop()] = d.message;
      }
      this.errors = fieldErrors;
      this.notify.spawnNotification({
        type: "negative",
        msg: this.extractError(err),
      });
    },
    extractError(err) {
      return extractApiMessage(err, this.$t("notifications.error"));
    },
  },
};
</script>

<style lang="scss" scoped>
.config-list__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-10);
}

.voucher-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.voucher-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
}
</style>
