import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { GET_Me } from "@/api/access/api";
import { isNotFound } from "@/api/createClient";
import { useMuninStore } from "@/stores/munin";

// The munin key of django-access.
export const ACCESS_MODULE = "access";
// A burst of refusals (a page firing twenty 403s) refreshes `me` once.
export const REFRESH_INTERVAL_MS = 5000;

const grants = (held, level) => held === "write" || (level === "read" && held === "read");

// What the logged-in user may do, from `GET /api/access/v2/me/`. Memory only: never a cookie, web storage or router
// state. The server is the authority; this keeps the UI honest. Status: `idle` (not asked yet) · `loading` ·
// `ready` (`me` loaded) · `absent` (no access module: every `can` is true, today's behaviour) · `error` (installed but
// `me` failed: every `can` is false until a retry loads it). Before the first answer (`idle`, `loading`) `can` is true
// for rendering only — the guard awaits `ensureLoaded()`, so no route is decided before `me` is known.
export const useAccessStore = defineStore("access", () => {
  const me = ref(null);
  const status = ref("idle");
  // The panel a deep link was refused for — Home names it once.
  const deniedPanel = ref(null);
  let inflight = null;
  let lastFetchAt = -Infinity;
  // Bumped by reset(): an answer that lands after a logout is dropped.
  let generation = 0;

  const loaded = computed(() => status.value === "ready" || status.value === "absent");
  const available = computed(() => status.value === "ready" || status.value === "error");
  const isStaff = computed(() => me.value?.user?.is_staff !== false);
  const managesAccess = computed(() => me.value?.manages_access === true);
  const gateMode = computed(() => me.value?.gate_mode ?? null);

  function can(area, level = "read") {
    if (me.value) return grants(me.value.permissions?.[area], level);
    return status.value !== "error";
  }

  const canAny = (areas = [], level = "read") => areas.some((area) => can(area, level));

  function settle(started, nextMe, nextStatus) {
    if (started !== generation) return;
    me.value = nextMe;
    status.value = nextStatus;
  }

  async function load() {
    const started = generation;
    const munin = useMuninStore();
    await munin.ensureLoaded();
    if (munin.loaded && !munin.isModuleInstalled(ACCESS_MODULE)) return settle(started, null, "absent");
    try {
      const { data } = await GET_Me();
      settle(started, data, "ready");
    } catch (err) {
      // A failed refresh keeps the `me` it had (a flaky network must not end a working session); a first load denies.
      if (me.value) return;
      // Without admin munin data (a customer token, munin down) a 404 is the only sign the module is not there.
      settle(started, null, isNotFound(err) && !munin.loaded ? "absent" : "error");
    }
  }

  // Single-flight: every caller waiting on one request gets the same promise.
  function fetchMe() {
    if (!inflight) {
      lastFetchAt = Date.now();
      // Only the first load shows as `loading`: a refresh keeps `me`, a retry keeps `error` until it lands.
      if (status.value === "idle") status.value = "loading";
      const started = generation;
      // A request a reset (or a forced refresh) outdated must not clear the newer one in flight.
      inflight = load().finally(() => {
        if (started === generation) inflight = null;
      });
    }
    return inflight;
  }

  const ensureLoaded = () => (loaded.value ? Promise.resolve() : fetchMe());

  // After a refusal: at most one `me` call per REFRESH_INTERVAL_MS, never without the module. `force` (the user's own
  // grants just changed) asks again now: an answer already on its way predates the change and is dropped.
  function refresh(force = false) {
    if (status.value === "absent") return Promise.resolve();
    if (force) {
      generation += 1;
      inflight = null;
      return fetchMe();
    }
    if (inflight || Date.now() - lastFetchAt < REFRESH_INTERVAL_MS) return inflight ?? Promise.resolve();
    return fetchMe();
  }

  function reset() {
    generation += 1;
    inflight = null;
    me.value = null;
    status.value = "idle";
    deniedPanel.value = null;
    lastFetchAt = -Infinity;
  }

  return {
    me,
    status,
    deniedPanel,
    loaded,
    available,
    isStaff,
    managesAccess,
    gateMode,
    can,
    canAny,
    ensureLoaded,
    refresh,
    reset,
  };
});
