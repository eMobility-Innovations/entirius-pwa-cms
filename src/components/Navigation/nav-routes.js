// Single source of truth for the panel sub-navigation.
//
// Consumed by:
//   - Navigation.vue — renders the desktop sidebar / mobile bottom bar from `filterNavRoutes`.
//   - App.vue        — decides whether a panel needs a nav at all. A single-tab panel
//                      (enrichment, emails, accounts, checkout, stock) has one entry, so the
//                      sidebar + edge toggle + mobile bottom bar are pointless and get hidden.
//
// Keeping the list here (not inline in Navigation) lets both consumers agree on the count without
// duplicating the route table.

export function buildNavRoutes() {
  const defaultLang = (process.env.VUE_APP_LANG || "EN").toLowerCase();
  return [
    {
      route: "/pages/content",
      labelKey: "nav.content_list",
      icon: "file-code",
      query: { lg: defaultLang },
      app: ["pages"],
    },
    {
      route: "/pages/layout-extender",
      labelKey: "nav.layout_extender",
      icon: "diagram-next",
      query: { lg: defaultLang },
      app: ["pages"],
    },
    {
      route: "/pages/gallery",
      labelKey: "nav.gallery",
      icon: "image",
      query: {},
      app: ["pages"],
    },
    {
      route: "/pages/content-sets",
      labelKey: "nav.content_sets",
      icon: "object-group",
      query: { lg: defaultLang },
      app: ["pages"],
    },
    {
      route: "/pages/authors",
      labelKey: "authors.title",
      icon: "user-pen",
      query: {},
      app: ["pages"],
    },
    {
      route: "/pim/products",
      labelKey: "nav.pim_products",
      icon: "boxes-stacked",
      query: {},
      app: ["pim"],
    },
    {
      route: "/pim/categories",
      labelKey: "nav.pim_categories",
      icon: "folder-tree",
      query: {},
      app: ["pim"],
    },
    {
      route: "/pim/feature-sets",
      labelKey: "nav.pim_feature_sets",
      icon: "layer-group",
      query: {},
      app: ["pim"],
    },
    {
      route: "/pim/features",
      labelKey: "nav.pim_features",
      icon: "tags",
      query: {},
      app: ["pim"],
    },
    {
      // etap-06: quality rules — gated by capability probe (hidden on old backend)
      route: "/pim/gap-definitions",
      labelKey: "nav.pim_gap_definitions",
      icon: "clipboard-check",
      query: {},
      app: ["pim"],
      requiresQuality: true,
    },
    {
      route: "/pricefighter/gap",
      labelKey: "nav.pricefighter_gap_table",
      icon: "scale-balanced",
      query: {},
      app: ["pricefighter"],
    },
    {
      route: "/pricefighter/strategies",
      labelKey: "nav.pricefighter_strategies",
      icon: "gears",
      query: {},
      app: ["pricefighter"],
    },
    {
      route: "/pricefighter/history",
      labelKey: "nav.pricefighter_history",
      icon: "clock-rotate-left",
      query: {},
      app: ["pricefighter"],
    },
    {
      route: "/points/list",
      labelKey: "nav.dp_points",
      icon: "location-dot",
      query: {},
      app: ["points"],
    },
    {
      route: "/points/types",
      labelKey: "nav.dp_types",
      icon: "truck",
      query: {},
      app: ["points"],
    },
    {
      route: "/forms/list",
      labelKey: "nav.cf_submissions",
      icon: "envelope",
      query: {},
      app: ["forms"],
    },
    {
      route: "/forms/bookings",
      labelKey: "nav.cf_bookings",
      icon: "calendar-days",
      query: {},
      app: ["forms"],
    },
    {
      route: "/forms/leads",
      labelKey: "nav.cf_leads",
      icon: "bullseye",
      query: {},
      app: ["forms"],
    },
    {
      route: "/accounts/customers",
      labelKey: "nav.accounts_customers",
      icon: "users",
      query: {},
      app: ["accounts"],
    },
    {
      route: "/checkout-orders/orders",
      labelKey: "nav.checkout_orders",
      icon: "shopping-cart",
      query: {},
      app: ["checkout"],
    },
    {
      route: "/promo/list",
      labelKey: "nav.promo_list",
      icon: "tags",
      query: {},
      app: ["promo"],
    },
    {
      route: "/agreements/list",
      labelKey: "nav.agm_definitions",
      icon: "file-contract",
      query: {},
      app: ["agreements"],
    },
    {
      route: "/agreements/consents",
      labelKey: "nav.agm_people",
      icon: "clock-rotate-left",
      query: {},
      app: ["agreements"],
    },
    {
      route: "/emails",
      labelKey: "nav.email_dashboard",
      icon: "at",
      query: {},
      app: ["emails"],
    },
    {
      route: "/reviews/queue",
      labelKey: "nav.reviews_queue",
      icon: "star",
      query: {},
      app: ["reviews"],
    },
    {
      route: "/reviews/products",
      labelKey: "nav.reviews_products",
      icon: "boxes-stacked",
      query: {},
      app: ["reviews"],
    },
    {
      route: "/faq/groups",
      labelKey: "nav.faq_groups",
      icon: "circle-question",
      query: {},
      app: ["faq"],
    },
    {
      route: "/faq/items",
      labelKey: "nav.faq_items",
      icon: "list-ol",
      query: {},
      app: ["faq"],
    },
    {
      route: "/pricing/prices",
      labelKey: "nav.pm_prices",
      icon: "money-bill-wave",
      query: {},
      app: ["pricing"],
    },
    {
      route: "/pricing/tax-classes",
      labelKey: "nav.pm_tax_classes",
      icon: "tags",
      query: {},
      app: ["pricing"],
    },
    {
      route: "/pricing/channels",
      labelKey: "nav.pm_channels",
      icon: "globe",
      query: {},
      app: ["pricing"],
    },
    {
      route: "/stock",
      labelKey: "stock.manage",
      icon: "warehouse",
      query: {},
      app: ["stock"],
    },
    {
      route: "/translation-jobs",
      labelKey: "translation.jobs",
      icon: "language",
      query: {},
      app: ["translation"],
    },
    {
      route: "/atlas/list",
      labelKey: "nav.atlas_list",
      icon: "layer-group",
      query: {},
      app: ["atlas"],
    },
    {
      // cross-source dashboard — RealProducts touched by auto-EAN-match
      route: "/atlas/auto-matched",
      labelKey: "nav.atlas_auto_matched",
      icon: "link",
      query: {},
      app: ["atlas"],
    },
    {
      // operator triage UI for find_duplicates_by_ean groups
      route: "/atlas/duplicates",
      labelKey: "nav.atlas_duplicates",
      icon: "copy",
      query: {},
      app: ["atlas"],
    },
    {
      route: "/atlas/review",
      labelKey: "nav.atlas_review_queue",
      icon: "square-check",
      query: {},
      app: ["atlas"],
    },
    {
      // single-box text/image search across PIM + atlas fingerprints —
      // optional django-lookup backend module, see requiresModule below
      route: "/atlas/find",
      labelKey: "nav.atlas_find",
      icon: "magnifying-glass",
      query: {},
      app: ["atlas"],
      requiresModule: "lookup",
    },
    {
      route: "/enrichment",
      labelKey: "nav.enrichment_review",
      icon: "wand-magic-sparkles",
      query: {},
      app: ["enricher"],
    },
    {
      route: "/enrichment/spawn-rules",
      labelKey: "nav.enrichment_spawn_rules",
      icon: "gears",
      query: {},
      app: ["enricher"],
    },
    {
      route: "/enrichment/tasks",
      labelKey: "nav.enrichment_tasks",
      icon: "list-check",
      query: {},
      app: ["enricher"],
    },
  ];
}

// Routes visible for the active panel. `requiresQuality` items are hidden until the backend's gaps
// capability probe resolves true (old backends never see the quality-rules nav item).
// `requiresModule` items are hidden until that optional django-munin module reports enabled
// (mirrors the router guard's `meta.module` gate — see router/index.js).
export function filterNavRoutes(
  routes,
  { activeApp, qualityAvailable, isModuleEnabled }
) {
  return routes.filter((r) => {
    if (r.app.indexOf(activeApp) === -1) return false;
    if (r.requiresQuality && qualityAvailable !== true) return false;
    if (r.requiresModule && !isModuleEnabled?.(r.requiresModule)) return false;
    return true;
  });
}
