<template>
  <div class="product-links p-8 ovy-auto h-100">
    <div class="flex ai-ct jc-sb mb-8 flex-wrap gap-5">
      <h2 class="fs-400 fw-600">{{ $t("pim.tab_links") }}</h2>
      <BasicButton data-testid="linked-create-btn" @click="openCreate">
        {{ $t("pim.links.create_button") }}
      </BasicButton>
    </div>

    <div class="flex ai-ct gap-5 mb-5 flex-wrap">
      <ReadonlyOff>
        <SegmentedControl
          v-model="activeLinkType"
          :options="filterOptions"
        />
      </ReadonlyOff>
    </div>

    <p
      class="t-muted fs-200 mb-5"
      data-testid="linked-sync-notice"
    >
      <FontAwesomeIcon :icon="$icons.info" />
      {{ $t("pim.links.sync_notice") }}
    </p>

    <Loader block v-show="loading" />

    <div v-show="!loading" class="links-table" role="table">
      <div class="links-table__row links-table__row--header" role="row">
        <span></span>
        <span>{{ $t("pim.links.col_type") }}</span>
        <span>{{ $t("pim.links.col_linked_sku") }}</span>
        <span>{{ $t("pim.links.col_linked_name") }}</span>
        <span>{{ $t("pim.links.col_position") }}</span>
        <span></span>
      </div>

      <draggable
        v-model="links"
        item-key="pk"
        :disabled="readonly || !activeLinkType || reordering"
        handle=".links-table__handle"
        ghost-class="links-table__row--ghost"
        @end="onDragEnd"
      >
        <template #item="{ element: row }">
          <div
            class="links-table__row"
            :class="{ 'links-table__row--draggable': activeLinkType && !reordering }"
            data-testid="linked-row"
            role="row"
          >
            <span
              class="links-table__handle"
              data-testid="linked-handle"
              :class="{ 'links-table__handle--disabled': !activeLinkType }"
              :title="!activeLinkType ? $t('pim.links.drag_disabled_hint') : ''"
            >
              <FontAwesomeIcon :icon="$icons.drag" />
            </span>
            <span>
              <StatusBadge
                :label="typeLabel(row.link_type_idx, row.link_type_name)"
                tone="neutral"
              />
            </span>
            <span>{{ row.linked_product?.sku }}</span>
            <span class="lc-1">{{ row.linked_product?.name }}</span>
            <span>{{ row.position }}</span>
            <span class="flex ai-ct gap-2" @click.stop>
              <IconButton
                icon="edit"
                size="sm"
                :label="$t('common.edit')"
                :data-testid="`linked-edit-${row.pk}`"
                @click="openEdit(row)"
              />
              <IconButton
                icon="delete"
                size="sm"
                variant="danger"
                :label="$t('common.delete')"
                :data-testid="`linked-delete-${row.pk}`"
                @click="confirmDelete(row)"
              />
            </span>
          </div>
        </template>
      </draggable>

      <p v-if="!links.length" class="t-muted fs-200 p-8 ta-ct">
        {{ $t("pim.links.empty") }}
      </p>
    </div>

    <SideDrawer
      :visible="formVisible"
      :title="editing ? $t('common.edit') : $t('pim.links.create_button')"
      width="420px"
      @close="closeForm"
    >
      <form class="flex flex-column gap-5" @submit.prevent="submitForm">
        <FormField
          :label="$t('pim.links.linked_sku_label')"
          required
          :error="errors.linked_product_sku?.msg || ''"
          data-testid="linked-form-sku"
        >
          <EntitySearchPicker
            :modelValue="formData.linked_product_sku"
            :displayValue="formData.linked_product_display"
            :fetchFn="productFetch"
            :placeholder="$t('pim.links.linked_sku_placeholder')"
            :disabled="!!editing"
            @update:modelValue="formData.linked_product_sku = $event"
            @update:displayValue="formData.linked_product_display = $event"
            @clear="formData.linked_product_sku = ''; formData.linked_product_display = ''"
          />
        </FormField>

        <FormField
          :label="$t('pim.links.type_label')"
          required
          :error="errors.link_type_idx?.msg || ''"
        >
          <div data-testid="linked-form-type">
            <BasicSelect
              :options="typeDropdownValues"
              v-model="formData.link_type_idx"
              :placeholder="$t('pim.links.type_placeholder')"
              :disabled="!!editing"
            />
          </div>
        </FormField>

        <FormField :label="$t('pim.links.position_label')">
          <NumberInput
            v-model="formData.position"
            :min="0"
            :max="9999"
            data-testid="linked-form-position"
          />
        </FormField>

        <div class="flex ai-ct jc-end gap-5 mt-8">
          <BasicButton data-testid="linked-form-cancel" @click="closeForm">
            {{ $t("common.cancel") }}
          </BasicButton>
          <BasicButton
            type="submit"
            variant="primary"
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
      :title="$t('pim.links.delete_title')"
    >
      <template #default>
        <p>{{ $t("pim.links.delete_body") }}</p>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";
