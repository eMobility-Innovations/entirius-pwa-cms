import { computed, toValue } from "vue";
import { useRoute, useRouter } from "vue-router";
import { panels as REGISTRY } from "@/configs/access";
import { buildNavRoutes, filterNavRoutes, isNavActive } from "@/components/Navigation/nav-routes";
import { useMuninStore } from "@/stores/munin";
import { useAccessStore } from "@/stores/access";
import { useQualityStore } from "@/stores/quality";
import { useEnrichmentProfileStore } from "@/stores/enrichmentProfile";
import { useIsDesktop } from "@/composables/useIsDesktop";
import { t } from "@/i18n";

// The one navigation model of the shell (r05 §2–§4): which panels exist (`usePanels`), which entries each has
// (`navTree`), which entry a route lights (`resolveNavEntry`), where the user is (`useActiveNav`) and the trail above
// the title (`useBreadcrumbs`). Pure functions carry the rules; the composables feed them the stores and the route.
// The active panel comes from `route.meta.panel` ("home" on `/`).
export const HOME = "home";
export const HOME_ROUTE = "/";
const HIDE_DISABLED = (process.env.VUE_APP_HIDE_DISABLED_PANELS || "").toUpperCase() === "TRUE";

// Registry order × Munin; `hideDisabled` drops locked panels instead of showing them dimmed.
export function panelList(isPanelEnabled, hideDisabled = HIDE_DISABLED) {
  const all = REGISTRY.map((panel) => ({ ...panel, isEnabled: isPanelEnabled(panel.idx) }));
  return hideDisabled ? all.filter((panel) => panel.isEnabled) : all;
}

// A panel the user cannot read (django-access) is always hidden — never dimmed like a module that is off.
export function usePanels() {
  const munin = useMuninStore();
  const access = useAccessStore();
  return computed(() => panelList(munin.isPanelEnabled).filter((panel) => access.canAny(panel.areas)));
}

// Each entry takes the `meta.area` of the route it opens (no router in a bare test: no area).
export const withAreas = (routes, router) =>
  routes.map((entry) => ({ ...entry, area: router?.resolve?.(entry.route).meta?.area }));

// An entry with a `badge` key takes its number from `counts` (the Memory suggestions); 0 shows nothing.
const withCount = (entry, counts) => (entry.badge ? { ...entry, count: counts?.[entry.badge] || 0 } : entry);

// `{ [panelIdx]: entries[] }`; ctx = { qualityAvailable, isModuleEnabled, isDesktop, canRead, counts? }.
export function navTree(ctx, routes = buildNavRoutes()) {
  return Object.fromEntries(
    REGISTRY.map((panel) => [
      panel.idx,
      filterNavRoutes(routes, { ...ctx, panel: panel.idx }).map((entry) => withCount(entry, ctx.counts)),
    ])
  );
}

// The numbers of the `badge` keys (a nav entry's, a RouteTabs tab's): the Memory suggestions waiting for the operator.
export function useNavCounts() {
  const enrichmentProfile = useEnrichmentProfileStore();
  return computed(() => ({ memorySuggestions: enrichmentProfile.pendingSuggestions }));
}

// `everyViewport`: the desktop entries on a phone too — where a page belongs does not change with the screen.
export function useNavTree({ everyViewport = false } = {}) {
  const munin = useMuninStore();
  const access = useAccessStore();
  const quality = useQualityStore();
  const counts = useNavCounts();
  const isDesktop = useIsDesktop();
  const routes = withAreas(buildNavRoutes(), useRouter());
  return computed(() =>
    navTree(
      {
        qualityAvailable: quality.available,
        isModuleEnabled: munin.isModuleEnabled,
        isDesktop: everyViewport || isDesktop.value,
        canRead: access.can,
        counts: counts.value,
      },
      routes
    )
  );
}

const longestPrefix = (entries, path) =>
  entries
    .filter((entry) => path.startsWith(`${entry.route}/`))
    .sort((a, b) => b.route.length - a.route.length)[0];

