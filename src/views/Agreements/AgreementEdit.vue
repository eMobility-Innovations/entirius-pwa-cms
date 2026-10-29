<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader
        :title="isEdit ? (definition.name || definition.slug || '') : $t('agm.create_definition')"
        back="/agreements/list"
      >
        <template #meta>
          <StatusBadge
            v-if="definition.is_system"
            :label="$t('agm.system_badge')"
            tone="info"
          />
        </template>
        <template v-if="!loadFailed" #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch
              :label="$t('agm.is_active')"
              v-model="form.is_active"
            />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <EmptyState v-else-if="loadFailed" icon="empty" :title="$t('notifications.error')" />

      <template v-else>
        <p v-if="definition.is_system" class="system-notice mb-8">
          {{ $t("agm.system_info") }}
        </p>

        <BasicCard :title="$t('agm.definition')" gap class="mb-8">
          <div class="form-grid">
            <FormField :label="$t('agm.slug')" required :error="fieldError('slug')">
              <BasicInput
                v-model="form.slug"
                :disabled="isEdit || definition.is_system"
              />
            </FormField>
            <FormField :label="$t('agm.name')" required :error="fieldError('name')">
              <BasicInput v-model="form.name" />
            </FormField>
            <FormField :label="$t('agm.category')" :error="fieldError('category')">
              <BasicSelect
                :options="categoryOptions"
                v-model="form.category"
                :placeholder="$t('common.select')"
                :disabled="definition.is_system"
              />
            </FormField>
            <FormField :label="$t('agm.consent_channel')" :error="fieldError('consent_channel')">
              <BasicSelect
                :options="consentChannelOptions"
                v-model="form.consent_channel"
                :placeholder="$t('common.select')"
                :disabled="definition.is_system"
              />
            </FormField>
            <FormField :label="$t('agm.content_route')" :error="fieldError('content_route')">
              <BasicInput v-model="form.content_route" />
            </FormField>
            <FormField :label="$t('agm.sort_order')" :error="fieldError('sort_order')">
              <BasicInput v-model="form.sort_order" type="number" />
            </FormField>
            <FormField :label="$t('agm.channels')" :error="fieldError('channel_ids')">
              <BasicSelect
                v-model="form.channel_ids"
                :options="channelOptions"
                :placeholder="$t('agm.all_channels')"
                multiple
                searchable
              />
            </FormField>

            <!-- display_contexts: read-only tags for system, multi-select for custom -->
            <FormField :label="$t('agm.display_contexts')" :error="fieldError('display_contexts')">
              <div v-if="definition.is_system" class="flex gap-2 flex-wrap">
                <Tag
                  v-for="ctx in definition.display_contexts"
                  :key="ctx"
                  :label="contextLabel(ctx)"
                />
                <span
                  v-if="!definition.display_contexts || !definition.display_contexts.length"
                  class="t-muted fs-200"
                >
                  ---
                </span>
              </div>
              <BasicSelect
                v-else
                v-model="form.display_contexts"
                :options="displayContextOptions"
                :placeholder="$t('agm.all_channels')"
                multiple
              />
            </FormField>
          </div>
        </BasicCard>

        <BasicCard v-if="isEdit" :title="$t('agm.versions')" gap class="mb-8">
          <template #actions>
            <ActionBar :actions="versionActions" />
          </template>

          <div v-if="showVersionForm" class="form-grid" data-testid="agm-new-version-form">
            <FormField :label="$t('agm.summary_en')" class="form-grid__wide">
              <BasicWysiwyg v-model="newVersion.summary_en" :toolbar="wysiwygToolbar" />
            </FormField>
            <FormField :label="$t('agm.summary_pl')" class="form-grid__wide">
              <BasicWysiwyg v-model="newVersion.summary_pl" :toolbar="wysiwygToolbar" />
            </FormField>
            <div class="form-grid__wide flex jc-fe gap-3">
              <BasicButton variant="secondary" @click="cancelVersionForm">
                {{ $t('common.cancel') }}
              </BasicButton>
              <BasicButton mutates variant="secondary" @click="createVersion">
                {{ $t('agm.create_version') }}
              </BasicButton>
            </div>
          </div>

          <DataTable
            :columns="versionColumns"
            :rows="versions"
            row-key="id"
            :empty-text="$t('agm.no_versions')"
          >
            <template #cell-version_number="{ value }">v{{ value }}</template>
            <template #cell-summary_en="{ value }">
              <span v-html="sanitizeHtml(value) || '—'" />
            </template>
            <template #cell-published_at="{ value }">
              <StatusBadge
                :label="value ? formatDate(value) : $t('agm.draft')"
                :tone="value ? 'positive' : 'neutral'"
              />
            </template>
            <template #cell-created_at="{ value }">{{ formatDate(value) }}</template>
            <template #cell-actions="{ row }">
              <IconButton
                v-if="!row.published_at"
                icon="edit"
                :label="$t('agm.edit_draft')"
                size="sm"
                @click="startEditDraft(row)"
              />
              <IconButton
                v-else
                icon="edit"
                :label="$t('agm.create_draft_from_published')"
                size="sm"
                @click="startEditPublished(row)"
              />
              <BasicButton mutates
                v-if="!row.published_at"
                variant="secondary"
                size="sm"
                @click="publishVersion(row.id)"
              >
                {{ $t('agm.publish') }}
              </BasicButton>
            </template>
          </DataTable>

          <!-- Draft edit form -->
          <div v-if="editingVersion" class="form-grid" data-testid="agm-edit-version-form">
            <h3 class="form-grid__wide fs-300 fw-600">
              {{ $t("agm.edit_draft") }} v{{ editingVersion.version_number }}
            </h3>
            <FormField :label="$t('agm.summary_en')" class="form-grid__wide">
              <BasicWysiwyg v-model="editVersion.summary_en" :toolbar="wysiwygToolbar" />
            </FormField>
            <FormField :label="$t('agm.summary_pl')" class="form-grid__wide">
              <BasicWysiwyg v-model="editVersion.summary_pl" :toolbar="wysiwygToolbar" />
            </FormField>
            <div class="form-grid__wide flex jc-fe gap-3">
              <BasicButton variant="secondary" @click="cancelEditVersion">
                {{ $t('common.cancel') }}
              </BasicButton>
              <BasicButton mutates variant="secondary" @click="saveDraftVersion(editingVersion.id)">
                {{ $t('common.save') }}
              </BasicButton>
            </div>
          </div>
        </BasicCard>

        <!-- Legal page history (only when the definition has a content_route) -->
        <BasicCard
          v-if="isEdit && definition.content_route"
          :title="$t('agm.content_history')"
          gap
          class="mb-8"
        >
          <template #actions>
            <IconButton
              :icon="contentHistoryOpen ? 'collapse' : 'expand'"
              :label="$t('agm.toggle_content_history')"
              :aria-expanded="String(contentHistoryOpen)"
              data-testid="agm-history-toggle"
              @click="contentHistoryOpen = !contentHistoryOpen"
            />
          </template>

          <template v-if="contentHistoryOpen">
            <div class="filter-chip-row" role="group" :aria-label="$t('builder.language')">
              <FilterChip
                v-for="lang in historyLanguages"
                :key="lang.value"
                :label="lang.label"
                :active="contentHistoryLang === lang.value"
                @click="setHistoryLang(lang.value)"
              />
            </div>

            <DataTable
              :columns="snapshotColumns"
              :rows="contentSnapshots"
              row-key="published_id"
              expandable
              :empty-text="$t('agm.content_history_empty')"
            >
              <template #cell-created_at="{ row, index }">
                <span class="flex ai-ct wrap gap-2">
                  <span>{{ formatDate(row.created_at) }}</span>
                  <StatusBadge
                    v-if="index === 0"
                    :label="$t('agm.snapshot_current')"
                    tone="positive"
                  />
                </span>
              </template>
              <template #cell-warnings="{ value }">
                <StatusBadge
                  v-if="value && value.length"
                  :label="$t('agm.snapshot_warnings')"
                  tone="warning"
                />
              </template>
              <template #expand="{ row }">
                <div class="legal-text-preview" v-html="sanitizeHtml(row.text_html)" />
              </template>
            </DataTable>
          </template>
        </BasicCard>
      </template>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteDefinition"
      @cancel="showDeleteConfirm = false"
      :title="$t('pim.confirm_delete_title')"
    >
      <template #default
        ><p>{{ $t("agm.confirm_delete") }}</p></template
      >
    </ConfirmDialog>

    <ConfirmDialog
      :open="showPublishedEditConfirm"
      @confirm="confirmEditPublished"
      @cancel="showPublishedEditConfirm = false"
      :title="$t('agm.create_draft_from_published')"
    >
      <template #default
        ><p>{{ $t("agm.edit_published_confirm") }}</p></template
      >
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import {
  GET_Definition,
  POST_Definition,
  PATCH_Definition,
  DELETE_Definition,
  GET_Versions,
  POST_Version,
  PATCH_Version,
  POST_PublishVersion,
  GET_AgmChannels,
  GET_ContentHistory,
} from "@/api/agreements/api";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

