<template>
  <SideDrawer
    :visible="visible"
    mode="focused"
    width="36rem"
    :title="drawerTitle"
    @close="onClose"
  >
    <div v-if="visible" class="fed">
      <!-- inclusion/exclusion -->
      <FormField :label="$t('promo.filter_field_inclusion')">
        <BasicSelect
          :options="inclusionOptions"
          v-model="local.is_inclusion_or_exclusion"
        />
      </FormField>

      <!-- take_common_part -->
      <FormField :label="$t('promo.filter_field_take_common_part')" class="mt-8">
        <BasicSwitch
          :label="$t('promo.filter_take_common_part_hint')"
          :hint="$t('promo.filter_common_tip')"
          v-model="local.take_common_part"
        />
      </FormField>

      <!-- ===== PRODUCT / THRESHOLD FIELDS ===== -->
      <template v-if="kind !== 'customer'">
        <!-- products -->
        <FormField :label="$t('promo.filter_field_products')" class="mt-8">
          <BasicInput
            v-model="productSearch"
            :placeholder="$t('promo.filter_search_products')"
            @input="debouncedFetch(fetchProducts)"
          />
          <div v-if="productResults.length" class="fed__results mt-2">
            <BasicCheckbox
              v-for="p in productResults"
              :key="p.sku"
              :model-value="local.products.includes(p.sku)"
              class="fed__result-row"
              @update:model-value="toggleProduct(p.sku)"
            >
              {{ p.sku }}{{ p.name ? ` — ${p.name}` : '' }}
            </BasicCheckbox>
          </div>
          <div v-if="local.products.length" class="fed__chips mt-2">
            <Tag
              v-for="sku in local.products"
              :key="sku"
              :label="sku"
              removable
              @remove="removeProduct(sku)"
            />
          </div>
          <p v-if="!local.products.length" class="fed__empty-hint">
            {{ $t('promo.filter_no_products_selected') }}
          </p>
        </FormField>

        <!-- categories -->
        <FormField :label="$t('promo.filter_field_categories')" class="mt-8">
          <BasicSelect
            v-model="local.categories"
            multiple
            :options="idOptions(categoryOptions, 'idx')"
            :placeholder="$t('promo.filter_field_categories')"
          />
        </FormField>

        <!-- attributes -->
        <FormField :label="$t('promo.filter_field_attributes')" class="mt-8">
          <BasicSelect
            v-model="local.attributes"
            multiple
            :options="idOptions(attributeOptions, 'idx')"
            :placeholder="$t('promo.filter_field_attributes')"
          />
        </FormField>

        <!-- features_qty_greater_than_attr_value -->
        <FormField :label="$t('promo.filter_field_features_qty_gt')" class="mt-8">
          <BasicSelect
            v-model="local.features_qty_greater_than_attr_value"
            multiple
            :options="idOptions(featureOptions, 'idx')"
            :placeholder="$t('promo.filter_field_features_qty_gt')"
          />
        </FormField>

        <!-- features_qty_is_multiple_of_attr_value -->
        <FormField :label="$t('promo.filter_field_features_qty_multiple')" class="mt-8">
          <BasicSelect
            v-model="local.features_qty_is_multiple_of_attr_value"
            multiple
            :options="idOptions(featureOptions, 'idx')"
            :placeholder="$t('promo.filter_field_features_qty_multiple')"
          />
        </FormField>

        <!-- numeric ranges -->
        <div class="fed__range-grid mt-8">
          <FormField :label="$t('promo.filter_field_product_price_from')">
            <NumberInput v-model="local.product_price_from" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_product_price_to')">
            <NumberInput v-model="local.product_price_to" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_cart_price_from')">
            <NumberInput v-model="local.cart_price_from" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_cart_price_to')">
            <NumberInput v-model="local.cart_price_to" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_qty_from')">
            <NumberInput v-model="local.qty_from" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_qty_to')">
            <NumberInput v-model="local.qty_to" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_cart_qty_from')">
            <NumberInput v-model="local.cart_qty_from" :max="INT_MAX" />
          </FormField>
          <FormField :label="$t('promo.filter_field_cart_qty_to')">
            <NumberInput v-model="local.cart_qty_to" :max="INT_MAX" />
          </FormField>
        </div>
      </template>

      <!-- ===== CUSTOMER FIELDS ===== -->
      <template v-else>
        <!-- customers -->
        <FormField :label="$t('promo.filter_field_customers')" class="mt-8">
          <BasicInput
            v-model="customerSearch"
            :placeholder="$t('promo.filter_search_customers')"
            @input="debouncedFetch(fetchCustomers)"
          />
          <div v-if="customerResults.length" class="fed__results mt-2">
            <BasicCheckbox
              v-for="c in customerResults"
              :key="c.uid"
              :model-value="local.customers.includes(c.uid)"
              class="fed__result-row"
              @update:model-value="toggleCustomer(c.uid)"
            >
              {{ c.first_name || '' }} {{ c.last_name || '' }}{{ c.email ? ` (${c.email})` : '' }}
            </BasicCheckbox>
          </div>
          <div v-if="local.customers.length" class="fed__chips mt-2">
            <Tag
              v-for="uid in local.customers"
              :key="uid"
              :label="String(uid)"
              removable
              @remove="removeCustomer(uid)"
            />
          </div>
          <p v-if="!local.customers.length" class="fed__empty-hint">
            {{ $t('promo.filter_no_customers_selected') }}
          </p>
        </FormField>

        <!-- groups -->
        <FormField :label="$t('promo.filter_field_groups')" class="mt-8">
          <BasicSelect
            v-model="local.groups"
            multiple
            :options="idOptions(groupOptions, 'code')"
            :placeholder="$t('promo.filter_field_groups')"
          />
        </FormField>
      </template>

      <!-- footer -->
      <ActionBar :actions="footerActions" class="fed__footer mt-10" />
    </div>
  </SideDrawer>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { t } from "@/i18n";
