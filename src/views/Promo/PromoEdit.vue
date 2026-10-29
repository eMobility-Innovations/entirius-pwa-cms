<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader :title="pageTitle" back="/promo/list">
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch
              v-model="form.is_active"
              :disabled="loadFailed"
              :label="$t('promo.field_is_active')"
              :hint="$t('promo.hint_is_active')"
            />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else>
        <!-- Section: Basic info -->
        <BasicCard :title="$t('promo.section_basic')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('promo.field_name')"
              required
              :error="formErrors.getFieldError('name')?.msg || ''"
            >
              <BasicInput
                v-model="form.name"
                :maxlength="128"
              />
            </FormField>
            <FormField
              :label="$t('promo.field_modifier')"
              required
              :error="formErrors.getFieldError('modifier')?.msg || ''"
            >
              <BasicSelect
                :options="modifierOptions"
                :model-value="form.modifier"
                :placeholder="$t('promo.select_modifier')"
                @update:model-value="onModifierSelect"
              />
            </FormField>
            <FormField :label="$t('promo.field_target')">
              <BasicSelect
                :options="targetOptions"
                v-model="form.target"
                :placeholder="$t('promo.select_target')"
              />
            </FormField>
            <FormField
              :label="$t('promo.field_priority')"
              :error="formErrors.getFieldError('priority')?.msg || ''"
            >
              <NumberInput
                v-model="form.priority"
                :max="INT_MAX"
              />
            </FormField>
          </div>
        </BasicCard>

        <!-- Section: Extra value (modifier-specific) -->
        <BasicCard
          v-if="extraValueKind && extraValueKind !== 'none'"
          :title="$t('promo.section_extra_value')"
          gap
          class="mb-8"
        >
          <div class="form-grid">
            <!-- percent / amount / gratis_qty -->
            <template v-if="['percent', 'amount', 'gratis_qty'].includes(extraValueKind)">
              <FormField
                :label="extraValueLabel"
                :error="formErrors.getFieldError('extra_value')?.msg || ''"
              >
                <NumberInput
                  v-model="form.extra_value"
                  :max="extraValueKind === 'percent' ? 100 : INT_MAX"
                />
              </FormField>
            </template>

            <!-- gratis_sku: sku + sku_logic + qty -->
            <template v-else-if="extraValueKind === 'gratis_sku'">
              <FormField
                :label="$t('promo.extra_gratis_sku')"
                :error="formErrors.getFieldError('extra_value')?.msg || ''"
              >
                <BasicInput
                  v-model="form.extra_value_sku"
                  :placeholder="$t('promo.extra_gratis_sku_placeholder')"
                />
              </FormField>
              <FormField :label="$t('promo.extra_gratis_sku_logic')">
                <BasicSelect
                  :options="skuLogicOptions"
                  v-model="form.extra_value_sku_logic"
                />
              </FormField>
              <FormField :label="$t('promo.extra_gratis_qty')">
                <NumberInput v-model="form.extra_value_qty" />
              </FormField>
            </template>

            <!-- threshold_percent / threshold_amount / gratis_threshold / currency_threshold_price: per-currency rows -->
            <template v-else-if="['threshold_percent', 'threshold_amount', 'gratis_threshold', 'currency_threshold_price'].includes(extraValueKind)">
              <FormField :label="extraValueLabel" class="form-grid__wide">
                <!-- per-currency groups -->
                <div
                  v-for="(group, groupIdx) in perCurrencyRows"
                  :key="group.iso3"
                  class="currency-threshold-group b-subtle rounded p-8 mb-8"
                >
                  <div class="flex ai-ct jc-sb mb-5">
                    <span class="fw-600 fs-300">{{ group.iso3 }}</span>
                    <IconButton
                      icon="close"
                      :label="$t('common.delete')"
                      variant="danger"
                      @click="removeCurrencyGroup(groupIdx)"
                    />
                  </div>
                  <div
                    v-for="(row, rowIdx) in group.rows"
                    :key="rowIdx"
                    class="flex ai-ct gap-5 mb-5"
                  >
                    <BasicInput
                      v-model="row.key"
                      :placeholder="$t('promo.extra_threshold_key')"
                      class="flex-1"
                    />
                    <NumberInput
                      v-model="row.value"
                      :placeholder="$t('promo.extra_threshold_value')"
                      class="flex-1"
                    />
                    <IconButton
                      icon="close"
                      :label="$t('common.delete')"
                      variant="danger"
                      @click="removeCurrencyRow(groupIdx, rowIdx)"
                    />
                  </div>
                  <BasicButton
                    variant="secondary"
                    @click="addCurrencyRow(groupIdx)"
                  >
                    {{ $t('promo.extra_add_threshold_row') }}
                  </BasicButton>
                </div>
                <!-- add currency group -->
                <div class="flex ai-ct gap-5 mt-1">
                  <BasicSelect
                    :options="availableCurrencyGroupOptions"
                    :model-value="null"
                    :placeholder="$t('promo.extra_add_currency')"
                    @update:model-value="addCurrencyGroup"
                  />
                </div>
              </FormField>
            </template>

            <!-- json fallback -->
            <template v-else-if="extraValueKind === 'json'">
              <FormField
                :label="$t('promo.extra_json')"
                class="form-grid__wide"
                :error="jsonParseError || ''"
              >
                <BasicTextarea
                  v-model="form.extra_value_json"
                  :rows="5"
                  :placeholder="$t('promo.extra_json_placeholder')"
                />
              </FormField>
            </template>
          </div>
        </BasicCard>

        <!-- Section: Order conditions -->
        <BasicCard :title="$t('promo.section_conditions')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('promo.field_min_order_amount')"
              :error="formErrors.getFieldError('min_order_amount')?.msg || ''"
            >
              <BasicInput
                v-model="form.min_order_amount"
                format="money"
                :placeholder="$t('promo.min_order_amount_placeholder')"
              />
            </FormField>
            <FormField :label="$t('promo.field_currencies')" :hint="$t('promo.currencies_hint')">
              <BasicSelect
                v-model="form.currencies"
                multiple
                :options="currencySelectOptions"
                :placeholder="$t('promo.field_currencies')"
              />
            </FormField>
            <FormField :label="$t('promo.section_channels')" hint-level="important" :hint="$t('promo.channels_hint')">
              <BasicSelect
                v-model="form.channels"
                multiple
                :options="channelSelectOptions"
                :placeholder="$t('promo.section_channels')"
              />
            </FormField>
            <FormField v-if="form.free_shipping" :label="$t('promo.field_free_shipping_methods')">
              <BasicSelect
                v-model="form.free_shipping_methods"
                multiple
                :options="shippingSelectOptions"
                :placeholder="$t('promo.field_free_shipping_methods')"
              />
            </FormField>
          </div>
        </BasicCard>

        <!-- Section: Flags (the rule's on/off sits in the page header) -->
        <BasicCard :title="$t('promo.section_flags')" gap class="mb-8">
          <div class="form-grid">
            <BasicSwitch
              :label="$t('promo.field_automatic')"
              :hint="$t('promo.hint_automatic')"
              v-model="form.automatic_applications"
            />
            <BasicSwitch
              :label="$t('promo.field_free_shipping')"
              :hint="$t('promo.hint_free_shipping')"
              v-model="form.free_shipping"
            />
            <BasicSwitch
              :label="$t('promo.field_free_order')"
              :hint="$t('promo.hint_free_order')"
              v-model="form.free_order"
            />
            <BasicSwitch
              :label="$t('promo.field_is_omnibus')"
              :hint="$t('promo.hint_is_omnibus')"
              v-model="form.is_omnibus"
            />
            <BasicSwitch
              :label="$t('promo.field_show_when_invalid')"
              :hint="$t('promo.hint_show_when_invalid')"
              v-model="form.show_when_invalid"
            />
            <BasicSwitch
              :label="$t('promo.field_combine')"
              :hint="$t('promo.hint_combine')"
              v-model="form.combine_with_other_rules"
            />
          </div>
        </BasicCard>

        <!-- Section: Discount codes (edit only) -->
        <BasicCard v-if="isEdit" :title="$t('promo.section_codes')" gap class="mb-8">
          <template #actions>
            <BasicButton variant="secondary" @click="openAddCode">
              {{ $t('promo.add_code') }}
            </BasicButton>
          </template>

          <ReadonlyOff>
            <BasicInput
              v-model="codesSearch"
              :placeholder="$t('promo.codes_search_placeholder')"
              :aria-label="$t('promo.codes_search_placeholder')"
              icon="search"
              class="codes-search"
              @input="debouncedFetch(() => fetchCodes(true))"
            />
          </ReadonlyOff>

          <DataTable
            :columns="codesColumns"
            :rows="codes"
            :sortable="true"
            row-key="id"
            :empty-text="$t('promo.no_codes')"
            @sort="onCodesSort"
            @row-click="openEditCode"
          >
            <template #cell-code="{ row }">
              <span class="promo-code fw-600">{{ row.code }}</span>
            </template>
            <template #cell-used="{ row }">
              {{ row.current_used }} / {{ row.max_used !== null ? row.max_used : "∞" }}
            </template>
            <template #cell-max_uses_per_user="{ row }">
              {{ row.max_uses_per_user !== null ? row.max_uses_per_user : "∞" }}
            </template>
            <template #cell-validity="{ row }">
              {{ row.active_from ? formatDate(row.active_from) : "∞" }}
              –
              {{ row.active_to ? formatDate(row.active_to) : "∞" }}
            </template>
            <template #cell-max_products_qty="{ row }">
              {{ row.max_products_qty !== null ? row.max_products_qty : "—" }}
            </template>
            <template #cell-actions="{ row }">
              <IconButton
                icon="edit"
                :label="$t('common.edit')"
                size="sm"
                @click="openEditCode(row)"
              />
              <IconButton
                icon="delete"
                :label="$t('common.delete')"
                variant="danger"
                size="sm"
                @click="confirmDeleteCode(row.id)"
              />
            </template>
          </DataTable>

          <Pagination
            v-if="codesCount > codesPageSize"
            :page="codesPaginationState.page"
            :pages="codesPaginationState.pages"
            @update:page="onCodesPageChange"
          />

          <!-- Add code form (inline) -->
          <BasicCard v-if="showAddCode" :title="$t('promo.new_code_title')" gap>
            <div class="form-grid">
              <FormField
                :label="$t('promo.code_field_code')"
                required
                :error="codeFormErrors.getFieldError('code')?.msg || ''"
              >
                <BasicInput
                  v-model="newCode.code"
                  format="key"
                  :maxlength="40"
                />
              </FormField>
              <FormField :label="$t('promo.code_field_max_used')">
                <NumberInput v-model="newCode.max_used" :min="1" :max="INT_MAX" />
              </FormField>
              <FormField :label="$t('promo.code_field_max_per_user')">
                <NumberInput v-model="newCode.max_uses_per_user" :min="1" :max="INT_MAX" />
              </FormField>
              <FormField :label="$t('promo.code_field_max_qty')">
                <NumberInput v-model="newCode.max_products_qty" :min="1" :max="INT_MAX" />
              </FormField>
              <FormField :label="$t('promo.code_field_active_from')">
                <BasicInput type="date" v-model="newCode.active_from" />
              </FormField>
              <FormField :label="$t('promo.code_field_active_to')">
                <BasicInput type="date" v-model="newCode.active_to" />
              </FormField>
            </div>
            <ActionBar :actions="newCodeActions" />
          </BasicCard>
        </BasicCard>

        <!-- Section: Filters (edit only) -->
        <BasicCard v-if="isEdit" :title="$t('promo.section_filters')" gap class="mb-8">
          <p class="fs-200 t-muted">{{ $t("promo.filters_hint") }}</p>

          <div>
            <div class="flex ai-ct jc-sb wrap gap-3 mb-5">
              <h3 class="fs-400 fw-600">{{ $t("promo.product_filters") }}</h3>
              <BasicButton variant="secondary" @click="addProductFilter">
                {{ $t('promo.add_filter') }}
              </BasicButton>
            </div>
            <DataTable
              :columns="filterColumns"
              :rows="productFilters"
              row-key="id"
              :empty-text="$t('promo.no_filters')"
              @row-click="(row) => openFilterDrawer('product', row)"
            >
              <template #cell-mode="{ row }">
                <StatusBadge
                  :label="row.is_inclusion_or_exclusion === 'exclusion' ? $t('promo.exclusion') : $t('promo.inclusion')"
                  :tone="row.is_inclusion_or_exclusion === 'exclusion' ? 'negative' : 'positive'"
                />
              </template>
              <template #cell-summary="{ row }">
                <span class="fs-200">{{ filterSummary(row, 'product') }}</span>
              </template>
              <template #cell-actions="{ row }">
                <div class="flex gap-2">
                  <IconButton
                    icon="edit"
                    :label="$t('common.edit')"
                    size="sm"
                    @click="openFilterDrawer('product', row)"
                  />
                  <IconButton
                    icon="delete"
                    :label="$t('common.delete')"
                    variant="danger"
                    size="sm"
                    @click="confirmDeleteFilter(row.id, 'product')"
                  />
                </div>
              </template>
            </DataTable>
          </div>
          <div>
            <div class="flex ai-ct jc-sb wrap gap-3 mb-5">
              <h3 class="fs-400 fw-600">{{ $t("promo.customer_filters") }}</h3>
              <BasicButton variant="secondary" @click="addCustomerFilter">
                {{ $t('promo.add_filter') }}
              </BasicButton>
            </div>
            <DataTable
              :columns="filterColumns"
              :rows="customerFilters"
              row-key="id"
              :empty-text="$t('promo.no_filters')"
              @row-click="(row) => openFilterDrawer('customer', row)"
            >
              <template #cell-mode="{ row }">
                <StatusBadge
                  :label="row.is_inclusion_or_exclusion === 'exclusion' ? $t('promo.exclusion') : $t('promo.inclusion')"
                  :tone="row.is_inclusion_or_exclusion === 'exclusion' ? 'negative' : 'positive'"
                />
              </template>
              <template #cell-summary="{ row }">
                <span class="fs-200">{{ filterSummary(row, 'customer') }}</span>
              </template>
              <template #cell-actions="{ row }">
                <div class="flex gap-2">
                  <IconButton
                    icon="edit"
                    :label="$t('common.edit')"
                    size="sm"
                    @click="openFilterDrawer('customer', row)"
                  />
                  <IconButton
                    icon="delete"
                    :label="$t('common.delete')"
                    variant="danger"
                    size="sm"
                    @click="confirmDeleteFilter(row.id, 'customer')"
                  />
                </div>
              </template>
            </DataTable>
          </div>
          <div>
            <div class="flex ai-ct jc-sb wrap gap-3 mb-5">
              <h3 class="fs-400 fw-600">{{ $t("promo.threshold_filters") }}</h3>
              <BasicButton variant="secondary" @click="addThresholdFilter">
                {{ $t('promo.add_filter') }}
              </BasicButton>
            </div>
            <DataTable
              :columns="filterColumns"
              :rows="thresholdFilters"
              row-key="id"
              :empty-text="$t('promo.no_filters')"
              @row-click="(row) => openFilterDrawer('threshold', row)"
            >
              <template #cell-mode="{ row }">
                <StatusBadge
                  :label="row.is_inclusion_or_exclusion === 'exclusion' ? $t('promo.exclusion') : $t('promo.inclusion')"
                  :tone="row.is_inclusion_or_exclusion === 'exclusion' ? 'negative' : 'positive'"
                />
              </template>
              <template #cell-summary="{ row }">
                <span class="fs-200">{{ filterSummary(row, 'threshold') }}</span>
              </template>
              <template #cell-actions="{ row }">
                <div class="flex gap-2">
                  <IconButton
                    icon="edit"
                    :label="$t('common.edit')"
                    size="sm"
                    @click="openFilterDrawer('threshold', row)"
                  />
                  <IconButton
                    icon="delete"
                    :label="$t('common.delete')"
                    variant="danger"
                    size="sm"
                    @click="confirmDeleteFilter(row.id, 'threshold')"
                  />
                </div>
              </template>
            </DataTable>
          </div>
        </BasicCard>
      </template>

    <!-- Delete rule confirmation -->
    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteRule"
      @cancel="showDeleteConfirm = false"
      :title="$t('promo.confirm_delete_title')"
    >
      <template #default>
        <p>{{ $t("promo.confirm_delete_rule") }}</p>
      </template>
    </ConfirmDialog>

    <!-- Delete code confirmation -->
    <ConfirmDialog
      tone="danger"
      :open="showDeleteCodeConfirm"
      @confirm="deleteCode"
      @cancel="showDeleteCodeConfirm = false"
      :title="$t('promo.confirm_delete_code_title')"
    >
      <template #default>
        <p>{{ $t("promo.confirm_delete_code") }}</p>
      </template>
    </ConfirmDialog>

    <!-- Delete filter confirmation -->
    <ConfirmDialog
      tone="danger"
      :open="!!pendingDeleteFilter"
      @confirm="executeDeleteFilter"
      @cancel="pendingDeleteFilter = null"
      :title="$t('promo.confirm_delete_filter_title')"
    >
      <template #default>
        <p>{{ $t("promo.confirm_delete_filter") }}</p>
      </template>
    </ConfirmDialog>

    <!-- Edit code modal -->
    <BasicModal
      :open="showEditCodeModal"
      size="sm"
      :title="$t('promo.edit_code_title')"
      :actions="editCodeActions"
      @update:open="(open) => open || closeEditCodeModal()"
    >
      <div class="edit-code-body">
        <p class="fs-200 t-muted mb-8">
          {{ $t("promo.code_field_current_used") }}: <strong>{{ editCode.current_used }}</strong>
        </p>
        <FormField
          :label="$t('promo.code_field_code')"
          required
          class="mb-5"
          :error="codeFormErrors.getFieldError('code')?.msg || ''"
        >
          <BasicInput v-model="editCode.code" format="key" :maxlength="40" />
        </FormField>
        <FormField :label="$t('promo.code_field_max_used')" class="mb-5">
          <NumberInput v-model="editCode.max_used" :min="1" :max="INT_MAX" />
        </FormField>
        <FormField :label="$t('promo.code_field_max_per_user')" class="mb-5">
          <NumberInput v-model="editCode.max_uses_per_user" :min="1" :max="INT_MAX" />
        </FormField>
        <FormField :label="$t('promo.code_field_active_from')" class="mb-5">
          <BasicInput type="date" v-model="editCode.active_from" />
        </FormField>
        <FormField :label="$t('promo.code_field_active_to')" class="mb-5">
          <BasicInput type="date" v-model="editCode.active_to" />
        </FormField>
        <FormField :label="$t('promo.code_field_max_qty')">
          <NumberInput v-model="editCode.max_products_qty" :min="1" :max="INT_MAX" />
        </FormField>
      </div>
    </BasicModal>

    <ConfirmDialog
      :open="!!pendingNav"
      @confirm="saveAndLeave"
      @discard="confirmLeave"
      @cancel="cancelLeave"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
    />

    <FilterEditDrawer
      :visible="filterDrawer.visible"
      :kind="filterDrawer.kind"
      :filter="filterDrawer.filter"
      :channel="channel"
      :rule-id="ruleId"
      @close="closeFilterDrawer"
      @saved="onFilterSaved"
    />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useCheckoutChannelStore } from "@/stores/checkoutChannel";
