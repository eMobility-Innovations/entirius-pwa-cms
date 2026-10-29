<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('emails.dashboard')" />
    </template>

    <Loader block v-if="loading" />

    <template v-else>
      <section class="mb-12">
        <h2 class="fs-500 fw-600 mb-8">{{ $t("emails.channels") }}</h2>
        <p v-if="channels.length === 0" class="fs-300 t-muted">
          {{ $t("emails.no_channels") }}
        </p>
        <div class="email-cards">
          <EmailCard
            v-for="channel in channels"
            :key="channel.pk"
            :to="`/emails/channels/${channel.pk}`"
            :title="channel.label || channel.idx"
            testid="emails-channel-card"
          >
            <template #icon>
              <span
                class="color-dot"
                data-census="data"
                :style="{ backgroundColor: channel.main_background_color || 'var(--surface-hover)' }"
                aria-hidden="true"
              ></span>
            </template>
            <p class="fs-200 t-muted mt-2">{{ channel.idx }}</p>
            <p v-if="channel.from_email" class="fs-200 t-muted mt-2">
              {{ channel.from_email }}
            </p>
          </EmailCard>
        </div>
      </section>

      <section>
        <h2 class="fs-500 fw-600 mb-8">{{ $t("emails.template_types") }}</h2>
        <div class="email-cards">
          <EmailCard
            v-for="emailType in emailTypes"
            :key="emailType.slug"
            :to="`/emails/templates/${emailType.slug}`"
            :title="$t(`emails.types.${emailType.slug}`)"
            testid="emails-type-card"
          >
            <p class="fs-200 t-muted mt-2">{{ $t(`emails.type_desc.${emailType.slug}`) }}</p>
          </EmailCard>
        </div>
      </section>
    </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_EmailChannels, GET_EmailTemplates } from "@/api/emails/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import EmailCard from "./EmailCard.vue";

export default {
  name: "EmailsDashboard",
  components: { EmailCard },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      channels: [],
      loading: true,
      allEmailTypes: [
        {
          slug: "accounts-new-account"
        },
        {
          slug: "accounts-reset-password"
        },
        {
          slug: "checkout-virtual-product"
        },
        {
          slug: "loyalty-coupon-confirmation"
        },
        {
          slug: "returns-return-confirmation"
        },
        {
          slug: "allegro-virtual-product"
        },
        {
          slug: "agreements-newsletter-signup"
        },
        {
          slug: "contact-forms-booking-confirmation"
        },
        {
          slug: "contact-forms-booking-admin-notification"
        },
        {
          slug: "contact-forms-submission"
        },
      ],
      emailTypes: [],
    };
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    async fetchData() {
      this.loading = true;
      try {
        const [channelsRes, ...typeCounts] = await Promise.all([
          GET_EmailChannels(),
          ...this.allEmailTypes.map((t) =>
            GET_EmailTemplates(t.slug, { page_size: 1 })
              .then((r) => r.data.count)
              .catch(() => 0)
          ),
        ]);
        this.channels = channelsRes.data.results || [];
        this.emailTypes = this.allEmailTypes.filter(
          (_, i) => typeCounts[i] > 0
        );
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("emails.error_load_channels")),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
</style>
