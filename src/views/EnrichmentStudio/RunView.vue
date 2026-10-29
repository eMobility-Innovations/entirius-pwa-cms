<template>
  <PageLayout class="run-view">
    <template #header>
      <PageHeader :title="title" :crumbs="crumbs" :back="{ name: 'EnrichmentStudio' }" wrap-title :description="nextLine">
        <template v-if="run" #meta>
          <router-link
            v-if="focus.step"
            :to="{ query: { step: focus.step.key } }"
            replace
            class="run-view__status-link flex ai-ct gap-1"
            data-testid="run-next"
          >
            <StatusBadge :label="statusLabel" :tone="runTone(run.status)" data-testid="run-status" />
            <FontAwesomeIcon :icon="$icons.next" class="run-view__status-arrow" aria-hidden="true" />
          </router-link>
          <StatusBadge v-else :label="statusLabel" :tone="runTone(run.status)" data-testid="run-status" />
          <router-link v-if="draft" :to="draft" class="t-accent fw-600 fs-250" data-testid="run-open-draft">
            {{ $t("enrichment.studio.open_draft_short") }}
          </router-link>
          <Tag :label="channelName" data-testid="run-channel" />
          <Tag v-if="language" :label="language" data-testid="run-language" />
          <span class="flex ai-ct gap-1 fs-250 t-secondary">
            {{ $t(closed ? "enrichment.studio.run_cost_final" : "enrichment.studio.run_cost") }}
            <CostLabel :cost="run.cost_usd" :partial="!run.cost_complete" data-testid="run-cost" />
          </span>
        </template>
        <template v-if="run && canCancel" #actions>
          <ActionBar>
            <BasicMenu :items="menuItems" :label="$t('enrichment.studio.run_menu')" placement="bottom-end" @select="confirmCancel = true">
              <template #trigger>
                <IconButton icon="more" variant="outline" mutates :label="$t('enrichment.studio.run_menu')" data-testid="run-menu" />
              </template>
            </BasicMenu>
          </ActionBar>
        </template>
      </PageHeader>
    </template>

    <Loader v-if="loading" block />
    <EmptyState
      v-else-if="!run"
      icon="empty"
      size="md"
      :title="$t('enrichment.studio.missing')"
      :message="$t('enrichment.studio.missing_hint')"
      data-testid="run-missing"
    >
      <router-link :to="{ name: 'EnrichmentStudio' }" class="t-accent fw-600">{{ $t("enrichment.studio.back_to_list") }}</router-link>
    </EmptyState>
    <div v-else class="flex-column gap-6">
      <StepCallout v-if="run.status === 'cancelled'" tone="neutral" icon="info" data-testid="run-cancelled">
        <p class="m-0">{{ $t("enrichment.studio.cancelled_banner") }}</p>
        <router-link :to="{ name: 'EnrichmentStudio', query: { new: '1', from: run.uid } }" class="t-accent fw-600" data-testid="run-restart">
          {{ $t("enrichment.studio.start_same") }}
        </router-link>
      </StepCallout>
      <ProfileGate :channel="run.channel" />
      <RunBrief :run="run" />
      <div class="run-view__grid">
        <StepRail class="run-view__rail" :run="run" :selected="selectedKey" />
        <StepPanel v-if="selectedStep" :key="selectedStep.key" :run="run" :step="selectedStep" @changed="onChanged" />
      </div>
    </div>

    <ConfirmDialog
      v-model:open="confirmCancel"
      tone="danger"
      :title="$t('enrichment.studio.cancel_title')"
      :message="$t('enrichment.studio.cancel_message')"
      :confirm-label="$t('enrichment.studio.cancel_run')"
      :loading="cancelling"
      @confirm="cancelRun"
      @cancel="confirmCancel = false"
    />
  </PageLayout>
</template>

<script>
import { isNotFound } from "@/api/createClient";
import { GET_Run, POST_CancelRun } from "@/api/enrichment/api";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import CostLabel from "@/views/EnrichmentReview/CostLabel.vue";
import ProfileGate from "./ProfileGate.vue";
import RunBrief from "./RunBrief.vue";
import StepCallout from "./StepCallout.vue";
import StepPanel from "./StepPanel.vue";
import StepRail from "./StepRail.vue";
import { defaultStep, draftRoute, isRunClosed, isRunWorking, nextAction, runTitle, runTone } from "./studioLogic";

const REFRESH_MS = 4000;
const OPEN = ["running", "waiting", "failed"];
// The header badge names the step it points at when the operator has something to do there.
const BADGE_KEYS = { your_turn: "enrichment.studio.your_turn_on", failed: "enrichment.studio.failed_on" };

