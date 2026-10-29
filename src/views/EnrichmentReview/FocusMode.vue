<template>
  <div class="focus-mode">
    <Loader block v-show="loading" />

    <EmptyState
      v-if="!loading && !current"
      icon="enrich"
      :title="$t('enrichment.review.empty')"
      :message="$t('enrichment.review.empty_message')"
    />

    <div v-else-if="current" class="focus-mode__column flex-column gap-8">
      <BasicCard>
        <div class="flex-column gap-6">
          <header class="focus-mode__head">
            <h2 class="focus-mode__title m-0" data-testid="enrichment-focus-subject">
              <a
                v-if="current.subject_url && !studioRun"
                :href="safeHref(current.subject_url)"
                target="_blank"
                rel="noopener noreferrer"
                class="focus-mode__link t-accent"
                >{{ title }}</a
              >
              <template v-else>{{ title }}</template>
            </h2>
            <span class="focus-mode__progress fs-200 t-secondary" data-testid="enrichment-focus-progress">
              {{ progress }}
            </span>
          </header>

          <div
            v-if="drifted && !studioRun"
            class="focus-mode__drift bg-warning-subtle t-warning rounded"
            data-testid="enrichment-focus-drift"
          >
            <FontAwesomeIcon :icon="$icons.warning" aria-hidden="true" />
            {{ $t("enrichment.drift.intro") }}
          </div>

          <!-- A Studio step is decided on its run, with the whole article: read here, approved there. -->
          <section v-if="studioRun" class="flex-column gap-5" data-testid="enrichment-focus-studio">
            <StatusBadge
              v-if="current.status !== 'pending'"
              class="focus-mode__status"
              :label="$t(`enrichment.status.${current.status}`)"
              size="sm"
            />
            <StudioStepPreview :key="current.id" :proposal="current" />
            <div class="focus-mode__studio flex ai-ct jc-sb flex-wrap gap-4 rounded">
              <p class="m-0 fs-300">{{ $t("enrichment.review.studio_note") }}</p>
              <router-link
                :to="{ name: 'EnrichmentStudioRun', params: { uid: studioRun }, query: studioQuery }"
                class="focus-mode__open t-accent fw-600"
                data-testid="enrichment-focus-open-studio"
                >{{ $t("enrichment.review.open_in_studio") }}</router-link
              >
            </div>
          </section>

          <ProposalPanel
            v-else
            :key="current.id"
            :proposal="current"
            :task="tasks[current.task_id] || null"
            :busy="acting || rejecting"
            wide
            data-testid="enrichment-focus-card"
            @accept="accept"
            @reject="startReject"
            @updated="remember"
          />

          <!-- Reject asks for its reason in place: Enter rejects, Esc keeps the proposal. -->
          <form
            v-if="rejecting"
            class="focus-mode__reject flex-column gap-4 rounded"
            data-testid="enrichment-focus-reject-form"
            @submit.prevent="reject"
            @keydown.esc.prevent="cancelReject"
          >
            <FormField :label="$t('enrichment.review.reject_reason')">
              <BasicInput
                v-model="reason"
                :maxlength="512"
                :placeholder="$t('enrichment.review.reject_reason_placeholder')"
                focus-on-create
                data-testid="enrichment-focus-reason"
              />
            </FormField>
            <div class="flex ai-ct jc-sb flex-wrap gap-4">
              <span class="focus-mode__keys fs-200 t-muted">{{ $t("enrichment.review.focus.reject_keys") }}</span>
              <div class="flex ai-ct gap-3 ml-auto">
                <BasicButton :disabled="acting" data-testid="enrichment-focus-reject-cancel" @click="cancelReject">
                  {{ $t("common.cancel") }}
                </BasicButton>
                <BasicButton type="submit" variant="danger" mutates :loading="acting" data-testid="enrichment-focus-reject">
                  {{ $t("common.reject") }}
                </BasicButton>
              </div>
            </div>
          </form>

          <nav class="flex ai-ct jc-sb flex-wrap gap-4" :aria-label="$t('enrichment.review.modes.focus')">
            <span class="focus-mode__keys fs-200 t-muted" data-testid="enrichment-focus-keys">
              {{ decidable ? $t("enrichment.review.focus.shortcuts") : $t("enrichment.review.focus.shortcuts_move") }}
            </span>
            <div class="flex ai-ct gap-3 ml-auto">
              <BasicButton variant="ghost" :disabled="acting || localIndex === 0"
                data-testid="enrichment-focus-back" @click="back">
                {{ $t("enrichment.review.focus.previous") }}
              </BasicButton>
              <BasicButton :disabled="acting" data-testid="enrichment-focus-skip" @click="skip">
                {{ decidable ? $t("enrichment.review.skip") : $t("enrichment.review.focus.next") }}
              </BasicButton>
            </div>
          </nav>
        </div>
      </BasicCard>

      <ProductPreviewCard
        v-if="isPimCurrent"
        :key="current.subject_ref"
        :sku="current.subject_ref"
        :channel-idx="pimChannel.activeChannelIdx"
      />
    </div>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage } from "@/composables/useFormErrors";
