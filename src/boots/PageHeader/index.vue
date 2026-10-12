<template>
  <header class="page-header" :class="{ 'page-header--sticky': sticky }">
    <div
      class="page-header__head"
      :class="{ 'page-header__head--sticky': sticky }"
      :data-fid="sticky ? 'sticky-header' : undefined"
    >
      <p v-if="overline" class="page-header__overline type-overline t-muted">{{ overline }}</p>
      <Breadcrumbs v-if="trail.length" class="page-header__crumbs" :items="trail" />
      <div class="page-header__title-row flex ai-ct gap-5" data-fid="page-title">
        <IconButton v-if="backTo" icon="back" :label="$t('common.back')" @click="goBack" />
        <h1
          class="page-header__title page-title"
          :class="{ 'page-header__title--after-back': backTo }"
          :title="title"
        >
          {{ title }}
        </h1>
        <div v-if="$slots.meta" class="page-header__meta flex ai-ct gap-2">
          <ReadonlyOff><slot name="meta" /></ReadonlyOff>
        </div>
      </div>
      <p v-if="description" class="page-header__description t-muted fs-200" data-testid="page-description">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions"><slot name="actions" /></div>
  </header>
</template>

<script setup>
// The page's frame head (R2, R3, R5): `title` is the page's only <h1>; `overline` sits above it (Home);
// `crumbs` ([{ label, to? }]) sit 24 px above the title row, and when omitted the shell's crumbs show (none without a
// shell) with the shell's back arrow to the parent crumb; `back` (a route location, or a handler) puts a back
// IconButton left of the H1 in any case; `description` is the page's help line under the title row (it wraps, never in
// `meta`). The title goes to the shell too: the last crumb and the browser tab name the page by it. Slots: `meta` (chips beside the title) and `actions` (an ActionBar: in the title row on desktop, its
// own row below 1024 px). `sticky` pins the head under the app header on a phone; the actions row scrolls away
// (Figma S8). Mounting claims the shell's header slot; `claimShell` false keeps a demo instance (the UI catalogue) out
// of it: no claim, no shell crumbs or back, the page keeps its own title. `data-fid="page-title"` marks the title row
// (back, H1, meta): Figma's "Heading" frame is that row (S6: 837.5 wide beside the actions).
import { computed } from "vue";
import { useRouter } from "vue-router";
import Breadcrumbs from "@/boots/Breadcrumbs/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import { usePageHeaderClaim } from "@/composables/pageHeader";
// `meta` holds the panel's channel picker: it navigates, so a read-only page keeps it enabled.
import { ReadonlyOff } from "@/composables/useReadonly";

const props = defineProps({
  title: { type: String, required: true },
  overline: { type: String, default: "" },
  description: { type: String, default: "" },
  crumbs: { type: Array, default: undefined },
  back: { type: [String, Object, Function], default: undefined },
  sticky: { type: Boolean, default: false },
  claimShell: { type: Boolean, default: true },
});

const router = useRouter();
const shell = usePageHeaderClaim(() => props.title, props.claimShell);
const trail = computed(() => props.crumbs ?? shell.crumbs.value);
// The shell's crumbs bring the shell's back arrow (to the parent crumb); a `back` of the view wins.
const backTo = computed(
  () => props.back ?? (props.crumbs === undefined && trail.value.length ? shell.back : undefined)
);

function goBack() {
  if (typeof backTo.value === "function") backTo.value();
  else router.push(backTo.value);
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// The head (overline, crumbs, title row) and the actions share a line while both fit; the actions wrap under it,
// right-aligned, when they do not, and always take their own row below 1024 px.
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-4) var(--space-5);
}

.page-header__head {
  flex: 1 1 20rem;
  min-width: 0;
}

.page-header__overline {
  margin-bottom: var(--space-2);
}

.page-header__crumbs {
  margin-bottom: var(--space-6);
}

// Chips that do not fit beside the whole title wrap under it: the title never shrinks for them.
.page-header__title-row {
  flex-wrap: wrap;
}

// One line at every width: a title longer than its row ends with an ellipsis (the full text is its `title`). The
// block padding keeps descenders inside the clipped box without moving the line.
.page-header__title {
  min-width: 0;
  max-width: 100%;
  margin-block: -0.15em;
  padding-block: 0.15em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// It stays on the back arrow's line: its width leaves room for the arrow and the gap.
.page-header__title--after-back {
  max-width: calc(100% - var(--elem-height) - var(--space-5));
}

// The chips keep their width.
.page-header__meta {
  flex: none;
}

.page-header__description {
  margin: var(--space-2) 0 0;
  overflow-wrap: anywhere;
}

.page-header__actions {
  min-width: 0;
  margin-left: auto;
}

@include max-shell {
  .page-header__actions {
    flex-basis: 100%;
  }
}

@include max-tablet {
  // A roomy PageLayout sets the larger phone title.
  .page-header__title {
    font-size: var(--page-header-title-size, var(--fs-500));
  }

  // A sticky box cannot leave its parent: the header gives up its box, so the head pins against the scroll body
  // (PageLayout) and the actions row, now its sibling, scrolls away.
  .page-header--sticky {
    display: contents;
  }

  .page-header__head--sticky {
    position: sticky;
    z-index: 1;
    // The pin line sits inside the scroll body's padding: PageLayout's padding (20 px on a phone outside one) puts it
    // at the edge.
    top: calc(-1 * var(--page-layout-pad-y, var(--space-5)));
    // Flush under the app header before any scroll too (Figma S7: y 81, full width).
    margin: calc(-1 * var(--page-layout-pad-y, var(--space-5))) calc(-1 * var(--page-layout-pad-x, var(--space-5))) 0;
    padding: var(--space-3) var(--page-layout-pad-x, var(--space-5));
    background-color: var(--surface-page);
  }
}
</style>
