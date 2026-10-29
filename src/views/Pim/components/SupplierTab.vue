<template>
  <div class="pv-5" data-test="supplier-tab">
    <Loader block v-if="loading" />

    <template v-else-if="!data">
      <EmptyState
        :title="$t('pim.supplier.no_supplier')"
        icon="info"
      />
    </template>

    <template v-else>
      <div class="flex-column gap-8">
        <LinkedSuppliersPanel :items="linkedSuppliers" />
        <BasicCard gap>
          <div class="flex flex-wrap ai-ct gap-5">
            <StatusBadge
              v-if="unseenCount > 0"
              :label="$t('pim.supplier.status_unseen', { count: unseenCount })"
              tone="warning"
            />
            <StatusBadge
              v-else
              :label="$t('pim.supplier.status_no_unseen')"
              tone="positive"
            />
            <span v-if="lastSync" class="t-muted fs-200">
              {{ $t("pim.supplier.status_last_sync", { date: lastSync }) }}
            </span>
          </div>
          <div class="flex-column gap-5">
            <div class="supplier-action">
              <BasicButton mutates
                variant="secondary"
                :disabled="repushing"
                data-test="supplier-force-repush"
                @click="onForceRepush"
              >
                {{ repushing ? $t('pim.supplier.actions.force_repush_progress') : $t('pim.supplier.actions.force_repush') }}
              </BasicButton>
              <span class="supplier-action__desc t-muted fs-200">
                {{ $t("pim.supplier.actions.force_repush_desc") }}
              </span>
            </div>
            <div class="supplier-action">
              <BasicButton mutates
                variant="secondary"
                :disabled="acknowledging || unseenCount === 0"
                data-test="supplier-acknowledge"
                @click="onAcknowledgeAll"
              >
                {{ acknowledging ? $t('pim.supplier.actions.acknowledge_progress') : $t('pim.supplier.actions.acknowledge_all') }}
              </BasicButton>
              <span class="supplier-action__desc t-muted fs-200">
                {{ $t("pim.supplier.actions.acknowledge_all_desc") }}
              </span>
            </div>
            <div class="supplier-action">
              <BasicButton
                variant="secondary"
                data-test="supplier-force-preferred"
                @click="onForcePreferredClick"
              >
                {{ $t('pim.supplier.actions.force_preferred') }}
              </BasicButton>
              <span class="supplier-action__desc t-muted fs-200">
                {{ $t("pim.supplier.actions.force_preferred_desc") }}
              </span>
            </div>
            <div class="supplier-action">
              <BasicButton mutates
                variant="secondary"
                :disabled="resetting"
                data-test="supplier-reset-auto"
                @click="onResetToAuto"
              >
                {{ resetting ? $t('pim.supplier.actions.reset_to_auto_progress') : $t('pim.supplier.actions.reset_to_auto') }}
              </BasicButton>
              <span class="supplier-action__desc t-muted fs-200">
                {{ $t("pim.supplier.actions.reset_to_auto_desc") }}
              </span>
            </div>
          </div>
        </BasicCard>
      </div>

      <SupplierTimeline :entries="data.changes || []" data-test="supplier-timeline" />

      <ForcePreferredModal
        :visible="showForceModal"
        :auto-preferred-name="data.source?.name || ''"
        :auto-preferred-reason="autoStrategyReason"
        :target-supplier-name="forceTargetName"
        :target-supplier-idx="forceTargetIdx"
        :loading="forcing"
        @close="showForceModal = false"
        @confirmed="onForcePreferredConfirmed"
      />
    </template>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import {
  GET_SkuChanges,
  POST_AcknowledgeSku,
  POST_ForceRepushSku,
  POST_ResetPrimaryToAuto,
  POST_SetPrimarySource,
} from "@/api/atlas/api";
import LinkedSuppliersPanel from "./supplier/LinkedSuppliersPanel.vue";
import SupplierTimeline from "./supplier/SupplierTimeline.vue";
import ForcePreferredModal from "./supplier/ForcePreferredModal.vue";
import { extractApiMessage } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";