import draggable from "vuedraggable";
import { ReadonlyOff, useReadonly } from "@/composables/useReadonly";
import { t } from "@/i18n";
import { useNotifyStore } from "@/stores/notify";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { useProductFetch } from "@/composables/useEntityFetch";
import {
  GET_ProductLinks,
  POST_ProductLink,
  PATCH_ProductLink,
  DELETE_ProductLink,
  GET_LinkTypes,
} from "@/api/pim/api";

const props = defineProps({
  channelIdx: { type: String, required: true },
  sku: { type: String, required: true },
});

const notify = useNotifyStore();
const readonly = useReadonly();
const { errors, handleApiError, clearErrors, validateRequired } = useFormErrors();

const links = ref([]);
const linkTypes = ref([]);
const loading = ref(false);
const reordering = ref(false);

const activeLinkType = ref("");

const formVisible = ref(false);
const formBusy = ref(false);
const editing = ref(null);
const formData = reactive({
  linked_product_sku: "",
  linked_product_display: "",
  link_type_idx: "",
  position: 0,
});

const deleteVisible = ref(false);
const deleteTarget = ref(null);

const TYPE_LABEL_KEYS = {
  related: "pim.links.type_related",
  crosssell: "pim.links.type_crosssell",
  upsell: "pim.links.type_upsell",
  navigation: "pim.links.type_navigation",
};

function typeLabel(typeIdx, fallbackName) {
  const key = TYPE_LABEL_KEYS[typeIdx];
  return key ? t(key) : (fallbackName || typeIdx);
}

const filterOptions = computed(() => {
  const opts = [{ value: "", label: t("pim.links.all"), testid: "linked-filter-all" }];
  for (const lt of linkTypes.value) {
    opts.push({
      value: lt.idx,
      label: typeLabel(lt.idx, lt.name),
      testid: `linked-filter-${lt.idx}`,
    });
  }
  return opts;
});

const typeDropdownValues = computed(() =>
  linkTypes.value.map((lt) => ({
    label: typeLabel(lt.idx, lt.name),
    value: lt.idx,
  }))
);

const productFetch = (() => {
  const fetcher = useProductFetch(props.channelIdx);
  return async (query) => {
    const items = await fetcher(query);
    return items.filter((i) => i.value !== props.sku);
  };
})();

async function fetchLinkTypes() {
  try {
    const { data } = await GET_LinkTypes({ page_size: 100, ordering: "position" });
    linkTypes.value = data.results || [];
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  }
}

