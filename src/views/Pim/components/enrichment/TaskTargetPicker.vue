<template>
  <div class="flex-column gap-4" data-testid="task-targets">
    <FormField :label="$t('enrichment.studio.task.channel')" required>
      <BasicSelect
        :model-value="pimChannel.activeChannelIdx"
        :options="channelOptions"
        data-testid="task-targets-channel"
        @update:model-value="pimChannel.setActiveChannel"
      />
    </FormField>
    <FormField :label="$t('enrichment.studio.task.products')">
      <SegmentedControl v-model="mode" :options="modeOptions" />
    </FormField>

    <FormField v-if="mode === 'paste'" :label="$t('enrichment.studio.task.skus')" :error="tooMany">
      <BasicTextarea
        v-model="text"
        :rows="4"
        :placeholder="$t('enrichment.studio.task.skus_placeholder')"
        data-testid="task-targets-skus"
      />
    </FormField>
    <FormField v-else :label="$t('enrichment.studio.task.category')">
      <BasicSelect
        v-model="category"
        :options="categoryOptions"
        :placeholder="$t('enrichment.studio.task.category_pick')"
        searchable
        data-testid="task-targets-category"
      />
    </FormField>

    <p v-if="pending" class="fs-200 t-muted m-0" data-testid="task-targets-checking">{{ $t("enrichment.studio.task.checking") }}</p>
    <p v-else-if="summary" class="task-targets__summary fs-200 m-0" data-testid="task-targets-summary">
      <span class="t-secondary">{{ summary }}</span>
      <template v-if="unknownText">
        <span class="t-muted" aria-hidden="true"> · </span>
        <span class="t-negative" data-testid="task-targets-unknown">{{ unknownText }}</span>
      </template>
    </p>
  </div>
</template>

<script>
import { POST_ResolveSubjects } from "@/api/enrichment/api";
import { GET_Categories, GET_Products } from "@/api/pim/api";
import { usePimChannelStore } from "@/stores/pimChannel";
import { useNotifyStore } from "@/stores/notify";
import { extractApiMessage } from "@/composables/useFormErrors";
import { pluralKey } from "@/utils/plural";
import { RUN_NOW_MAX } from "./runLane";
import { MAX_REFS, UNKNOWN_SHOWN, parseRefs } from "./taskTargets";

const MODULE = "pim";
const DEBOUNCE_MS = 400;
const EMPTY = Object.freeze({ skus: [], filters: null, count: 0, pending: false });