export default {
  name: "SupplierTab",
  components: { LinkedSuppliersPanel, SupplierTimeline, ForcePreferredModal },
  props: {
    sku: { type: String, required: true },
  },
  emits: ["refreshed"],
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  data() {
    return {
      loading: false,
      data: null,
      acknowledging: false,
      repushing: false,
      showForceModal: false,
      forceTargetName: "",
      forceTargetIdx: "",
      forcing: false,
      resetting: false,
    };
  },
  computed: {
    linkedSuppliers() {
      if (!this.data?.source) return [];
      return [
        {
          sp_id: this.data.source_product_id,
          supplier_idx: this.data.source.idx,
          supplier_name: this.data.source.name,
          cost: this.data.cost ?? null,
          stock: this.data.stock ?? null,
          is_preferred: true,
        },
      ];
    },
    unseenCount() {
      return this.data?.unseen_count || 0;
    },
    lastSync() {
      const iso = this.data?.last_change_at;
      if (!iso) return null;
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
    autoStrategyReason() {
      return "lowest_cost";
    },
  },
  watch: {
    sku: {
      immediate: true,
      handler(v) {
        if (v) this.fetch();
      },
    },
  },
  methods: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await GET_SkuChanges(this.sku);
        this.data = data;
      } catch (err) {
        if (isNotFound(err)) {
          this.data = null;
        } else {
          this.notify.spawnNotification({
            type: "negative",
            msg: extractApiMessage(err, this.$t("notifications.error")),
          });
        }
      } finally {
        this.loading = false;
      }
    },
    async onAcknowledgeAll() {
      if (this.acknowledging || this.unseenCount === 0) return;
      this.acknowledging = true;
      try {
        await POST_AcknowledgeSku(this.sku, { all_unseen: true });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.supplier.toast.acknowledge_success"),
        });
        await this.fetch();
        this.$emit("refreshed");
      } catch {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.$t("pim.supplier.toast.acknowledge_error"),
        });
      } finally {
        this.acknowledging = false;
      }
    },
    async onForceRepush() {
      if (this.repushing) return;
      this.repushing = true;
      try {
        const { data } = await POST_ForceRepushSku(this.sku);
        const failed = (data?.failed || []).length;
        const channels = data?.pushed_channels_count || 0;
        if (failed > 0) {
          this.notify.spawnNotification({
            type: "warning",
            msg: this.$t("pim.supplier.toast.repush_partial", { failed }),
          });
        } else {
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("pim.supplier.toast.repush_success", { count: channels }),
          });
        }
        await this.fetch();
        this.$emit("refreshed");
      } catch {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.$t("pim.supplier.toast.repush_error"),
        });
      } finally {
        this.repushing = false;
      }
    },
    onForcePreferredClick() {
      this.forceTargetName = this.data?.source?.name || "";
      this.forceTargetIdx = this.data?.source?.idx || "";
      this.showForceModal = true;
    },
    async onForcePreferredConfirmed({ supplierIdx, reason }) {
      if (this.forcing || !supplierIdx) return;
      this.forcing = true;
      try {
        await POST_SetPrimarySource(this.sku, {
          source_idx: supplierIdx,
          reason,
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.supplier.toast.force_preferred_success"),
        });
        this.showForceModal = false;
        await this.fetch();
        this.$emit("refreshed");
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(
            err,
            this.$t("pim.supplier.toast.force_preferred_error")
          ),
        });
      } finally {
        this.forcing = false;
      }
    },
    async onResetToAuto() {
      if (this.resetting) return;
      this.resetting = true;
      try {
        const { data } = await POST_ResetPrimaryToAuto(this.sku);
        const msg = data?.switched
          ? this.$t("pim.supplier.toast.reset_to_auto_switched", {
              supplier: data?.new_primary_source_idx || "",
            })
          : this.$t("pim.supplier.toast.reset_to_auto_no_change");
        this.notify.spawnNotification({ type: "positive", msg });
        await this.fetch();
        this.$emit("refreshed");
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(
            err,
            this.$t("pim.supplier.toast.reset_to_auto_error")
          ),
        });
      } finally {
        this.resetting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.supplier-action {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-5) var(--space-8);
}
.supplier-action__desc {
  flex: 1 1 14rem;
  line-height: var(--lh-300, 1.4);
}
</style>
