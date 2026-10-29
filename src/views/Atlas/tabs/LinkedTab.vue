<template>
  <div class="flex flex-column">
    <div class="flex ai-ct jc-sb mb-8 flex-wrap gap-5">
      <h2 class="fs-400 fw-600">{{ $t("atlas.tabs.linked") }}</h2>
      <BasicButton
        variant="primary"
        data-testid="linked-create-btn"
        @click="openCreate"
      >
        {{ $t("atlas.linked.create_button") }}
      </BasicButton>
    </div>

    <div
      v-if="!loading && shouldShowNoPreferredBanner"
      class="bg-warning-subtle t-warning p-5 rounded mb-8"
      data-testid="linked-no-preferred-banner"
    >
      <p class="fs-200">{{ $t("atlas.linked.no_preferred_warning") }}</p>
    </div>

    <Loader block v-show="loading" />

    <DataTable
      v-show="!loading"
      :columns="columns"
      :rows="links"
      row-key="id"
      :empty-text="$t('atlas.linked.empty')"
    >
      <template #cell-is_primary="{ value }">
        <StatusBadge
          :label="
            value
              ? $t('atlas.linked.preferred')
              : $t('atlas.linked.not_preferred')
          "
          :tone="value ? 'positive' : 'neutral'"
        />
      </template>
      <template #cell-is_active="{ value }">
        <StatusBadge
          :label="value ? $t('common.active') : $t('common.inactive')"
          :tone="value ? 'positive' : 'negative'"
        />
      </template>
      <template #cell-actions="{ row }">
        <div class="flex ai-ct gap-2" @click.stop>
          <IconButton mutates
            v-if="!isMonitoringSupplier && !row.is_primary"
            icon="primary"
            size="sm"
            :label="$t('atlas.linked.set_preferred_button')"
            :data-testid="`linked-set-preferred-${row.id}`"
            @click="setPrimary(row)"
          />
          <IconButton mutates
            v-else-if="!isMonitoringSupplier"
            icon="primary"
            size="sm"
            :pressed="true"
            :label="$t('atlas.linked.unset_preferred_button')"
            :data-testid="`linked-unset-preferred-${row.id}`"
            @click="unsetPrimary(row)"
          />
          <IconButton
            icon="edit"
            size="sm"
            :label="$t('common.edit')"
            :data-testid="`linked-edit-${row.id}`"
            @click="openEdit(row)"
          />
          <IconButton
            icon="delete"
            variant="danger"
            size="sm"
            :label="$t('common.delete')"
            :data-testid="`linked-delete-${row.id}`"
            @click="confirmDelete(row)"
          />
        </div>
      </template>
    </DataTable>

    <SideDrawer
      :visible="formVisible"
      :title="
        editing ? $t('common.edit') : $t('atlas.linked.create_button')
      "
      width="420px"
      @close="closeForm"
    >
      <form class="flex flex-column gap-5" @submit.prevent="submitForm">
        <FormField
          :label="$t('atlas.linked.real_product_sku_label')"
          required
          :error="errors.real_product_sku?.msg || ''"
        >
          <div class="flex ai-ct gap-3">
            <EntitySearchPicker
              v-model="formData.real_product_sku"
              :display-value="skuLabel"
              :fetch-fn="skuFetchFn"
              :disabled="!!editing"
              :placeholder="$t('atlas.linked.sku_search_placeholder')"
              class="flex-1"
              data-testid="linked-form-sku"
              @update:display-value="skuLabel = $event"
              @clear="skuLabel = ''"
            />
            <IconButton
              v-if="formData.real_product_sku"
              icon="preview"
              variant="outline"
              :label="$t('atlas.linked.sku_preview')"
              data-testid="linked-sku-preview-btn"
              @click="openPreview"
            />
          </div>
        </FormField>
        <FormField :label="$t('atlas.linked.priority_label')">
          <NumberInput
            v-model="formData.priority"
            :min="0"
            :max="9999"
            data-testid="linked-form-priority"
          />
        </FormField>
        <FormField :label="$t('atlas.linked.external_id_label')">
          <BasicInput
            v-model="formData.external_id"
            :maxlength="128"
            data-testid="linked-form-external-id"
          />
        </FormField>
        <FormField
          v-if="!isMonitoringSupplier"
          :label="$t('atlas.linked.is_preferred_label')"
        >
          <BasicSwitch
            v-model="formData.is_primary"
            data-testid="linked-form-is-preferred"
          />
        </FormField>
        <FormField :label="$t('atlas.form.is_active_label')">
          <BasicSwitch
            v-model="formData.is_active"
            data-testid="linked-form-is-active"
          />
        </FormField>
        <FormField :label="$t('atlas.linked.notes_label')">
          <BasicInput
            v-model="formData.notes"
            data-testid="linked-form-notes"
          />
        </FormField>
        <div class="flex ai-ct jc-end gap-5 mt-8">
          <BasicButton data-testid="linked-form-cancel" @click="closeForm">
            {{ $t("common.cancel") }}
          </BasicButton>
          <BasicButton
            variant="primary"
            type="submit"
            :disabled="formBusy"
            data-testid="linked-form-submit"
          >
            {{ $t("common.save") }}
          </BasicButton>
        </div>
      </form>
    </SideDrawer>

    <ConfirmDialog
      tone="danger"
      :open="deleteVisible"
      @confirm="executeDelete"
      @cancel="deleteVisible = false"
      :title="$t('atlas.linked.delete_title')"
    >
      <template #default>
        <p>{{ $t("atlas.linked.delete_body") }}</p>
      </template>
    </ConfirmDialog>

    <SideDrawer
      :visible="previewVisible"
      :title="$t('atlas.linked.sku_preview')"
      mode="focused"
      width="420px"
      @close="previewVisible = false"
    >
      <Loader v-show="previewLoading" />
      <div
        v-if="!previewLoading && previewProduct"
        class="sku-preview"
        data-testid="linked-sku-preview"
      >
        <div class="sku-preview__image">
          <img
            v-if="previewImage"
            :src="previewImage"
            :alt="previewProduct.name"
          />
          <FontAwesomeIcon
            v-else
            :icon="$icons.image"
            class="sku-preview__placeholder"
          />
        </div>
        <h3 class="fs-400 fw-600 mt-5">{{ previewProduct.name }}</h3>
        <dl class="sku-preview__meta fs-200 mt-5">
          <dt>{{ $t("atlas.linked.col.sku") }}</dt>
          <dd>{{ previewProduct.sku }}</dd>
          <dt>EAN</dt>
          <dd>{{ previewProduct.ean || "—" }}</dd>
          <dt>{{ $t("atlas.linked.preview_categories") }}</dt>
          <dd>{{ previewCategories || "—" }}</dd>
        </dl>
      </div>
    </SideDrawer>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_ProductLinks,
  POST_ProductLink,
  PATCH_ProductLink,
  DELETE_ProductLink,
  POST_SetPrimaryLink,
  POST_UnsetPrimaryLink,
} from "@/api/atlas/api";
import { GET_Products, GET_Product } from "@/api/pim/api";

