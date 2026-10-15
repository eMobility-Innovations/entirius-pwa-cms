import { defineStore } from "pinia";
import { ref } from "vue";
import { GET_Memory, GET_ProfileStatus } from "@/api/enrichment/api";
import { t } from "@/i18n";

// The company profile's health for the shell (contract A4 § 2–§ 3): how complete the whole-company profile is (the
// "Communication profile" row of configuration health) and how many memory suggestions wait for the operator (the
// Memory nav badge). App.vue starts it while the enrichment module is on and the user can read `enrichment.profile`;
// the profile and memory pages refresh it after a change.
const POLL_MS = 60000;
const SUGGESTION_KINDS = ["rule_suggestion", "fact_suggestion"];
export const PROFILE_CHECK = "enrichment.profile";
export const PROFILE_ROUTE = "/enrichment/settings/profile";

const sectionName = (key) => {
  const path = `enrichment.profile.sections.${key}`;
  const name = t(path);
  return name === path ? key : name;
};

/** The configuration-health row of a profile status (null = not known); `scope` names the missing sections. */
export function profileHealthRow(status) {
  if (!status) return null;
  const missing = (status.sections || []).filter((s) => !s.complete).map((s) => sectionName(s.key));
  const state = status.complete ? "configured" : "incomplete";
  return { code: PROFILE_CHECK, state, severity: "low", scope: missing.join(", "), fix_url: PROFILE_ROUTE };
}

async function countSuggestions() {
  const answers = await Promise.all(
    SUGGESTION_KINDS.map((kind) => GET_Memory({ kind, status: "active", page_size: 1 }))
  );
  return answers.reduce((sum, { data }) => sum + (data.count || 0), 0);
}

export const useEnrichmentProfileStore = defineStore("enrichmentProfile", () => {
  const status = ref(null);
  const pendingSuggestions = ref(0);
  let timer = null;
  // Bumped by stop(): an answer that lands after logout is dropped.
  let session = 0;

  async function refresh() {
    const mine = session;
    try {
      const [{ data }, count] = await Promise.all([GET_ProfileStatus({ channel: "" }), countSuggestions()]);
      if (mine !== session) return;
      status.value = data;
      pendingSuggestions.value = count;
    } catch (err) {
      console.warn("Company profile status unavailable:", err.message || err);
    }
  }

  function start() {
    if (timer) return;
    refresh();
    timer = setInterval(refresh, POLL_MS);
  }

  function stop() {
    session += 1;
    clearInterval(timer);
    timer = null;
    status.value = null;
    pendingSuggestions.value = 0;
  }

  return { status, pendingSuggestions, refresh, start, stop };
});
