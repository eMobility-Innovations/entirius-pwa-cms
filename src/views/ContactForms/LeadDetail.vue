<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <!-- the header renders in every state: its back control stays while loading or after a failed load -->
      <PageHeader :title="$t('cf.lead_detail')" back="/forms/leads">
        <template v-if="lead" #meta>
          <span class="fs-200 t-strong fw-600">{{ lead.name }}</span>
          <StatusBadge :label="leadStatusLabel($t, lead.status)" :tone="leadStatusVariant(lead.status)" />
        </template>
        <template v-if="lead" #actions>
          <!-- the detail-form pattern (plan 33): unsaved state and the page's own controls left of the ActionBar -->
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSelect
              v-if="otherTransitions.length"
              :options="otherTransitions"
              :model-value="null"
              :placeholder="$t('cf.change_status')"
              :aria-label="$t('cf.change_status')"
              class="cf-detail__transitions"
              @update:model-value="onTransition"
            />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else-if="lead">

        <div class="cf-lead-grid">
          <!-- Editable fields -->
          <BasicCard :title="$t('cf.actions')" gap>
            <FormField :label="$t('cf.name')" :error="formErrors.getFieldError('name')?.msg || ''">
              <BasicInput
                v-model="form.name"
                :maxlength="255"
              />
            </FormField>
            <FormField :label="$t('cf.phone')" :error="formErrors.getFieldError('phone')?.msg || ''">
              <BasicInput
                v-model="form.phone"
                type="tel"
                :maxlength="32"
              />
            </FormField>
            <FormField :label="$t('cf.company')" :error="formErrors.getFieldError('company')?.msg || ''">
              <BasicInput
                v-model="form.company"
                :maxlength="255"
              />
            </FormField>
            <FormField
              :label="$t('cf.deal_value')"
              :error="formErrors.getFieldError('deal_value')?.msg || ''"
            >
              <BasicInput
                v-model="form.deal_value"
                type="number"
                min="0"
                step="0.01"
              />
            </FormField>
            <FormField :label="$t('cf.notes')" :error="formErrors.getFieldError('notes')?.msg || ''">
              <BasicInput
                v-model="form.notes"
              />
            </FormField>
          </BasicCard>

          <!-- Read-only facts -->
          <BasicCard :title="$t('cf.submission_detail')" gap>
            <dl class="cf-field-list">
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.email") }}</dt>
                <dd>{{ lead.email }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.channel") }}</dt>
                <dd>{{ lead.channel_idx }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.source_type") }}</dt>
                <dd>{{ sourceTypeLabel(lead.source_type) }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.contact_date") }}</dt>
                <dd>{{ formatDateTime(lead.contact_date) }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.status_changed_at") }}</dt>
                <dd>{{ formatDateTime(lead.status_changed_at) }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.attribution_method") }}</dt>
                <dd>{{ lead.attribution_method || "---" }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.gclid") }}</dt>
                <dd>
                  <code v-if="lead.gclid" class="cf-code">{{
                    lead.gclid
                  }}</code>
                  <span v-else class="t-muted">---</span>
                </dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.campaign_name") }}</dt>
                <dd>{{ lead.campaign_name || "---" }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.landing_page") }}</dt>
                <dd>{{ lead.landing_page || "---" }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.ads_imported") }}</dt>
                <dd>
                  <span
                    v-if="lead.ads_conversion_imported"
                    class="cf-ads-imported"
                  >
                    <font-awesome-icon :icon="$icons.check" />
                    {{ formatDateTime(lead.ads_imported_at) }}
                  </span>
                  <span v-else class="t-muted">---</span>
                </dd>
              </div>
            </dl>
          </BasicCard>

          <!-- Integrations card -->
          <BasicCard :title="$t('cf.integrations_title')" gap>
            <dl class="cf-field-list">
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.google_ads_enabled_label") }}</dt>
                <dd>
                  <StatusBadge
                    :label="
                      integrations?.google_ads_enabled
                        ? $t('cf.enabled')
                        : $t('cf.disabled')
                    "
                    :tone="
                      integrations?.google_ads_enabled ? 'positive' : 'neutral'
                    "
                  />
                </dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.bookings_enabled_label") }}</dt>
                <dd>
                  <StatusBadge
                    :label="
                      integrations?.bookings_enabled
                        ? $t('cf.enabled')
                        : $t('cf.disabled')
                    "
                    :tone="
                      integrations?.bookings_enabled ? 'positive' : 'neutral'
                    "
                  />
                </dd>
              </div>
            </dl>
          </BasicCard>
        </div>
      </template>

    <BasicModal
      :open="showMarkAsWon"
      size="sm"
      :title="$t('cf.mark_as_won_title')"
      :actions="markAsWonActions"
      @update:open="(open) => open || cancelMarkAsWon()"
    >
      <p class="mb-5">{{ $t("cf.mark_as_won_description") }}</p>
      <FormField :label="$t('cf.deal_value')">
        <BasicInput
          v-model="markAsWonDealValue"
          type="number"
          min="0"
          step="0.01"
        />
      </FormField>
      <p
        v-if="integrations && integrations.google_ads_enabled"
        class="fs-200 t-accent mt-5"
      >
        <font-awesome-icon :icon="$icons.info" />
        {{ $t("cf.google_ads_push_hint") }}
      </p>
      <p
        v-else-if="integrations"
        class="fs-200 t-muted mt-5"
      >
        <font-awesome-icon :icon="$icons.info" />
        {{ $t("cf.google_ads_off_hint") }}
      </p>
    </BasicModal>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_Lead,
  PATCH_Lead,
  POST_LeadTransition,
  GET_ChannelIntegrations,
} from "@/api/contactForms/api";
import {
  allowedTransitions,
  leadStatusLabel,
  leadStatusVariant,
} from "./helpers/leadStatus";

export default {
  name: "LeadDetail",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const formErrors = useFormErrors();
    return { loader, notify, formErrors };
  },
  data() {
    return {
      lead: null,
      loading: false,
      saving: false,
      integrations: null,
      showMarkAsWon: false,
      markAsWonDealValue: "",
      isDirty: false,
      initialSnapshot: null,
      form: {
        name: "",
        phone: "",
        company: "",
        deal_value: "",
        notes: "",
      },
    };
  },
  computed: {
    headerActions() {
      return [
        ...(this.canMarkAsWon
          ? [{ key: "mark-as-won", role: "secondary", label: this.$t("cf.mark_as_won"), onClick: this.openMarkAsWon }]
          : []),
        { key: "save", role: "primary", label: this.$t("cf.save"), disabled: !this.isDirty || this.saving,
          onClick: this.save },
      ];
    },
    markAsWonActions() {
      return [
        { key: "cancel", role: "secondary", label: this.$t("cf.cancel"), onClick: this.cancelMarkAsWon },
        { key: "confirm", role: "primary", label: this.$t("cf.confirm"), onClick: this.confirmMarkAsWon },
      ];
    },
    canMarkAsWon() {
      if (!this.lead) return false;
      return allowedTransitions(this.lead.status).includes("won");
    },
    otherTransitions() {
      if (!this.lead) return [];
      return allowedTransitions(this.lead.status)
        .filter((s) => s !== "won" || !this.canMarkAsWon)
        .map((s) => ({
          label: this.$t("cf.transition_to", {
            status: leadStatusLabel(this.$t, s),
          }),
          value: s,
        }));
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.initialSnapshot) {
          this.isDirty = JSON.stringify(this.form) !== this.initialSnapshot;
        }
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  mounted() {
    this.fetchLead();
  },
  methods: {
    leadStatusLabel,
    leadStatusVariant,
    formatDateTime(iso) {
      if (!iso) return "---";
      const d = new Date(iso);
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    sourceTypeLabel(value) {
      if (!value) return "---";
      const key = `cf.source_types.${value}`;
      const translated = this.$t(key);
      return translated !== key ? translated : value;
    },
    snapshotForm() {
      this.$nextTick(() => {
        this.initialSnapshot = JSON.stringify(this.form);
        this.isDirty = false;
      });
    },
    async fetchLead() {
      this.loading = true;
      try {
        const { data } = await GET_Lead(this.$route.params.id);
        this.lead = data;
        this.form = {
          name: data.name || "",
          phone: data.phone || "",
          company: data.company || "",
          deal_value: data.deal_value != null ? String(data.deal_value) : "",
          notes: data.notes || "",
        };
        this.snapshotForm();
        this.fetchIntegrations();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async fetchIntegrations() {
      if (!this.lead?.channel_idx) return;
      try {
        const { data } = await GET_ChannelIntegrations(this.lead.channel_idx);
        this.integrations = data;
      } catch {
        // Non-fatal — the Mark-as-Won hint simply won't show.
        this.integrations = null;
      }
    },
    buildPayload() {
      const payload = {
        name: this.form.name || null,
        phone: this.form.phone || null,
        company: this.form.company || null,
        notes: this.form.notes || null,
      };
      if (this.form.deal_value !== "" && this.form.deal_value != null) {
        payload.deal_value = this.form.deal_value;
      } else {
        payload.deal_value = null;
      }
      return payload;
    },
    async save() {
      if (!this.lead) return;
      this.saving = true;
      this.loader.loaderStart();
      try {
        const { data } = await PATCH_Lead(this.lead.id, this.buildPayload());
        this.lead = data;
        this.form = {
          name: data.name || "",
          phone: data.phone || "",
          company: data.company || "",
          deal_value: data.deal_value != null ? String(data.deal_value) : "",
          notes: data.notes || "",
        };
        this.snapshotForm();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("cf.save_success"),
        });
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("cf.save_error")),
        });
      } finally {
        this.saving = false;
        this.loader.loaderFinish();
      }
    },
    async onTransition(newStatus) {
      if (!newStatus || !this.lead) return;
      if (newStatus === "won") {
        this.openMarkAsWon();
        return;
      }
      await this.runTransition({ new_status: newStatus });
    },
    openMarkAsWon() {
      this.markAsWonDealValue =
        this.form.deal_value ||
        (this.lead?.deal_value != null ? String(this.lead.deal_value) : "");
      this.showMarkAsWon = true;
    },
    cancelMarkAsWon() {
      this.showMarkAsWon = false;
    },
    async confirmMarkAsWon() {
      const dealValue = this.markAsWonDealValue;
      if (!dealValue) {
        this.notify.spawnNotification({
          type: "negative",
          msg: this.$t("cf.save_error"),
        });
        return;
      }
      const ok = await this.runTransition({
        new_status: "won",
        deal_value: dealValue,
      });
      if (ok) this.showMarkAsWon = false;
    },
    async runTransition(payload) {
      if (!this.lead) return false;
      this.loader.loaderStart();
      try {
        const { data } = await POST_LeadTransition(this.lead.id, payload);
        this.lead = data;
        this.form.deal_value =
          data.deal_value != null ? String(data.deal_value) : "";
        this.snapshotForm();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("cf.transition_success"),
        });
        return true;
      } catch (err) {
        const body = err?.response?.data || err || {};
        if (body.error === "INVALID_TRANSITION") {
          this.notify.spawnNotification({
            type: "negative",
            msg: this.$t("cf.invalid_transition", {
              from: leadStatusLabel(this.$t, body.from_status),
              to: leadStatusLabel(this.$t, body.to_status),
            }),
          });
        } else {
          this.formErrors.handleApiError(err);
          this.notify.spawnNotification({
            type: "negative",
            msg:
              body.message ||
              this.formErrors.summary ||
              this.$t("cf.transition_error"),
          });
        }
        return false;
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.cf-lead-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-8);
}


.cf-field-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.cf-field-list__row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--space-5);
  align-items: baseline;
}

.cf-field-list__row > dt {
  font-size: var(--fs-200);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.cf-field-list__row > dd {
  margin: 0;
  color: var(--text-body);
  word-break: break-word;
}

.cf-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fs-200);
  padding: 2px var(--space-1);
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  color: var(--text-body);
}

.cf-ads-imported {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--positive);
}

.cf-detail__transitions {
  min-width: 180px;
}
</style>