import { modifierShortLabel } from "./promo-modifiers";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import Pagination from "@/boots/Pagination/index.vue";
import {
  GET_DiscountMeta,
  GET_DiscountRule,
  POST_DiscountRule,
  PATCH_DiscountRule,
  DELETE_DiscountRule,
  GET_DiscountCodes,
  POST_DiscountCode,
  PATCH_DiscountCode,
  DELETE_DiscountCode,
  GET_ProductFilters,
  DELETE_ProductFilter,
  GET_ThresholdFilters,
  DELETE_ThresholdFilter,
  GET_CustomerFilters,
  DELETE_CustomerFilter,
  GET_ShippingMethods,
  GET_Currencies,
} from "@/api/promo/api";
import FilterEditDrawer from "./FilterEditDrawer.vue";
import { INT_MAX } from "@/utils/formats";
import { formatDay } from "@/utils/format";
import { ReadonlyOff } from "@/composables/useReadonly";

const RULE_FORMATS = { min_order_amount: { format: "money" } };
const CODE_FORMATS = { code: { format: "key" } };

const EXTRA_VALUE_KINDS_SCALAR = ["percent", "amount", "gratis_qty"];
const EXTRA_VALUE_KINDS_THRESHOLD = [
  "threshold_percent",
  "threshold_amount",
  "gratis_threshold",
  "currency_threshold_price",
];

