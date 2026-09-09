<template>
  <div class="p-500 fs-300 t-basic-800 h-100 ov-h">
    <Teleport to="#reviews-toolbar-left" defer>
      <BasicButton
        text=""
        icon="arrow-left"
        class="bg-basic-200 t-basic-600"
        @click="$router.push('/reviews/queue')"
      />
      <span class="fw-600 fs-400">{{
        review.title || $t("reviews.detail")
      }}</span>
      <StatusBadge
        v-if="review.status"
        :label="$t(`reviews.status.${review.status}`)"
        :variant="statusVariant(review.status)"
        data-testid="review-status"
      />
    </Teleport>
    <Teleport to="#reviews-toolbar-right" defer>
      <span v-if="isDirty" class="chip bg-warning-100 t-warning-300">{{
        $t("unsaved.changes")
      }}</span>
      <BasicButton
        v-if="can('accepted')"
        :text="$t('reviews.approve')"
        class="bg-positive-100 t-positive-300"
        :isDisabled="busy"
        data-testid="review-approve"
        @click="transition(approveFn, 'approved')"
      />
      <BasicButton
        v-if="can('not_accepted')"
        :text="$t('reviews.reject')"
        class="bg-negative-100 t-negative-300"
        :isDisabled="busy"
        data-testid="review-reject"
        @click="transition(rejectFn, 'rejected')"
      />
      <BasicButton
        v-if="can('pending')"
        :text="$t('reviews.requeue')"
        class="bg-basic-200 t-basic-600"
        :isDisabled="busy"
        data-testid="review-requeue"
        @click="transition(requeueFn, 'requeued')"
      />
      <BasicButton
        v-if="can('archived')"
        :text="$t('reviews.archive')"
        class="bg-basic-200 t-basic-600"
        :isDisabled="busy"
        data-testid="review-archive"
        @click="transition(archiveFn, 'archived')"
      />
      <BasicButton
        text=""
        icon="trash-can"
        class="bg-negative-100 t-negative-300"
        data-testid="review-delete"
        @click="showDeleteConfirm = true"
      />
      <BasicButton
        :text="$t('common.save')"
        class="bg-support-400 t-basic-100"
        :isDisabled="busy"
        data-testid="review-save"
        @click="saveReview"
      />
    </Teleport>

    <div class="bg-basic-100 b-basic-300 br-50 h-100 ovy-auto p-500">
      <Loader v-if="loading" />
      <template v-else>
        <div class="detail-grid">
          <!-- Review content -->
          <section class="detail-section">
            <h2 class="fs-500 fw-600 mb-300">
              {{ $t("reviews.section.review") }}
            </h2>
            <FormField
              :label="$t('reviews.field.name')"
              :error="fieldError('name')"
              class="mb-300"
            >
              <BasicInput v-model="form.name" data-testid="review-name" />
            </FormField>
            <FormField
              :label="$t('reviews.field.title')"
              :error="fieldError('title')"
              required
              class="mb-300"
            >
              <div class="flex ai-ct gap-200">
                <BasicInput
                  v-model="form.title"
                  class="flex-1"
                  data-testid="review-title"
                />
                <BasicButton
                  v-if="languages.length"
                  :text="$t('reviews.translations')"
                  icon="language"
                  class="btn-outline"
                  @click="translatingField = 'title'"
                />
              </div>
            </FormField>
            <FormField
              :label="$t('reviews.field.detail')"
              :error="fieldError('detail')"
              required
            >
              <div class="flex ai-fs gap-200">
                <TextAreaBasic
                  v-model="form.detail"
                  class="flex-1"
                  data-testid="review-detail"
                />
                <BasicButton
                  v-if="languages.length"
                  :text="$t('reviews.translations')"
                  icon="language"
                  class="btn-outline"
                  @click="translatingField = 'detail'"
                />
              </div>
            </FormField>
          </section>

          <!-- Meta: author, product, ratings, audit -->
          <section class="detail-section">
            <h2 class="fs-500 fw-600 mb-300">
              {{ $t("reviews.section.author") }}
            </h2>
            <dl class="meta">
              <dt>{{ $t("reviews.field.customer") }}</dt>
              <dd>
                {{
                  review.customer_id
                    ? `#${review.customer_id}`
                    : $t("reviews.anonymous")
                }}
              </dd>
              <dt>{{ $t("reviews.field.customer_email") }}</dt>
              <dd>{{ review.customer_email || "—" }}</dd>
              <dt>{{ $t("reviews.field.sku") }}</dt>
              <dd>
                {{ review.sku }}
                <span class="t-basic-500">{{ review.product_name }}</span>
              </dd>
              <dt>{{ $t("reviews.field.channel") }}</dt>
              <dd>{{ review.channel_idx || "—" }}</dd>
              <dt>{{ $t("reviews.field.source") }}</dt>
              <dd>{{ review.source || "—" }}</dd>
              <dt>{{ $t("reviews.field.language") }}</dt>
              <dd>{{ review.language || "—" }}</dd>
              <dt>{{ $t("reviews.col.created") }}</dt>
              <dd>{{ formatDate(review.created_at) }}</dd>
            </dl>

            <h2 class="fs-500 fw-600 mt-400 mb-300">
              {{ $t("reviews.section.ratings") }}
            </h2>
            <dl class="meta">
              <template
                v-for="rating in review.ratings || []"
                :key="rating.rating_name"
              >
                <dt>{{ rating.rating_name }}</dt>
                <dd>{{ formatStars(rating.rate) }}</dd>
              </template>
            </dl>

            <h2 class="fs-500 fw-600 mt-400 mb-300">
              {{ $t("reviews.section.audit") }}
            </h2>
            <dl class="meta">
              <dt>{{ $t("reviews.field.reviewed_by") }}</dt>
              <dd>{{ review.reviewed_by || "—" }}</dd>
              <dt>{{ $t("reviews.field.reviewed_at") }}</dt>
              <dd>
                {{ review.reviewed_at ? formatDate(review.reviewed_at) : "—" }}
              </dd>
              <dt>{{ $t("reviews.field.reject_reason") }}</dt>
              <dd>{{ review.reject_reason || "—" }}</dd>
            </dl>
            <FormField :label="$t('reviews.reject_reason')" class="mt-300">
              <BasicInput
                v-model="rejectReason"
                :placeholder="$t('reviews.reject_reason_placeholder')"
                data-testid="review-reject-reason"
              />
            </FormField>

            <h2 class="fs-500 fw-600 mt-400 mb-300">
              {{ $t("reviews.section.consents") }}
            </h2>
            <p
              v-if="!(review.consents || []).length"
              class="fs-200 t-basic-500"
            >
              {{ $t("reviews.no_consents") }}
            </p>
            <ul v-else class="fs-200">
              <li v-for="consent in review.consents" :key="consent.slug">
                {{ consent.slug }}
                <span class="t-basic-500">{{
                  formatDate(consent.accepted_at)
                }}</span>
              </li>
            </ul>
          </section>
        </div>

        <!-- Translations -->
        <section class="detail-section mt-400">
          <div class="flex ai-ct jc-sb mb-300 flex-wrap gap-200">
            <h2 class="fs-500 fw-600">
              {{ $t("reviews.section.translations") }}
            </h2>
            <div v-if="translatorAvailable" class="flex ai-ct gap-200">
              <Dropdown
                :values="aiTargetOptions"
                :selected="aiTarget ? [aiTarget] : []"
                :placeholder="$t('reviews.translate_target')"
                class="detail-lang-select"
                data-testid="review-ai-target"
                @onSelect="(val) => (aiTarget = val)"
              />
              <BasicButton
                :text="$t('reviews.translate_ai')"
                icon="language"
                class="btn-outline"
                :isDisabled="!aiTarget || busy"
                data-testid="review-ai-translate"
                @click="translateWithAi"
              />
            </div>
          </div>
          <p
            v-if="!(review.translations || []).length"
            class="fs-200 t-basic-500"
          >
            {{ $t("reviews.no_translations") }}
          </p>
          <DataTable
            v-else
            :columns="translationColumns"
            :rows="review.translations"
            row-key="language"
          >
            <template #cell-origin="{ value }">
              <StatusBadge
                :label="$t(`reviews.origin.${value}`)"
                :variant="value === 'manual' ? 'positive' : 'informative'"
              />
            </template>
            <template #cell-modified_at="{ value }">{{
              formatDate(value)
            }}</template>
          </DataTable>
        </section>

        <!-- Merchant reply -->
        <section class="detail-section mt-400">
          <h2 class="fs-500 fw-600 mb-300">
            {{ $t("reviews.section.reply") }}
          </h2>
          <FormField :label="$t('reviews.field.reply')" class="mb-300">
            <TextAreaBasic
              v-model="replyForm.body"
              data-testid="review-reply-body"
            />
          </FormField>
          <div class="flex ai-ct gap-300 flex-wrap">
            <Switcher
              :label="$t('reviews.field.reply_published')"
              :selected="replyForm.is_published"
              @onSelect="replyForm.is_published = !replyForm.is_published"
            />
            <BasicButton
              :text="$t('reviews.save_reply')"
              class="bg-support-400 t-basic-100"
              :isDisabled="!replyForm.body || busy"
              data-testid="review-reply-save"
              @click="saveReply"
            />
            <BasicButton
              v-if="review.reply"
              :text="$t('reviews.delete_reply')"
              class="bg-negative-100 t-negative-300"
              :isDisabled="busy"
              data-testid="review-reply-delete"
              @click="deleteReply"
            />
            <BasicButton
              v-if="review.reply && languages.length"
              :text="$t('reviews.translations')"
              icon="language"
              class="btn-outline"
              data-testid="review-reply-translations"
              @click="translatingField = 'reply'"
            />
            <span v-if="review.reply" class="fs-200 t-basic-500">
              {{ review.reply.author || "—" }} ·
              {{ formatDate(review.reply.modified_at) }}
            </span>
            <StatusBadge
              v-for="t9n in (review.reply && review.reply.translations) || []"
              :key="t9n.language"
              :label="t9n.language.toUpperCase()"
              :variant="t9n.origin === 'manual' ? 'positive' : 'informative'"
            />
          </div>
        </section>

        <!-- Photos -->
        <section class="detail-section mt-400">
          <h2 class="fs-500 fw-600 mb-300">
            {{ $t("reviews.section.images") }}
          </h2>
          <p v-if="!(review.images || []).length" class="fs-200 t-basic-500">
            {{ $t("reviews.no_images") }}
          </p>
          <div v-else class="images-grid">
            <div
              v-for="image in review.images"
              :key="image.id"
              class="image-card b-basic-300 br-50 p-200"
            >
              <a :href="resolveMediaUrl(image.url)" target="_blank" rel="noopener">
                <img
                  :src="resolveMediaUrl(image.thumbnail_url)"
                  :alt="`${image.width}×${image.height}`"
                  class="image-card__thumb br-50"
                />
              </a>
              <div class="flex ai-ct jc-sb gap-100 mt-200">
                <StatusBadge
                  :label="$t(`reviews.status.${image.status}`)"
                  :variant="statusVariant(image.status)"
                />
                <div class="flex ai-ct gap-100">
                  <button
                    v-if="image.status !== 'accepted'"
                    class="detail-btn bg-positive-100 t-positive-300"
                    :disabled="busy"
                    :data-testid="`review-image-approve-${image.id}`"
                    @click="imageAction(image, 'approve')"
                  >
                    {{ $t("reviews.approve") }}
                  </button>
                  <button
                    v-if="image.status !== 'not_accepted'"
                    class="detail-btn bg-negative-100 t-negative-300"
                    :disabled="busy"
                    :data-testid="`review-image-reject-${image.id}`"
                    @click="imageAction(image, 'reject')"
                  >
                    {{ $t("reviews.reject") }}
                  </button>
                  <button
                    class="detail-btn bg-basic-200 t-basic-600"
                    :disabled="busy"
                    @click="imageAction(image, 'delete')"
                  >
                    {{ $t("common.delete") }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>

    <TranslationsDrawer
      :visible="!!translatingField"
      :title="translatingField ? $t(`reviews.field.${translatingField}`) : ''"
      :languages="languages"
      :default-language="defaultLanguage"
      :values="translatingFieldValues"
      @cancel="translatingField = null"
      @save="onTranslationsSave"
    />

    <Confirmation-modal
      :visible="showDeleteConfirm"
      @accept="deleteReview"
      @reject="showDeleteConfirm = false"
    >
      <template #header>
        <h2>{{ $t("reviews.confirm_delete_title") }}</h2>
      </template>
      <template #description>
        <p>{{ $t("reviews.confirm_delete") }}</p>
      </template>
    </Confirmation-modal>

    <Confirmation-modal
      :visible="showTranslatePrompt"
      @accept="confirmTranslatePrompt"
      @reject="showTranslatePrompt = false"
    >
      <template #header>
        <h2>{{ $t("reviews.translate_prompt_title") }}</h2>
      </template>
      <template #description>
        <p class="mb-300">{{ $t("reviews.translate_prompt_text") }}</p>
        <div class="translate-chips">
          <button
            v-for="opt in aiTargetOptions"
            :key="opt.value"
            type="button"
            class="translate-chip"
            :class="{ 'is-selected': translateTargets.includes(opt.value) }"
            :data-testid="`review-translate-chip-${opt.value}`"
            @click="toggleTranslateTarget(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </template>
      <template #footer>
        <BasicButton
          :text="$t('reviews.translate_prompt_skip')"
          class="bg-basic-200 t-basic-600"
          @click="showTranslatePrompt = false"
        />
        <BasicButton
          :text="$t('reviews.translate_ai')"
          class="bg-support-400 t-basic-100"
          :isDisabled="!translateTargets.length || busy"
          data-testid="review-translate-confirm"
          @click="confirmTranslatePrompt"
        />
      </template>
    </Confirmation-modal>

    <UnsavedChangesModal
      :visible="!!pendingNav"
      @save="saveAndLeave"
      @discard="confirmLeave"
      @stay="cancelLeave"
    />
  </div>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useMuninStore } from "@/stores/munin";