import { useSearchDebounce } from "@/composables/useSearchDebounce";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Products, GET_Categories, GET_Features, GET_Attributes } from "@/api/pim/api";
import { GET_Customers, GET_AccountsGroups } from "@/api/accounts/api";
import {
  POST_ProductFilter,
  POST_ThresholdFilter,
  POST_CustomerFilter,
  PATCH_ProductFilter,
  PATCH_ThresholdFilter,
  PATCH_CustomerFilter,
} from "@/api/promo/api";
import { useNotifyStore } from "@/stores/notify";
import { useLoaderStore } from "@/stores/loader";
import { INT_MAX } from "@/utils/formats";

const props = defineProps({
  visible: { type: Boolean, default: false },
  kind: { type: String, default: "product" }, // "product" | "threshold" | "customer"
  filter: { type: Object, default: null },
  channel: { type: String, required: true },
  ruleId: { type: [String, Number], required: true },
});

const emit = defineEmits(["close", "saved"]);

const notify = useNotifyStore();
const loader = useLoaderStore();

// ─── search debounce instances ─────────────────────────────────────────────
const { search: productSearch, debouncedFetch } = useSearchDebounce(300);
const { search: customerSearch, debouncedFetch: debouncedFetchCustomer } = useSearchDebounce(300);

// ─── remote option lists ────────────────────────────────────────────────────
const productResults = ref([]);
const categoryOptions = ref([]);
const attributeOptions = ref([]);
const featureOptions = ref([]);
const customerResults = ref([]);
const groupOptions = ref([]);

// ─── local form state ───────────────────────────────────────────────────────
const saving = ref(false);

