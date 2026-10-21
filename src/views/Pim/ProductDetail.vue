<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="product.sku || !loading" #header>
      <PageHeader :title="product.name || product.sku || $t('pim.product_detail')" back="/pim/products">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template v-if="product.sku" #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch v-model="form.is_enabled" :label="$t('pim.enabled')" />
            <ActionBar>
              <ReadonlyArea v-if="aiEnabled" :area="EMBEDDED_AREAS.ai">
                <ProductAiResults
                  ref="aiResults"
                  :sku="product.sku"
                  :product="product"
                  :workers="aiWorkers"
                  :templates="aiTemplates"
                  :all-templates="aiAllTemplates"
                  :usable="aiUsable"
                  @applied="onAiApplied"
                  @run="openAiTask"
                />
              </ReadonlyArea>
              <BasicMenu :items="moreMenuItems" :label="$t('pim.more_actions')" placement="bottom-end" @select="onMoreSelect">
                <template #trigger>
                  <IconButton icon="more" variant="outline" :label="$t('pim.more_actions')" data-testid="pim-product-more" />
                </template>
              </BasicMenu>
              <IconButton
                v-if="canDeleteProduct"
                mutates
                icon="delete"
                variant="danger"
                :label="$t('common.delete')"
                data-testid="pim-product-delete"
                @click="showDeleteConfirm = true"
              />
              <BasicButton mutates variant="primary" @click="saveProduct">{{ $t("common.save") }}</BasicButton>
            </ActionBar>
          </div>
        </template>
      </PageHeader>
    </template>
    <Loader block v-if="loading" />

    <!-- etap-12 #25: 404 on the chosen channel auto-switches to default and warns. -->
    <div
      v-if="channelMismatchWarning"
      class="bg-warning-subtle t-warning p-8 rounded mb-8"
      role="alert"
    >
      <font-awesome-icon :icon="$icons.warning" class="mr-5" />
      {{ $t("pim.channel_mismatch_warning") }}
    </div>

    <template v-else-if="!loading">
      <div class="product-layout">
        <div class="product-layout__media">
          <MediaGallery
            :key="mediaKey"
            :channel-idx="channelIdx"
            :sku="product.sku"
            :ai-actions="aiPictureActions"
            @ai-run="openAiOnPicture"
          />
        </div>

        <div class="product-layout__content">
          <BasicCard :title="$t('pim.basic_info')" gap class="mb-8">
            <div class="flex flex-wrap ai-ct gap-5">
              <span class="meta-item">SKU: <strong>{{ product.sku }}</strong></span>
              <span v-if="product.product_class_name" class="meta-item">
                {{ $t("pim.product_class") }}:
                <strong :class="productClassColor">{{ productClassLabel }}</strong>
              </span>
              <span v-if="product.feature_set_idx" class="meta-item">
                {{ $t("pim.feature_set") }}: <strong>{{ product.feature_set_idx }}</strong>
              </span>
              <span v-if="product.ean" class="meta-item">EAN: <strong>{{ product.ean }}</strong></span>
            </div>
            <StatusBadge
              v-if="pimChannel.isDefaultChannel && product.inheriting_channels_count"
              tone="accent"
              :dot="false"
              :label="$t('pim.channels_inherit', { count: product.inheriting_channels_count })"
            />
            <div class="form-grid">
              <FormField :label="$t('pim.visibility')">
                <BasicSelect :options="visibilityOptions" v-model="form.visibility" />
              </FormField>
              <FormField :label="$t('pim.feature_set')">
                <BasicSelect
                  :options="featureSetOptions"
                  :model-value="form.feature_set_idx"
                  :placeholder="$t('pim.select_feature_set')"
                  :disabled="!featureSetOptions.length"
                  @update:model-value="onFeatureSetSelect"
                />
              </FormField>
              <ProductT9nField
                v-for="field in T9N_TABS.info"
                :key="field"
                v-model="form[`${field}_t9n`][defaultLang]"
                :label="t9nFieldLabel(field)"
                :language="defaultLang"
                :control="t9nControl(field)"
                :inheritance="t9nInheritance(field)"
                :translatable="secondaryLanguages.length > 0"
                class="form-grid__wide"
                @toggle-override="({ language, override }) => onToggleOverride({ featureIdx: field, language, override })"
                @translate="openTranslations(field)"
              />
            </div>
          </BasicCard>

          <BasicCard :title="$t('pim.physical_properties')" gap class="mb-8">
            <p class="fs-200 t-warning">{{ $t("pim.shared_warning") }}</p>
            <div class="form-grid">
              <FormField label="EAN" :error="formErrors.getFieldError('ean')?.msg || ''">
                <BasicInput v-model="form.ean" format="ean" :maxlength="16" />
              </FormField>
              <FormField :label="$t('pim.weight')">
                <BasicInput v-model="form.weight" />
              </FormField>
              <FormField :label="$t('pim.width')">
                <BasicInput v-model="form.width" />
              </FormField>
              <FormField :label="$t('pim.height')">
                <BasicInput v-model="form.height" />
              </FormField>
              <FormField :label="$t('pim.depth')">
                <BasicInput v-model="form.deep" />
              </FormField>
            </div>
          </BasicCard>
        </div>
      </div>

      <BasicTabs v-model="activeTab" :options="tabs" id-prefix="pim-product" class="mb-8" />

      <div
        role="tabpanel"
        :id="`pim-product-panel-${activeTab}`"
        :aria-labelledby="`pim-product-tab-${activeTab}`"
      >
        <AttributeEditor
          v-if="activeTab === 'attributes'"
          :attributes="product.attributes || []"
          :feature-set-idx="form.feature_set_idx"
          :channel-idx="channelIdx"
          :languages="pimChannel.activeChannelLanguages"
          @update:attributes="onAttributesChange"
        />

        <BasicCard v-if="T9N_TABS[activeTab]" :title="activeTabLabel" gap>
          <div class="form-grid">
            <ProductT9nField
              v-for="field in T9N_TABS[activeTab]"
              :key="field"
              v-model="form[`${field}_t9n`][defaultLang]"
              :label="t9nFieldLabel(field)"
              :language="defaultLang"
              :control="t9nControl(field)"
              :inheritance="t9nInheritance(field)"
              :translatable="secondaryLanguages.length > 0"
              class="form-grid__wide"
              @toggle-override="({ language, override }) => onToggleOverride({ featureIdx: field, language, override })"
              @translate="openTranslations(field)"
            />
            <FormField
              v-if="activeTab === 'seo'"
              :label="$t('pim.og_image_url')"
              :hint="$t('pim.og_image_url_help')"
              class="form-grid__wide"
            >
              <BasicInput v-model="form.og_image" />
            </FormField>
          </div>
        </BasicCard>

        <CategoryAssignment
          v-if="activeTab === 'categories'"
          :categories="product.categories || []"
          :channel-idx="channelIdx"
          @update:category-idxs="onCategoryIdxsChange"
        />

        <ProductFiles v-if="activeTab === 'files'" :channel-idx="channelIdx" :sku="product.sku" />

        <ProductLinks v-if="activeTab === 'links'" :channel-idx="channelIdx" :sku="product.sku" />

        <EmptyState
          v-if="activeTab === 'variants' || activeTab === 'audit_log'"
          icon="empty"
          size="sm"
          :title="$t('pim.coming_soon')"
        />

        <ReadonlyArea v-if="activeTab === 'pricing'" :area="EMBEDDED_AREAS.pricing">
          <PriceDetail
            :sku="product.sku || product.real_product?.sku || ''"
            :channel-idx-prop="channelIdx"
            :embedded="true"
            :configurable="product.product_class_name?.toLowerCase() === 'productconfigurable'"
          />
        </ReadonlyArea>

        <ReadonlyArea v-if="activeTab === 'stock'" :area="EMBEDDED_AREAS.stock">
          <StockTab :sku="product.sku || product.real_product?.sku || ''" :embedded="true" />
        </ReadonlyArea>

        <ReadonlyArea v-if="activeTab === 'supplier' && hasSupplierTab" :area="EMBEDDED_AREAS.supplier">
          <SupplierTab :sku="product.sku || product.real_product?.sku || ''" @refreshed="onSupplierRefreshed" />
        </ReadonlyArea>

        <QualityTab
          v-if="activeTab === 'quality' && hasQualityData"
          :key="`${channelIdx}:${product.pk}`"
          :product-pk="product.pk"
          :channel-idx="channelIdx"
          :evaluated-at="product.gap_evaluated_at"
        />
      </div>
    </template>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteProduct"
      @cancel="showDeleteConfirm = false"
      :title="$t('pim.confirm_delete_title')"
    >
      <template #default
        ><p>{{ $t("pim.confirm_delete_product") }}</p></template
      >
    </ConfirmDialog>

    <ConfirmDialog
      :open="!!pendingInheritanceFlag"
      @confirm="confirmInheritanceFlag"
      @cancel="pendingInheritanceFlag = null"
      :title="$t('pim.confirm_inheritance_title')"
    >
      <template #default
        ><p>{{ $t("pim.confirm_inheritance_warning") }}</p></template
      >
    </ConfirmDialog>

    <ConfirmDialog
      :open="!!pendingFeatureSetIdx"
      @confirm="confirmFeatureSetChange"
      @cancel="pendingFeatureSetIdx = null"
      :title="$t('pim.confirm_change_feature_set_title')"
    >
      <template #default
        ><p>{{ $t("pim.confirm_change_feature_set_warning") }}</p></template
      >
    </ConfirmDialog>

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

    <CopyTranslationsDialog
      :visible="showCopyDialog"
      :channel-idx="channelIdx"
      :sku="product.sku || ''"
      @close="showCopyDialog = false"
      @copied="fetchProduct"
    />

    <AddToChannelDialog
      :visible="showAddToChannelDialog"
      :channel-idx="channelIdx"
      :sku="product.sku || ''"
      :present-in-channels="product.present_in_channels || []"
      @close="showAddToChannelDialog = false"
      @added="onAddedToChannel"
    />

    <ReadonlyArea v-if="aiEnabled" :area="EMBEDDED_AREAS.ai">
      <RunAiTaskDialog
        :open="aiDialogOpen"
        :workers="aiWorkers"
        :templates="aiTemplates"
        :initial-template="aiTemplate"
        :initial-picture="aiPicture"
        :skus="product.sku ? [product.sku] : []"
        background
        @created="(task) => $refs.aiResults?.track(task)"
        @template-saved="reloadAiTemplates"
        @close="aiDialogOpen = false"
      />
    </ReadonlyArea>

    <!-- Translations drawer -->
    <TranslationsDrawer
      :visible="!!translatingField"
      :title="translatingFieldLabel"
      :languages="pimChannel.activeChannelLanguages"
      :default-language="defaultLang"
      :values="translatingField ? form[translatingFieldFormKey] : {}"
      @cancel="translatingField = null"
      @save="onTranslationsSave"
    >
      <template #input="{ lang, modelValue, onUpdate }">
        <InheritanceField
          v-if="!pimChannel.isDefaultChannel"
          :inherited="!!translatingFieldInheritFlag"
          :language="lang"
          :overridden-langs="overriddenLangsMap[translatingField] || []"
          :inherited-value="''"
          @toggle-override="
            ({ language, override }) =>
              onToggleOverride({
                featureIdx: translatingField,
                language,
                override,
              })
          "
        >
          <template #default="{ readonly }">
            <BasicWysiwyg
              v-if="translatingFieldIsWysiwyg"
              variant="lite"
              :model-value="modelValue"
              @update:model-value="onUpdate"
              :disabled="readonly"
            />
            <BasicTextarea
              v-else-if="translatingFieldIsTextArea"
              :model-value="modelValue"
              @update:model-value="onUpdate"
              rows="3"
              :disabled="readonly"
            />
            <BasicInput
              v-else
              :model-value="modelValue"
              @update:model-value="onUpdate"
              :disabled="readonly"
            />
          </template>
        </InheritanceField>
        <template v-else>
          <BasicWysiwyg
            v-if="translatingFieldIsWysiwyg"
            variant="lite"
            :model-value="modelValue"
            @update:model-value="onUpdate"
          />
          <BasicTextarea
            v-else-if="translatingFieldIsTextArea"
            :model-value="modelValue"
            @update:model-value="onUpdate"
            rows="3"
          />
          <BasicInput
            v-else
            :model-value="modelValue"
            @update:model-value="onUpdate"
          />
        </template>
      </template>
    </TranslationsDrawer>
  </PageLayout>