import { safeHref } from "@/utils/safeHref";
import ProductPreviewCard from "./ProductPreviewCard.vue";
import { acceptChosen } from "./applyMode";
import ProposalPanel from "./ProposalPanel.vue";
import StudioStepPreview from "./StudioStepPreview.vue";
import { runUidOf, subjectName } from "./reviewLogic";
import { useFieldLabels } from "./useFieldLabels";
import { GET_Task, POST_RejectProposal } from "@/api/enrichment/api";

const ACTIONABLE = ["pending", "drifted"];
// The status chips that hold proposals to decide; "All" is narrowed to pending by the page while Focus is on.
const REVIEW_FILTERS = ["pending", "drifted", "__all"];

// One proposal at a time: what it is about (a product by name and SKU, a Studio article by its topic and step), its
// card (ProposalPanel: the change by its shape, Apply / Edit / Reject) or, for a Studio step, the step as the Studio
// shows it with the way there. Apply and Reject only on a pending proposal (a drifted one re-confirms); a Studio
// step is decided in the Studio. Reject asks for its reason in place. Keys: A apply · R reject · S / → skip · ← back.
export default {
  name: "EnrichmentFocusMode",
  components: { ProductPreviewCard, ProposalPanel, StudioStepPreview },
  props: {
    rows: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 25 },
    totalCount: { type: Number, default: 0 },
    // The status chip in force: the counter says "to review" when the set holds proposals to decide.
    statusFilter: { type: String, default: "pending" },
  },
  emits: ["need-more", "exit"],
  setup() {
    return { notify: useNotifyStore(), pimChannel: usePimChannelStore(), ...useFieldLabels() };
  },
  data() {
    return {
      localIndex: 0,
      acting: false,
      rejecting: false,
      reason: "",
      // What this session learnt about a proposal (decided, re-confirm, edited) by id — the parent's rows stay as read.
      known: {},
      tasks: {},
    };
  },
  computed: {
    current() {
      const row = this.rows[this.localIndex];
      return row ? this.known[row.id] || row : null;
    },
    studioRun() {
      return runUidOf(this.current);
    },
    studioQuery() {
      const step = this.current?.target_locator?.step;
      return step ? { step } : {};
    },
    drifted() {
      return this.current?.status === "drifted";
    },
    decidable() {
      return !!this.current && !this.studioRun && ACTIONABLE.includes(this.current.status);
    },
    // A product by its name and SKU; a Studio step by its article and step — never "run:<uid>".
    title() {
      if (!this.studioRun) return subjectName(this.current);
      const step = this.proposalField(this.current);
      const topic = this.tasks[this.current.task_id]?.params?.brief?.topic || this.namedSubject;
      return topic
        ? this.$t("enrichment.review.focus.studio_title", { topic, step })
        : this.$t("enrichment.review.focus.studio_untitled", { step });
    },
    namedSubject() {
      const { subject_label: label, subject_ref: ref } = this.current;
      return label && label !== ref ? label : "";
    },
    progress() {
      const params = { index: this.globalIndex + 1, total: this.totalCount };
      const toReview = REVIEW_FILTERS.includes(this.statusFilter);
      return this.$t(toReview ? "enrichment.review.focus.progress" : "enrichment.review.progress", params);
    },
    // The product-context card only for PIM proposals (subject_ref = SKU).
    isPimCurrent() {
      const c = this.current;
      return !!c && (c.target_module || "").includes("pim") && !!c.subject_ref;
    },
    globalIndex() {
      return (this.page - 1) * this.pageSize + this.localIndex;
    },
    hasMorePages() {
      return this.page * this.pageSize < this.totalCount;
    },
  },
  watch: {
    // A fresh page arrived (parent loaded next) — start at its top.
    rows() {
      this.localIndex = 0;
      this.cancelReject();
    },
    "current.task_id": { immediate: true, handler: "loadTask" },
  },
  mounted() {
    window.addEventListener("keydown", this.onKey);
  },
  unmounted() {
    window.removeEventListener("keydown", this.onKey);
  },
  methods: {
    safeHref,
    onKey(e) {
      // Never hijack keys while the operator types (the reject reason, an edit).
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey || this.acting || this.rejecting || !this.current) return;
      const action = this.keyAction(e.key);
      if (!action) return;
      e.preventDefault();
      action();
    },
    keyAction(key) {
      const decide = { a: this.accept, r: this.startReject };
      const move = { s: this.skip, ArrowRight: this.skip, ArrowLeft: this.back };
      const lower = key.length === 1 ? key.toLowerCase() : key;
      return move[lower] || (this.decidable ? decide[lower] : null);
    },
    async loadTask(id) {
      if (id == null || id in this.tasks) return;
      this.tasks[id] = null;
      try {
        const { data } = await GET_Task(id);
        this.tasks[id] = data;
      } catch {
        // Without its run a translation shows no source text and a Studio step reads "Studio article".
      }
    },
    remember(proposal) {
      this.known = { ...this.known, [proposal.id]: proposal };
    },
    advance() {
      this.cancelReject();
      if (this.localIndex < this.rows.length - 1) {
        this.localIndex += 1;
      } else if (this.hasMorePages) {
        this.$emit("need-more"); // parent loads next page → rows watcher resets index
      } else {
        this.$emit("exit"); // end of the filtered set → back to List
      }
    },
    back() {
      if (this.localIndex === 0) return;
      this.localIndex -= 1;
      this.cancelReject();
    },
    skip() {
      this.advance();
    },
    async accept() {
      if (this.acting || !this.decidable) return;
      const proposal = this.current;
      this.acting = true;
      try {
        const { data } = await acceptChosen(proposal);
        if (data.status === "drifted") {
          // The live value moved since the proposal: the card shows the NEW value and asks for a second Apply (D2).
          this.remember({ ...proposal, ...data });
          this.notify.spawnNotification({ type: "warning", msg: this.$t("enrichment.drift.title") });
          return;
        }
        this.remember({ ...proposal, ...data, status: data.status || "applied" });
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.toast.accepted") });
        this.advance();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.acting = false;
      }
    },
    startReject() {
      if (this.decidable) this.rejecting = true;
    },
    cancelReject() {
      this.rejecting = false;
      this.reason = "";
    },
    async reject() {
      if (this.acting || !this.decidable) return;
      const proposal = this.current;
      const reason = this.reason.trim();
      this.acting = true;
      try {
        await POST_RejectProposal(proposal.id, reason ? { reason } : {});
        this.remember({ ...proposal, status: "rejected" });
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.toast.rejected") });
        this.advance();
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.acting = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";
.focus-mode__column {
  max-width: 860px;
  margin: 0 auto;
  min-width: 0;
}
.focus-mode__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2) var(--space-5);
}
.focus-mode__title {
  flex: 1 1 20rem;
  min-width: 0;
  font-size: var(--fs-400);
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.focus-mode__progress {
  flex: none;
  white-space: nowrap;
}
.focus-mode__link,
.focus-mode__open {
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
.focus-mode__status {
  align-self: flex-start;
}
.focus-mode__drift {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5);
  font-size: var(--fs-200);
}
.focus-mode__studio,
.focus-mode__reject {
  padding: var(--space-5);
  background: var(--surface-raised);
}
// Keyboard shortcuts mean nothing on a touch screen.
@include max-tablet {
  .focus-mode__keys {
    display: none;
  }
}
</style>