function buildExtraValuePayload(form, extraValueKind) {
  if (!extraValueKind || extraValueKind === "none") return null;
  if (EXTRA_VALUE_KINDS_SCALAR.includes(extraValueKind)) {
    return form.extra_value !== null && form.extra_value !== "" ? Number(form.extra_value) : null;
  }
  if (EXTRA_VALUE_KINDS_THRESHOLD.includes(extraValueKind)) {
    const obj = {};
    for (const group of form.perCurrencyRows || []) {
      if (!group.iso3) continue;
      const currencyRows = {};
      for (const row of group.rows) {
        if (row.key) currencyRows[row.key] = Number(row.value) || 0;
      }
      if (Object.keys(currencyRows).length) obj[group.iso3] = currencyRows;
    }
    return obj;
  }
  if (extraValueKind === "gratis_sku") {
    return {
      sku: form.extra_value_sku,
      sku_logic: form.extra_value_sku_logic,
      quantity: Number(form.extra_value_qty) || 1,
    };
  }
  if (extraValueKind === "json") {
    try {
      return JSON.parse(form.extra_value_json || "null");
    } catch {
      return null;
    }
  }
  return null;
}

export default {
  name: "PromoEdit",
  components: { ReadonlyOff, FilterEditDrawer, Pagination },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const checkoutChannel = useCheckoutChannelStore();
    const formErrors = useFormErrors();
    const codeFormErrors = useFormErrors();
    const unsaved = useUnsavedChanges();
    const { search: codesSearch, debouncedFetch } = useSearchDebounce();
    return { loader, notify, checkoutChannel, formErrors, codeFormErrors, ...unsaved, codesSearch, debouncedFetch, INT_MAX };
  },
  data() {
    return {
      // Until the meta (and the rule) load the header is hidden; after a failed load its Save, Delete and Active
      // switch stay disabled, so the empty default form never overwrites the stored rule.
      loading: true,
      loadFailed: false,
      showDeleteConfirm: false,
      showAddCode: false,
      showEditCodeModal: false,
      showDeleteCodeConfirm: false,
      pendingDeleteCodeId: null,
      pendingDeleteFilter: null,
      filterDrawer: {
        visible: false,
        kind: "product",
        filter: null,
      },
      modifiers: [],
      targets: [],
      codes: [],
      codesCount: 0,
      codesPage: 1,
      codesPageSize: 20,
      codesOrdering: null,
      productFilters: [],
      customerFilters: [],
      thresholdFilters: [],
      shippingMethodOptions: [],
      currencyOptions: [],
      jsonParseError: null,
      editCode: {
        id: null,
        code: "",
        max_used: null,
        max_uses_per_user: null,
        active_from: null,
        active_to: null,
        max_products_qty: null,
        current_used: 0,
      },
      // The code as stored when the edit opened: a legacy value the operator leaves alone never blocks the save.
      editCodeStored: "",
      newCode: {
        code: "",
        max_used: null,
        max_uses_per_user: null,
        max_products_qty: null,
        active_from: null,
        active_to: null,
      },
      perCurrencyRows: [],
      form: {
        name: "",
        modifier: null,
        extra_value: null,
        extra_value_sku: "",
        extra_value_sku_logic: "AND",
        extra_value_qty: 1,
        extra_value_json: "",
        target: "all",
        min_order_amount: "",
        free_shipping: false,
        free_order: false,
        is_omnibus: false,
        is_active: true,
        show_when_invalid: true,
        combine_with_other_rules: false,
        automatic_applications: false,
        priority: 0,
        currencies: [],
        free_shipping_methods: [],
        channels: [],
      },
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
    isEdit() {
      return !!this.$route.params.id;
    },
    ruleId() {
      return this.$route.params.id;
    },
    pageTitle() {
      if (!this.isEdit) return this.$t("promo.create_rule");
      return this.form.name || this.$t("promo.edit_rule");
    },
    headerActions() {
      const del = { key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
        disabled: this.loadFailed, onClick: () => (this.showDeleteConfirm = true) };
      return [
        ...(this.isEdit ? [del] : []),
        { key: "save", role: "primary", label: this.$t("common.save"), disabled: this.loadFailed, onClick: this.saveRule },
      ];
    },
    newCodeActions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: () => (this.showAddCode = false) },
        { key: "save", role: "secondary", label: this.$t("promo.save_code"), onClick: this.saveNewCode },
      ];
    },
    editCodeActions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("common.cancel"), onClick: this.closeEditCodeModal },
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.saveEditCode },
      ];
    },
    modifierOptions() {
      return this.modifiers.map(m => {
        const label = modifierShortLabel(m.value, m.label);
        return { label, description: m.label !== label ? m.label : "", value: m.value };
      });
    },
    targetOptions() {
      return this.targets.map(t => ({ label: t.label, value: t.value }));
    },
    extraValueKind() {
      if (!this.form.modifier) return null;
      const found = this.modifiers.find(m => m.value === this.form.modifier);
      return found ? found.extra_value_kind : null;
    },
    currencySelectOptions() {
      return this.currencyOptions.map(c => ({ label: `${c.iso3} — ${c.name}`, value: c.iso3 }));
    },
    // The active channel is always applied (backend auto-adds it) — can't toggle off.
    channelSelectOptions() {
      return this.checkoutChannel.channels.map(ch => {
        const active = ch.idx === this.channel;
        const description = active ? this.$t("promo.channel_active") : "";
        return { label: ch.name || ch.idx, value: ch.idx, description, disabled: active };
      });
    },
    shippingSelectOptions() {
      return this.shippingMethodOptions.map(m => ({
        label: `[${m.channel_idx}] ${m.code}${m.name ? ` — ${m.name}` : ""}`,
        value: m.code,
      }));
    },
    availableCurrencyGroupOptions() {
      const used = new Set(this.perCurrencyRows.map(g => g.iso3));
      return this.currencyOptions
        .filter(c => !used.has(c.iso3))
        .map(c => ({ label: `${c.iso3} — ${c.name}`, value: c.iso3 }));
    },
    extraValueLabel() {
      const kind = this.extraValueKind;
      if (kind === "percent") return this.$t("promo.extra_percent");
      if (kind === "amount") return this.$t("promo.extra_amount");
      if (kind === "gratis_qty") return this.$t("promo.extra_gratis_qty");
      if (EXTRA_VALUE_KINDS_THRESHOLD.includes(kind)) return this.$t("promo.extra_threshold");
      return this.$t("promo.extra_value");
    },
    skuLogicOptions() {
      return [
        { label: "AND", value: "AND" },
        { label: "OR", value: "OR" },
      ];
    },
    inclusionOptions() {
      return [
        { label: this.$t("promo.inclusion"), value: "inclusion" },
        { label: this.$t("promo.exclusion"), value: "exclusion" },
      ];
    },
    filterColumns() {
      return [
        { key: "mode", label: this.$t("promo.filter_col_mode"), sortable: false, width: "150px" },
        { key: "summary", label: this.$t("promo.filter_col_contents"), sortable: false, width: "1fr" },
        { key: "actions", label: "", sortable: false, width: "90px" },
      ];
    },
    codesColumns() {
      return [
        { key: "code", label: this.$t("promo.code_field_code"), sortable: true, width: "1fr" },
        { key: "used", label: this.$t("promo.col_used"), sortable: true, width: "120px" },
        { key: "max_uses_per_user", label: this.$t("promo.code_field_max_per_user"), sortable: true, width: "140px" },
        { key: "validity", label: this.$t("promo.col_validity"), sortable: true, width: "200px" },
        { key: "max_products_qty", label: this.$t("promo.code_field_max_qty"), sortable: true, width: "120px" },
        { key: "actions", label: "", sortable: false, width: "80px" },
      ];
    },
    codesPaginationState() {
      return {
        page: this.codesPage,
        pages: Math.ceil(this.codesCount / this.codesPageSize),
      };
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
        if (this.extraValueKind === "json") {
          try {
            JSON.parse(this.form.extra_value_json || "null");
            this.jsonParseError = null;
          } catch {
            this.jsonParseError = this.$t("promo.json_parse_error");
          }
        }
      },
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  async mounted() {
    this.checkoutChannel.fetchChannels();
    await Promise.all([this.fetchMeta(), this.fetchShippingMethods(), this.fetchCurrencies()]);
    if (this.isEdit) {
      await this.fetchRule();
      await Promise.all([
        this.fetchCodes(),
        this.fetchProductFilters(),
        this.fetchCustomerFilters(),
        this.fetchThresholdFilters(),
      ]);
    } else {
      // New rule: pre-select the active channel (backend auto-adds it anyway).
      if (!this.form.channels.length) this.form.channels = [this.channel];
      this.snapshot(this.form);
      this.track(this.form);
      this.loading = false;
    }
  },
  methods: {
    filterSummary(f, kind) {
      const parts = [];
      if (kind === "customer") {
        if (f.customers && f.customers.length) parts.push(`${this.$t("promo.filter_lbl_customers")}: ${f.customers.length}`);
        if (f.groups && f.groups.length) parts.push(`${this.$t("promo.filter_lbl_groups")}: ${f.groups.length}`);
      } else {
        if (f.products && f.products.length) parts.push(`${this.$t("promo.filter_lbl_products")}: ${f.products.length}`);
        if (f.categories && f.categories.length) parts.push(`${this.$t("promo.filter_lbl_categories")}: ${f.categories.length}`);
        if (f.attributes && f.attributes.length) parts.push(`${this.$t("promo.filter_lbl_attributes")}: ${f.attributes.length}`);
        const featureCount = (f.features_qty_greater_than_attr_value?.length || 0) + (f.features_qty_is_multiple_of_attr_value?.length || 0);
        if (featureCount) parts.push(`${this.$t("promo.filter_lbl_features")}: ${featureCount}`);
        const priceFrom = f.product_price_from;
        const priceTo = f.product_price_to;
        if (priceFrom !== null && priceFrom !== undefined || priceTo !== null && priceTo !== undefined) {
          parts.push(`${this.$t("promo.filter_lbl_product_price")}: ${priceFrom ?? ""}–${priceTo ?? ""}`);
        }
        const cartFrom = f.cart_price_from;
        const cartTo = f.cart_price_to;
        if (cartFrom !== null && cartFrom !== undefined || cartTo !== null && cartTo !== undefined) {
          parts.push(`${this.$t("promo.filter_lbl_cart_price")}: ${cartFrom ?? ""}–${cartTo ?? ""}`);
        }
        const qtyFrom = f.qty_from;
        const qtyTo = f.qty_to;
        if (qtyFrom !== null && qtyFrom !== undefined || qtyTo !== null && qtyTo !== undefined) {
          parts.push(`${this.$t("promo.filter_lbl_qty")}: ${qtyFrom ?? ""}–${qtyTo ?? ""}`);
        }
        const cartQtyFrom = f.cart_qty_from;
        const cartQtyTo = f.cart_qty_to;
        if (cartQtyFrom !== null && cartQtyFrom !== undefined || cartQtyTo !== null && cartQtyTo !== undefined) {
          parts.push(`${this.$t("promo.filter_lbl_cart_qty")}: ${cartQtyFrom ?? ""}–${cartQtyTo ?? ""}`);
        }
      }
      return parts.length ? parts.join(" · ") : this.$t("promo.filter_empty");
    },
    async fetchMeta() {
      try {
        const { data } = await GET_DiscountMeta(this.channel);
        this.modifiers = data.modifiers || [];
        this.targets = data.targets || [];
      } catch {
        // Non-critical
      }
    },
    async fetchShippingMethods() {
      try {
        const { data } = await GET_ShippingMethods(this.channel);
        this.shippingMethodOptions = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchCurrencies() {
      try {
        const { data } = await GET_Currencies(this.channel);
        this.currencyOptions = data.results || [];
      } catch {
        // Non-critical
      }
    },
    addCurrencyGroup(iso3) {
      this.perCurrencyRows.push({ iso3, rows: [{ key: "", value: "" }] });
    },
    removeCurrencyGroup(groupIdx) {
      this.perCurrencyRows.splice(groupIdx, 1);
    },
    addCurrencyRow(groupIdx) {
      this.perCurrencyRows[groupIdx].rows.push({ key: "", value: "" });
    },
    removeCurrencyRow(groupIdx, rowIdx) {
      this.perCurrencyRows[groupIdx].rows.splice(rowIdx, 1);
    },
    async fetchRule() {
      this.loading = true;
      try {
        const { data } = await GET_DiscountRule(this.channel, this.ruleId);
        this.resetFormFromData(data);
        this.snapshot(this.form);
        this.track(this.form);
        this.loadFailed = false;
      } catch (err) {
        this.loadFailed = true;
        this.notify.spawnNotification({
          type: "negative",
          msg: this.codeErrorMessage(err),
        });
      } finally {
        this.loading = false;
      }
    },
    resetFormFromData(data) {
      const ev = data.extra_value;
      let perCurrencyRows = [];
      let extra_value_sku = "";
      let extra_value_sku_logic = "AND";
      let extra_value_qty = 1;
      let extra_value_json = "";
      let extra_value = null;

      const kind = (() => {
        const found = this.modifiers.find(m => m.value === data.modifier);
        return found ? found.extra_value_kind : null;
      })();

      if (EXTRA_VALUE_KINDS_SCALAR.includes(kind)) {
        extra_value = ev;
      } else if (EXTRA_VALUE_KINDS_THRESHOLD.includes(kind) && ev && typeof ev === "object") {
        // Detect nested {iso3: {threshold: value}} vs flat {threshold: value}
        const isNested = Object.values(ev).every(v => v !== null && typeof v === "object" && !Array.isArray(v));
        if (isNested) {
          perCurrencyRows = Object.entries(ev).map(([iso3, thresholds]) => ({
            iso3,
            rows: Object.entries(thresholds).map(([key, value]) => ({ key, value: String(value) })),
          }));
        } else {
          // Legacy flat data — put under a single "_legacy" group to preserve losslessly
          perCurrencyRows = [{
            iso3: "_legacy",
            rows: Object.entries(ev).map(([key, value]) => ({ key, value: String(value) })),
          }];
        }
      } else if (kind === "gratis_sku" && ev) {
        extra_value_sku = ev.sku || "";
        extra_value_sku_logic = ev.sku_logic || "AND";
        extra_value_qty = ev.quantity || 1;
      } else if (kind === "json" && ev !== null && ev !== undefined) {
        extra_value_json = JSON.stringify(ev, null, 2);
      }

      this.perCurrencyRows = perCurrencyRows;
      this.form = {
        name: data.name || "",
        modifier: data.modifier || null,
        extra_value,
        extra_value_sku,
        extra_value_sku_logic,
        extra_value_qty,
        extra_value_json,
        target: data.target || "all",
        min_order_amount: data.min_order_amount || "",
        free_shipping: !!data.free_shipping,
        free_order: !!data.free_order,
        is_omnibus: !!data.is_omnibus,
        is_active: data.is_active ?? true,
        show_when_invalid: data.show_when_invalid ?? true,
        combine_with_other_rules: !!data.combine_with_other_rules,
        automatic_applications: !!data.automatic_applications,
        priority: data.priority ?? 0,
        currencies: data.currencies || [],
        free_shipping_methods: data.free_shipping_methods || [],
        channels: data.channels || [],
      };
    },
    async fetchCodes(resetPage = false) {
      if (resetPage) this.codesPage = 1;
      try {
        const params = {
          page: this.codesPage,
          page_size: this.codesPageSize,
        };
        if (this.codesSearch) params.search = this.codesSearch;
        if (this.codesOrdering) params.ordering = this.codesOrdering;
        const { data } = await GET_DiscountCodes(this.channel, this.ruleId, params);
        this.codes = data.results || [];
        this.codesCount = data.count || 0;
      } catch {
        // Non-critical
      }
    },
    async fetchProductFilters() {
      try {
        const { data } = await GET_ProductFilters(this.channel, this.ruleId);
        this.productFilters = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchCustomerFilters() {
      try {
        const { data } = await GET_CustomerFilters(this.channel, this.ruleId);
        this.customerFilters = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchThresholdFilters() {
      try {
        const { data } = await GET_ThresholdFilters(this.channel, this.ruleId);
        this.thresholdFilters = data.results || [];
      } catch {
        // Non-critical
      }
    },
    openEditCode(code) {
      this.editCodeStored = code.code;
      this.editCode = {
        id: code.id,
        code: code.code,
        max_used: code.max_used ?? null,
        max_uses_per_user: code.max_uses_per_user ?? null,
        active_from: code.active_from ? code.active_from.slice(0, 10) : null,
        active_to: code.active_to ? code.active_to.slice(0, 10) : null,
        max_products_qty: code.max_products_qty ?? null,
        current_used: code.current_used ?? 0,
      };
      this.codeFormErrors.clearErrors();
      this.showEditCodeModal = true;
    },
    closeEditCodeModal() {
      this.showEditCodeModal = false;
    },
    normalizeCodeLimit(value) {
      // Nullable "limit" fields (ge=1): 0 / empty / invalid -> null (no limit).
      const n = Number(value);
      return Number.isFinite(n) && n >= 1 ? n : null;
    },
    codeErrorMessage(err) {
      return extractApiMessage(err, this.$t("notifications.save_error"));
    },
    async saveEditCode() {
      const formats = this.editCode.code === this.editCodeStored ? {} : CODE_FORMATS;
      if (!this.codeFormErrors.validateFormats(this.editCode, formats)) return;
      const codeId = this.editCode.id;
      this.loader.loaderStart();
      try {
        const payload = {
          code: this.editCode.code,
          max_used: this.normalizeCodeLimit(this.editCode.max_used) ?? 1,
          max_uses_per_user: this.normalizeCodeLimit(this.editCode.max_uses_per_user),
          active_from: this.editCode.active_from || null,
          active_to: this.editCode.active_to || null,
          max_products_qty: this.normalizeCodeLimit(this.editCode.max_products_qty),
        };
        await PATCH_DiscountCode(this.channel, this.ruleId, codeId, payload);
        await this.fetchCodes();
        this.showEditCodeModal = false;
        this.notify.spawnNotification({ type: "positive", msg: this.$t("promo.code_updated") });
      } catch (err) {
        this.showEditCodeModal = false;
        this.notify.spawnNotification({ type: "negative", msg: this.codeErrorMessage(err) });
      } finally {
        this.loader.loaderFinish();
      }
    },
    onCodesSort({ key, direction }) {
      const keyMap = {
        code: "code",
        used: "current_used",
        validity: "active_from",
        max_uses_per_user: "max_uses_per_user",
        max_products_qty: "max_products_qty",
      };
      const backendKey = keyMap[key];
      if (!backendKey || !direction) {
        this.codesOrdering = null;
      } else {
        this.codesOrdering = direction === "desc" ? `-${backendKey}` : backendKey;
      }
      this.fetchCodes(true);
    },
    onCodesPageChange(page) {
      this.codesPage = page;
      this.fetchCodes();
    },
    confirmDeleteCode(codeId) {
      this.pendingDeleteCodeId = codeId;
      this.showDeleteCodeConfirm = true;
    },
    confirmDeleteFilter(filterId, kind) {
      this.pendingDeleteFilter = { id: filterId, kind };
    },
    async executeDeleteFilter() {
      const { id, kind } = this.pendingDeleteFilter;
      this.pendingDeleteFilter = null;
      if (kind === "product") await this.deleteProductFilter(id);
      else if (kind === "customer") await this.deleteCustomerFilter(id);
      else await this.deleteThresholdFilter(id);
    },
    addThresholdFilter() {
      this.openFilterDrawer("threshold", null);
    },
    async deleteThresholdFilter(filterId) {
      this.loader.loaderStart();
      try {
        await DELETE_ThresholdFilter(this.channel, this.ruleId, filterId);
        await this.fetchThresholdFilters();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: this.codeErrorMessage(err) });
      } finally {
        this.loader.loaderFinish();
      }
    },
    onModifierSelect(val) {
      this.form.modifier = val;
      // Reset extra_value fields when modifier changes
      this.form.extra_value = null;
      this.perCurrencyRows = [];
      this.form.extra_value_sku = "";
      this.form.extra_value_json = "";
    },
    openAddCode() {
      this.showAddCode = true;
      this.newCode = {
        code: "",
        max_used: null,
        max_uses_per_user: null,
        max_products_qty: null,
        active_from: null,
        active_to: null,
      };
      this.codeFormErrors.clearErrors();
    },
    async saveNewCode() {
      const valid = this.codeFormErrors.validateRequired(this.newCode, {
        code: this.$t("promo.code_field_code"),
      });
      if (!valid || !this.codeFormErrors.validateFormats(this.newCode, CODE_FORMATS)) return;

      this.loader.loaderStart();
      try {
        const payload = { code: this.newCode.code };
        const muNew = this.normalizeCodeLimit(this.newCode.max_used);
        if (muNew !== null) payload.max_used = muNew;
        const muuNew = this.normalizeCodeLimit(this.newCode.max_uses_per_user);
        if (muuNew !== null) payload.max_uses_per_user = muuNew;
        const mpqNew = this.normalizeCodeLimit(this.newCode.max_products_qty);
        if (mpqNew !== null) payload.max_products_qty = mpqNew;
        if (this.newCode.active_from) payload.active_from = this.newCode.active_from;
        if (this.newCode.active_to) payload.active_to = this.newCode.active_to;

        await POST_DiscountCode(this.channel, this.ruleId, payload);
        await this.fetchCodes(true);
        this.showAddCode = false;
        this.notify.spawnNotification({ type: "positive", msg: this.$t("promo.code_created") });
      } catch (err) {
        this.codeFormErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: this.codeErrorMessage(err),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async deleteCode() {
      const codeId = this.pendingDeleteCodeId;
      this.showDeleteCodeConfirm = false;
      this.pendingDeleteCodeId = null;
      this.loader.loaderStart();
      try {
        await DELETE_DiscountCode(this.channel, this.ruleId, codeId);
        await this.fetchCodes();
        this.notify.spawnNotification({ type: "positive", msg: this.$t("promo.code_deleted") });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.codeErrorMessage(err),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    addProductFilter() {
      // Open an empty editor; the filter is created (POST) only when the user saves.
      this.openFilterDrawer("product", null);
    },
    async deleteProductFilter(filterId) {
      this.loader.loaderStart();
      try {
        await DELETE_ProductFilter(this.channel, this.ruleId, filterId);
        await this.fetchProductFilters();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: this.codeErrorMessage(err) });
      } finally {
        this.loader.loaderFinish();
      }
    },
    addCustomerFilter() {
      this.openFilterDrawer("customer", null);
    },
    async deleteCustomerFilter(filterId) {
      this.loader.loaderStart();
      try {
        await DELETE_CustomerFilter(this.channel, this.ruleId, filterId);
        await this.fetchCustomerFilters();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: this.codeErrorMessage(err) });
      } finally {
        this.loader.loaderFinish();
      }
    },
    openFilterDrawer(kind, filter) {
      this.filterDrawer = { visible: true, kind, filter };
    },
    closeFilterDrawer() {
      this.filterDrawer.visible = false;
    },
    async onFilterSaved() {
      if (this.filterDrawer.kind === "product") await this.fetchProductFilters();
      else if (this.filterDrawer.kind === "threshold") await this.fetchThresholdFilters();
      else await this.fetchCustomerFilters();
    },
    buildPayload() {
      const payload = {
        name: this.form.name,
        modifier: this.form.modifier,
        target: this.form.target || "all",
        min_order_amount: this.form.min_order_amount || null,
        free_shipping: this.form.free_shipping,
        free_order: this.form.free_order,
        is_omnibus: this.form.is_omnibus,
        is_active: this.form.is_active,
        show_when_invalid: this.form.show_when_invalid,
        combine_with_other_rules: this.form.combine_with_other_rules,
        automatic_applications: this.form.automatic_applications,
        priority: Number(this.form.priority) || 0,
        currencies: this.form.currencies,
        free_shipping_methods: this.form.free_shipping_methods,
        channels: this.form.channels,
        extra_value: buildExtraValuePayload({ ...this.form, perCurrencyRows: this.perCurrencyRows }, this.extraValueKind),
      };

      return payload;
    },
    async saveAndLeave() {
      await this.saveRule();
      this.confirmLeave();
    },
    // A rule that failed to load holds the empty default form: never write it over the stored rule.
    async saveRule() {
      if (this.loadFailed) return;
      const valid = this.formErrors.validateRequired(this.form, {
        name: this.$t("promo.field_name"),
        modifier: this.$t("promo.field_modifier"),
      });
      if (!valid || !this.formErrors.validateFormats(this.form, RULE_FORMATS)) return;

      if (this.extraValueKind === "json" && this.jsonParseError) return;

      this.loader.loaderStart();
      try {
        const payload = this.buildPayload();
        if (this.isEdit) {
          await PATCH_DiscountRule(this.channel, this.ruleId, payload);
          this.notify.spawnNotification({ type: "positive", msg: this.$t("promo.rule_saved") });
          await this.fetchRule();
        } else {
          const { data } = await POST_DiscountRule(this.channel, payload);
          this.notify.spawnNotification({ type: "positive", msg: this.$t("promo.rule_created") });
          this.$router.push(`/promo/${data.id}`);
        }
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async deleteRule() {
      this.showDeleteConfirm = false;
      if (this.loadFailed) return;
      this.loader.loaderStart();
      try {
        await DELETE_DiscountRule(this.channel, this.ruleId);
        this.snapshot(this.form);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("promo.rule_deleted") });
        this.$router.push("/promo/list");
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.codeErrorMessage(err),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    formatDate(d) {
      return d ? formatDay(d) : "";
    },
  },
};
</script>

<style lang="scss" scoped>
.promo-code {
  font-family: var(--font-mono);
  font-size: var(--fs-300);
}

.currency-threshold-group {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  padding: var(--space-8);
}

.codes-search {
  max-width: 360px;
  min-width: 200px;
}

.edit-code-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