import { useRegionalStore } from "@/stores/regional";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import { formatDate } from "@/utils/format";
import UnsavedChangesModal from "@/functionals/Unsaved-changes-modal/index.vue";
import ConfirmationModal from "@/functionals/Confirmation-modal/index.vue";
import {
  GET_Review,
  PATCH_Review,
  DELETE_Review,
  POST_ApproveReview,
  POST_RejectReview,
  POST_ArchiveReview,
  POST_RequeueReview,
  POST_ReviewTranslation,
  PATCH_ReviewTranslation,
  PUT_ReviewReply,
  DELETE_ReviewReply,
  POST_ReviewReplyTranslation,
  PATCH_ReviewReplyTranslation,
  POST_ApproveReviewImage,
  POST_RejectReviewImage,
  DELETE_ReviewImage,
  POST_TranslateReview,
} from "@/api/reviews/api";
import { statusVariant, formatStars } from "./reviewStatus";
import { resolveMediaUrl } from "@/utils/resolveMediaUrl";

// Mirrors REVIEW_STATUS_TRANSITIONS in django-reviews/enum.py — which buttons make sense for a status.
const TRANSITIONS = {
  pending: ["accepted", "not_accepted", "archived"],
  accepted: ["pending", "not_accepted", "archived"],
  not_accepted: ["accepted", "pending", "archived"],
  archived: [],
};

