import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { GET_ConfigHealth, POST_ConfigHealthCheck } from "@/api/munin/api";
import { useMuninStore } from "@/stores/munin";

// Configuration health (django-munin `health/`): state, not events — nothing to mark read; a fixed config clears
// on the next poll. A bad → good flip keeps `justFixed` for FIXED_MS so the header can say "fixed" before it hides.
// A live probe (SMTP login …) runs only on "Check again": its failures stay until the next "Check again", because a
// plain poll never repeats the probe and must not read its absence as "fixed".
const POLL_MS = 30000;
const FIXED_MS = 10000;
// `disabled` = AI_TOOLBOX_ENABLED off on purpose: healthy, shown, never a warning.
const QUIET_STATES = ["configured", "disabled"];
// The toolbox states in which an AI action cannot work at all; `unreachable` may recover, so it only warns.
const AI_BLOCKED_STATES = ["disabled", "unconfigured"];
const TOOLBOX_CODE = "toolbox.status";

export const useConfigHealthStore = defineStore("configHealth", () => {
  const munin = useMuninStore();
  const checks = ref([]);
  const checkedAt = ref(null);
  const justFixed = ref(false);
  const checking = ref(false);
  // Opened from the header icon (while something fails) or the user menu (always — the green state on demand).
  const panelOpen = ref(false);
  const probeRows = ref([]);
  let timer = null;
  let fixedTimer = null;
  // Bumped by stop(): a response that lands after logout belongs to the old session and is dropped.
  let session = 0;

  const failing = computed(() =>
    checks.value.filter((row) => !QUIET_STATES.includes(row.state))
  );
  const passing = computed(() =>
    checks.value.filter((row) => QUIET_STATES.includes(row.state))
  );

  // "" = not reported (check absent on this backend), else the worst row's state for that code.
  function stateOf(code) {
    const rows = checks.value.filter((row) => row.code === code);
    if (!rows.length) return "";
    return (
      rows.find((row) => row.state !== "configured")?.state || "configured"
    );
  }

  function failingFor(code) {
    return failing.value.filter((row) => row.code === code);
  }

  // The AI toolbox state every AI action follows: the health row first; without one (health is read only with
  // `munin.config`, or it is unavailable) the public registry's `platform.toolbox.state`. "" = nobody reports it.
  const aiState = computed(
    () => stateOf(TOOLBOX_CODE) || munin.platform?.toolbox?.state || ""
  );
  const aiUsable = computed(() => !AI_BLOCKED_STATES.includes(aiState.value));

  function apply(data, fromProbe) {
    const wasFailing = failing.value.length > 0;
    const rows = data.checks || [];
    if (fromProbe) probeRows.value = rows.filter((row) => row.probe);
    checks.value = withProbeRows(rows);
    checkedAt.value = data.checked_at || null;
    if (wasFailing && !failing.value.length) flashFixed();
  }

  // The last probe failures over a poll's rows: they replace the green row of their code, never duplicate a row.
  function withProbeRows(rows) {
    const key = (row) => `${row.code}:${row.scope}`;
    const extra = probeRows.value.filter(
      (probe) => !rows.some((row) => key(row) === key(probe))
    );
    const codes = new Set(extra.map((row) => row.code));
    return [
      ...rows.filter(
        (row) => !(row.state === "configured" && codes.has(row.code))
      ),
      ...extra,
    ];
  }

  function flashFixed() {
    justFixed.value = true;
    clearTimeout(fixedTimer);
    fixedTimer = setTimeout(() => (justFixed.value = false), FIXED_MS);
  }

  async function poll() {
    if (document.visibilityState !== "visible") return;
    const mine = session;
    try {
      const { data } = await GET_ConfigHealth();
      if (mine === session) apply(data, false);
    } catch (err) {
      console.warn("Configuration health unavailable:", err.message || err);
    }
  }

  // "Check again": config checks plus the live probes (SMTP login …), each cached 60 s by its module.
  async function recheck() {
    checking.value = true;
    const mine = session;
    try {
      const { data } = await POST_ConfigHealthCheck();
      if (mine === session) apply(data, true);
    } catch (err) {
      console.warn("Configuration health unavailable:", err.message || err);
    } finally {
      checking.value = false;
    }
  }

  // A tab coming back to the foreground polls at once instead of waiting up to POLL_MS.
  function start() {
    if (timer) return;
    poll();
    timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
  }

  function stop() {
    session += 1;
    clearInterval(timer);
    clearTimeout(fixedTimer);
    document.removeEventListener("visibilitychange", poll);
    timer = null;
    justFixed.value = false;
    probeRows.value = [];
    checks.value = [];
    checkedAt.value = null;
    panelOpen.value = false;
  }

  return {
    checks,
    checkedAt,
    justFixed,
    checking,
    panelOpen,
    failing,
    passing,
    stateOf,
    failingFor,
    aiState,
    aiUsable,
    poll,
    recheck,
    start,
    stop,
  };
});
