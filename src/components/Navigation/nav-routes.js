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

// The sections of Leads → Settings (the hub behind the one "/leads/settings" entry): nav glyphs like the entries
// below, not icons.js meanings; `module` hides a section whose backend is off.
export const LEADS_SETTINGS_SECTIONS = [
  { key: "stages", route: "LeadsStages", labelKey: "nav.leads_stages", icon: "list-ol", module: "leads" },
  { key: "lead-types", route: "LeadsLeadTypes", labelKey: "leads.lead_types.title", icon: "tags", module: "leads" },
  { key: "templates", route: "CommunicatorTemplates", labelKey: "nav.communicator_templates", icon: "file-lines", module: "communicator" },
  { key: "sequences", route: "CommunicatorSequences", labelKey: "nav.communicator_sequences", icon: "repeat", module: "communicator" },
  { key: "sending", route: "CommunicatorSettings", labelKey: "nav.communicator_settings", icon: "paper-plane", module: "communicator" },
];

// The tabs of Enricher → Review and Enricher → Settings (RouteTabs): each tab its own route, by name; `badge` as on a
// nav entry. `idPrefix` names the tabs and the panel each one controls (routeTabPanel).
export const ENRICHMENT_REVIEW_TABS = {
  idPrefix: "enrichment-review",
  sections: [
    { route: "EnrichmentReview", labelKey: "enrichment.review.tabs.proposals", testid: "enrichment-tab-proposals" },
    { route: "EnrichmentRuns", labelKey: "enrichment.review.tabs.runs", testid: "enrichment-tab-runs" },
  ],
};
export const ENRICHMENT_SETTINGS_TABS = {
  idPrefix: "enrichment-settings",
  sections: [
    { route: "EnrichmentProfile", labelKey: "nav.enrichment_profile", testid: "enrichment-tab-profile" },
    { route: "EnrichmentMemory", labelKey: "nav.enrichment_memory", badge: "memorySuggestions", testid: "enrichment-tab-memory" },
    { route: "EnrichmentTemplates", labelKey: "nav.enrichment_templates", testid: "enrichment-tab-templates" },
    { route: "EnrichmentSpawnRules", labelKey: "nav.enrichment_spawn_rules", testid: "enrichment-tab-spawn-rules" },
  ],
};

/** The attributes of the page body a RouteTabs tab controls (route = the page's route name). */
export const routeTabPanel = ({ idPrefix }, route) => ({
  role: "tabpanel",
  id: `${idPrefix}-panel-${route}`,
  "aria-labelledby": `${idPrefix}-tab-${route}`,
});

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
      icon: "users",
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
      route: "/faq/duplicates",
      labelKey: "nav.faq_duplicates",
      icon: "copy",
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
      route: "/leads/inbox",
      labelKey: "nav.leads_inbox",
      icon: "inbox",
      query: {},
      app: ["leads"],
      requiresModule: "communicator",
      // One entry for both lists (UX-010): its Conversations | Companies toggle, Review, a thread without a company and
      // a company card are all Inbox work, so the Inbox stays lit — the menu never jumps when a row opens a card
      activeOn: ["/leads/inbox/", "/leads/conversations", "/leads/companies"],
    },
    {
      // Leads without communicator: no Inbox, no toggle — the company list is the entry (the panel fallback)
      route: "/leads/companies",
      labelKey: "nav.leads_companies",
      icon: "building",
      query: {},
      app: ["leads"],
      requiresModule: "leads",
      hiddenWithModule: "communicator",
      activeOn: ["/leads/companies/"], // a company card
    },
    {
      route: "/leads/board",
      labelKey: "nav.leads_board",
      icon: "table-columns",
      query: {},
      app: ["leads"],
      requiresModule: "leads",
      desktopOnly: true,
    },
    {
      route: "/leads/import",
      labelKey: "nav.leads_import",
      icon: "file-import",
      query: {},
      app: ["leads"],
      requiresModule: "leads",
      desktopOnly: true,
    },
    {
      // Stages, templates, sequences and send settings live here as sections (UX-002d) — one entry fits a phone
      route: "/leads/settings",
      labelKey: "nav.leads_settings",
      icon: "gear",
      query: {},
      app: ["leads"],
      activeOn: ["/leads/settings/"], // every section
    },
    {
      route: "/enrichment",
      labelKey: "nav.enrichment_review",
      icon: "wand-magic-sparkles",
      query: {},
      app: ["enricher"],
    },
    {
      route: "/enrichment/studio",
      labelKey: "nav.enrichment_studio",
      icon: "pen-to-square",
      query: {},
      app: ["enricher"],
    },
    {
      // Profile, Memory, AI templates and Spawn rules as tabs (ENRICHMENT_SETTINGS_TABS); `badge`: the pending
      // suggestions count (useNav `counts`) — on the phone tab bar too
      route: "/enrichment/settings",
      labelKey: "nav.enrichment_settings",
      icon: "gear",
      query: {},
      app: ["enricher"],
      badge: "memorySuggestions",
    },
    {
      route: "/access/roles",
      labelKey: "nav.access.roles",
      icon: "user-shield",
      query: {},
      app: ["access"],
    },
    {
      route: "/access/staff",
      labelKey: "nav.access.staff",
      icon: "user",
      query: {},
      app: ["access"],
    },
    {
      route: "/access/groups",
      labelKey: "nav.access.groups",
      icon: "users",
      query: {},
      app: ["access"],
    },
    {
      route: "/access/applications",
      labelKey: "nav.access.applications",
      icon: "key",
      query: {},
      app: ["access"],
    },
    {
      route: "/access/audit",
      labelKey: "nav.access.audit",
      icon: "clock-rotate-left",
      query: {},
      app: ["access"],
    },
  ];
}

// The entries of one panel (`panel` = its idx). `requiresQuality` items are hidden until the backend's gaps
// capability probe resolves true (old backends never see the quality-rules nav item).
// `requiresModule` items are hidden until that optional django-munin module reports enabled
// (mirrors the router guard's `meta.module` gate — see router/index.js); `hiddenWithModule` items give way
// once that module is enabled (another entry covers their pages then).
// `desktopOnly` items are hidden below the desktop breakpoint (useIsDesktop) — on a phone the
// leads panel keeps its plan-13 shape: no bottom bar over the Inbox/Review sticky actions.
// An entry is also lit on the pages it owns without a nav item of their own (`activeOn` path prefixes).
// An entry with an `area` (its route's `meta.area`) is hidden when `canRead(area)` is false (django-access).
export function isNavActive(route, path = "") {
  return (route.activeOn || []).some((prefix) => path.startsWith(prefix));
}

export function filterNavRoutes(
  routes,
  { panel, qualityAvailable, isModuleEnabled, isDesktop, canRead }
) {
  return routes.filter((r) => {
    if (r.app.indexOf(panel) === -1) return false;
    if (r.requiresQuality && qualityAvailable !== true) return false;
    if (r.requiresModule && !isModuleEnabled?.(r.requiresModule)) return false;
    if (r.hiddenWithModule && isModuleEnabled?.(r.hiddenWithModule)) return false;
    if (r.desktopOnly && !isDesktop) return false;
    if (r.area && canRead && !canRead(r.area)) return false;
    return true;
  });
}
