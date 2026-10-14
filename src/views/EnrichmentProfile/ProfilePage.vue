<template>
  <PageLayout class="profile-page fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('enrichment.profile.title')" :description="$t('enrichment.profile.description')">
        <template #meta>
          <BasicSelect
            :model-value="channel"
            :options="channelOptions"
            :floating-label="$t('enrichment.profile.scope')"
            data-testid="profile-channel"
            @update:model-value="setChannel"
          />
        </template>
        <template #actions>
          <span v-if="dirty" class="fs-200 t-secondary" data-testid="profile-unsaved">{{ $t("enrichment.profile.unsaved") }}</span>
          <ActionBar v-if="!loading && schema" :actions="actions" />
        </template>
      </PageHeader>
    </template>

    <Loader v-if="loading" block />
    <div v-else-if="schema" class="flex-column gap-8">
      <p v-if="channel" class="m-0 t-secondary" data-testid="profile-overlay-note">{{ $t("enrichment.profile.overlay_note") }}</p>
      <ProfileCompleteness :status="status" />

      <BasicCard :title="$t('enrichment.profile.save_note')">
        <FormField :label="$t('enrichment.profile.note')" :hint="$t('enrichment.profile.note_hint')">
          <BasicInput v-model="note" :maxlength="200" data-testid="profile-note" />
        </FormField>
      </BasicCard>

      <BasicCard v-if="jsonMode" :title="$t('enrichment.profile.json')">
        <FormField :label="$t('enrichment.profile.json')" :error="jsonErrors.$ || ''">
          <BasicTextarea v-model="jsonText" :rows="30" data-testid="profile-json" />
        </FormField>
        <ul v-if="jsonList.length" class="profile-page__errors m-0 mt-4 flex-column gap-1" role="alert" data-testid="profile-json-errors">
          <li v-for="error in jsonList" :key="error.path"><code>{{ error.path }}</code>: {{ error.message }}</li>
        </ul>
      </BasicCard>
      <template v-else>
        <ProfileSection
          v-for="section in sections"
          :key="section.key"
          v-model="form[section.key]"
          :section="section"
          :status="summary.byKey[section.key] || null"
          :errors="sectionErrors(section.key)"
        />
      </template>
    </div>

    <ProfileHistory :visible="historyOpen" :versions="versions" :busy="saving" :dirty="dirty" @close="historyOpen = false" @restore="restore" />

    <ConfirmDialog
      :open="pendingChannel !== null"
      tone="danger"
      :title="$t('unsaved.title')"
      :message="$t('enrichment.profile.switch_discards')"
      :confirm-label="$t('unsaved.discard')"
      data-testid="profile-switch-confirm"
      @update:open="(open) => !open && (pendingChannel = null)"
      @confirm="confirmChannel"
    />
  </PageLayout>
</template>

<script>
import {
  GET_Profile,
  GET_ProfileSchema,
  GET_ProfileStatus,
  GET_ProfileVersions,
  POST_RestoreProfileVersion,
  PUT_Profile,
} from "@/api/enrichment/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import ProfileCompleteness from "./ProfileCompleteness.vue";
import ProfileHistory from "./ProfileHistory.vue";
import ProfileSection from "./ProfileSection.vue";
import { checkProfileJson } from "./jsonCheck";
import { completeness, errorsByPath, errorsInside, prettyJson, pruneEmpty, sectionsFrom } from "./profileLogic";
import { useProfileChannels } from "./useProfileChannels";