async function fetchLinks() {
  if (!props.channelIdx || !props.sku) return;
  loading.value = true;
  try {
    const params = { ordering: "position", page_size: 100 };
    if (activeLinkType.value) params.link_type = activeLinkType.value;
    const { data } = await GET_ProductLinks(props.channelIdx, props.sku, params);
    links.value = data.results || [];
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  formData.linked_product_sku = "";
  formData.linked_product_display = "";
  formData.link_type_idx = activeLinkType.value || linkTypes.value[0]?.idx || "";
  formData.position = 0;
}

function openCreate() {
  editing.value = null;
  resetForm();
  clearErrors();
  formVisible.value = true;
}

function openEdit(row) {
  editing.value = row;
  formData.linked_product_sku = row.linked_product?.sku || "";
  formData.linked_product_display = row.linked_product?.name || row.linked_product?.sku || "";
  formData.link_type_idx = row.link_type_idx;
  formData.position = row.position;
  clearErrors();
  formVisible.value = true;
}

function closeForm() {
  formVisible.value = false;
  editing.value = null;
}

async function submitForm() {
  if (!editing.value) {
    const ok = validateRequired(formData, {
      linked_product_sku: t("pim.links.linked_sku_label"),
      link_type_idx: t("pim.links.type_label"),
    });
    if (!ok) return;
  }
  formBusy.value = true;
  clearErrors();
  try {
    if (editing.value) {
      await PATCH_ProductLink(props.channelIdx, props.sku, editing.value.pk, {
        position: formData.position,
      });
      notify.spawnNotification({ type: "positive", msg: t("pim.links.toast_updated") });
    } else {
      await POST_ProductLink(props.channelIdx, props.sku, {
        linked_product_sku: formData.linked_product_sku,
        link_type_idx: formData.link_type_idx,
        position: formData.position,
      });
      notify.spawnNotification({ type: "positive", msg: t("pim.links.toast_created") });
    }
    formVisible.value = false;
    editing.value = null;
    await fetchLinks();
  } catch (err) {
    handleApiError(err);
    if (Object.keys(errors).length === 0) {
      notify.spawnNotification({
        type: "negative",
        msg: extractApiMessage(err, t("notifications.error")),
      });
    }
  } finally {
    formBusy.value = false;
  }
}

function confirmDelete(row) {
  deleteTarget.value = row;
  deleteVisible.value = true;
}

async function onDragEnd() {
  if (!activeLinkType.value) return;
  reordering.value = true;
  const updates = [];
  links.value.forEach((link, idx) => {
    const newPos = idx + 1;
    if (link.position !== newPos) {
      updates.push({ pk: link.pk, newPos });
      link.position = newPos;
    }
  });
  if (!updates.length) {
    reordering.value = false;
    return;
  }
  try {
    await Promise.all(
      updates.map(({ pk, newPos }) =>
        PATCH_ProductLink(props.channelIdx, props.sku, pk, { position: newPos })
      )
    );
    notify.spawnNotification({ type: "positive", msg: t("pim.links.toast_reordered") });
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
    await fetchLinks();
  } finally {
    reordering.value = false;
  }
}

async function executeDelete() {
  if (!deleteTarget.value) return;
  try {
    await DELETE_ProductLink(props.channelIdx, props.sku, deleteTarget.value.pk);
    notify.spawnNotification({ type: "positive", msg: t("pim.links.toast_deleted") });
    deleteVisible.value = false;
    deleteTarget.value = null;
    await fetchLinks();
  } catch (err) {
    notify.spawnNotification({
      type: "negative",
      msg: extractApiMessage(err, t("notifications.error")),
    });
  }
}

onMounted(async () => {
  await fetchLinkTypes();
  await fetchLinks();
});

watch(
  () => [props.channelIdx, props.sku, activeLinkType.value],
  () => { fetchLinks(); }
);
</script>

<style lang="scss" scoped>
.product-links {
  display: flex;
  flex-direction: column;
}
.links-table {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  overflow: hidden;
}
.links-table__row {
  display: grid;
  grid-template-columns: 32px 140px 180px 1fr 80px 96px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-base);
}
.links-table__row:last-child {
  border-bottom: none;
}
.links-table__row--header {
  background: var(--surface-raised);
  font-weight: 600;
  font-size: var(--fs-200);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.links-table__row--draggable {
  cursor: grab;
}
.links-table__row--draggable:hover {
  background: var(--surface-raised);
}
.links-table__row--ghost {
  opacity: 0.4;
  background: var(--accent-subtle);
}
.links-table__handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
.links-table__handle--disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
