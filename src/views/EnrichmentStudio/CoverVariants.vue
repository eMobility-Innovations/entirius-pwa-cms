<template>
  <form v-if="editable" class="cover-variants flex-column gap-5" data-testid="cover-variants" @submit.prevent @focusout="save">
    <p
      ref="note"
      class="cover-variants__note type-caption m-0"
      :class="{ 'cover-variants__note--short': short }"
      :role="short ? 'alert' : undefined"
      data-testid="cover-note"
    >
      {{ $t(chosen === null ? "enrichment.studio.cover.choose_needed" : "enrichment.studio.cover.choose") }}
    </p>
    <BasicRadioGroup
      layout="cards"
      :model-value="chosen"
      :options="options"
      :name="`cover-${proposal.id}`"
      :disabled="readonly"
      :aria-label="$t('enrichment.studio.cover.variants')"
      data-testid="cover-picks"
      @update:model-value="choose"
    >
      <template #option="{ option, checked }">
        <span class="cover-variants__card flex-column gap-2">
          <StagedImage :proposal-id="proposal.id" :variant="option.value" :alt="option.label" @loaded="(src) => remember(option.value, src)" />
          <span class="cover-variants__title flex ai-ct gap-2">
            <FontAwesomeIcon v-if="checked" :icon="$icons.success" class="cover-variants__check" aria-hidden="true" />
            {{ option.label }}
          </span>
        </span>
      </template>
    </BasicRadioGroup>
    <ul class="cover-variants__tools m-0" data-testid="cover-tools">
      <li v-for="option in options" :key="option.value" class="cover-variants__tool flex ai-ct gap-2">
        <details v-if="option.prompt" class="cover-variants__prompt">
          <summary class="fs-250 t-secondary">{{ $t("enrichment.studio.cover.prompt") }}</summary>
          <p class="m-0 fs-250 t-secondary">{{ option.prompt }}</p>
          <p v-if="option.mustShow" class="m-0 fs-250 t-secondary">{{ $t("enrichment.studio.cover.must_show") }}: {{ option.mustShow }}</p>
        </details>
        <IconButton
          icon="preview"
          size="sm"
          class="cover-variants__enlarge"
          :label="$t('enrichment.studio.cover.enlarge_variant', { title: option.label })"
          :disabled="!urls[option.value]"
          data-testid="cover-enlarge"
          @click="enlarged = option.value"
        />
      </li>
    </ul>
    <FormField :label="$t('enrichment.studio.cover.alt')" :hint="$t('enrichment.studio.cover.alt_hint')">
      <BasicTextarea :model-value="alt" :rows="2" :maxlength="ALT_MAX" autogrow data-testid="cover-alt" @update:model-value="editAlt" />
    </FormField>
    <p v-if="text" class="m-0 fs-300" data-testid="cover-text">
      <span class="fw-600">{{ $t("enrichment.studio.cover.text") }}:</span> „{{ text }}”
    </p>

    <BasicModal
      :open="enlarged !== null"
      :title="enlarged === null ? '' : titleOf(variants[enlarged], enlarged)"
      size="lg"
      data-testid="cover-enlarged"
      @update:open="(open) => !open && (enlarged = null)"
    >
      <img v-if="enlarged !== null" :src="urls[enlarged]" :alt="alt" class="cover-variants__large" />
    </BasicModal>
  </form>

  <div v-else class="cover-variants flex-column gap-3" data-testid="cover-chosen">
    <StagedImage
      v-if="chosen !== null && !missing"
      class="cover-variants__summary"
      :proposal-id="proposal.id"
      :variant="chosen"
      :alt="alt"
      @missing="missing = true"
    />
    <dl class="cover-variants__facts m-0">
      <template v-if="chosen !== null">
        <dt>{{ $t("enrichment.studio.cover.chosen_label") }}</dt>
        <dd class="m-0">{{ titleOf(variants[chosen], chosen) }}</dd>
      </template>
      <dt>{{ $t("enrichment.studio.cover.alt") }}</dt>
      <dd class="m-0">{{ alt || "—" }}</dd>
      <template v-if="text">
        <dt>{{ $t("enrichment.studio.cover.text") }}</dt>
        <dd class="m-0">{{ text }}</dd>
      </template>
    </dl>
  </div>
</template>

<script>
import { PATCH_Proposal } from "@/api/enrichment/api";
import { useNotifyStore } from "@/stores/notify";
import { useReadonly } from "@/composables/useReadonly";
import { extractApiMessage } from "@/composables/useFormErrors";
import StagedImage from "./StagedImage.vue";

const ALT_MAX = 250;