// The company profile (contract A4 § 2): what the AI is told about the company, per scope — the whole company or a
// channel overlay (only the sections that differ). The form comes from the profile's schema; "Edit JSON" edits the
// same data as text, checked as it is typed. Save makes a new version with an optional note; History compares and
// restores versions. Validation errors from the server show at their fields (or as a list in JSON mode).
export default {
  name: "ProfilePage",
  components: { ProfileCompleteness, ProfileHistory, ProfileSection },
  setup() {
    const { options: channelOptions, load: loadChannels } = useProfileChannels();
    return { notify: useNotifyStore(), profileStore: useEnrichmentProfileStore(), channelOptions, loadChannels };
  },
  data() {
    return {
      channel: String(this.$route.query.channel || ""),
      schema: null,
      saved: {},
      form: {},
      status: null,
      versions: [],
      note: "",
      jsonMode: false,
      jsonText: "",
      apiErrors: {},
      loading: true,
      saving: false,
      historyOpen: false,
      pendingChannel: null,
      loadSeq: 0,
    };
  },
  computed: {
    sections() {
      return sectionsFrom(this.schema);
    },
    summary() {
      return completeness(this.status);
    },
    jsonErrors() {
      return this.jsonMode ? this.jsonCheckErrors : {};
    },
    jsonCheckErrors() {
      const { errors } = checkProfileJson(this.schema, this.jsonText);
      return Object.fromEntries(Object.entries(errors).map(([path, e]) => [path, this.jsonMessage(e)]));
    },
    jsonList() {
      const all = { ...this.jsonErrors, ...this.apiErrors };
      return Object.entries(all).filter(([path]) => path !== "$").map(([path, message]) => ({ path, message }));
    },
    dirty() {
      const current = this.jsonMode ? this.jsonText : prettyJson(pruneEmpty(this.form));
      return current !== prettyJson(pruneEmpty(this.saved));
    },
    actions() {
      return [
        { key: "history", role: "secondary", mutates: false, label: this.$t("enrichment.profile.history"),
          testid: "profile-history-open", onClick: () => (this.historyOpen = true) },
        { key: "json", role: "secondary", mutates: false, expanded: this.jsonMode, testid: "profile-json-toggle",
          label: this.$t(this.jsonMode ? "enrichment.profile.edit_form" : "enrichment.profile.edit_json"), onClick: this.toggleJson },
        { key: "save", role: "primary", mutates: true, label: this.$t("common.save"), loading: this.saving,
          disabled: this.saving, testid: "profile-save", onClick: this.save },
      ];
    },
  },
  mounted() {
    this.loadChannels();
    this.loadAll();
  },
  methods: {
    jsonMessage({ code, arg }) {
      return this.$t(`enrichment.profile.json_error.${code}`, { arg });
    },
    sectionErrors(key) {
      const own = this.apiErrors[key] ? { "": this.apiErrors[key] } : {};
      return { ...own, ...errorsInside(this.apiErrors, key) };
    },
    setChannel(channel) {
      if (this.dirty) this.pendingChannel = channel || "";
      else this.applyChannel(channel);
    },
    confirmChannel() {
      const channel = this.pendingChannel;
      this.pendingChannel = null;
      this.applyChannel(channel);
    },
    applyChannel(channel) {
      this.channel = channel || "";
      this.$router.replace({ query: { ...this.$route.query, channel: this.channel || undefined } });
      this.loadAll();
    },
    // Only the newest load fills the page: a slower answer for a scope the picker already left is dropped.
    async loadAll() {
      const mine = ++this.loadSeq;
      this.loading = true;
      try {
        const [schema, scope] = await Promise.all([this.schema || this.fetchSchema(), this.fetchScope()]);
        if (mine !== this.loadSeq) return;
        this.schema = schema;
        this.showScope(scope);
      } catch (err) {
        if (mine === this.loadSeq) this.toastError(err);
      } finally {
        if (mine === this.loadSeq) this.loading = false;
      }
    },
    async fetchSchema() {
      const { data } = await GET_ProfileSchema();
      return data.json_schema;
    },
    fetchScope() {
      const params = { channel: this.channel };
      return Promise.all([GET_Profile(params), GET_ProfileStatus(params), GET_ProfileVersions(params)]);
    },
    showScope([profile, status, versions]) {
      this.showProfile(profile.data);
      this.status = status.data;
      this.versions = versions.data || [];
    },
    showProfile(profile) {
      this.saved = profile.data || {};
      this.form = JSON.parse(JSON.stringify(this.saved));
      this.jsonText = prettyJson(this.saved);
      this.apiErrors = {};
    },
    toggleJson() {
      if (!this.jsonMode) {
        this.jsonText = prettyJson(pruneEmpty(this.form));
        this.jsonMode = true;
        return;
      }
      const { data, errors } = checkProfileJson(this.schema, this.jsonText);
      if (Object.keys(errors).length) return;
      this.form = data;
      this.jsonMode = false;
    },
    payload() {
      if (!this.jsonMode) return pruneEmpty(this.form);
      const { data, errors } = checkProfileJson(this.schema, this.jsonText);
      return Object.keys(errors).length ? null : data;
    },
    async save() {
      const data = this.payload();
      if (!data) return;
      this.saving = true;
      try {
        const { data: profile } = await PUT_Profile({ channel: this.channel }, { data, note: this.note.trim() });
        this.note = "";
        await this.afterChange(profile, "enrichment.profile.saved");
      } catch (err) {
        this.apiErrors = errorsByPath(err);
        this.toastError(err);
      } finally {
        this.saving = false;
      }
    },
    async restore(version) {
      this.saving = true;
      try {
        const { data: profile } = await POST_RestoreProfileVersion(version, { channel: this.channel });
        this.jsonMode = false;
        await this.afterChange(profile, "enrichment.profile.restored");
      } catch (err) {
        this.toastError(err);
      } finally {
        this.saving = false;
      }
    },
    async afterChange(profile, toastKey) {
      this.showProfile(profile);
      this.notify.spawnNotification({ type: "positive", msg: this.$t(toastKey) });
      this.profileStore.refresh();
      const params = { channel: this.channel };
      const [status, versions] = await Promise.all([GET_ProfileStatus(params), GET_ProfileVersions(params)]);
      this.status = status.data;
      this.versions = versions.data || [];
    },
    toastError(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>

<style lang="scss" scoped>
.profile-page__errors {
  padding-left: var(--space-5);
  color: var(--negative);
}
</style>