function buildLocal(filter, kind) {
  if (kind === "customer") {
    return {
      is_inclusion_or_exclusion: filter?.is_inclusion_or_exclusion ?? "inclusion",
      take_common_part: filter?.take_common_part ?? false,
      customers: Array.isArray(filter?.customers) ? [...filter.customers] : [],
      groups: Array.isArray(filter?.groups) ? [...filter.groups] : [],
    };
  }
  return {
    is_inclusion_or_exclusion: filter?.is_inclusion_or_exclusion ?? "inclusion",
    take_common_part: filter?.take_common_part ?? false,
    products: Array.isArray(filter?.products) ? [...filter.products] : [],
    categories: Array.isArray(filter?.categories) ? [...filter.categories] : [],
    attributes: Array.isArray(filter?.attributes) ? [...filter.attributes] : [],
    features_qty_greater_than_attr_value: Array.isArray(filter?.features_qty_greater_than_attr_value)
      ? [...filter.features_qty_greater_than_attr_value]
      : [],
    features_qty_is_multiple_of_attr_value: Array.isArray(filter?.features_qty_is_multiple_of_attr_value)
      ? [...filter.features_qty_is_multiple_of_attr_value]
      : [],
    product_price_from: filter?.product_price_from ?? null,
    product_price_to: filter?.product_price_to ?? null,
    cart_price_from: filter?.cart_price_from ?? null,
    cart_price_to: filter?.cart_price_to ?? null,
    qty_from: filter?.qty_from ?? null,
    qty_to: filter?.qty_to ?? null,
    cart_qty_from: filter?.cart_qty_from ?? null,
    cart_qty_to: filter?.cart_qty_to ?? null,
  };
}

const local = ref(buildLocal(null, "product"));

// ─── computed ────────────────────────────────────────────────────────────────
const drawerTitle = computed(() => {
  if (props.kind === "customer") return t("promo.filter_drawer_title_customer");
  if (props.kind === "threshold") return t("promo.filter_drawer_title_threshold");
  return t("promo.filter_drawer_title_product");
});

const footerActions = computed(() => [
  { key: "cancel", role: "secondary", label: t("common.cancel"), onClick: onClose },
  { key: "save", role: "primary", label: t("common.save"), onClick: onSave, disabled: saving.value },
]);

const inclusionOptions = computed(() => [
  { label: t("promo.inclusion"), value: "inclusion", description: t("promo.mode_inclusion_desc") },
  { label: t("promo.exclusion"), value: "exclusion", description: t("promo.mode_exclusion_desc") },
]);

// ─── watchers ────────────────────────────────────────────────────────────────
watch(
  () => props.visible,
  async (open) => {
    if (!open) return;
    local.value = buildLocal(props.filter, props.kind);
    productSearch.value = "";
    productResults.value = [];
    customerSearch.value = "";
    customerResults.value = [];
    await loadStaticOptions();
  }
);

// ─── data loaders ────────────────────────────────────────────────────────────
async function loadStaticOptions() {
  if (props.kind !== "customer") {
    await Promise.all([loadCategories(), loadAttributes(), loadFeatures()]);
  } else {
    await loadGroups();
  }
}

async function loadCategories() {
  try {
    const { data } = await GET_Categories(props.channel, { page_size: 200 });
    categoryOptions.value = data.results || [];
  } catch {
    categoryOptions.value = [];
  }
}

async function loadAttributes() {
  try {
    const { data } = await GET_Attributes({ page_size: 200 });
    attributeOptions.value = data.results || [];
  } catch {
    attributeOptions.value = [];
  }
}

async function loadFeatures() {
  try {
    const { data } = await GET_Features({ page_size: 200 }, props.channel);
    featureOptions.value = data.results || [];
  } catch {
    featureOptions.value = [];
  }
}

async function loadGroups() {
  try {
    const { data } = await GET_AccountsGroups({ page_size: 200 });
    groupOptions.value = data.results || [];
  } catch {
    groupOptions.value = [];
  }
}

async function fetchProducts() {
  if (!productSearch.value.trim()) {
    productResults.value = [];
    return;
  }
  try {
    const { data } = await GET_Products(props.channel, {
      search: productSearch.value,
      page_size: 20,
    });
    productResults.value = data.results || [];
  } catch {
    productResults.value = [];
  }
}