const EMPTY_LINK = (supplierIdx) => ({
  real_product_sku: "",
  source_idx: supplierIdx || "",
  external_id: "",
  priority: 0,
  is_primary: false,
  is_active: true,
  notes: "",
});

export default {
  name: "LinkedTab",
  components: {},
  props: {
    supplier: { type: Object, default: null },
  },
  setup() {
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const { errors, handleApiError, clearErrors } = useFormErrors();
    return { notify, pimChannel, errors, handleApiError, clearErrors };
  },
  data() {
    return {
      links: [],
      loading: false,
      formVisible: false,
      formBusy: false,
      formData: EMPTY_LINK(this.supplier?.idx),
      skuLabel: "",
      editing: null,
      deleteVisible: false,
      deleteTarget: null,
      previewVisible: false,
      previewLoading: false,
      previewProduct: null,
    };
  },
  computed: {
    isMonitoringSupplier() {
      return this.supplier?.supplier_role === "monitoring";
    },
    columns() {
      const cols = [
        {
          key: "real_product_sku",
          label: this.$t("atlas.linked.col.sku"),
          width: "1.5fr",
        },
        {
          key: "external_id",
          label: this.$t("atlas.linked.col.external_id"),
          width: "1fr",
        },
        {
          key: "priority",
          label: this.$t("atlas.linked.col.priority"),
          width: "80px",
        },
        {
          key: "is_primary",
          label: this.$t("atlas.linked.col.preferred"),
          width: "120px",
        },
        {
          key: "is_active",
          label: this.$t("atlas.col.status"),
          width: "100px",
        },
        { key: "actions", label: "", width: "140px" },
      ];
      // Primary-source has no meaning for monitoring (it drives sourcing/cost writes).
      return this.isMonitoringSupplier
        ? cols.filter((c) => c.key !== "is_primary")
        : cols;
    },
    shouldShowNoPreferredBanner() {
      return (
        !this.isMonitoringSupplier &&
        this.links.length > 0 &&
        !this.links.some((l) => l.is_primary)
      );
    },
    channelIdx() {
      // PIM search is channel-scoped; the default channel holds the full catalogue.
      return (
        this.pimChannel.activeChannelIdx ||
        this.pimChannel.defaultChannelIdx ||
        ""
      );
    },
    previewImage() {
      return (
        this.previewProduct?.thumbnail_url ||
        this.previewProduct?.og_image ||
        ""
      );
    },
    previewCategories() {
      const cats = this.previewProduct?.categories || [];
      return cats
        .map((c) => c.name || c.idx || c)
        .filter(Boolean)
        .join(", ");
    },
  },
  watch: {
    "supplier.idx"() {
      this.fetchLinks();
    },
  },
  mounted() {
    this.fetchLinks();
    // EntitySearchPicker needs a channel to scope the PIM search.
    if (!this.pimChannel.channels.length) this.pimChannel.fetchChannels();
  },
  methods: {
    async skuFetchFn(query) {
      if (!this.channelIdx) return [];
      try {
        const params = { page_size: 20 };
        if (query) params.search = query;
        const { data } = await GET_Products(this.channelIdx, params);
        const items = data?.results || data || [];
        return items.map((p) => ({
          value: p.sku,
          label: p.name || p.sku,
          secondary: p.sku,
        }));
      } catch {
        return [];
      }
    },
    async openPreview() {
      if (!this.formData.real_product_sku || !this.channelIdx) return;
      this.previewVisible = true;
      this.previewLoading = true;
      this.previewProduct = null;
      try {
        const { data } = await GET_Product(
          this.channelIdx,
          this.formData.real_product_sku
        );
        this.previewProduct = data;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        this.previewVisible = false;
      } finally {
        this.previewLoading = false;
      }
    },
    async fetchLinks() {
      if (!this.supplier?.idx) return;
      this.loading = true;
      try {
        const { data } = await GET_ProductLinks({
          source: this.supplier.idx,
          page_size: 100,
        });
        this.links = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.editing = null;
      this.formData = EMPTY_LINK(this.supplier?.idx);
      this.skuLabel = "";
      this.clearErrors();
      this.formVisible = true;
    },
    openEdit(row) {
      this.editing = row;
      this.formData = { ...row };
      this.skuLabel = row.real_product_sku;
      this.clearErrors();
      this.formVisible = true;
    },
    closeForm() {
      this.formVisible = false;
      this.editing = null;
    },
    async submitForm() {
      this.formBusy = true;
      this.clearErrors();
      try {
        const payload = { ...this.formData };
        if (this.editing) {
          delete payload.real_product_sku;
          delete payload.source_idx;
          await PATCH_ProductLink(this.editing.id, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("atlas.linked.toast.updated"),
          });
        } else {
          payload.source_idx = this.supplier?.idx;
          await POST_ProductLink(payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("atlas.linked.toast.created"),
          });
        }
        this.formVisible = false;
        this.fetchLinks();
      } catch (err) {
        this.handleApiError(err);
        if (Object.keys(this.errors).length === 0) {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
        }
      } finally {
        this.formBusy = false;
      }
    },
    async setPrimary(row) {
      try {
        await POST_SetPrimaryLink(row.id);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.linked.toast.set_preferred"),
        });
        this.fetchLinks();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async unsetPrimary(row) {
      try {
        await POST_UnsetPrimaryLink(row.id);
        this.notify.spawnNotification({
          type: "warning",
          msg: this.$t("atlas.linked.toast.unset_preferred"),
        });
        this.fetchLinks();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    confirmDelete(row) {
      this.deleteTarget = row;
      this.deleteVisible = true;
    },
    async executeDelete() {
      if (!this.deleteTarget) return;
      try {
        await DELETE_ProductLink(this.deleteTarget.id);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("atlas.linked.toast.deleted"),
        });
        this.deleteVisible = false;
        this.deleteTarget = null;
        this.fetchLinks();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.sku-preview {
  padding: var(--space-3);
}
.sku-preview__image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 220px;
  background: var(--surface-base);
  border-radius: var(--radius-base);
  overflow: hidden;
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}
.sku-preview__placeholder {
  font-size: var(--fs-700);
  color: var(--text-muted);
}
.sku-preview__meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  dt {
    color: var(--text-secondary);
  }
  dd {
    margin: 0;
    word-break: break-word;
  }
}
</style>