// The cover step: one image per scene the AI proposed, side by side (stacked on a phone) as radio cards — pick the
// one that becomes the cover; under each card enlarge it or peek at its prompt. A pick saves at once (and takes that
// variant's alt text unless the operator wrote their own), the alt text when its
// field is left; Approve (the step panel) is off until a variant is picked and calls `prepare()`, which saves what is
// not saved yet. Once approved: the chosen image, its alt text and the text on it. The form's state goes up as
// `state` (chosen, total, dirty, saving, saved).
export default {
  name: "CoverVariants",
  components: { StagedImage },
  props: {
    proposal: { type: Object, required: true },
  },
  emits: ["updated", "state"],
  setup() {
    return { notify: useNotifyStore(), readonly: useReadonly(), ALT_MAX };
  },
  data() {
    return {
      chosen: null,
      alt: "",
      urls: {},
      enlarged: null,
      short: false,
      missing: false,
      dirty: false,
      saving: false,
      saved: false,
      inflight: null,
    };
  },
  computed: {
    value() {
      return this.proposal.proposed_value || {};
    },
    variants() {
      return this.value.variants || [];
    },
    text() {
      return String(this.value.cover_text || "").trim();
    },
    editable() {
      return this.proposal.status === "pending";
    },
    options() {
      return this.variants.map((variant, index) => ({
        value: index,
        label: this.titleOf(variant, index),
        prompt: variant?.prompt || "",
        mustShow: (variant?.must_show || []).join("; "),
        testid: "cover-pick",
      }));
    },
    state() {
      const { chosen, dirty, saving, saved } = this;
      return { chosen, total: this.variants.length, dirty, saving, saved };
    },
  },
  watch: {
    "proposal.id": { immediate: true, handler: "reset" },
    // A saved value comes back from the server; edits made while it was on the way win.
    "proposal.proposed_value"() {
      if (!this.dirty) this.reset();
    },
    state: { immediate: true, handler(state) { this.$emit("state", state); } },
  },
  methods: {
    reset() {
      const chosen = this.value.chosen;
      this.chosen = Number.isInteger(chosen) && chosen >= 0 && chosen < this.variants.length ? chosen : null;
      this.alt = this.value.alt || "";
      this.short = false;
      this.missing = false;
      this.dirty = false;
    },
    titleOf(variant, index) {
      return variant?.title || this.$t("enrichment.studio.cover.variant", { n: index + 1 });
    },
    remember(index, src) {
      this.urls = { ...this.urls, [index]: src };
    },
    choose(index) {
      if (this.readonly) return;
      this.chosen = index;
      // Every variant comes with its own alt text; a pick takes it, unless the operator wrote one of their own.
      if (!this.alt.trim() || this.variants.some((variant) => variant?.alt === this.alt)) this.alt = this.variants[index]?.alt || this.alt;
      this.short = false;
      this.touch();
      this.save();
    },
    editAlt(value) {
      this.alt = value ?? "";
      this.touch();
    },
    touch() {
      this.dirty = true;
      this.saved = false;
    },
    // One save at a time: a later call waits until none runs, then saves only what is still unsaved.
    async save() {
      while (this.inflight) await this.inflight;
      if (!this.dirty) return true;
      this.inflight = this.persist();
      try {
        return await this.inflight;
      } finally {
        this.inflight = null;
      }
    },
    async persist() {
      const { chosen, alt } = this;
      this.saving = true;
      try {
        const value = { ...this.value, chosen, alt: alt.trim() };
        const { data } = await PATCH_Proposal(this.proposal.id, { proposed_value: value });
        if (this.chosen === chosen && this.alt === alt) this.dirty = false;
        this.saved = true;
        this.$emit("updated", data);
        return true;
      } catch (err) {
        this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
        return false;
      } finally {
        this.saving = false;
      }
    },
    // Before an approval: a variant picked and everything saved.
    async prepare() {
      if (this.chosen === null) {
        this.short = true;
        this.$nextTick(() => this.$refs.note?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
        return false;
      }
      return this.save();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.cover-variants__note {
  color: var(--text-secondary);
}
.cover-variants__note--short {
  color: var(--negative);
  font-weight: 600;
}
// The same columns as the cards above, so on a wide screen each card's tools sit under it.
.cover-variants__tools {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-4);
  margin-top: calc(-1 * var(--space-3));
  padding: 0;
  list-style: none;
}
.cover-variants__tool {
  align-items: flex-start;
  padding: 0 var(--space-3);
}
.cover-variants__title {
  font-weight: 600;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.cover-variants__check {
  color: var(--accent);
}
.cover-variants__prompt {
  flex: 1;
  min-width: 0;

  summary {
    cursor: pointer;
  }
  p {
    margin-top: var(--space-2);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
}
.cover-variants__enlarge {
  margin-left: auto;
}
.cover-variants__large {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-base);
}
.cover-variants__summary {
  max-width: 40rem;
}
.cover-variants__facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-2) var(--space-6);
  align-items: baseline;

  dt {
    font-size: var(--fs-250);
    font-weight: 600;
    color: var(--text-secondary);
  }
  dd {
    color: var(--text-strong);
    overflow-wrap: anywhere;
  }
}
@include max-tablet {
  .cover-variants__tools {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 0;
  }
}
</style>
