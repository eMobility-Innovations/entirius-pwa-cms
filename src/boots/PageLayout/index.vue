<template>
  <div class="page-layout h-100 ovy-auto" :class="{ 'page-layout--roomy': roomy }">
    <slot name="header" />
    <NoticeMe v-if="readonly" class="page-layout__readonly" stroke_color_class="t-warning">
      <p class="page-layout__readonly-text fs-200" role="status" data-testid="readonly-notice">
        {{ $t("access.readonly_notice") }}
      </p>
    </NoticeMe>
    <div v-if="$slots.toolbar" class="page-layout__toolbar"><ReadonlyOff><slot name="toolbar" /></ReadonlyOff></div>
    <div class="page-layout__body"><slot /></div>
    <div v-if="hasFooter()" class="page-layout__footer"><slot name="footer" /></div>
  </div>
</template>

<script setup>
// The content region of a page (R4: no border, no card; Figma draws content on the page background): padding 40 top /
// 80 sides on desktop, 20 on a phone, and one scroll body. Slots: `header` (a PageHeader), `toolbar` (the filters
// row), `default` (the content), `footer` (a list's Pagination, pinned to the bottom edge while the body scrolls).
// A sticky PageHeader pins inside this scroll body. `roomy` keeps the desktop rhythm on a phone (40 top, 32 below
// the header, the 30 px title): the Figma P5 frames (Home, content list, gallery).
// Read-only mode (plan 19): decided here once, from the route's area (src/composables/useReadonly.js), and provided to
// the page; one notice line under the header says why. `readonly` forces it on, it never lifts it. The toolbar (search
// and filters) is outside it: reading needs it.
import { useSlots } from "vue";
import { hasSlotContent } from "@/composables/useSlotContent";
import { ReadonlyOff, provideReadonly, usePageReadonly } from "@/composables/useReadonly";
import NoticeMe from "@/boots/NoticeMe/index.vue";

const props = defineProps({
  roomy: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
});

const readonly = provideReadonly(usePageReadonly(() => props.readonly));

const slots = useSlots();
// A footer slot can render nothing (e.g. `<Pagination v-if="pages > 1" />` on one page): a strip with no content
// would still show. Only real vnodes (not a v-if's Comment placeholder or an empty Fragment) count as content.
// A function, not a computed: `useSlots()` is not reactive, so a computed that first saw no footer (a dynamic
// `<template v-if="…" #footer>`) would stay false. The template re-evaluates it on every render.
const hasFooter = () => hasSlotContent(slots.footer?.());
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.page-layout {
  display: flex;
  flex-direction: column;
  // Shared with PageHeader: its sticky head reaches the edge through this padding.
  --page-layout-pad-y: var(--space-10);
  --page-layout-pad-x: calc(2 * var(--space-10));
  // The FAB's corner lane: bottom-pinned rows (the footer, a view's sticky decision bar) keep their right edge clear.
  --fab-lane: 0px;

  gap: var(--space-8);
  padding: var(--page-layout-pad-y) var(--page-layout-pad-x);

  @include max-tablet {
    --page-layout-pad-y: var(--space-5);
    --page-layout-pad-x: var(--space-5);

    gap: var(--space-5);
  }

  @include max-shell {
    --fab-lane: calc(44px + var(--space-4));
  }
}

@include max-tablet {
  .page-layout--roomy {
    --page-layout-pad-y: var(--space-10);
    // Read by PageHeader's phone title.
    --page-header-title-size: var(--fs-700);

    gap: var(--space-8);
  }
}

.page-layout__readonly-text {
  margin: 0;
  padding: var(--space-3) var(--space-5);
  color: var(--text-body);
}

// On a phone the search (the first control of a view's toolbar row) takes the whole row and the filters line up under
// it, instead of wrapping wherever each view's own search width runs out.
@include max-tablet {
  .page-layout__toolbar > :deep(* > .input-basic-wrapper:first-child) {
    flex: 1 1 100%;
    max-width: none;
  }
}

.page-layout__body {
  min-width: 0;
}

// Pinned to the scroll body's bottom edge through its padding (the sticky head does the same at the top).
.page-layout__footer {
  position: sticky;
  bottom: calc(-1 * var(--page-layout-pad-y));
  z-index: 1;
  padding-block: var(--space-3);
  background-color: var(--surface-page);
  // Keeps the pager out of the FAB's corner lane.
  padding-right: var(--fab-lane);
}
</style>
