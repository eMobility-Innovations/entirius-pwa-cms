<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader
        :title="`${$t('emails.lang_config')}: ${config.language || $t('emails.default_lang')}`"
        :back="goBack"
      >
        <template v-if="!loadFailed" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <Loader block v-if="loading" />

    <template v-else-if="!loadFailed">
      <BasicCard :title="$t('emails.shop_details')" gap class="mb-8">
        <div class="form-grid">
          <FormField :label="$t('emails.shop_name')">
            <BasicInput v-model="config.shop_name" />
          </FormField>
          <FormField :label="$t('emails.logo_url')">
            <BasicInput v-model="config.logo_url" />
          </FormField>
          <FormField :label="$t('emails.header_email')">
            <BasicInput v-model="config.header_mail" />
          </FormField>
          <FormField :label="$t('emails.footer_brand_name')">
            <BasicInput v-model="config.footer_name_brand" />
          </FormField>
          <FormField :label="$t('emails.footer_brand_link')">
            <BasicInput v-model="config.footer_link_brand" />
          </FormField>
          <FormField :label="$t('emails.footer_copy')" class="form-grid__wide">
            <BasicWysiwyg v-model="config.footer_copy" />
          </FormField>
        </div>
      </BasicCard>

      <BasicCard :title="$t('emails.social_links')" gap class="mb-8">
        <div class="form-grid">
          <FormField label="Facebook">
            <BasicInput v-model="config.footer_link_facebook" />
          </FormField>
          <FormField label="Instagram">
            <BasicInput v-model="config.footer_link_instagram" />
          </FormField>
          <FormField label="YouTube">
            <BasicInput v-model="config.footer_link_youtube" />
          </FormField>
          <FormField label="X (Twitter)">
            <BasicInput v-model="config.footer_link_x" />
          </FormField>
          <FormField label="TikTok">
            <BasicInput v-model="config.footer_link_tiktok" />
          </FormField>
        </div>
      </BasicCard>

      <BasicCard :title="$t('emails.footer_overrides')" gap>
        <p class="fs-200 t-secondary">{{ $t("emails.footer_overrides_hint") }}</p>
        <div class="form-grid">
          <FormField
            :label="$t('emails.footer_signature_copy_1')"
            :hint="$t('emails.footer_signature_copy_1_hint')"
          >
            <BasicInput v-model="config.footer_signature_copy_1" :maxlength="512" />
          </FormField>
          <FormField
            :label="$t('emails.footer_signature_copy_2')"
            :hint="$t('emails.footer_signature_copy_2_hint')"
          >
            <BasicInput v-model="config.footer_signature_copy_2" :maxlength="512" />
          </FormField>
          <FormField
            :label="$t('emails.footer_socials_copy')"
            :hint="$t('emails.footer_socials_copy_hint')"
          >
            <BasicInput v-model="config.footer_socials_copy" :maxlength="512" />
          </FormField>
          <FormField
            :label="$t('emails.footer_unsubscribe_label')"
            :hint="$t('emails.footer_unsubscribe_label_hint')"
          >
            <BasicInput v-model="config.footer_unsubscribe_label" :maxlength="256" />
          </FormField>
          <FormField
            :label="$t('emails.footer_automatic_copy')"
            hint-level="important"
            :hint="$t('emails.footer_automatic_copy_hint')"
            class="form-grid__wide"
          >
            <BasicWysiwyg v-model="config.footer_automatic_copy" />
          </FormField>
        </div>
      </BasicCard>
    </template>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_EmailLangConfig, PATCH_EmailLangConfig } from "@/api/emails/api";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "EmailLangConfigEdit",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      config: {},
      loading: true,
      loadFailed: false,
    };
  },
  computed: {
    headerActions() {
      return [
        {
          key: "save",
          role: "primary",
          label: this.$t("common.save"),
          onClick: this.save,
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
      try {
        const { data } = await GET_EmailLangConfig(this.$route.params.pk);
        this.config = data;
      } catch (err) {
        this.loadFailed = true;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("emails.error_load_config")),
        });
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.loader.loaderStart();
      try {
        const { data } = await PATCH_EmailLangConfig(
          this.$route.params.pk,
          this.config
        );
        this.config = data;
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
      }
    },
    goBack() {
      if (this.config.channel_id) {
        this.$router.push(`/emails/channels/${this.config.channel_id}`);
      } else {
        this.$router.push("/emails");
      }
    },
  },
};
</script>