export default {
  name: "ReviewDetail",
  components: { UnsavedChangesModal, ConfirmationModal },
  setup() {
    const loader = useLoaderStore();
    const munin = useMuninStore();
    const notify = useNotifyStore();
    const regional = useRegionalStore();
    const unsaved = useUnsavedChanges();
    const formErrors = useFormErrors();
    return { loader, munin, notify, regional, ...unsaved, formErrors };
  },
  data() {
    return {
      review: {},
      form: { name: "", title: "", detail: "" },
      replyForm: { body: "", is_published: true },
      rejectReason: "",
      translatingField: null,
      aiTarget: null,
      showTranslatePrompt: false,
      translateTargets: [],
      loading: false,
      busy: false,
      showDeleteConfirm: false,
    };
  },
  computed: {
    reviewId() {
      return this.$route.params.id;
    },
    channelIdx() {
      return this.review.channel_idx || process.env.VUE_APP_CHANNEL;
    },
    languages() {
      const codes = new Set(
        (this.regional.languages || []).map((l) => String(l.iso2).toLowerCase())
      );
      for (const t9n of this.review.translations || []) codes.add(t9n.language);
      return Array.from(codes).sort();
    },
    defaultLanguage() {
      return (
        this.review.language || (process.env.VUE_APP_LANG || "pl").toLowerCase()
      );
    },
    translatingFieldValues() {
      if (!this.translatingField) return {};
      const values = {};
      if (this.translatingField === "reply") {
        for (const t9n of this.review.reply?.translations || [])
          values[t9n.language] = t9n.body || "";
        return values;
      }
      for (const t9n of this.review.translations || [])
        values[t9n.language] = t9n[this.translatingField] || "";
      return values;
    },
    // The AI translator is an optional backend module: keep its UI dormant when
    // the module is absent instead of letting the call fail (repo convention).
    translatorAvailable() {
      return this.munin.isModuleEnabled("reviews_translator");
    },
    aiTargetOptions() {
      const existing = new Set(
        (this.review.translations || []).map((t) => t.language)
      );
      return this.languages
        .filter((code) => !existing.has(code) && code !== this.defaultLanguage)
        .map((code) => ({ label: code.toUpperCase(), value: code }));
    },
    translationColumns() {
      return [
        {
          key: "language",
          label: this.$t("reviews.field.language"),
          width: "90px",
        },
        { key: "origin", label: "", width: "100px" },
        {
          key: "title",
          label: this.$t("reviews.field.title"),
          width: "minmax(160px, 1fr)",
        },
        {
          key: "detail",
          label: this.$t("reviews.field.detail"),
          width: "minmax(200px, 2fr)",
        },
        {
          key: "modified_at",
          label: this.$t("reviews.field.reviewed_at"),
          width: "140px",
        },
      ];
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
    this.regional.fetchAll?.().catch(() => {});
    await this.fetchReview();
  },
  methods: {
    formatDate,
    formatStars,
    statusVariant,
    can(target) {
      return (TRANSITIONS[this.review.status] || []).includes(target);
    },
    fieldError(name) {
      return this.formErrors.getFieldError(name)?.msg || "";
    },
    approveFn() {
      return POST_ApproveReview(this.reviewId);
    },
    rejectFn() {
      return POST_RejectReview(this.reviewId, { reason: this.rejectReason });
    },
    archiveFn() {
      return POST_ArchiveReview(this.reviewId);
    },
    requeueFn() {
      return POST_RequeueReview(this.reviewId);
    },
    applyReview(data) {
      this.review = data;
      this.form = {
        name: data.name || "",
        title: data.title || "",
        detail: data.detail || "",
      };
      this.replyForm = {
        body: data.reply?.body || "",
        is_published: data.reply ? data.reply.is_published : true,
      };
      this.snapshot(this.form);
      this.track(this.form);
    },
    async fetchReview() {
      this.loading = true;
      try {
        const { data } = await GET_Review(this.reviewId);
        this.applyReview(data);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    async run(fn, toastKey, toastParams) {
      if (this.busy) return null;
      this.busy = true;
      this.loader.loaderStart();
      try {
        const result = await fn();
        if (toastKey)
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t(toastKey, toastParams),
          });
        return result;
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        return null;
      } finally {
        this.busy = false;
        this.loader.loaderFinish();
      }
    },
    async transition(fn, toastSuffix) {
      const result = await this.run(fn, `reviews.toast.${toastSuffix}`);
      if (result?.data) this.applyReview(result.data);
      // Freshly accepted content is the moment to offer AI translation - but only
      // when there are languages left to translate into.
      if (
        result?.data &&
        toastSuffix === "approved" &&
        this.translatorAvailable &&
        this.aiTargetOptions.length
      ) {
        this.translateTargets = [];
        this.showTranslatePrompt = true;
      }
    },
    toggleTranslateTarget(code) {
      this.translateTargets = this.translateTargets.includes(code)
        ? this.translateTargets.filter((c) => c !== code)
        : [...this.translateTargets, code];
    },
    async confirmTranslatePrompt() {
      if (!this.translateTargets.length) return;
      const result = await this.requestAiTranslation([...this.translateTargets]);
      if (result?.data) {
        const jobs = (result.data.job_ids || []).join(", ") || "—";
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("reviews.toast.translation_requested", { jobs }),
        });
      }
      this.showTranslatePrompt = false;
    },
    async saveReview() {
      const valid = this.formErrors.validateRequired(this.form, {
        title: this.$t("reviews.field.title"),
        detail: this.$t("reviews.field.detail"),
      });
      if (!valid) return;
      const result = await this.run(
        () => PATCH_Review(this.reviewId, { ...this.form }),
        "reviews.toast.saved"
      );
      if (result?.data) this.applyReview(result.data);
    },
    async saveAndLeave() {
      await this.saveReview();
      this.confirmLeave();
    },
    async deleteReview() {
      this.showDeleteConfirm = false;
      const result = await this.run(
        () => DELETE_Review(this.reviewId),
        "reviews.toast.deleted"
      );
      if (result) {
        this.snapshot(this.form);
        this.$router.push("/reviews/queue");
      }
    },
    async onTranslationsSave({ values }) {
      const field = this.translatingField;
      const isReply = field === "reply";
      const existing = new Set(
        (isReply
          ? this.review.reply?.translations || []
          : this.review.translations || []
        ).map((t) => t.language)
      );
      const result = await this.run(async () => {
        for (const lang of this.languages) {
          const value = values[lang] || "";
          if (existing.has(lang)) {
            if (isReply)
              await PATCH_ReviewReplyTranslation(this.reviewId, lang, {
                body: value,
              });
            else
              await PATCH_ReviewTranslation(this.reviewId, lang, {
                [field]: value,
              });
          } else if (value) {
            if (isReply)
              await POST_ReviewReplyTranslation(this.reviewId, {
                language: lang,
                body: value,
              });
            else
              await POST_ReviewTranslation(this.reviewId, {
                language: lang,
                [field]: value,
              });
          }
        }
      }, "reviews.toast.translations_saved");
      if (result !== null) {
        this.translatingField = null;
        await this.fetchReview();
      }
    },
    async requestAiTranslation(targets) {
      return this.run(() =>
        POST_TranslateReview(this.channelIdx, this.reviewId, {
          target_languages: targets,
        })
      );
    },
    async translateWithAi() {
      const result = await this.requestAiTranslation([this.aiTarget]);
      if (result?.data) {
        const jobs = (result.data.job_ids || []).join(", ") || "—";
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("reviews.toast.translation_requested", { jobs }),
        });
        this.aiTarget = null;
      }
    },
    async saveReply() {
      const result = await this.run(
        () =>
          PUT_ReviewReply(this.reviewId, {
            body: this.replyForm.body,
            is_published: this.replyForm.is_published,
          }),
        "reviews.toast.reply_saved"
      );
      if (result) await this.fetchReview();
    },
    async deleteReply() {
      const result = await this.run(
        () => DELETE_ReviewReply(this.reviewId),
        "reviews.toast.reply_deleted"
      );
      if (result) await this.fetchReview();
    },
    async imageAction(image, action) {
      const calls = {
        approve: () => POST_ApproveReviewImage(this.reviewId, image.id),
        reject: () => POST_RejectReviewImage(this.reviewId, image.id),
        delete: () => DELETE_ReviewImage(this.reviewId, image.id),
      };
      const toast =
        action === "delete"
          ? "reviews.toast.image_deleted"
          : "reviews.toast.image_updated";
      const result = await this.run(calls[action], toast);
      if (result) await this.fetchReview();
    },
  },
};
</script>

<style lang="scss" scoped>
.detail-grid {
  display: grid;
  grid-template-columns: minmax(320px, 2fr) minmax(280px, 1fr);
  gap: var(--space-400);
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}
.detail-section {
  border: 1px solid var(--c-basic-200);
  border-radius: var(--radius-md);
  padding: 20px;
}
.meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
  font-size: var(--fs-200);
  dt {
    color: var(--c-basic-500);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  dd {
    margin: 0;
  }
}
.detail-lang-select {
  min-width: 140px;
}
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-300);
}
.image-card__thumb {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
}
.detail-btn {
  height: var(--elem-height);
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--fs-200);
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.translate-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 13rem;
  overflow-y: auto;
}
.translate-chip {
  padding: 2px 12px;
  border-radius: 999px;
  font-size: var(--fs-200);
  font-weight: 500;
  border: 1px solid var(--c-basic-400);
  background: transparent;
  color: var(--c-basic-600);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  &:hover {
    border-color: var(--c-basic-600);
  }
  &.is-selected {
    background: var(--c-support-400);
    border-color: var(--c-support-400);
    color: var(--c-basic-100);
  }
}
</style>