// The products a Studio task runs on, in the active PIM channel (picked here): a pasted SKU list (checked against the
// channel — unknown SKUs are named and left out) or a category. A category of at most RUN_NOW_MAX products is sent as
// its SKUs (so Run now stays possible); a bigger one as the PIM `filter` scope (queued; the run takes the first 500).
// v-model = { skus, filters, count, pending }: `filters` set = a filter scope, `pending` = still checking.
export default {
  name: "TaskTargetPicker",
  props: {
    modelValue: { type: Object, default: () => EMPTY },
  },
  emits: ["update:modelValue"],
  setup() {
    return { pimChannel: usePimChannelStore(), notify: useNotifyStore() };
  },
  data() {
    return { mode: "paste", text: "", known: [], unknown: [], categories: [], category: null, categoryCount: 0, seq: 0, timer: null };
  },
  computed: {
    channel() {
      return this.pimChannel.activeChannelIdx;
    },
    channelOptions() {
      return this.pimChannel.channels.map((c) => ({ label: c.name || c.idx, value: c.idx }));
    },
    modeOptions() {
      return [
        { value: "paste", label: this.$t("enrichment.studio.task.mode_paste"), testid: "task-targets-mode-paste" },
        { value: "category", label: this.$t("enrichment.studio.task.mode_category"), testid: "task-targets-mode-category" },
      ];
    },
    categoryOptions() {
      return this.categories.map((c) => ({ value: c.idx, label: c.name || c.idx }));
    },
    refs() {
      return parseRefs(this.text);
    },
    tooMany() {
      return this.refs.length > MAX_REFS ? this.$t("enrichment.studio.task.too_many", { max: MAX_REFS }) : "";
    },
    pending() {
      return this.modelValue.pending;
    },
    summary() {
      if (this.mode === "category") return this.category ? this.categorySummary() : "";
      if (!this.refs.length || this.tooMany) return "";
      const count = this.known.length;
      return this.$t(`enrichment.studio.task.recognised_${pluralKey(count)}`, { count });
    },
    unknownText() {
      if (this.mode !== "paste" || !this.unknown.length) return "";
      const shown = this.unknown.slice(0, UNKNOWN_SHOWN).join(", ");
      const rest = this.unknown.length - UNKNOWN_SHOWN;
      const list = rest > 0 ? this.$t("enrichment.studio.task.and_more", { list: shown, count: rest }) : shown;
      return this.$t("enrichment.studio.task.unknown", { count: this.unknown.length, list });
    },
  },
  watch: {
    text() {
      this.schedule();
    },
    mode() {
      this.refresh();
    },
    category() {
      this.refresh();
    },
    channel() {
      this.category = null;
      this.categories = [];
      this.refresh();
    },
  },
  mounted() {
    if (!this.pimChannel.channels.length) this.pimChannel.fetchChannels();
    this.refresh();
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    emit(target) {
      this.$emit("update:modelValue", { ...EMPTY, ...target });
    },
    schedule() {
      clearTimeout(this.timer);
      this.emit({ pending: this.refs.length > 0 && !this.tooMany });
      this.timer = setTimeout(this.refresh, DEBOUNCE_MS);
    },
    refresh() {
      clearTimeout(this.timer);
      return this.mode === "paste" ? this.resolvePaste() : this.loadCategory();
    },
    // Every check gets a number: an answer that comes back after a newer one started is dropped.
    async lookup(load) {
      const mine = ++this.seq;
      try {
        const result = await load();
        if (mine === this.seq) this.emit(result);
      } catch (err) {
        if (mine !== this.seq) return;
        this.emit({});
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
      }
    },
    resolvePaste() {
      const refs = this.refs;
      this.known = [];
      this.unknown = [];
      if (!refs.length || this.tooMany || !this.channel) return this.lookup(async () => ({}));
      this.emit({ pending: true });
      return this.lookup(async () => {
        const { data } = await POST_ResolveSubjects({ module: MODULE, channel: this.channel, refs });
        this.known = data.known.map((item) => item.ref);
        this.unknown = data.unknown;
        return { skus: this.known, count: this.known.length };
      });
    },
    async loadCategory() {
      if (!this.categories.length && this.channel) await this.loadCategories();
      const idx = this.category;
      if (!idx) return this.lookup(async () => ({}));
      this.emit({ pending: true });
      return this.lookup(async () => {
        const { data } = await GET_Products(this.channel, { category: idx, page_size: RUN_NOW_MAX });
        this.categoryCount = data.count || 0;
        if (this.categoryCount > RUN_NOW_MAX) return { filters: { category_idx: idx }, count: this.categoryCount };
        const skus = (data.results || []).map((product) => product.sku);
        return { skus, count: skus.length };
      });
    },
    async loadCategories() {
      try {
        const { data } = await GET_Categories(this.channel, { page_size: 100 });
        this.categories = data.results || [];
      } catch {
        this.categories = [];
      }
    },
    categorySummary() {
      const count = this.categoryCount;
      const text = this.$t(`enrichment.studio.task.in_category_${pluralKey(count)}`, { count });
      return count > MAX_REFS ? `${text} ${this.$t("enrichment.studio.task.first_only", { max: MAX_REFS })}` : text;
    },
  },
};
</script>

<style lang="scss" scoped>
// A long list of unknown SKUs wraps anywhere: a phone never scrolls sideways.
.task-targets__summary {
  overflow-wrap: anywhere;
}
</style>
