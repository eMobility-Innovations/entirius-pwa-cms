<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader
        :title="isEdit ? String(item.question || item.url_key || '') : $t('faq.create_item')"
        back="/faq/items"
      >
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch
              :label="$t('faq.is_active')"
              v-model="form.is_active"
            />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else>
        <BasicCard :title="$t('faq.item_details')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              id="faq-item-url-key"
              :label="$t('faq.url_key')"
              required
              hint-level="important"
              :hint="$t('faq.url_key_hint')"
              :error="formErrors.getFieldError('url_key')?.msg || ''"
            >
              <div class="flex ai-st gap-3">
                <BasicInput
                  v-model="form.url_key"
                  :disabled="isEdit"
                  class="flex-1"
                />
                <IconButton
                  v-if="canTranslate"
                  icon="translate"
                  :label="translationsLabel('url_key')"
                  variant="outline"
                  @click="openTranslations('url_key')"
                />
              </div>
            </FormField>
            <FormField :label="$t('faq.group')" :error="formErrors.getFieldError('group_idx')?.msg || ''">
              <BasicSelect
                :options="groupOptions"
                v-model="form.group_idx"
                :placeholder="$t('faq.no_group')"
              />
            </FormField>
          </div>
        </BasicCard>

        <!-- Content fields — each with per-field Translations button -->
        <BasicCard :title="$t('faq.item_content')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              id="faq-item-question"
              :label="$t('faq.question')"
              required
              class="form-grid__wide"
              :error="formErrors.getFieldError('question')?.msg || ''"
            >
              <div class="flex ai-st gap-3">
                <BasicInput
                  v-model="form.question"
                  class="flex-1"
                />
                <IconButton
                  v-if="canTranslate"
                  icon="translate"
                  :label="translationsLabel('question')"
                  variant="outline"
                  @click="openTranslations('question')"
                />
              </div>
            </FormField>

            <FormField
              :label="$t('faq.short_answer')"
              class="form-grid__wide"
              :error="formErrors.getFieldError('short_answer')?.msg || ''"
            >
              <div class="flex ai-st gap-3">
                <BasicInput
                  v-model="form.short_answer"
                  class="flex-1"
                />
                <IconButton
                  v-if="canTranslate"
                  icon="translate"
                  :label="translationsLabel('short_answer')"
                  variant="outline"
                  @click="openTranslations('short_answer')"
                />
              </div>
            </FormField>

            <FormField
              :label="$t('faq.answer')"
              required
              class="form-grid__wide"
              :error="formErrors.getFieldError('answer')?.msg || ''"
            >
              <div class="flex ai-st gap-3">
                <BasicWysiwyg v-model="form.answer" class="flex-1" />
                <IconButton
                  v-if="canTranslate"
                  icon="translate"
                  :label="translationsLabel('answer')"
                  variant="outline"
                  @click="openTranslations('answer')"
                />
              </div>
            </FormField>
          </div>
        </BasicCard>

        <!-- Associations (edit mode only) -->
        <BasicCard v-if="isEdit" :title="$t('faq.associations')" gap class="mb-8">
          <template #actions>
            <BasicButton
              variant="secondary"
              @click="addAssociation"
            >
              {{ $t('faq.add_association') }}
            </BasicButton>
          </template>
          <p v-if="!associations.length" class="fs-200 t-muted">
            {{ $t("faq.no_associations") }}
          </p>
          <div
            v-for="(assoc, idx) in associations"
            :key="idx"
            class="assoc-row flex ai-ct gap-5 mb-5"
          >
            <BasicSelect
              :floating-label="$t('faq.entity_type')"
              :options="entityTypeOptions"
              :model-value="assoc.entity_type"
              class="assoc-type-select"
              @update:model-value="(val) => { assoc.entity_type = val; assoc.entity_identifier = ''; assoc.entity_display = ''; }"
            />
            <EntitySearchPicker
              v-if="assoc.entity_type === 'product'"
              :modelValue="assoc.entity_identifier"
              :displayValue="assoc.entity_display || ''"
              :fetchFn="productFetch"
              :placeholder="$t('layout_extender.search_product')"
              :manual="!pimEnabled"
              class="flex-1"
              @update:modelValue="assoc.entity_identifier = $event"
              @update:displayValue="assoc.entity_display = $event"
              @clear="assoc.entity_identifier = ''; assoc.entity_display = ''"
            />
            <EntitySearchPicker
              v-else-if="assoc.entity_type === 'category'"
              :modelValue="assoc.entity_identifier"
              :displayValue="assoc.entity_display || ''"
              :fetchFn="categoryFetch"
              :placeholder="$t('layout_extender.search_category')"
              :manual="!pimEnabled"
              class="flex-1"
              @update:modelValue="assoc.entity_identifier = $event"
              @update:displayValue="assoc.entity_display = $event"
              @clear="assoc.entity_identifier = ''; assoc.entity_display = ''"
            />
            <EntitySearchPicker
              v-else-if="assoc.entity_type === 'blog-post' || assoc.entity_type === 'page'"
              :modelValue="assoc.entity_identifier"
              :displayValue="assoc.entity_display || ''"
              :fetchFn="pageFetch"
              :placeholder="$t('layout_extender.search_page')"
              :clientFilter="true"
              class="flex-1"
              @update:modelValue="assoc.entity_identifier = $event"
              @update:displayValue="assoc.entity_display = $event"
              @clear="assoc.entity_identifier = ''; assoc.entity_display = ''"
            />
            <BasicInput
              v-else
              v-model="assoc.entity_identifier"
              :placeholder="$t('faq.entity_identifier')"
              :disabled="!assoc.entity_type"
              class="flex-1"
            />
            <IconButton
              icon="close"
              :label="$t('faq.remove_association')"
              variant="danger"
              size="sm"
              @click="removeAssociation(idx)"
            />
          </div>
          <div v-if="associationsDirty" class="flex jc-fe mt-5">
            <BasicButton mutates
              variant="secondary"
              @click="saveAssociations"
            >
              {{ $t('faq.save_associations') }}
            </BasicButton>
          </div>
        </BasicCard>
      </template>

    <!-- Per-field translations drawer -->
    <TranslationsDrawer
      :visible="!!translatingField"
      :title="translatingFieldLabel"
      :languages="channelLanguages"
      :default-language="defaultLang"
      :values="translatingFieldValues"
      @cancel="translatingField = null"
      @save="onTranslationsSave"
    >
      <template v-if="translatingField === 'answer'" #input="{ lang, modelValue, onUpdate }">
        <BasicWysiwyg
          :modelValue="modelValue"
          @update:modelValue="onUpdate"
        />
      </template>
    </TranslationsDrawer>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteItem"
      @cancel="showDeleteConfirm = false"
      :title="$t('faq.confirm_delete_title')"
    >
      <template #default>
        <p>{{ $t("faq.confirm_delete_item") }}</p>
      </template>
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
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { useMuninStore } from "@/stores/munin";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useCategoryFetch, useProductFetch, usePageFetch } from "@/composables/useEntityFetch";
import {
  GET_FaqItem,
  POST_FaqItem,
  PATCH_FaqItem,
  DELETE_FaqItem,
  GET_FaqItemTranslations,
  POST_FaqItemTranslation,
  PATCH_FaqItemTranslation,
  GET_FaqGroups,
  GET_FaqChannels,
} from "@/api/faq/api";