</template>

<script>
import { computed, defineAsyncComponent } from "vue";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useMuninStore } from "@/stores/munin";
import { useAccessStore } from "@/stores/access";
import { AREAS } from "@/configs/areas";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { ReadonlyArea } from "@/composables/useReadonly";
import MediaGallery from "./components/MediaGallery.vue";
import AttributeEditor from "./components/AttributeEditor.vue";
import CategoryAssignment from "./components/CategoryAssignment.vue";
import InheritanceField from "./components/InheritanceField.vue";
import ProductFiles from "./components/ProductFiles.vue";
import CopyTranslationsDialog from "./components/CopyTranslationsDialog.vue";
import AddToChannelDialog from "./components/AddToChannelDialog.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import ProductT9nField from "./components/ProductT9nField.vue";
import { useAiWorkers } from "./components/enrichment/useAiWorkers";
import {
  GET_Product,
  PATCH_Product,
  DELETE_Product,
  POST_ToggleOverride,
  GET_FeatureSetsGlobal,
} from "@/api/pim/api";
import { GET_BulkHasChanges } from "@/api/atlas/api";
import { hasQualityFields } from "./quality";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import { isNotFound } from "@/api/createClient";

// Translatable system fields per place: the info card and the text tabs (T9N_TABS[activeTab]).
const T9N_TABS = {
  info: ["name"],
  descriptions: ["short_description", "description"],
  product_tile: ["subname", "subname2"],
  seo: ["url_key", "meta_title", "meta_description", "canonical_url"],
};
const DESCRIPTION_FIELDS = ["name", "description", "short_description"];
const INHERIT_FLAGS = ["inherit_attributes", "inherit_descriptions", "inherit_images"];
// The "more" menu items that open a dialog, by key (the inheritance flags toggle instead).
const MORE_DIALOGS = { channels: "showAddToChannelDialog", copy: "showCopyDialog" };
const WYSIWYG = { is: "BasicWysiwyg", attrs: { variant: "lite" } };
const TEXTAREA = { is: "BasicTextarea", attrs: { rows: 3 } };
const INPUT = { is: "BasicInput", attrs: {} };
// Enrichment target kinds the media gallery shows (an applied one reloads the gallery, not the form).
const MEDIA_KINDS = ["picture", "video"];
// The tabs that embed another panel's screen work on that panel's area: shown only when it is readable, read-only by
// it alone (not by the product's `pim.products`).
// The AI drawer and run dialog (`ai`) likewise: by the enrichment proposals, so a reviewer without write sees no Run/Apply.
const EMBEDDED_AREAS = {
  pricing: AREAS.PRICEMANAGER_PRICES,
  stock: AREAS.QMS_STOCK,
  supplier: AREAS.ATLAS_PRODUCTS,
  ai: AREAS.ENRICHMENT_PROPOSALS,
};