export default {
  name: "AgreementEdit",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const formErrors = useFormErrors();
    const unsaved = useUnsavedChanges();
    return { loader, notify, formErrors, ...unsaved };
  },
  data() {
    return {
      definition: {},
      versions: [],
      channels: [],
      // An edit screen starts loading: the header (Save, Delete) renders after the definition arrives.
      loading: Boolean(this.$route.params.slug),
      loadFailed: false,
      showDeleteConfirm: false,
      showVersionForm: false,
      showPublishedEditConfirm: false,
      pendingPublishedVersion: null,
      editingVersionId: null,
      editVersion: {
        summary_en: "",
        summary_pl: "",
      },
      newVersion: {
        summary_en: "",
        summary_pl: "",
      },
      form: {
        slug: "",
        name: "",
        category: "",
        consent_channel: "",
        content_route: "",
        sort_order: 0,
        is_active: true,
        channel_ids: [],
        display_contexts: [],
      },
      wysiwygToolbar: ["bold", "italic", "underline", "link"],
      contentHistoryOpen: false,
      contentHistoryLang: "",
      contentSnapshots: [],
    };
  },
  computed: {
    isEdit() {
      return !!this.$route.params.slug;
    },
    versionActions() {
      return [
        {
          key: "create-version",
          role: "secondary",
          label: this.$t("agm.create_version"),
          expanded: this.showVersionForm,
          onClick: () => { this.showVersionForm = !this.showVersionForm; },
        },
      ];
    },
    headerActions() {
      return [
        ...(this.isEdit && !this.definition.is_system
          ? [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              onClick: () => (this.showDeleteConfirm = true) }]
          : []),
        { key: "save", role: "primary", label: this.$t("agm.save"), onClick: this.saveDefinition },
      ];
    },
    editingVersion() {
      return this.versions.find((v) => v.id === this.editingVersionId && !v.published_at) || null;
    },
    versionColumns() {
      return [
        { key: "version_number", label: this.$t("agm.version_number"), width: "64px" },
        { key: "summary_en", label: this.$t("agm.summary_en"), width: "1fr", truncate: true, priority: 2 },
        { key: "published_at", label: this.$t("agm.published_at"), width: "max-content" },
        { key: "created_at", label: this.$t("agm.created_at"), width: "120px", numeric: true, priority: 2 },
        { key: "actions", label: "", actions: true },
      ];
    },
    snapshotColumns() {
      return [
        { key: "created_at", label: this.$t("agm.published_at"), width: "max-content" },
        { key: "language", label: this.$t("builder.language"), width: "64px" },
        { key: "text_preview", label: this.$t("common.preview"), width: "1fr", priority: 2 },
        { key: "warnings", label: "", width: "max-content", priority: 2 },
      ];
    },
    historyLanguages() {
      return [
        { value: "", label: this.$t("agm.filter_all") },
        { value: "en", label: "EN" },
        { value: "pl", label: "PL" },
        { value: "de", label: "DE" },
      ];
    },
    categoryOptions() {
      return [
        { label: this.$t("agm.filter_mandatory"), value: "mandatory" },
        { label: this.$t("agm.filter_marketing"), value: "marketing" },
        { label: this.$t("agm.filter_informational"), value: "informational" },
      ];
    },
    consentChannelOptions() {
      return [
        { label: "General", value: "general" },
        { label: "Email", value: "email" },
        { label: "SMS", value: "sms" },
        { label: "Push", value: "push" },
        { label: "Web", value: "web" },
      ];
    },
    channelOptions() {
      return this.channels.map((ch) => ({
        label: ch.name || ch.idx,
        value: ch.id,
      }));
    },
    displayContextOptions() {
      return [
        { label: this.$t("agm.context_checkout"), value: "checkout" },
        { label: this.$t("agm.context_registration"), value: "registration" },
        { label: this.$t("agm.context_newsletter"), value: "newsletter" },
      ];
    },
  },
  async mounted() {
    await this.fetchChannels();
    if (this.isEdit) {
      await this.fetchDefinition();
      await this.fetchVersions();
      if (this.definition.content_route) {
        await this.fetchContentHistory();
      }
    } else {
      this.snapshot(this.form);
      this.track(this.form);
    }
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  methods: {
    sanitizeHtml,
    fieldError(field) {
      return this.formErrors.getFieldError(field)?.msg || "";
    },
    contextLabel(ctx) {
      const map = {
        checkout: this.$t("agm.context_checkout"),
        registration: this.$t("agm.context_registration"),
        newsletter: this.$t("agm.context_newsletter"),
      };
      return map[ctx] || ctx;
    },
    formatDate(dateStr) {
      if (!dateStr) return "---";
      return new Date(dateStr).toLocaleDateString();
    },
    startEditDraft(ver) {
      this.editingVersionId = ver.id;
      this.editVersion = {
        summary_en: ver.summary_en || "",
        summary_pl: ver.summary_pl || "",
      };
    },
    startEditPublished(ver) {
      this.pendingPublishedVersion = ver;
      this.showPublishedEditConfirm = true;
    },
    cancelEditVersion() {
      this.editingVersionId = null;
      this.editVersion = { summary_en: "", summary_pl: "" };
    },
    async fetchChannels() {
      try {
        const { data } = await GET_AgmChannels({ page_size: 100 });
        this.channels = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async fetchDefinition() {
      this.loading = true;
      try {
        const { data } = await GET_Definition(this.$route.params.slug);
        this.definition = data;
        this.resetForm(data);
        this.snapshot(this.form);
        this.track(this.form);
      } catch (err) {
        // Only the first load fails the page; a failed refresh after a save keeps the loaded form.
        if (!this.definition.slug) this.loadFailed = true;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async fetchVersions() {
      try {
        const { data } = await GET_Versions(this.$route.params.slug);
        this.versions = data.results || data || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    resetForm(data) {
      this.form = {
        slug: data.slug || "",
        name: data.name || "",
        category: data.category || "",
        consent_channel: data.consent_channel || "",
        content_route: data.content_route || "",
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
        channel_ids: data.channel_ids || [],
        display_contexts: data.display_contexts || [],
      };
    },
    async saveDefinition() {
      this.loader.loaderStart();
      try {
        const payload = {
          slug: this.form.slug,
          name: this.form.name,
          category: this.form.category,
          consent_channel: this.form.consent_channel,
          content_route: this.form.content_route || null,
          sort_order: parseInt(this.form.sort_order) || 0,
          is_active: this.form.is_active,
          channel_ids: this.form.channel_ids,
          display_contexts: this.form.display_contexts,
        };
        if (this.isEdit) {
          await PATCH_Definition(this.$route.params.slug, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("notifications.success"),
          });
          await this.fetchDefinition();
        } else {
          const { data } = await POST_Definition(payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("notifications.success"),
          });
          this.$router.push(`/agreements/${data.slug}`);
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
    async deleteDefinition() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_Definition(this.$route.params.slug);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.deleted"),
        });
        this.$router.push("/agreements/list");
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    cancelVersionForm() {
      this.showVersionForm = false;
      this.newVersion = { summary_en: "", summary_pl: "" };
    },
    async createVersion() {
      this.loader.loaderStart();
      try {
        await POST_Version(this.$route.params.slug, {
          summary_t9n: {
            en: this.newVersion.summary_en,
            pl: this.newVersion.summary_pl,
          },
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.success"),
        });
        this.cancelVersionForm();
        await this.fetchVersions();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async saveDraftVersion(id) {
      this.loader.loaderStart();
      try {
        await PATCH_Version(id, {
          summary_t9n: {
            en: this.editVersion.summary_en,
            pl: this.editVersion.summary_pl,
          },
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.success"),
        });
        this.cancelEditVersion();
        await this.fetchVersions();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async confirmEditPublished() {
      this.showPublishedEditConfirm = false;
      const ver = this.pendingPublishedVersion;
      this.pendingPublishedVersion = null;
      if (!ver) return;
      this.loader.loaderStart();
      try {
        await POST_Version(this.$route.params.slug, {
          summary_t9n: {
            en: ver.summary_en || "",
            pl: ver.summary_pl || "",
          },
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.success"),
        });
        await this.fetchVersions();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    setHistoryLang(lang) {
      this.contentHistoryLang = lang;
      this.fetchContentHistory();
    },
    async fetchContentHistory() {
      try {
        const params = {};
        if (this.contentHistoryLang) params.language = this.contentHistoryLang;
        const { data } = await GET_ContentHistory(
          this.$route.params.slug,
          params
        );
        this.contentSnapshots = data.snapshots || [];
      } catch (err) {
        this.contentSnapshots = [];
      }
    },
    async publishVersion(id) {
      this.loader.loaderStart();
      try {
        await POST_PublishVersion(id);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("notifications.success"),
        });
        await this.fetchVersions();
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
// Locked system definition: the notice bar above the form (docs/ui-rules.md § Locked / system entity).
.system-notice {
  color: var(--text-muted);
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  padding: var(--space-2) var(--space-4);
}

.legal-text-preview {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-4);
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
}
</style>
