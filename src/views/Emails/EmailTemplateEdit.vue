<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader :title="$t('emails.edit_template')" :back="goBack">
        <template #meta>
          <span class="fs-200 t-muted">({{ typeLabel }})</span>
          <span v-if="template.language_code" class="fs-200 t-accent fw-600">{{ template.language_code }}</span>
        </template>
        <template v-if="!loadFailed" #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <Loader block v-if="loading" />

    <BasicCard v-else-if="!loadFailed" :title="$t('emails.template_content')" gap>
      <div class="form-grid">
        <FormField :label="$t('emails.subject')" class="form-grid__wide">
          <BasicInput v-model="template.subject" />
        </FormField>
        <FormField
          v-for="field in contentFields"
          :key="field.key"
          :label="$t(field.label)"
          :hint="field.hint ? $t(field.hint) : ''"
          :hint-level="field.hintLevel"
          :class="{ 'form-grid__wide': field.wysiwyg }"
        >
          <BasicWysiwyg v-if="field.wysiwyg" v-model="template[field.key]" />
          <BasicInput v-else v-model="template[field.key]" />
        </FormField>
      </div>
    </BasicCard>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { GET_EmailTemplate, PATCH_EmailTemplate } from "@/api/emails/api";
import { extractApiMessage } from "@/composables/useFormErrors";
import { emailTypeLabel } from "./emailTypes";

// A hint naming a placeholder the text can carry changes what the user types: an important hint (plan 60).
const PLACEHOLDER_HINTS = [
  "emails.field_hints.user_name",
  "emails.field_hints.order_id",
  "emails.field_hints.return_id",
  "emails.field_hints.greeting",
];

