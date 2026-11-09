<template>
  <div class="focus-mode">
    <Loader block v-show="loading || queueLoading" />

    <EmptyState
      v-if="!loading && !queueLoading && !current"
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

          <FocusProduct
            v-else-if="productStep"
            ref="product"
            :key="current.subject_ref"
            :sku="current.subject_ref"
            :locked="acting || sendingBack || skipping || queueLoading"
            @done="productDone"
            @send-back="startSendBack"
          />

          <ProposalPanel
            v-else
            :key="current.id"
            :proposal="current"
            :task="tasks[current.task_id] || null"
            :busy="acting || sendingBack"
            wide
            data-testid="enrichment-focus-card"
            @accept="accept"
            @reject="startSendBack"
            @updated="remember"
          />

          <!-- Send back asks for an optional reason in place; Escape keeps the card open. -->
          <form
            v-if="sendingBack"
            class="focus-mode__send-back flex-column gap-4 rounded"
            data-testid="enrichment-focus-send-back-form"
            @submit.prevent="sendBack"
            @keydown.esc.prevent="cancelSendBack"
          >
            <FormField :label="$t('enrichment.review.focus.send_back_reason')">
              <BasicInput
                v-model="reason"
                :maxlength="512"
                :placeholder="$t('enrichment.review.focus.send_back_reason_placeholder')"
                focus-on-create
                data-testid="enrichment-focus-reason"
              />
            </FormField>
            <div class="flex ai-ct jc-sb flex-wrap gap-4">
              <span class="focus-mode__keys fs-200 t-muted">{{ $t("enrichment.review.focus.send_back_keys") }}</span>
              <div class="flex ai-ct gap-3 ml-auto">
                <BasicButton :disabled="acting" data-testid="enrichment-focus-send-back-cancel" @click="cancelSendBack">
                  {{ $t("common.cancel") }}
                </BasicButton>
                <BasicButton type="submit" variant="danger" mutates :loading="acting" data-testid="enrichment-focus-send-back">
                  {{ $t("enrichment.review.focus.send_back") }}
                </BasicButton>
              </div>
            </div>
          </form>

          <form v-if="skipping" class="focus-mode__skip flex-column gap-4 rounded"
            data-testid="enrichment-focus-skip-form" @submit.prevent="confirmSkip" @keydown.esc.prevent="cancelSkip">
            <FormField :label="$t('enrichment.review.skip')">
              <BasicInput v-model="skipNote" :maxlength="512" :disabled="acting"
                :placeholder="$t('enrichment.review.focus.skip_note_placeholder')"
                data-testid="enrichment-focus-skip-note" />
            </FormField>
            <div class="flex gap-3 ml-auto">
              <BasicButton :disabled="acting" @click="cancelSkip">{{ $t('enrichment.review.focus.skip_cancel') }}</BasicButton>
              <BasicButton type="submit" mutates :loading="acting" :disabled="acting"
                data-testid="enrichment-focus-skip-confirm">{{ $t('enrichment.review.focus.skip_confirm') }}</BasicButton>
            </div>
          </form>

          <nav class="flex ai-ct jc-sb flex-wrap gap-4" :aria-label="$t('enrichment.review.modes.focus')">
            <span class="focus-mode__keys fs-200 t-muted" data-testid="enrichment-focus-keys">
              {{ decidable ? $t("enrichment.review.focus.shortcuts") : $t("enrichment.review.focus.shortcuts_move") }}
            </span>
            <div class="flex ai-ct gap-3 ml-auto">
              <BasicButton variant="ghost" :disabled="acting || queueLoading || skipping || !canGoBack"
                data-testid="enrichment-focus-back" @click="back">
                {{ $t("enrichment.review.focus.previous") }}
              </BasicButton>
              <BasicButton :disabled="acting || queueLoading || skipping" data-testid="enrichment-focus-skip" @click="skip">
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
import FocusProduct from "./FocusProduct.vue";
import ProposalPanel from "./ProposalPanel.vue";
import StudioStepPreview from "./StudioStepPreview.vue";
import { focusSteps, isProductProposal, runUidOf, subjectName } from "./reviewLogic";
import { useFieldLabels } from "./useFieldLabels";
import { GET_Task, POST_RejectProposal } from "@/api/enrichment/api";
import { POST_ReviewNext, POST_ReviewSkip, releaseOnLeave } from "@/api/integrator/review";
import { createQueueState, applyNext, goBack, needsRefresh, productsCounterParams, rowsForSku } from "./focusQueue";

const ACTIONABLE = ["pending", "drifted"];
// The status chips that hold proposals to decide; "All" is narrowed to pending by the page while Focus is on.
const REVIEW_FILTERS = ["pending", "drifted", "__all"];