// One run of a workflow: the header says what to do now (the badge links to the step that waits for you), the channel,
// language and cost; then the brief, the steps rail and the selected step. While a step works the run refreshes
// itself; an approval moves on to the next step. Cancel run sits in the header's overflow menu.
export default {
  name: "RunView",
  components: { CostLabel, ProfileGate, RunBrief, StepCallout, StepPanel, StepRail },
  setup() {
    return { notify: useNotifyStore(), channels: useContentDBChannelStore(), runTone };
  },
  data() {
    return { run: null, loading: true, timer: null, confirmCancel: false, cancelling: false };
  },
  computed: {
    uid() {
      return this.$route.params.uid;
    },
    title() {
      return runTitle(this.run) || this.$t("enrichment.studio.title");
    },
    crumbs() {
      return [{ label: this.$t("enrichment.studio.title"), to: { name: "EnrichmentStudio" } }, { label: this.title }];
    },
    selectedKey() {
      const asked = this.$route.query.step;
      return this.run?.steps.some((s) => s.key === asked) ? asked : defaultStep(this.run);
    },
    selectedStep() {
      return this.run?.steps.find((s) => s.key === this.selectedKey) || null;
    },
    closed() {
      return isRunClosed(this.run);
    },
    focus() {
      const action = nextAction(this.run);
      return BADGE_KEYS[action.kind] ? action : { ...action, step: null };
    },
    statusLabel() {
      const key = BADGE_KEYS[this.focus.kind];
      return key ? this.$t(key, { step: this.focus.step.label }) : this.$t(`enrichment.studio.run_status.${this.run.status}`);
    },
    // The page's help line: what happens now, in one sentence.
    nextLine() {
      if (!this.run) return "";
      const { kind, step } = nextAction(this.run);
      const path = `enrichment.studio.next.${kind}`;
      const text = this.$t(path, { step: step?.label });
      return text === path ? "" : text;
    },
    draft() {
      return this.run.status === "done" ? draftRoute(this.run) : null;
    },
    channelName() {
      const channel = this.channels.channels.find((c) => c.idx === this.run.channel);
      return channel?.name || this.run.channel;
    },
    language() {
      return String(this.run.inputs?.language || "").toUpperCase();
    },
    canCancel() {
      return OPEN.includes(this.run.status);
    },
    menuItems() {
      return [{ key: "cancel", label: this.$t("enrichment.studio.cancel_run"), danger: true, testid: "run-cancel" }];
    },
  },
  watch: {
    uid: { immediate: true, handler: "load" },
  },
  mounted() {
    this.channels.fetchChannelsAndLanguages();
  },
  // A read still on its way when the page closes lands on nothing: no new poll, no toast.
  beforeUnmount() {
    this.disposed = true;
    clearTimeout(this.timer);
  },
  methods: {
    async load() {
      this.loading = true;
      await this.refresh();
      this.loading = false;
    },
    async refresh() {
      clearTimeout(this.timer);
      try {
        const { data } = await GET_Run(this.uid);
        if (this.disposed) return;
        this.setRun(data);
      } catch (err) {
        if (this.disposed) return;
        if (!isNotFound(err)) this.failed(err);
        if (!this.run) return;
        this.schedule();
      }
    },
    setRun(run) {
      this.run = run;
      this.schedule();
    },
    schedule() {
      clearTimeout(this.timer);
      if (!this.disposed && isRunWorking(this.run)) this.timer = setTimeout(this.refresh, REFRESH_MS);
    },
    onChanged(run, { advance } = {}) {
      this.setRun(run);
      if (advance) this.$router.replace({ query: { step: defaultStep(run) } });
    },
    async cancelRun() {
      this.cancelling = true;
      try {
        const { data } = await POST_CancelRun(this.uid);
        this.setRun(data);
        this.notify.spawnNotification({ type: "positive", msg: this.$t("enrichment.studio.cancelled_toast") });
      } catch (err) {
        this.failed(err);
      } finally {
        this.cancelling = false;
        this.confirmCancel = false;
      }
    },
    failed(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.run-view__grid {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;

  @include max-shell {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
  }
}
.run-view__rail {
  position: sticky;
  top: var(--space-6);

  @include max-shell {
    position: static;
  }
}
.run-view__status-link {
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  text-decoration: none;
}
.run-view__status-link:hover .run-view__status-arrow {
  color: var(--text-accent);
}
.run-view__status-arrow {
  font-size: var(--fs-200);
}
</style>