export default {
  name: "ProductDetail",
  components: {
    ReadonlyArea,
    PimChannelSelect,
    ProductT9nField,
    MediaGallery,
    AttributeEditor,
    CategoryAssignment,
    InheritanceField,
    ProductFiles,
    CopyTranslationsDialog,
    AddToChannelDialog,
    PriceDetail: defineAsyncComponent(() => import("@/views/PriceManager/PriceDetail.vue")),
    StockTab: defineAsyncComponent(() => import("@/views/Stock/StockTab.vue")),
    SupplierTab: defineAsyncComponent(() => import("./components/SupplierTab.vue")),
    QualityTab: defineAsyncComponent(() => import("./components/QualityTab.vue")),
    RunAiTaskDialog: defineAsyncComponent(() => import("./components/enrichment/RunAiTaskDialog.vue")),
    ProductAiResults: defineAsyncComponent(() => import("./components/enrichment/ProductAiResults.vue")),
    ProductLinks: defineAsyncComponent(() => import("./components/ProductLinks.vue")),
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  // Another product replaces this one (the panel remounts its view on a new SKU): unsaved edits ask first, as when
  // leaving; a hash or query change (a tab, the AI drawer) stays on the page.
  beforeRouteUpdate(to, from, next) {
    if (to.params.sku === from.params.sku) return next();
    this.guardNavigation(to, from, next);
  },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const munin = useMuninStore();
    const unsaved = useUnsavedChanges();
    const {
      workers: aiWorkers,
      templates: aiTemplates,
      allTemplates: aiAllTemplates,
      enabled: aiEnabled,
      writable: aiWritable,
      usable: aiUsable,
      reloadTemplates: reloadAiTemplates,
    } = useAiWorkers();
    const formErrors = useFormErrors();
    const access = useAccessStore();
    // Deleting a SKU is its own permission (access plan 09b): an Editor edits but does not delete. UX only.
    const canDeleteProduct = computed(() => access.can(AREAS.PIM_PRODUCT_DELETE, "write"));
    const canReadTab = (tab) => access.can(EMBEDDED_AREAS[tab]);
    return { loader, notify, pimChannel, munin, formErrors, aiWorkers, aiTemplates, aiAllTemplates, aiEnabled, aiWritable, aiUsable, reloadAiTemplates, canDeleteProduct, canReadTab, ...unsaved, T9N_TABS, EMBEDDED_AREAS };
  },
  data() {
    return {
      product: {},
      loading: true,
      showDeleteConfirm: false,
      pendingInheritanceFlag: null,
      activeTab: "attributes",
      changedAttributes: null,
      changedCategoryIdxs: null,
      showCopyDialog: false,
      showAddToChannelDialog: false,
      aiDialogOpen: false,
      aiTemplate: "",
      aiPicture: "",
      mediaKey: 0,
      translatingField: null,
      overriddenLangsMap: {},
      featureSetOptions: [],
      pendingFeatureSetIdx: null,
      form: {
        visibility: null,
        is_enabled: true,
        feature_set_idx: null,
        ean: "",
        weight: "",
        width: "",
        height: "",
        deep: "",
        name_t9n: {},
        description_t9n: {},
        short_description_t9n: {},
        url_key_t9n: {},
        meta_title_t9n: {},
        meta_description_t9n: {},
        canonical_url_t9n: {},
        og_image: "",
        subname_t9n: {},
        subname2_t9n: {},
      },
      visibilityOptions: [
        { label: "Not visible individually", value: 1 },
        { label: "Catalog", value: 2 },
        { label: "Search", value: 3 },
        { label: "Catalog & Search", value: 4 },
      ],
      supplierStatus: null,
      _suppressHashSync: false,
      channelMismatchWarning: false,
    };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    tabs() {
      const tabs = [
        { value: "attributes", label: this.$t("pim.tab_attributes") },
        { value: "descriptions", label: this.$t("pim.tab_descriptions") },
        { value: "product_tile", label: this.$t("pim.tab_product_tile") },
        { value: "seo", label: "SEO" },
        { value: "categories", label: this.$t("pim.categories") },
        { value: "files", label: this.$t("pim.tab_files") },
        { value: "links", label: this.$t("pim.tab_links") },
        { value: "variants", label: this.$t("pim.tab_variants") },
        { value: "audit_log", label: this.$t("pim.tab_audit_log") },
      ];
      if (this.munin.isPanelEnabled("pricing") && this.canReadTab("pricing")) {
        tabs.push({ value: "pricing", label: this.$t("pm.tab_pricing") });
      }
      if (this.munin.isPanelEnabled("stock") && this.canReadTab("stock")) {
        tabs.push({ value: "stock", label: this.$t("stock.tab_stock") });
      }
      if (this.hasSupplierTab) {
        tabs.push({ value: "supplier", label: this.$t("pim.tab_supplier") });
      }
      if (this.hasQualityData) {
        tabs.push({ value: "quality", label: this.$t("pim.quality_tab") });
      }
      return tabs;
    },
    activeTabLabel() {
      return this.tabs.find((t) => t.value === this.activeTab)?.label || "";
    },
    // Secondary actions and the channel inheritance flags (B-29: Save keeps its label, the rest sits in "more").
    // The image templates as a gallery tile's AI menu: one action on that very picture.
    aiPictureActions() {
      if (!this.aiWritable || !this.aiUsable) return [];
      const imageWorkers = new Set(this.aiWorkers.filter((worker) => worker.kind === "image").map((worker) => worker.key));
      return this.aiTemplates
        .filter((template) => imageWorkers.has(template.worker_key))
        .map((template) => ({ key: template.key, label: template.label, testid: `media-ai-${template.key}` }));
    },
    moreMenuItems() {
      const isChild = !this.pimChannel.isDefaultChannel;
      const items = [
        { key: "channels", label: this.$t("pim.channels"), icon: "channels" },
        isChild && { key: "copy", label: this.$t("pim.copy_translations"), icon: "duplicate" },
      ];
      if (isChild && this.pimChannel.activeChannelInheritanceEnabled) {
        items.push(
          { key: "inheritance-separator", separator: true },
          { key: "inheritance-heading", heading: true, label: this.$t("pim.inheritance") },
          ...INHERIT_FLAGS.map((flag) => ({
            key: flag,
            label: this.$t(`pim.${flag}`),
            checked: !!this.product[flag],
          }))
        );
      }
      return items.filter(Boolean);
    },
    hasSupplierTab() {
      return (
        this.munin.isPanelEnabled("atlas") &&
        this.canReadTab("supplier") &&
        this.supplierStatus?.has_source === true
      );
    },
    hasQualityData() {
      // Soft-compat gate: detail response carries gap_* only when the backend supports it.
      return hasQualityFields(this.product);
    },
    productClassLabel() {
      // etap-12 #24: ProductBase rows previously fell through to "Custom" via missing key.
      const name = this.product.product_class_name;
      const map = {
        productbase: this.$t("pim.type_base"),
        productsimple: this.$t("pim.type_simple"),
        productconfigurable: this.$t("pim.type_configurable"),
        productbundle: this.$t("pim.type_bundle"),
      };
      return map[name?.toLowerCase()] || this.$t("pim.type_custom");
    },
    productClassColor() {
      const name = this.product.product_class_name;
      const map = {
        productbase: "t-body",
        productsimple: "t-accent",
        productconfigurable: "t-accent",
        productbundle: "t-warning",
      };
      return map[name?.toLowerCase()] || "t-body";
    },
    defaultNameT9n() {
      return this.product.default_channel_name_t9n || {};
    },
    defaultDescriptionT9n() {
      return this.product.default_channel_description_t9n || {};
    },
    defaultLang() {
      return (
        this.pimChannel.activeChannel?.default_language ||
        this.pimChannel.activeChannelLanguages[0] ||
        "en"
      );
    },
    secondaryLanguages() {
      return this.pimChannel.activeChannelLanguages.filter(
        (l) => l !== this.defaultLang
      );
    },
    translatingFieldFormKey() {
      if (!this.translatingField) return null;
      return `${this.translatingField}_t9n`;
    },
    translatingFieldLabel() {
      return this.t9nFieldLabel(this.translatingField);
    },
    translatingFieldIsWysiwyg() {
      return this.t9nControl(this.translatingField) === WYSIWYG;
    },
    translatingFieldIsTextArea() {
      return this.t9nControl(this.translatingField) === TEXTAREA;
    },
    translatingFieldInheritFlag() {
      return this.t9nInheritFlag(this.translatingField);
    },
  },
  watch: {
    "pimChannel.activeChannelIdx"() {
      this.fetchProduct();
    },
    "$route.hash"(newHash) {
      this.applyHashToTab(newHash);
    },
    activeTab(newTab) {
      this.syncTabToHash(newTab);
    },
    hasSupplierTab(enabled) {
      // Supplier tab appears asynchronously after fetchSupplierStatus(). If the user
      // landed on the page with #supplier hash, applyHashToTab() in mounted() found
      // no matching tab and bailed. Reapply once the tab becomes available.
      if (enabled) this.applyHashToTab(this.$route.hash);
    },
    hasQualityData(enabled) {
      // Quality tab appears once fetchProduct() resolves (gap_* fields present).
      // Re-apply a #quality deep-link that mounted() couldn't match yet.
      if (enabled) this.applyHashToTab(this.$route.hash);
    },
  },
  mounted() {
    this.fetchProduct();
    this.fetchFeatureSets();
    this.fetchSupplierStatus();
    this.applyHashToTab(this.$route.hash);
  },
  methods: {
    t9nFieldLabel(field) {
      return this.$t(`pim.${field}`);
    },
    t9nControl(field) {
      if (["description", "short_description"].includes(field)) return WYSIWYG;
      if (field === "meta_description") return TEXTAREA;
      return INPUT;
    },
    t9nInheritFlag(field) {
      return DESCRIPTION_FIELDS.includes(field)
        ? this.product.inherit_descriptions
        : this.product.inherit_attributes;
    },
    // The inheritance state of a field on a non-default channel; null on the default channel (no inheritance).
    t9nInheritance(field) {
      if (this.pimChannel.isDefaultChannel) return null;
      const inheritedValues = { name: this.defaultNameT9n, description: this.defaultDescriptionT9n };
      return {
        inherited: !!this.t9nInheritFlag(field),
        overriddenLangs: this.overriddenLangsMap[field] || [],
        inheritedValue: inheritedValues[field]?.[this.defaultLang] || "",
      };
    },
    openAiTask(templateKey) {
      this.aiTemplate = templateKey;
      this.aiPicture = "";
      this.aiDialogOpen = true;
    },
    openAiOnPicture({ template, pictureRef }) {
      this.aiTemplate = template;
      this.aiPicture = pictureRef;
      this.aiDialogOpen = true;
    },
    // An AI proposal was written to PIM: show it without losing unsaved edits. A clean form reloads; a dirty one
    // takes only the written field and language, unless the operator edited that very value (then it warns).
    async onAiApplied(proposal) {
      const loc = proposal.target_locator || {};
      if (loc.channel && loc.channel !== this.channelIdx) return;
      if (MEDIA_KINDS.includes(proposal.target_kind)) {
        this.mediaKey += 1;
        return;
      }
      try {
        const { data } = await GET_Product(this.channelIdx, this.product.sku);
        if (!this.isDirty) {
          this.product = data;
          return this.resetForm();
        }
        this.mergeAppliedField(data, `${loc.feature_idx}_t9n`, loc.language);
      } catch {
        this.notify.spawnNotification({ type: "informative", msg: this.$t("enrichment.ai.applied_reload") });
      }
    },
    mergeAppliedField(fresh, key, lang) {
      if (!(key in this.form) || !lang) {
        this.notify.spawnNotification({ type: "informative", msg: this.$t("enrichment.ai.applied_reload") });
        return;
      }
      const value = fresh[key]?.[lang] || "";
      const original = this.formFromProduct();
      const untouched = this.form[key][lang] === original[key][lang];
      original[key][lang] = value;
      this.product = { ...this.product, [key]: { ...this.product[key], [lang]: value } };
      if (untouched) this.form[key][lang] = value;
      else this.notify.spawnNotification({ type: "warning", msg: this.$t("enrichment.ai.applied_conflict") });
      this.snapshot(original);
      // The snapshot covers the form only: unsaved attribute or category edits keep the page dirty.
      if (this.changedAttributes || this.changedCategoryIdxs) this.$nextTick(() => (this.isDirty = true));
    },
    onMoreSelect({ key }) {
      if (INHERIT_FLAGS.includes(key)) {
        this.toggleInheritanceFlag(key);
        return;
      }
      const dialog = MORE_DIALOGS[key];
      if (dialog) this[dialog] = true;
    },
    openTranslations(fieldName) {
      this.translatingField = fieldName;
    },
    onTranslationsSave({ values }) {
      this.form[this.translatingFieldFormKey] = values;
      this.translatingField = null;
    },
    async fetchProduct() {
      this.loading = true;
      try {
        const { data } = await GET_Product(
          this.channelIdx,
          this.$route.params.sku
        );
        this.product = data;
        this.channelMismatchWarning = false;
        this.resetForm();
      } catch (err) {
        // etap-12 #25: product missing in selected channel → switch to default + warn.
        if (
          isNotFound(err) &&
          this.pimChannel.defaultChannelIdx &&
          this.channelIdx !== this.pimChannel.defaultChannelIdx
        ) {
          this.channelMismatchWarning = true;
          this.pimChannel.setActiveChannel(this.pimChannel.defaultChannelIdx);
          // pimChannel watcher will re-trigger fetchProduct().
          return;
        }
        const msg = extractApiMessage(err, this.$t("notifications.error"));
        this.notify.spawnNotification({ type: "negative", msg });
      } finally {
        this.loading = false;
      }
    },
    onFeatureSetSelect(val) {
      if (val === this.form.feature_set_idx) return;
      this.pendingFeatureSetIdx = val;
    },
    confirmFeatureSetChange() {
      this.form.feature_set_idx = this.pendingFeatureSetIdx;
      this.pendingFeatureSetIdx = null;
    },
    async fetchFeatureSets() {
      try {
        const { data } = await GET_FeatureSetsGlobal({ page_size: 100 });
        const results = data.results || data || [];
        this.featureSetOptions = results.map((fs) => ({
          label: fs.name || fs.idx,
          value: fs.idx,
        }));
      } catch {
        this.featureSetOptions = [];
      }
    },
    resetForm() {
      this.changedAttributes = null;
      this.changedCategoryIdxs = null;
      this.translatingField = null;
      const map = {};
      for (const attr of this.product.attributes || []) {
        if (attr.overridden_langs)
          map[attr.feature_idx] = [...attr.overridden_langs];
      }
      this.overriddenLangsMap = map;
      this.form = this.formFromProduct();
      this.snapshot(this.form);
      this.track(this.form);
    },
    // The editable form of `this.product`: its plain fields and every t9n field filled for each channel language.
    formFromProduct() {
      const t9nKeys = [
        "name_t9n",
        "description_t9n",
        "short_description_t9n",
        "url_key_t9n",
        "meta_title_t9n",
        "meta_description_t9n",
        "canonical_url_t9n",
        "subname_t9n",
        "subname2_t9n",
      ];
      const t9nData = {};
      for (const key of t9nKeys) {
        const src = { ...(this.product[key] || {}) };
        for (const lang of this.pimChannel.activeChannelLanguages) {
          if (!(lang in src)) src[lang] = "";
        }
        t9nData[key] = src;
      }
      return {
        visibility: this.product.visibility,
        is_enabled: this.product.is_enabled,
        feature_set_idx: this.product.feature_set_idx || null,
        ean: this.product.ean || "",
        weight: this.product.weight || "",
        width: this.product.width || "",
        height: this.product.height || "",
        deep: this.product.deep || "",
        og_image: this.product.og_image || "",
        ...t9nData,
      };
    },
    async toggleInheritanceFlag(flag) {
      const newVal = !this.product[flag];
      if (newVal) {
        this.pendingInheritanceFlag = flag;
        return;
      }
      await this._applyInheritanceFlag(flag, newVal);
    },
    async confirmInheritanceFlag() {
      const flag = this.pendingInheritanceFlag;
      this.pendingInheritanceFlag = null;
      if (flag) {
        await this._applyInheritanceFlag(flag, true);
      }
    },
    async _applyInheritanceFlag(flag, newVal) {
      try {
        await PATCH_Product(this.channelIdx, this.product.sku, {
          [flag]: newVal,
        });
        this.product[flag] = newVal;
        await this.fetchProduct();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async onToggleOverride({ featureIdx, language, override }) {
      try {
        await POST_ToggleOverride(this.channelIdx, this.product.sku, {
          feature_idx: featureIdx,
          language,
          override,
        });
        const langs = [...(this.overriddenLangsMap[featureIdx] || [])];
        if (override) {
          if (!langs.includes(language)) langs.push(language);
        } else {
          const idx = langs.indexOf(language);
          if (idx !== -1) langs.splice(idx, 1);
        }
        this.overriddenLangsMap = {
          ...this.overriddenLangsMap,
          [featureIdx]: langs,
        };
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    onAddedToChannel(targetChannelIdx) {
      this.pimChannel.setActiveChannel(targetChannelIdx);
    },
    onAttributesChange(attrs) {
      this.changedAttributes = attrs;
      this.isDirty = true;
    },
    onCategoryIdxsChange(idxs) {
      this.changedCategoryIdxs = idxs;
      this.isDirty = true;
    },
    async saveProduct() {
      // Only an EAN typed here is checked: a stored one the operator did not touch never blocks other edits.
      const eanChanged = this.form.ean !== (this.product.ean || "");
      if (eanChanged && !this.formErrors.validateFormats(this.form, { ean: { format: "ean" } })) return;
      this.loader.loaderStart();
      try {
        const payload = {};
        if (this.form.visibility !== this.product.visibility)
          payload.visibility = this.form.visibility;
        if (this.form.is_enabled !== this.product.is_enabled)
          payload.is_enabled = this.form.is_enabled;
        if (this.form.ean !== (this.product.ean || ""))
          payload.ean = this.form.ean || null;
        if (this.form.weight !== (this.product.weight || ""))
          payload.weight = this.form.weight || null;
        if (this.form.width !== (this.product.width || ""))
          payload.width = this.form.width || null;
        if (this.form.height !== (this.product.height || ""))
          payload.height = this.form.height || null;
        if (this.form.deep !== (this.product.deep || ""))
          payload.deep = this.form.deep || null;
        if (
          this.form.feature_set_idx !== (this.product.feature_set_idx || null)
        )
          payload.feature_set_idx = this.form.feature_set_idx;

        // System features — send via attributes array
        const t9nAttrs = [];
        const systemT9nFields = [
          { formKey: "name_t9n", featureIdx: "name" },
          { formKey: "description_t9n", featureIdx: "description" },
          { formKey: "short_description_t9n", featureIdx: "short_description" },
          { formKey: "url_key_t9n", featureIdx: "url_key" },
          { formKey: "meta_title_t9n", featureIdx: "meta_title" },
          { formKey: "meta_description_t9n", featureIdx: "meta_description" },
          { formKey: "canonical_url_t9n", featureIdx: "canonical_url" },
          { formKey: "subname_t9n", featureIdx: "subname" },
          { formKey: "subname2_t9n", featureIdx: "subname2" },
        ];
        for (const { formKey, featureIdx } of systemT9nFields) {
          const orig = this.product[formKey] || {};
          for (const lang of Object.keys(this.form[formKey])) {
            if (this.form[formKey][lang] !== (orig[lang] || "")) {
              t9nAttrs.push({
                feature_idx: featureIdx,
                value_txt_t9n: this.form[formKey],
              });
              break;
            }
          }
        }

        // og_image — plain VARCHAR255 system feature
        if (this.form.og_image !== (this.product.og_image || "")) {
          t9nAttrs.push({ feature_idx: "og_image", value_txt: this.form.og_image });
        }

        if (this.changedAttributes || t9nAttrs.length) {
          payload.attributes = [...(this.changedAttributes || []), ...t9nAttrs];
        }

        if (this.changedCategoryIdxs) {
          payload.category_idxs = this.changedCategoryIdxs;
        }

        if (Object.keys(payload).length === 0) {
          this.notify.spawnNotification({
            type: "informative",
            msg: this.$t("pim.no_changes_detected"),
          });
          this.loader.loaderFinish();
          return;
        }

        await PATCH_Product(this.channelIdx, this.product.sku, payload);
        const changedKeys = Object.keys(payload);
        const fieldLabels = changedKeys.map((k) => {
          const map = {
            visibility: this.$t("pim.visibility"),
            is_enabled: this.$t("pim.enabled"),
            ean: "EAN",
            weight: this.$t("pim.weight"),
            width: this.$t("pim.width"),
            height: this.$t("pim.height"),
            deep: this.$t("pim.depth"),
            attributes: this.$t("pim.tab_attributes"),
            category_idxs: this.$t("pim.categories"),
            feature_set_idx: this.$t("pim.feature_set"),
          };
          return map[k] || k;
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: `${this.$t("pim.product_saved")}: ${fieldLabels.join(", ")}`,
        });
        await this.fetchProduct();
      } catch (err) {
        const errData = err?.response?.data || err;
        let msg = this.$t("notifications.save_error");
        if (errData?.message) {
          msg = errData.message;
          if (errData.details?.length) {
            const fieldErrors = errData.details
              .map((d) =>
                d.field ? `${d.field}: ${d.description}` : d.description
              )
              .join(", ");
            msg += ` (${fieldErrors})`;
          }
        } else if (errData?.detail) {
          msg = errData.detail;
        }
        this.notify.spawnNotification({ type: "negative", msg });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async saveAndLeave() {
      await this.saveProduct();
      this.confirmLeave();
    },
    async deleteProduct() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Product(this.channelIdx, this.product.sku);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.deleted"),
        });
        this.confirmLeave();
        this.$router.push("/pim/products");
      } catch (err) {
        const msg = extractApiMessage(err, this.$t("notifications.error"));
        this.notify.spawnNotification({ type: "negative", msg });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async fetchSupplierStatus() {
      if (!this.munin.isPanelEnabled("atlas") || !this.canReadTab("supplier")) {
        this.supplierStatus = null;
        return;
      }
      const sku = this.$route.params.sku;
      if (!sku) return;
      try {
        const { data } = await GET_BulkHasChanges([sku]);
        this.supplierStatus = data?.skus?.[sku] || null;
      } catch {
        this.supplierStatus = null;
      }
    },
    onSupplierRefreshed() {
      this.fetchSupplierStatus();
    },
    applyHashToTab(rawHash) {
      const hash = (rawHash || "").replace(/^#/, "");
      if (!hash) return;
      const match = this.tabs.find((t) => t.value === hash);
      if (match && this.activeTab !== hash) {
        this._suppressHashSync = true;
        this.activeTab = hash;
        this.$nextTick(() => {
          this._suppressHashSync = false;
        });
      }
    },
    syncTabToHash(tabValue) {
      if (this._suppressHashSync) return;
      const currentHash = (this.$route.hash || "").replace(/^#/, "");
      if (currentHash === tabValue) return;
      this.$router.replace({
        path: this.$route.path,
        query: this.$route.query,
        hash: `#${tabValue}`,
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.product-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: var(--space-10);

  @include max-desktop {
    grid-template-columns: 1fr;
  }
}

.product-layout__media,
.product-layout__content {
  min-width: 0;
}

.meta-item {
  font-size: var(--fs-200);
  color: var(--text-muted);

  strong {
    font-weight: 600;
    color: var(--text-body);
  }
}
</style>