// exact → activeOn → meta.navParent → longest path prefix; entries are one panel's, already filtered.
export function resolveNavEntry(entries, route) {
  const path = route.path;
  return (
    entries.find((entry) => entry.route === path) ??
    entries.find((entry) => isNavActive(entry, path)) ??
    entries.find((entry) => entry.route === route.meta?.navParent) ??
    longestPrefix(entries, path) ??
    null
  );
}

// The phone tab bar lists the active panel's entries: shown with two or more, never on `meta.noBottomBar`
// (Leads Review).
export const tabBarShown = (entries, route) => entries.length > 1 && !route.meta?.noBottomBar;

export const activePanelOf = (route) => (route.path === HOME_ROUTE ? HOME : route.meta?.panel ?? null);

// `tree` is what this screen lists (the phone tab bar drops `desktopOnly` entries); `entry` is resolved among every
// entry, so a desktop-only page opened on a phone lights nothing and keeps its own crumb instead of its neighbour's.
export function useActiveNav() {
  const route = useRoute();
  const tree = useNavTree();
  const everyEntry = useNavTree({ everyViewport: true });
  const panelIdx = computed(() => activePanelOf(route));
  const entry = computed(() => resolveNavEntry(everyEntry.value[panelIdx.value] ?? [], route));
  return { panelIdx, entry, tree };
}

const paramNames = (path) => [...path.matchAll(/:(\w+)/g)].map((match) => match[1]);

// The `meta.crumbParent` chain of `route` (route names), outermost first, each linked with the params it takes.
export function crumbParents(route, records) {
  const parents = [];
  const byName = (name) => (name ? records.find((r) => r.name === name) : null);
  let record = byName(route.meta?.crumbParent);
  while (record && !parents.some((parent) => parent.record === record)) {
    parents.unshift({ record, params: Object.fromEntries(paramNames(record.path).map((key) => [key, route.params[key]])) });
    record = byName(record.meta?.crumbParent);
  }
  return parents;
}

// R3: panel → entry → crumbParent chain → current page; nothing on the panel's list itself (its entry or its root:
// Stock's entry `/stock` redirects to the root `/stock/manage`) or outside a panel.
// A panel whose root is the entry keeps both crumbs (Figma S6: "Pages / Lista treści / Product Showcase"), unless the
// entry reads the same as the panel (Promo: "Promotions / Promotions / <rule>").
export function buildCrumbs(route, { panel, entry, parents = [], title }) {
  if (!panel || route.path === panel.root || route.path === entry?.route) return [];
  const showEntry = entry && t(entry.labelKey) !== t(panel.labelKey);
  return [
    { label: t(panel.labelKey), to: panel.root },
    ...(showEntry ? [{ label: t(entry.labelKey), to: { path: entry.route, query: entry.query } }] : []),
    ...parents.map(({ record, params }) => ({ label: t(record.meta.titleKey), to: { name: record.name, params } })),
    { label: title || t(route.meta?.titleKey) },
  ];
}

// The back arrow goes to the last linked crumb: history back when that is where the user came from (keeps list
// filters and paging), else a push (a deep link never leaves the app).
export function goBackTo(router, target) {
  const back = window.history.state?.back;
  if (back && back.split("?")[0] === router.resolve(target).path) router.back();
  else router.push(target);
}

export function useBreadcrumbs(title = null) {
  const route = useRoute();
  const router = useRouter();
  const panels = usePanels();
  const { panelIdx, entry } = useActiveNav();
  const crumbs = computed(() =>
    buildCrumbs(route, {
      panel: panels.value.find((panel) => panel.idx === panelIdx.value),
      entry: entry.value,
      parents: crumbParents(route, router.getRoutes()),
      title: toValue(title),
    })
  );
  const backTarget = computed(() => crumbs.value.at(-2)?.to ?? null);
  const back = () => backTarget.value && goBackTo(router, backTarget.value);
  return { crumbs, backTarget, back };
}