// One proposal at a time: what it is about (a product by name and SKU, a Studio article by its topic and step), its
// card (ProposalPanel) or, for a Studio step, the step as the Studio shows it with the way there.
// A Studio step is decided in the Studio. Keys: A apply · R send back · S / → skip · ← back.
// A PIM product is one step, all of it (FocusProduct): its proposals are decided together, the set first.
export default {
  name: "EnrichmentFocusMode",
  components: { FocusProduct, ProductPreviewCard, ProposalPanel, StudioStepPreview },
  props: {
    rows: { type: Array, default: () => [] },
    skuRows: { type: Array, default: () => [] },
    startSku: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 25 },
    totalCount: { type: Number, default: 0 },
    // The status chip in force: the counter says "to review" when the set holds proposals to decide.
    statusFilter: { type: String, default: "pending" },
  },
  emits: ["need-more", "need-sku", "exit"],
  setup() {
    return { notify: useNotifyStore(), pimChannel: usePimChannelStore(), ...useFieldLabels() };
  },
  data() {
    return {
      localIndex: 0,
      acting: false,
      sendingBack: false,
      reason: "",
      // What this session learnt about a proposal (decided, re-confirm, edited) by id — the parent's rows stay as read.
      known: {},
      tasks: {},
      queue: createQueueState(),
      queueEnabled: !!this.startSku || this.rows.some(isProductProposal),
      queueLoading: false,
      queueRequest: null,
      queueExhausted: false,
      skipping: false,
      skipNote: "",
      openedAt: null,
      refreshTimer: null,
      reservedSku: null,
      left: false,
      decided: false, // something on this page left the set, so the next rows slid up onto it
    };
  },
  computed: {
    steps() {
      return focusSteps(this.rows, [], { products: !this.queueEnabled });
    },
    current() {
      if (this.queueEnabled && this.queue.current) return this.productRow;
      if (this.queueLoading) return null;
      const row = this.steps[this.localIndex];
      return row ? this.known[row.id] || row : null;
    },
    productRow() {
      return rowsForSku([...this.skuRows, ...this.rows], this.queue.current)[0] || {
        id: `queue:${this.queue.current}`, subject_ref: this.queue.current,
        target_module: "pim", target_kind: "attribute_value", status: "pending",
      };
    },
    canGoBack() {
      return this.queue.current ? this.queue.history.length > 0 : this.localIndex > 0;
    },
    productStep() {
      return isProductProposal(this.current);
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
      if (this.queue.current && this.queue.remaining == null) return "";
      if (this.queue.current) return this.$t("enrichment.review.focus.products_remaining", productsCounterParams(this.queue.remaining));
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
      return (this.page - 1) * this.pageSize + this.rows.indexOf(this.steps[this.localIndex]);
    },
    hasMorePages() {
      return this.page * this.pageSize < this.totalCount;
    },
  },
  watch: {
    // A fresh page arrived (parent loaded next) — start at its top.
    rows() {
      this.localIndex = 0;
      this.decided = false;
      this.cancelSendBack();
      if (!this.queueEnabled && this.rows.some(isProductProposal)) {
        this.queueEnabled = true;
        this.nextProduct();
      }
    },
    // A page of nothing but products already passed: on to the next one.
    loading(now) {
      if (now || this.queueLoading || this.queue.current || !this.rows.length || this.steps.length) return;
      if (this.queueEnabled && !this.queueExhausted) return;
      if (this.hasMorePages) this.nextPage();
      else this.exit();
    },
    "current.task_id": { immediate: true, handler: "loadTask" },
  },
  mounted() {
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("pagehide", this.leave);
    window.addEventListener("beforeunload", this.leave);
    if (this.startSku) this.showSku(this.startSku);
    else if (this.queueEnabled) this.nextProduct();
  },
  beforeUnmount() {
    this.leave();
  },
  unmounted() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("pagehide", this.leave);
    window.removeEventListener("beforeunload", this.leave);
  },
  methods: {
    safeHref,
    showSku(sku, refreshClock = true) {
      this.queue.current = sku;
      if (refreshClock) this.openedAt = Date.now();
      this.cancelSendBack();
      this.cancelSkip();
      this.$emit("need-sku", sku);
      if (refreshClock) this.scheduleRefresh();
    },
    scheduleRefresh() {
      clearTimeout(this.refreshTimer);
      if (!this.reservedSku || this.left) return;
      this.refreshTimer = setTimeout(this.refreshReservation, 12 * 60 * 1000);
    },
    refreshReservation() {
      if (this.left || !this.reservedSku || !needsRefresh(this.openedAt, Date.now())) return;
      return this.nextProduct(undefined, true);
    },
    async nextProduct(after, refresh = false) {
      if (this.left) return;
      if (this.queueLoading) {
        if (refresh) return this.queueRequest;
        await this.queueRequest;
        return this.nextProduct(after);
      }
      this.queueRequest = this.loadNextProduct(after, refresh);
      return this.queueRequest;
    },
    async loadNextProduct(after, refresh) {
      this.queueLoading = true;
      try {
        const { data } = await POST_ReviewNext(after);
        if (this.left) return releaseOnLeave(data.sku);
        const preserveCard = refresh && this.reservedSku &&
          (this.queue.current !== this.reservedSku || data.sku === this.reservedSku);
        this.reservedSku = data.sku;
        this.queueExhausted = data.sku === null;
        if (preserveCard) return this.refreshHistory(data);
        applyNext(this.queue, data);
        if (this.queue.current) this.showSku(this.queue.current);
        else clearTimeout(this.refreshTimer);
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.queueLoading = false;
        if (!this.left && this.queueExhausted && !this.queue.current && !this.steps.length && this.hasMorePages) this.nextPage();
      }
    },
    refreshHistory(data) {
      this.queue.remaining = data.remaining;
      this.queue.reservedUntil = data.reserved_until;
      this.openedAt = Date.now();
      this.scheduleRefresh();
    },
    leave() {
      if (this.left) return;
      this.left = true;
      clearTimeout(this.refreshTimer);
      const sku = this.reservedSku || this.queue.current;
      if (sku) releaseOnLeave(sku);
    },
    exit() {
      this.leave();
      this.$emit("exit");
    },
    cancelSkip() {
      if (this.acting) return;
      this.skipping = false;
      this.skipNote = "";
    },
    async confirmSkip() {
      if (this.acting || this.queueLoading || !this.queue.current) return;
      const sku = this.queue.current;
      this.acting = true;
      try {
        await POST_ReviewSkip(sku, this.skipNote.trim().slice(0, 512));
        this.skipping = false;
        this.skipNote = "";
        await this.nextProduct(sku);
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      } finally {
        this.acting = false;
      }
    },
    onKey(e) {
      // Never hijack keys while the operator types a reason or an edit.
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey || this.acting || this.sendingBack || this.skipping || this.queueLoading || !this.current) return;
      const action = this.keyAction(e.key);
      if (!action) return;
      e.preventDefault();
      action();
    },
    keyAction(key) {
      const decide = { a: this.accept, r: this.startSendBack };
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
      this.cancelSendBack();
      if (this.localIndex < this.steps.length - 1) {
        this.localIndex += 1;
      } else if (this.hasMorePages) {
        this.nextPage();
      } else {
        this.exit(); // end of the filtered set → back to List
      }
    },
    nextPage() {
      this.$emit("need-more", { decided: this.decided }); // parent loads the rows → rows watcher resets index
    },
    productDone({ decided }) {
      this.decided ||= decided;
      this.cancelSendBack();
      return this.nextProduct(this.queue.current);
    },
    back() {
      if (this.acting || this.queueLoading || this.skipping) return;
      if (this.queue.current) {
        const sku = goBack(this.queue);
        if (sku) this.showSku(sku, false);
        return;
      }
      if (this.localIndex === 0) return;
      this.localIndex -= 1;
      this.cancelSendBack();
    },
    skip() {
      if (this.acting || this.queueLoading || this.skipping) return;
      if (this.productStep) {
        this.cancelSendBack();
        this.skipping = true;
        return;
      }
      this.advance();
    },
    async accept() {
      if (this.acting || this.queueLoading || this.skipping || this.sendingBack || !this.decidable) return;
      if (this.productStep) return this.$refs.product?.apply();
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
    startSendBack() {
      if (this.acting || this.queueLoading || this.skipping) return;
      if (this.decidable && (!this.productStep || this.$refs.product?.canSendBack)) this.sendingBack = true;
    },
    cancelSendBack() {
      this.sendingBack = false;
      this.reason = "";
    },
    async sendBack() {
      if (this.acting || this.queueLoading || this.skipping || !this.decidable) return;
      const product = this.productStep;
      const proposal = this.current;
      const reason = this.reason.trim();
      this.acting = true;
      try {
        if (product) {
          await this.$refs.product.sendBack(reason);
          return;
        }
        await POST_RejectProposal(proposal.id, reason ? { reason } : {});
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.review.focus.send_back_done") });
        this.remember({ ...proposal, status: "rejected" });
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
.focus-mode__send-back,
.focus-mode__skip {
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