async function fetchCustomers() {
  if (!customerSearch.value.trim()) {
    customerResults.value = [];
    return;
  }
  try {
    const { data } = await GET_Customers({
      search: customerSearch.value,
      page_size: 20,
    });
    customerResults.value = data.results || [];
  } catch {
    customerResults.value = [];
  }
}

// watch customer search separately with its own debounce
watch(customerSearch, () => {
  debouncedFetchCustomer(fetchCustomers);
});

// ─── toggle helpers ─────────────────────────────────────────────────────────
// { idx | code, name } rows → BasicSelect options ("idx — name").
function idOptions(rows, key) {
  return rows.map((row) => ({ label: row.name ? `${row[key]} — ${row.name}` : row[key], value: row[key] }));
}

function toggleInArray(arr, value) {
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
}

function toggleProduct(sku) { toggleInArray(local.value.products, sku); }
function removeProduct(sku) {
  local.value.products = local.value.products.filter((s) => s !== sku);
}
function toggleCustomer(uid) { toggleInArray(local.value.customers, uid); }
function removeCustomer(uid) {
  local.value.customers = local.value.customers.filter((u) => u !== uid);
}

// ─── save ────────────────────────────────────────────────────────────────────
const RANGE_FIELDS = [
  "product_price_from", "product_price_to", "cart_price_from", "cart_price_to",
  "qty_from", "qty_to", "cart_qty_from", "cart_qty_to",
];

function numOrNull(v) {
  // NumberInput emits strings; empty -> null, otherwise a number (backend ints).
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildPayload() {
  const payload = { ...local.value };
  if (props.kind !== "customer") {
    RANGE_FIELDS.forEach((k) => { payload[k] = numOrNull(payload[k]); });
  }
  return payload;
}

function filterErrorMessage(e) {
  return extractApiMessage(e, t("notifications.save_error"));
}

async function onSave() {
  saving.value = true;
  loader.loaderStart();
  try {
    const filterId = props.filter?.id;
    const isCreate = !filterId;
    const payload = buildPayload();

    if (props.kind === "product") {
      await (isCreate
        ? POST_ProductFilter(props.channel, props.ruleId, payload)
        : PATCH_ProductFilter(props.channel, props.ruleId, filterId, payload));
    } else if (props.kind === "threshold") {
      await (isCreate
        ? POST_ThresholdFilter(props.channel, props.ruleId, payload)
        : PATCH_ThresholdFilter(props.channel, props.ruleId, filterId, payload));
    } else {
      await (isCreate
        ? POST_CustomerFilter(props.channel, props.ruleId, payload)
        : PATCH_CustomerFilter(props.channel, props.ruleId, filterId, payload));
    }

    notify.spawnNotification({ type: "positive", msg: t("promo.filter_saved") });
    emit("saved");
    emit("close");
  } catch (e) {
    // Keep the drawer OPEN on error so the user can correct and retry.
    notify.spawnNotification({ type: "negative", msg: filterErrorMessage(e) });
  } finally {
    saving.value = false;
    loader.loaderFinish();
  }
}

function onClose() {
  emit("close");
}
</script>

<style lang="scss">
/* Unscoped — teleported to body */
.fed {
  display: flex;
  flex-direction: column;
  font-size: var(--fs-300);
  color: var(--text-body);

  &__results {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-base);
    max-height: 180px;
    overflow-y: auto;
    background: var(--surface-base);
  }

  &__result-row {
    padding: var(--space-1) var(--space-2);
    font-size: var(--fs-200);
    min-height: 36px;

    &:hover {
      background: var(--surface-raised);
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__empty-hint {
    font-size: var(--fs-200);
    color: var(--text-muted);
    margin-top: var(--space-1);
  }

  &__range-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
  }

  &__footer {
    padding-top: var(--space-8);
    flex-shrink: 0;
  }
}
</style>