export default {
  name: "FaqItemEdit",
  components: {},
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const unsaved = useUnsavedChanges();
    const formErrors = useFormErrors();
    const muninStore = useMuninStore();
    const pimChannelStore = usePimChannelStore();
    return { loader, notify, ...unsaved, formErrors, muninStore, pimChannelStore };
  },
  data() {
    return {
      item: {},
      groups: [],
      channels: [],
      translations: [],
      associations: [],
      originalAssociations: "[]",
      translatingField: null,
      loading: false,
      showDeleteConfirm: false,
      form: {
        url_key: "",
        question: "",
        answer: "",
        short_answer: "",
        group_idx: null,
        is_active: true,
      },
    };
  },
  computed: {
    channel() {
      return process.env.VUE_APP_CHANNEL;
    },
    isEdit() {
      return !!this.$route.params.id;
    },
    canTranslate() {
      return this.isEdit && this.channelLanguages.length > 0;
    },
    headerActions() {
      return [
        ...(this.isEdit
          ? [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              onClick: () => (this.showDeleteConfirm = true) }]
          : []),
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.saveItem },
      ];
    },
    groupOptions() {
      const opts = [{ label: this.$t("faq.no_group"), value: null }];
      for (const g of this.groups) {
        opts.push({ label: g.name || g.idx, value: g.idx });
      }
      return opts;
    },
    entityTypeOptions() {
      return [
        { label: "Product", value: "product" },
        { label: "Category", value: "category" },
        { label: "Blog Post", value: "blog-post" },
        { label: "Page", value: "page" },
      ];
    },
    pimEnabled() {
      return this.muninStore.isPanelEnabled("pim");
    },
    pimChannelIdx() {
      return this.pimChannelStore.activeChannelIdx || this.channel;
    },
    productFetch() {
      return useProductFetch(this.pimChannelIdx);
    },
    categoryFetch() {
      return useCategoryFetch(this.pimChannelIdx);
    },
    pageFetch() {
      return usePageFetch();
    },
    associationsDirty() {
      return JSON.stringify(this.associations) !== this.originalAssociations;
    },
    channelLanguages() {
      const langs = new Set();
      for (const ch of this.channels) {
        if (ch.language_codes) {
          for (const code of ch.language_codes) langs.add(code);
        }
      }
      return Array.from(langs);
    },
    defaultLang() {
      const ch = this.channels.find((c) => c.idx === this.channel);
      return ch?.default_language || this.channelLanguages[0] || "en";
    },
    translatingFieldLabel() {
      return this.translatingField ? this.$t(`faq.${this.translatingField}`) : "";
    },
    translatingFieldValues() {
      if (!this.translatingField) return {};
      const vals = {};
      for (const t9n of this.translations) {
        vals[t9n.language] = t9n[this.translatingField] || "";
      }
      return vals;
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  async mounted() {
    await Promise.all([this.fetchGroups(), this.fetchChannels()]);
    if (this.isEdit) {
      await this.fetchItem();
      await this.fetchTranslations();
    } else {
      const groupIdx = this.$route.query.group;
      if (groupIdx) this.form.group_idx = groupIdx;
      this.snapshot(this.form);
      this.track(this.form);
    }
  },
  methods: {
    translationsLabel(field) {
      return this.$t("faq.translations_of", { field: this.$t(`faq.${field}`) });
    },
    openTranslations(fieldName) {
      this.translatingField = fieldName;
    },
    async onTranslationsSave({ values }) {
      this.loader.loaderStart();
      try {
        const field = this.translatingField;
        const existingLangs = new Set(this.translations.map((t) => t.language));

        for (const lang of this.channelLanguages) {
          const val = values[lang] || "";
          if (existingLangs.has(lang)) {
            await PATCH_FaqItemTranslation(this.channel, this.$route.params.id, lang, {
              [field]: val,
            });
          } else if (val) {
            // Create new T9N row — need all required fields.
            // Note: backend rejects empty question/answer (min_length=1). When
            // editing url_key for a language without an existing T9N row, the
            // user must translate question + answer first.
            const payload = { language: lang, url_key: "", question: "", answer: "", short_answer: "" };
            payload[field] = val;
            await POST_FaqItemTranslation(this.channel, this.$route.params.id, payload);
          }
        }
        await this.fetchTranslations();
        this.translatingField = null;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.translations_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },

    async fetchGroups() {
      try {
        const { data } = await GET_FaqGroups(this.channel, { page_size: 100 });
        this.groups = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchChannels() {
      try {
        const { data } = await GET_FaqChannels({ page_size: 100 });
        this.channels = Array.isArray(data) ? data : data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchItem() {
      this.loading = true;
      try {
        const { data } = await GET_FaqItem(this.channel, this.$route.params.id);
        this.item = data;
        this.associations = (data.associations || []).map((a) => ({ ...a }));
        this.originalAssociations = JSON.stringify(this.associations);
        this.resetForm(data);
        this.snapshot(this.form);
        this.track(this.form);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    resetForm(data) {
      this.form = {
        url_key: data.url_key || "",
        question: data.question || "",
        answer: data.answer || "",
        short_answer: data.short_answer || "",
        group_idx: data.group_idx || null,
        is_active: data.is_active ?? true,
      };
    },
    async fetchTranslations() {
      try {
        const { data } = await GET_FaqItemTranslations(this.channel, this.$route.params.id);
        this.translations = data.results || data || [];
      } catch {
        // Non-critical
      }
    },

    addAssociation() {
      this.associations.push({ entity_type: "", entity_identifier: "" });
    },
    removeAssociation(idx) {
      this.associations.splice(idx, 1);
    },
    async saveAssociations() {
      try {
        await PATCH_FaqItem(this.channel, this.$route.params.id, {
          associations: this.associations.filter(
            (a) => a.entity_type && a.entity_identifier
          ),
        });
        this.originalAssociations = JSON.stringify(this.associations);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.associations_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },

    async saveAndLeave() {
      await this.saveItem();
      this.confirmLeave();
    },
    async saveItem() {
      // The rich-text editor emits `<p></p>` for an empty document: required means visible text.
      const answerText = (this.form.answer || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      const valid = this.formErrors.validateRequired({ ...this.form, answer: answerText && this.form.answer }, {
        url_key: this.$t("faq.url_key"),
        question: this.$t("faq.question"),
        answer: this.$t("faq.answer"),
      });
      if (!valid) return;

      this.loader.loaderStart();
      try {
        const payload = {
          url_key: this.form.url_key,
          question: this.form.question,
          answer: this.form.answer,
          short_answer: this.form.short_answer,
          group_idx: this.form.group_idx,
          is_active: this.form.is_active,
        };
        if (this.isEdit) {
          await PATCH_FaqItem(this.channel, this.$route.params.id, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("faq.item_saved"),
          });
          await this.fetchItem();
        } else {
          const { data } = await POST_FaqItem(this.channel, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("faq.item_created"),
          });
          this.$router.push(`/faq/items/${data.id}`);
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
    async deleteItem() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_FaqItem(this.channel, this.$route.params.id);
        this.snapshot(this.form);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.item_deleted"),
        });
        this.$router.push("/faq/items");
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
.assoc-row {
  padding: var(--space-2) 0;
}

.assoc-type-select {
  min-width: 150px;
  max-width: 180px;
  flex-shrink: 0;
}

</style>