const TYPE_FIELDS = {
  "accounts-new-account": [
    {
      key: "welcome",
      label: "emails.fields.welcome",
      hint: "emails.field_hints.user_name",
      wysiwyg: true,
    },
    { key: "announce", label: "emails.fields.announce", wysiwyg: true },
    { key: "confirm_button", label: "emails.fields.confirm_button", wysiwyg: false },
    { key: "thank_you", label: "emails.fields.thank_you", wysiwyg: true },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "accounts-reset-password": [
    { key: "welcome", label: "emails.fields.welcome", wysiwyg: true },
    { key: "reset_button", label: "emails.fields.reset_button", wysiwyg: false },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "checkout-virtual-product": [
    {
      key: "welcome",
      label: "emails.fields.welcome",
      hint: "emails.field_hints.user_name",
      wysiwyg: true,
    },
    {
      key: "order",
      label: "emails.fields.order",
      hint: "emails.field_hints.order_id",
      wysiwyg: true,
    },
    { key: "products", label: "emails.fields.products", wysiwyg: false },
    { key: "key_name", label: "emails.fields.key_name", wysiwyg: false },
    {
      key: "additional_key_name",
      label: "emails.fields.additional_key_name",
      wysiwyg: false,
    },
    { key: "instructions", label: "emails.fields.instructions", wysiwyg: false },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "loyalty-coupon-confirmation": [
    {
      key: "welcome",
      label: "emails.fields.welcome",
      hint: "emails.field_hints.user_name",
      wysiwyg: true,
    },
    { key: "thank_you", label: "emails.fields.thank_you", wysiwyg: true },
    { key: "coupon_copy", label: "emails.fields.coupon_copy", wysiwyg: true },
    { key: "coupon_button", label: "emails.fields.coupon_button", wysiwyg: false },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "returns-return-confirmation": [
    {
      key: "welcome",
      label: "emails.fields.welcome",
      hint: "emails.field_hints.user_name",
      wysiwyg: true,
    },
    {
      key: "return_copy",
      label: "emails.fields.return_copy",
      hint: "emails.field_hints.return_id",
      wysiwyg: true,
    },
    { key: "comment_copy", label: "emails.fields.comment_copy", wysiwyg: true },
    { key: "print_copy", label: "emails.fields.print_copy", wysiwyg: true },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "allegro-virtual-product": [
    {
      key: "welcome",
      label: "emails.fields.welcome",
      hint: "emails.field_hints.user_name",
      wysiwyg: true,
    },
    {
      key: "order",
      label: "emails.fields.order",
      hint: "emails.field_hints.order_id",
      wysiwyg: true,
    },
    { key: "products", label: "emails.fields.products", wysiwyg: false },
    { key: "key_name", label: "emails.fields.key_name", wysiwyg: false },
    {
      key: "additional_key_name",
      label: "emails.fields.additional_key_name",
      wysiwyg: false,
    },
    { key: "instructions", label: "emails.fields.instructions", wysiwyg: false },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "agreements-newsletter-signup": [
    {
      key: "welcome",
      label: "emails.fields.welcome",
      hint: "emails.field_hints.user_name",
      wysiwyg: true,
    },
    { key: "confirm_copy", label: "emails.fields.confirm_copy", wysiwyg: true },
    { key: "confirm_button", label: "emails.fields.confirm_button", wysiwyg: false },
    { key: "help", label: "emails.fields.help", wysiwyg: true },
  ],
  "contact-forms-booking-confirmation": [
    {
      key: "header_title",
      label: "emails.fields.header_title",
      hint: "emails.field_hints.header_booking",
      wysiwyg: false,
    },
    {
      key: "greeting_template",
      label: "emails.fields.greeting_template",
      hint: "emails.field_hints.greeting",
      wysiwyg: false,
    },
    {
      key: "intro_copy",
      label: "emails.fields.intro_copy",
      hint: "emails.field_hints.intro_booking",
      wysiwyg: true,
    },
    { key: "label_datetime", label: "emails.fields.label_datetime", wysiwyg: false },
    { key: "label_email", label: "emails.fields.label_email", wysiwyg: false },
    { key: "label_phone", label: "emails.fields.label_phone", wysiwyg: false },
    { key: "label_company", label: "emails.fields.label_company", wysiwyg: false },
    { key: "label_message", label: "emails.fields.label_message", wysiwyg: false },
    { key: "label_video", label: "emails.fields.label_video", wysiwyg: false },
    {
      key: "closing_copy",
      label: "emails.fields.closing_copy",
      hint: "emails.field_hints.closing_booking",
      wysiwyg: true,
    },
  ],
  "contact-forms-booking-admin-notification": [
    {
      key: "header_title",
      label: "emails.fields.header_title",
      hint: "emails.field_hints.header_admin_booking",
      wysiwyg: false,
    },
    {
      key: "intro_copy",
      label: "emails.fields.intro_copy",
      hint: "emails.field_hints.intro_booking",
      wysiwyg: true,
    },
    { key: "label_datetime", label: "emails.fields.label_datetime", wysiwyg: false },
    { key: "label_name", label: "emails.fields.label_name", wysiwyg: false },
    { key: "label_email", label: "emails.fields.label_email", wysiwyg: false },
    { key: "label_phone", label: "emails.fields.label_phone", wysiwyg: false },
    { key: "label_company", label: "emails.fields.label_company", wysiwyg: false },
    { key: "label_message", label: "emails.fields.label_message", wysiwyg: false },
    { key: "label_video", label: "emails.fields.label_video", wysiwyg: false },
    { key: "closing_copy", label: "emails.fields.closing_copy", wysiwyg: true },
  ],
  "contact-forms-submission": [
    {
      key: "header_title",
      label: "emails.fields.header_title",
      hint: "emails.field_hints.header_submission",
      wysiwyg: false,
    },
    { key: "intro_copy", label: "emails.fields.intro_copy", wysiwyg: true },
    { key: "label_email", label: "emails.fields.label_email", wysiwyg: false },
    { key: "label_type", label: "emails.fields.label_type", wysiwyg: false },
    { key: "label_form", label: "emails.fields.label_form", wysiwyg: false },
    { key: "label_code", label: "emails.fields.label_code", wysiwyg: false },
    { key: "label_body", label: "emails.fields.label_body", wysiwyg: false },
    { key: "closing_copy", label: "emails.fields.closing_copy", wysiwyg: true },
  ],
};

export default {
  name: "EmailTemplateEdit",
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    return { loader, notify };
  },
  data() {
    return {
      template: {},
      loading: true,
      loadFailed: false,
    };
  },
  computed: {
    emailType() {
      return this.$route.params.emailType;
    },
    typeLabel() {
      return emailTypeLabel(this.$t, this.emailType);
    },
    contentFields() {
      return (TYPE_FIELDS[this.emailType] || []).map((field) => ({
        ...field,
        hintLevel: PLACEHOLDER_HINTS.includes(field.hint) ? "important" : "subtle",
      }));
    },
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
    this.fetchTemplate();
  },
  methods: {
    async fetchTemplate() {
      this.loading = true;
      try {
        const { data } = await GET_EmailTemplate(
          this.emailType,
          this.$route.params.pk
        );
        this.template = data;
      } catch (err) {
        this.loadFailed = true;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("emails.error_load_template")),
        });
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.loader.loaderStart();
      try {
        const payload = { subject: this.template.subject };
        for (const field of this.contentFields) {
          payload[field.key] = this.template[field.key];
        }
        const { data } = await PATCH_EmailTemplate(
          this.emailType,
          this.$route.params.pk,
          payload
        );
        this.template = data;
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
      this.$router.push(`/emails/templates/${this.emailType}`);
    },
  },
};
</script>
