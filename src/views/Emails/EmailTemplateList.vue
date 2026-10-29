<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="typeLabel" back="/emails" />
    </template>

    <Loader block v-if="loading" />

    <template v-else>
      <p v-if="templates.length === 0" class="fs-300 t-muted">
        {{ $t("emails.no_templates") }}
      </p>
      <div class="email-cards">
        <EmailCard
          v-for="tpl in templates"
          :key="tpl.pk"
          :to="`/emails/templates/${emailType}/${tpl.pk}`"
          :title="tpl.subject || $t('emails.default_subject')"
          testid="emails-template-card"
          :level="2"
        >
          <p class="fs-200 t-muted mt-2">
            {{ $t("emails.language") }}:
            {{ tpl.language_code || $t("emails.default_lang") }}
          </p>
          <StatusBadge
            :tone="tpl.subject ? 'positive' : 'neutral'"
            :label="tpl.subject ? $t('emails.customized') : $t('emails.default')"
            class="mt-5"
          />
        </EmailCard>
      </div>
    </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_EmailTemplates } from "@/api/emails/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { emailTypeLabel } from "./emailTypes";
import EmailCard from "./EmailCard.vue";

export default {
  name: "EmailTemplateList",
  components: { EmailCard },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      templates: [],
      loading: true,
    };
  },
  computed: {
    emailType() {
      return this.$route.params.emailType;
    },
    typeLabel() {
      return emailTypeLabel(this.$t, this.emailType);
    },
  },
  mounted() {
    this.fetchTemplates();
  },
  methods: {
    async fetchTemplates() {
      this.loading = true;
      try {
        const { data } = await GET_EmailTemplates(this.emailType);
        this.templates = data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("emails.error_load_templates")),
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
