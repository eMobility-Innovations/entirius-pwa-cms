import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { GET_Modules } from "@/api/munin/api";

// Maps django-munin module keys to CMS panel idx values.
// Modules not in this map (regional, etc.) have no CMS panel.
// Value can be a single panel idx (string) or multiple panels (array)
// when one Django module powers more than one CMS panel.
const MODULE_TO_PANEL = {
  contentdb: "pages",
  pim: "pim",
  deliverypoints: "points",
  contact_forms: "forms",
  accounts: "accounts",
  agreements: "agreements",
  email: "emails",
  faq: "faq",
  pricemanager: "pricing",
  pricefighter: "pricefighter",
  qms: "stock",
  // Promo hosts Discounts (served by django-checkout) with Vouchers as an
  // optional sub-feature — the panel must not disappear when only the
  // voucher module is missing.
  checkout: ["checkout", "promo"],
  checkout_voucher: "promo",
  atlas: "atlas",
  enrichment: "enricher",
  pim_translator: "translation",
  contentdb_translator: "translation",
};

// Env fallback: parse VUE_APP_PANELS the same way access.js used to
const ENV_PANELS_RAW = process.env.VUE_APP_PANELS || "";
const envPanelSet = new Set(
  ENV_PANELS_RAW.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// THE ACCESS PANEL ENABLES ITSELF, because Munin will never report it and there must not
// be a SECOND variable to remember. It is not a Munin module — it has no entry in
// MODULE_TO_PANEL and never will — so without this line a deployment that sets
// VUE_APP_ACCESS_PANEL_ENABLED=true gets the routes, the bundle and the API, and then
// HeaderControls silently filters the entry out because `access` is absent from
// VUE_APP_PANELS and VUE_APP_HIDE_DISABLED_PANELS defaults to true. Measured on a real
// host: CMS_PANELS=pages,pim,stock,pricing,suppliers,emails,enricher — no `access`.
// One flag, one meaning: turning the panel on shows the panel.
if (String(process.env.VUE_APP_ACCESS_PANEL_ENABLED || "false").toLowerCase() === "true") {
  envPanelSet.add("access");
}

// Env fallback for individual module keys (e.g. VUE_APP_MODULES=checkout,vouchers)
const ENV_MODULES_RAW = process.env.VUE_APP_MODULES || "";
const envModuleSet = new Set(
  ENV_MODULES_RAW.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export const useMuninStore = defineStore("munin", () => {
  // modules stored as array of { key, label, enabled_in_cms, ... }
  const modules = ref([]);
  const loaded = ref(false);
  const loading = ref(false);

  // Tracks the in-flight fetch so the router guard can await it
  let _fetchPromise = null;

  const enabledPanels = computed(() => {
    // Pre-login (no admin data) the env set is the only source.
    if (!loaded.value) return new Set(envPanelSet);

    const panels = new Set();
    const reported = new Set(); // panels Munin knows about — enabled or not
    for (const mod of modules.value) {
      const target = MODULE_TO_PANEL[mod.key];
      if (!target) continue;
      const list = Array.isArray(target) ? target : [target];
      for (const p of list) {
        reported.add(p);
        if (mod.enabled_in_cms) panels.add(p);
      }
    }
    // VUE_APP_PANELS is a gap-filling fallback: it force-enables only panels Munin
    // does NOT report at all (e.g. a module not yet registered with Munin, like
    // enrichment). It never overrides an admin's explicit "off" for a reported module.
    for (const p of envPanelSet) if (!reported.has(p)) panels.add(p);
    return panels;
  });

  function isPanelEnabled(panelIdx) {
    return enabledPanels.value.has(panelIdx);
  }

  function isModuleEnabled(key) {
    if (!loaded.value) return envModuleSet.has(key)
    return modules.value.some(m => m.key === key && m.enabled_in_cms)
  }

  async function fetchModules() {
    loading.value = true;
    try {
      const { data } = await GET_Modules();
      // API returns { platform, modules: { key: {…}, … } }
      const modulesDict = data.modules || {};
      const parsed = Object.entries(modulesDict).map(([key, mod]) => ({
        key,
        ...mod,
      }));
      // Only trust the response if it includes admin data (enabled_in_cms).
      // Unauthenticated requests get the public response without it —
      // keep loaded = false so the env fallback stays active until
      // Login-wall re-fetches with a valid token.
      const hasAdminData = parsed.some((m) => "enabled_in_cms" in m);
      if (hasAdminData) {
        modules.value = parsed;
        loaded.value = true;
      }
    } catch (err) {
      console.warn(
        "Munin API unavailable, using env fallback:",
        err.message || err
      );
      // Keep loaded = false so env fallback stays active
    } finally {
      loading.value = false;
      _fetchPromise = null;
    }
  }

  // Starts fetch and stores the promise. Subsequent calls return the same promise.
  function ensureLoaded() {
    if (loaded.value) return Promise.resolve();
    if (_fetchPromise) return _fetchPromise;
    _fetchPromise = fetchModules();
    return _fetchPromise;
  }

  function isModuleInstalled(moduleKey) {
    if (!loaded.value) return false
    return modules.value.some(m => m.key === moduleKey)
  }

  // Version gate for backend feature detection. "1.1.0rc0" counts as 1.1.0
  // (parseInt drops the rc suffix). Unknown module/version -> false (safe lock).
  function isModuleAtLeast(moduleKey, minVersion) {
    const mod = modules.value.find((m) => m.key === moduleKey);
    if (!mod?.version) return false;
    const parse = (v) => v.split(".").map((p) => parseInt(p, 10) || 0);
    const [maj, min, pat] = parse(mod.version);
    const [rMaj, rMin, rPat] = parse(minVersion);
    return maj !== rMaj ? maj > rMaj : min !== rMin ? min > rMin : pat >= rPat;
  }

  return {
    modules,
    loaded,
    loading,
    enabledPanels,
    isPanelEnabled,
    isModuleInstalled,
    isModuleEnabled,
    isModuleAtLeast,
    fetchModules,
    ensureLoaded,
  };
});
