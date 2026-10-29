<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader
        :title="channel.label || $t('emails.channel')"
        back="/emails"
      >
        <template #meta>
          <span v-if="channel.idx" class="fs-200 t-muted">({{ channel.idx }})</span>
        </template>
        <template v-if="!loadFailed" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <Loader block v-if="loading" />

    <EmptyState
      v-else-if="loadFailed"
      :title="$t('emails.error_load_channel')"
      icon="warning"
    >
      <BasicButton variant="ghost" @click="fetchData">
        {{ $t("emails.retry") }}
      </BasicButton>
    </EmptyState>

    <template v-else>
      <BasicCard :title="$t('emails.branding')" gap class="mb-8">
        <div class="form-grid">
          <FormField :label="$t('emails.from_name')">
            <BasicInput v-model="channel.from_name" />
          </FormField>
          <FormField :label="$t('emails.from_email')">
            <BasicInput v-model="channel.from_email" />
          </FormField>
          <FormField :label="$t('emails.main_background_color')">
            <ColorInput v-model="channel.main_background_color" />
          </FormField>
          <FormField :label="$t('emails.body_background_color')">
            <ColorInput v-model="channel.body_background_color" />
          </FormField>
          <FormField :label="$t('emails.main_text_color')">
            <ColorInput v-model="channel.main_text_color" />
          </FormField>
          <FormField :label="$t('emails.brand_text_color')">
            <ColorInput v-model="channel.brand_text_color" />
          </FormField>
          <FormField :label="$t('emails.font_family')">
            <BasicSelect v-model="channel.font_family" :options="fontOptions" />
            <p
              v-if="channel.font_family"
              :style="{ fontFamily: channel.font_family }"
              class="fs-300 t-secondary mt-2"
            >
              {{ $t("emails.font_preview") }}
            </p>
          </FormField>
          <FormField :label="$t('emails.logo_max_width')">
            <NumberInput
              v-model="channel.logo_max_width"
              suffix="px"
              :min="0"
              :max="1000"
              :step="10"
            />
          </FormField>
        </div>
      </BasicCard>

      <section>
        <h2 class="fs-500 fw-600 mb-8">{{ $t("emails.lang_configs") }}</h2>
        <p v-if="langConfigs.length === 0" class="fs-300 t-muted">
          {{ $t("emails.no_lang_configs") }}
        </p>
        <div class="email-cards">
          <EmailCard
            v-for="config in langConfigs"
            :key="config.pk"
            :to="`/emails/lang-configs/${config.pk}`"
            :title="config.language || $t('emails.default_lang')"
            testid="emails-lang-config-card"
          >
            <p v-if="config.shop_name" class="fs-200 t-muted mt-2">
              {{ config.shop_name }}
            </p>
          </EmailCard>
        </div>
      </section>
    </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import {
  GET_EmailChannel,
  GET_EmailLangConfigs,
  PATCH_EmailChannel,
} from "@/api/emails/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import EmailCard from "./EmailCard.vue";

export default {
  name: "EmailChannelEdit",
  components: { EmailCard },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      channel: {},
      langConfigs: [],
      loading: true,
      loadFailed: false,
      saving: false,
      fontOptions: [
        { label: "Arial", value: "Arial, Helvetica, sans-serif" },
        { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
        { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
        { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
        {
          label: "Trebuchet MS",
          value: "'Trebuchet MS', Helvetica, sans-serif",
        },
        {
          label: "Lucida Grande",
          value: "'Lucida Grande', 'Lucida Sans', sans-serif",
        },
        { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
        { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
        { label: "Palatino", value: "'Palatino Linotype', Palatino, serif" },
        { label: "Courier New", value: "'Courier New', Courier, monospace" },
      ],
    };
  },
  computed: {
    headerActions() {
      return [
        {
          key: "save",
          role: "primary",
          label: this.$t("common.save"),
          onClick: this.saveChannel,
          loading: this.saving,
          disabled: this.saving,
          testid: "emails-save",
        },
      ];
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    async fetchData() {
      this.loading = true;
      this.loadFailed = false;
      const pk = this.$route.params.channelPk;
      try {
        const [channelRes, configsRes] = await Promise.all([
          GET_EmailChannel(pk),
          GET_EmailLangConfigs(pk),
        ]);
        this.channel = channelRes.data;
        this.langConfigs = configsRes.data.results || [];
      } catch (err) {
        this.loadFailed = true;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("emails.error_load_channel")),
        });
      } finally {
        this.loading = false;
      }
    },
    async saveChannel() {
      if (this.saving) return;
      this.saving = true;
      this.loader.loaderStart();
      try {
        const pk = this.$route.params.channelPk;
        const { data } = await PATCH_EmailChannel(pk, {
          from_name: this.channel.from_name,
          from_email: this.channel.from_email,
          main_background_color: this.channel.main_background_color,
          body_background_color: this.channel.body_background_color,
          main_text_color: this.channel.main_text_color,
          brand_text_color: this.channel.brand_text_color,
          font_family: this.channel.font_family,
          logo_max_width: this.channel.logo_max_width,
        });
        this.channel = data;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("emails.saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("emails.error_save")),
        });
      } finally {
        this.loader.loaderFinish();
        this.saving = false;
      }
    },
  },
};
</script>
