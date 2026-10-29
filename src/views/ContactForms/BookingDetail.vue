<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <!-- the header renders in every state: its back control stays while loading or after a failed load -->
      <PageHeader :title="$t('cf.booking_detail')" back="/forms/bookings">
        <template v-if="booking?.linked_lead" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else-if="booking">

        <div class="cf-booking-grid">
          <BasicCard :title="$t('cf.meeting_start')" gap>
            <dl class="cf-field-list">
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.meeting_start") }}</dt>
                <dd>{{ formatDateTime(booking.meeting_start) }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.meeting_end") }}</dt>
                <dd>{{ formatDateTime(booking.meeting_end) }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.timezone") }}</dt>
                <dd>{{ booking.timezone }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.name") }}</dt>
                <dd>
                  <span v-if="booking.name">{{ booking.name }}</span>
                  <span v-else class="t-muted">---</span>
                </dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.email") }}</dt>
                <dd>{{ booking.email }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.channel") }}</dt>
                <dd>{{ booking.channel_idx }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.provider") }}</dt>
                <dd>{{ booking.provider }}</dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.calendar_event_id") }}</dt>
                <dd>
                  <code class="cf-code">{{ booking.calendar_event_id }}</code>
                </dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.meet_link") }}</dt>
                <dd>
                  <a
                    v-if="booking.meet_link"
                    :href="safeHref(booking.meet_link)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="cf-inline-link"
                  >
                    {{ $t("cf.open_meet") }}
                    <font-awesome-icon :icon="$icons.video" />
                  </a>
                  <span v-else class="t-muted">---</span>
                </dd>
              </div>
              <div class="cf-field-list__row">
                <dt>{{ $t("cf.created_at") }}</dt>
                <dd>{{ formatDateTime(booking.created_at) }}</dd>
              </div>
            </dl>
          </BasicCard>

          <BasicCard :title="$t('cf.lead_status')" gap>
            <template v-if="booking.linked_lead">
              <div class="mb-5">
                <StatusBadge
                  :label="leadStatusLabel($t, booking.linked_lead.status)"
                  :tone="leadStatusVariant(booking.linked_lead.status)"
                />
              </div>
              <dl class="cf-field-list">
                <div class="cf-field-list__row">
                  <dt>{{ $t("cf.name") }}</dt>
                  <dd>
                    <span v-if="booking.linked_lead.name">{{
                      booking.linked_lead.name
                    }}</span>
                    <span v-else class="t-muted">---</span>
                  </dd>
                </div>
                <div class="cf-field-list__row">
                  <dt>{{ $t("cf.email") }}</dt>
                  <dd>{{ booking.linked_lead.email }}</dd>
                </div>
                <div class="cf-field-list__row">
                  <dt>{{ $t("cf.deal_value") }}</dt>
                  <dd>
                    <span v-if="booking.linked_lead.deal_value">{{
                      booking.linked_lead.deal_value
                    }}</span>
                    <span v-else class="t-muted">---</span>
                  </dd>
                </div>
              </dl>
            </template>
            <EmptyState
              v-else
              icon="user"
              :title="$t('cf.no_linked_lead')"
              :message="''"
            />
          </BasicCard>
        </div>
      </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_Booking } from "@/api/contactForms/api";
import { leadStatusLabel, leadStatusVariant } from "./helpers/leadStatus";
import { extractApiMessage } from "@/composables/useFormErrors";
import { safeHref } from "@/utils/safeHref";

export default {
  name: "BookingDetail",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      booking: null,
      loading: false,
    };
  },
  computed: {
    headerActions() {
      const leadId = this.booking.linked_lead.id;
      return [
        { key: "open-lead", role: "primary", label: this.$t("cf.open_lead"),
          onClick: () => this.$router.push(`/forms/leads/${leadId}`) },
      ];
    },
  },
  mounted() {
    this.fetchBooking();
  },
  methods: {
    safeHref,
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
    async fetchBooking() {
      this.loading = true;
      try {
        const { data } = await GET_Booking(this.$route.params.id);
        this.booking = data;
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.cf-booking-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
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
  grid-template-columns: 160px 1fr;
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

.cf-inline-link {
  color: var(--text-accent);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.cf-inline-link:hover {
  text-decoration: underline;
}

.cf-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fs-200);
  padding: 2px var(--space-1);
  background: var(--surface-raised);
  border-radius: var(--radius-base);
  color: var(--text-body);
}
</style>
