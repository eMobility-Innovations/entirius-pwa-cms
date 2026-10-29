import { computed, defineComponent, inject, provide } from "vue";
import { routeLocationKey } from "vue-router";
import { panels } from "@/configs/access";

// The read-only mode of a page (django-access, plan 19): decided once, in PageLayout, from the route's area — the
// route's `meta.area`, else the first area of its panel — and provided to everything inside the page. ActionBar,
// FloatingActions, BulkActionBar, FormField and a BasicButton/IconButton marked `mutates` honour it. Without the
// access module (or before `me` loaded) a page is never read-only. Hiding is UX only: the gate refuses the write.
// The access store reaches PageLayout injected (App.vue provides ACCESS_STORE), so the boots import no store.
export const READONLY = Symbol("Readonly");
export const ACCESS_STORE = Symbol("AccessStore");

const NEVER = computed(() => false);

/** The read-only flag of the page this component sits in (a ref; false outside a PageLayout). */
export function useReadonly() {
  return inject(READONLY, NEVER);
}

/** Provide `flag` (a ref) to every component below. Returns it. */
export function provideReadonly(flag) {
  provide(READONLY, flag);
  return flag;
}

/** A region that only reads or navigates (the filters row, the header's channel picker): never read-only. */
export const ReadonlyOff = defineComponent({
  name: "ReadonlyOff",
  setup(_, { slots }) {
    provideReadonly(NEVER);
    return () => slots.default?.();
  },
});

/** A region of a page that works on another area (a product's embedded prices, stock or supplier tab): read-only by
 * that area alone, whatever the route's area says. */
export const ReadonlyArea = defineComponent({
  name: "ReadonlyArea",
  props: { area: { type: String, required: true } },
  setup(props, { slots }) {
    const access = inject(ACCESS_STORE, null);
    provideReadonly(computed(() => !!access && isAreaReadonly(access, props.area)));
    return () => slots.default?.();
  },
});

/** The area a route works on: its own `meta.area`, else its panel's first area; null without a panel. */
export function routeArea(route) {
  const meta = route?.meta ?? {};
  return meta.area ?? panels.find((panel) => panel.idx === meta.panel)?.areas?.[0] ?? null;
}

/** True when the access module answered and the user cannot write `area`. */
export function isAreaReadonly(access, area) {
  return Boolean(area) && access.available && !access.can(area, "write");
}

/** PageLayout's decision: `force()` (the view's `readonly` prop), an enclosing page's flag, or the route's area. A
 * view that renders the PageLayout calls it without `force` to read the same decision (its own PageLayout provides the
 * flag to the view's children only, so `useReadonly()` in the view itself is always false). */
export function usePageReadonly(force = () => false) {
  const outer = useReadonly();
  const route = inject(routeLocationKey, null);
  const access = inject(ACCESS_STORE, null);
  return computed(() => force() || outer.value || (!!access && isAreaReadonly(access, routeArea(route))));
}
